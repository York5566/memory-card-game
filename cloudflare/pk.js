import { sanitize } from '../public/js/core.js';
import { imageIds, readLimited, decodeProfile, LIMITS, sha256 } from '../public/js/profile-format.js';
import { PK, nickname, makeRoom, advanceRoom, readyRoom, flipRoom, finishRoom, roomView, nextDeadline } from '../public/js/pk-rules.js';

export const PK_QUOTA = Object.freeze({ sessions: 400, rooms: 200, actions: 12000, activeRooms: 20, activeSessions: 64, perIP: 30, assets: 3, messages: 900 });
const DAY = 86400000, TTL = 20 * 60000;
const hash = s => sha256(new TextEncoder().encode(s));
const token = () => [...crypto.getRandomValues(new Uint8Array(24))].map(n => n.toString(16).padStart(2, '0')).join('');
const validID = id => typeof id === 'string' && /^[a-f0-9]{48}$/.test(id);
const fail = code => { throw new Error(code); };
const json = (value, status = 200) => Response.json(value, { status });

export async function handlePK(request, env, { verify, ipKey }) {
  const origin = request.headers.get('Origin'), allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (!origin || !allowed.includes(origin)) return json({ error: 'origin' }, 403);
  Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Turnstile-Token, Authorization', 'Access-Control-Max-Age': '86400' });
  try {
    const path = new URL(request.url).pathname;
    if (!['/api/pk/session', '/api/pk/socket', '/api/pk/assets'].includes(path)) fail('missing');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== (path.endsWith('/socket') ? 'GET' : 'POST')) fail('invalid');
    if (env.PK_ENABLED !== 'true' || !env.PK_ARENA || !env.PK_RATE_LIMITER || !env.TURNSTILE_SECRET || !env.IP_HASH_SECRET) fail('unavailable');
    const ip = await ipKey(env, request, Math.floor(Date.now() / DAY));
    if (!(await env.PK_RATE_LIMITER.limit({ key: ip })).success) fail('rate');
    const internalHeaders = new Headers();
    let body;
    if (path === '/api/pk/session' && request.method === 'POST') {
      await verify(env, request, 'pk');
      const input = JSON.parse(new TextDecoder().decode(await readLimited(request.body, 512)));
      body = JSON.stringify({ name: nickname(input.name), ip });
    } else {
      const bearer = path.endsWith('/socket')
        ? (request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map(s => s.trim()).find(s => s.startsWith('session.'))?.slice(8)
        : request.headers.get('Authorization')?.replace(/^Bearer /, '');
      if (!validID(bearer)) fail('auth');
      internalHeaders.set('X-Session', await hash(bearer));
      if (path.endsWith('/socket')) {
        if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') fail('invalid');
        internalHeaders.set('Upgrade', 'websocket');
      } else {
        if (request.method !== 'POST') fail('invalid');
        body = await readLimited(request.body, 256);
      }
    }
    const stub = env.PK_ARENA.get(env.PK_ARENA.idFromName('arena-v1'));
    const response = await stub.fetch(new Request('https://pk.internal' + path, { method: request.method, headers: internalHeaders, body }));
    if (response.status === 101) return response;
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...headers } });
  } catch (error) {
    const known = ['rate', 'invalid', 'auth', 'missing', 'unavailable'].includes(error.message);
    return new Response(JSON.stringify({ error: known ? error.message : 'unavailable' }), { status: error.message === 'rate' ? 429 : error.message === 'auth' ? 403 : 503, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
}

// One bounded coordinator makes queue removal, fallback and matching atomic.
// Only deadline alarms are used: idle WebSockets can hibernate.
export class PKArena {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.sessions = new Map(await ctx.storage.list({ prefix: 's:', limit: 100 }));
      this.rooms = new Map(await ctx.storage.list({ prefix: 'r:', limit: 40 }));
      this.ledger = await ctx.storage.get('ledger') || { day: -1, sessions: 0, rooms: 0, ips: {} };
    });
  }
  run(fn) { return this.ctx.blockConcurrencyWhile(fn); }
  putSession(sid, value) { this.sessions.set('s:' + sid, value); return this.ctx.storage.put('s:' + sid, value); }
  putRoom(id, value) { this.rooms.set('r:' + id, value); return this.ctx.storage.put('r:' + id, value); }
  sockets(sid) { return this.ctx.getWebSockets(sid).filter(ws => ws.readyState === 1); }
  send(sid, data) { for (const ws of this.sockets(sid)) try { ws.send(JSON.stringify(data)); } catch { /* close event handles disconnect */ } }
  broadcast(id, sound) {
    const room = this.rooms.get('r:' + id); if (!room) return;
    room.players.forEach((p, seat) => { if (p) this.send(p.sid, { type: 'room', id, view: roomView(room, seat, Date.now()), assets: Boolean(room.assetKey), sound }); });
  }
  async schedule() {
    const deadlines = [...this.rooms.values()].map(nextDeadline);
    for (const s of this.sessions.values()) { deadlines.push(s.expires); if (s.queueAt) deadlines.push(s.queueAt + PK.waitMs); }
    if (deadlines.length) {
      const time = Math.max(Date.now() + 50, Math.min(...deadlines));
      const previous = await this.ctx.storage.getAlarm();
      if (!previous || Math.abs(previous - time) > 50) await this.ctx.storage.setAlarm(time);
    } else await this.ctx.storage.deleteAlarm();
  }
  async sweep(now = Date.now()) {
    for (const [key, room] of this.rooms) {
      if (room.state === 'ended' && now >= room.expiresAt) {
        this.rooms.delete(key); await this.ctx.storage.delete(key);
        for (const p of room.players) if (p) {
          const s = this.sessions.get('s:' + p.sid);
          if (s?.room === key.slice(2)) { s.room = null; await this.putSession(p.sid, s); this.send(p.sid, { type: 'idle' }); }
        }
      } else if (advanceRoom(room, now)) { await this.putRoom(key.slice(2), room); this.broadcast(key.slice(2)); }
    }
    for (const [key, s] of this.sessions) {
      const sid = key.slice(2);
      if (now >= s.expires) {
        await this.leave(sid, s, now);
        for (const ws of this.sockets(sid)) ws.close(1000, 'expired');
        this.sessions.delete(key); await this.ctx.storage.delete(key); continue;
      }
      if (s.queueAt && now >= s.queueAt + PK.waitMs) {
        s.queueAt = 0; s.fallback = true; await this.putSession(sid, s);
        this.send(sid, { type: 'fallback' });
      }
    }
  }
  async leave(sid, s, now) {
    s.queueAt = 0; s.fallback = false; s.released = true;
    if (s.room) {
      const room = this.rooms.get('r:' + s.room);
      if (room && room.state !== 'ended') {
        const seat = room.players.findIndex(p => p?.sid === sid);
        finishRoom(room, now, 'left', room.players[1 - seat] ? 1 - seat : null);
        await this.putRoom(s.room, room); this.broadcast(s.room);
      }
    }
    s.room = null; s.source = null; await this.putSession(sid, s);
  }
  async fetch(request) {
    return this.run(async () => {
      try {
        const now = Date.now(), path = new URL(request.url).pathname;
        await this.sweep(now);
        if (path.endsWith('/session')) {
          const { name, ip } = await request.json();
          if (this.ledger.day !== Math.floor(now / DAY)) this.ledger = { day: Math.floor(now / DAY), sessions: 0, rooms: 0, ips: {} };
          if (this.sessions.size >= PK_QUOTA.activeSessions || this.ledger.sessions >= PK_QUOTA.sessions || (this.ledger.ips[ip] || 0) >= PK_QUOTA.perIP) fail('capacity');
          const secret = token(), sid = await hash(secret);
          this.ledger.sessions++; this.ledger.ips[ip] = (this.ledger.ips[ip] || 0) + 1;
          await this.ctx.storage.put('ledger', this.ledger);
          await this.putSession(sid, { name, ip, expires: now + TTL, queueAt: 0, room: null, messages: 0, joins: 0, connects: 0 });
          await this.schedule(); return json({ token: secret, expires: now + TTL });
        }
        const sid = request.headers.get('X-Session'), s = this.sessions.get('s:' + sid);
        if (!s || s.expires <= now || s.released) fail('auth');
        if (path.endsWith('/socket')) {
          if (++s.connects > 8) fail('rate');
          await this.putSession(sid, s);
          for (const old of this.sockets(sid)) old.close(4001, 'replaced');
          const [client, server] = Object.values(new WebSocketPair());
          this.ctx.acceptWebSocket(server, [sid]); server.serializeAttachment({ sid, count: 0, second: 0 });
          if (s.room) {
            const room = this.rooms.get('r:' + s.room);
            if (room) {
              const seat = room.players.findIndex(p => p?.sid === sid);
              if (room.away[seat] && room.state !== 'ended') {
                room.turnEnd = Math.max(room.turnEnd, now + PK.turnMs);
                if (room.settleAt) room.settleAt = now + room.config.mismatchMs;
              }
              room.connected[seat] = true; room.away[seat] = 0; room.rev++;
              await this.putRoom(s.room, room); this.broadcast(s.room);
            }
          } else this.send(sid, s.fallback ? { type: 'fallback' } : s.queueAt ? { type: 'queue', until: s.queueAt + PK.waitMs, now } : { type: 'idle' });
          await this.schedule();
          return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'memory-pk' } });
        }
        const { room: id } = await request.json(), room = this.rooms.get('r:' + id);
        if (!room || s.room !== id || !room.players.some(p => p?.sid === sid) || !room.assetKey) fail('missing');
        s.downloads ||= {};
        if ((s.downloads[id] || 0) >= PK_QUOTA.assets) fail('rate');
        s.downloads[id] = (s.downloads[id] || 0) + 1; await this.putSession(sid, s);
        const object = await this.env.IMAGES.get(room.assetKey); if (!object) fail('images');
        return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream' } });
      } catch (error) { return json({ error: ['auth','rate','capacity','missing','images'].includes(error.message) ? error.message : 'unavailable' }, 503); }
    });
  }
  async source(input) {
    const config = sanitize(input?.config);
    if (input?.code) {
      if (!/^\d{12}$/.test(input.code)) fail('images');
      const now = Date.now();
      const row = await this.env.DB.prepare("UPDATE mg_profiles SET last_used_at=?,expires_at=? WHERE code=? AND status='ready' AND expires_at>? RETURNING object_key").bind(now, now + LIMITS.retentionDays * DAY, input.code, now).first();
      if (!row) fail('images');
      const object = await this.env.IMAGES.get(row.object_key); if (!object) fail('images');
      const profile = await decodeProfile(await readLimited(object.body, LIMITS.packageBytes));
      return { config: profile.config, assetKey: row.object_key };
    }
    if (imageIds(config).length) fail('images');
    return { config, assetKey: null };
  }
  async createRoom(sid, s, guestId, guest, now) {
    if (this.ledger.day !== Math.floor(now / DAY)) this.ledger = { day: Math.floor(now / DAY), sessions: 0, rooms: 0, ips: {} };
    if (this.rooms.size >= PK_QUOTA.activeRooms || this.ledger.rooms >= PK_QUOTA.rooms || (this.ledger.actions || 0) >= PK_QUOTA.actions * .75) fail('capacity');
    const id = token(), room = makeRoom(s.source.config, { sid, name: s.name }, now, () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
    room.assetKey = s.source.assetKey;
    if (guest) room.players[1] = { sid: guestId, name: guest.name };
    room.connected[1] = Boolean(guest);
    s.queueAt = 0; s.room = id; s.source = null;
    this.ledger.rooms++; await this.ctx.storage.put('ledger', this.ledger);
    await this.putRoom(id, room); await this.putSession(sid, s);
    if (guest) { guest.queueAt = 0; guest.room = id; guest.source = null; await this.putSession(guestId, guest); }
    this.broadcast(id);
  }
  async webSocketMessage(ws, raw) {
    return this.run(async () => {
      const attached = ws.deserializeAttachment(), sid = attached?.sid, s = this.sessions.get('s:' + sid);
      if (!s || !this.sockets(sid).includes(ws)) { ws.close(1008, 'session'); return; }
      const now = Date.now();
      // Authenticated actions only; protocol pings bypass this handler via auto response.
      if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > LIMITS.manifestBytes + 2048) { ws.close(1009, 'size'); return; }
      if (attached.second !== Math.floor(now / 1000)) { attached.second = Math.floor(now / 1000); attached.count = 0; }
      if (++attached.count > 6 || ++s.messages > PK_QUOTA.messages) { ws.close(1008, 'rate'); return; }
      ws.serializeAttachment(attached);
      try {
        await this.sweep(now);
        if (s.expires <= now) fail('auth');
        const data = JSON.parse(raw);
        if (this.ledger.day !== Math.floor(now / DAY)) this.ledger = { day: Math.floor(now / DAY), sessions: 0, rooms: 0, ips: {} };
        this.ledger.actions = (this.ledger.actions || 0) + 1;
        if (this.ledger.actions > PK_QUOTA.actions) { ws.close(1008, 'daily'); return; }
        await this.ctx.storage.put('ledger', this.ledger);
        if (['create', 'queue', 'join'].includes(data.type)) {
          if (s.released) fail('auth');
          if (s.room || s.queueAt || s.fallback) fail('busy');
          if (++s.joins > 10) fail('rate');
          if (data.type === 'join') {
            if (!validID(data.id)) fail('missing');
            const room = this.rooms.get('r:' + data.id);
            if (!room || room.state !== 'lobby' || room.players[1] || !room.connected[0]) fail('missing');
            room.players[1] = { sid, name: s.name }; room.connected[1] = true; room.rev++;
            s.room = data.id; await this.putRoom(data.id, room); this.broadcast(data.id);
          } else {
            s.source = await this.source(data.source);
            if (data.type === 'create') await this.createRoom(sid, s, null, null, now);
            else {
              const found = [...this.sessions].find(([key, other]) => key !== 's:' + sid && other.queueAt && now < other.queueAt + PK.waitMs && other.expires > now && this.sockets(key.slice(2)).length);
              if (found) await this.createRoom(found[0].slice(2), found[1], sid, s, now);
              else { s.queueAt = now; this.send(sid, { type: 'queue', until: now + PK.waitMs, now }); }
            }
          }
        } else if (data.type === 'leave') { await this.leave(sid, s, now); this.send(sid, { type: 'idle' }); }
        else if (data.type === 'fallback-ack') { if (!s.fallback || s.queueAt || s.room) fail('invalid'); s.fallback = false; s.source = null; s.released = true; this.send(sid, { type: 'released' }); }
        else if (['ready', 'flip'].includes(data.type)) {
          const room = this.rooms.get('r:' + s.room); if (!room) fail('missing');
          const seat = room.players.findIndex(p => p?.sid === sid);
          const sound = data.type === 'flip' ? flipRoom(room, seat, data.index, now, data.rev) : undefined;
          if (data.type === 'ready') readyRoom(room, seat, now);
          await this.putRoom(s.room, room); this.broadcast(s.room, sound);
        } else fail('invalid');
      } catch (error) {
        this.send(sid, { type: 'error', error: ['busy','missing','rate','images','capacity','auth','invalid'].includes(error.message) ? error.message : 'unavailable' });
      }
      await this.putSession(sid, s); await this.schedule();
    });
  }
  async disconnected(ws) {
    return this.run(async () => {
      const sid = ws.deserializeAttachment()?.sid, s = this.sessions.get('s:' + sid);
      if (!s || this.sockets(sid).some(other => other !== ws)) return;
      if (s.room) {
        const room = this.rooms.get('r:' + s.room);
        if (room && room.state !== 'ended') {
          const seat = room.players.findIndex(p => p?.sid === sid); room.connected[seat] = false; room.away[seat] = Date.now(); room.rev++;
          await this.putRoom(s.room, room); this.broadcast(s.room);
        }
      } else if (s.released) { this.sessions.delete('s:' + sid); await this.ctx.storage.delete('s:' + sid); }
      // Keep a briefly disconnected queue entry until its original deadline.
      // Matching only considers live sockets; reconnect resumes that same wait.
      await this.schedule();
    });
  }
  webSocketClose(ws) { return this.disconnected(ws); }
  webSocketError(ws) { return this.disconnected(ws); }
  alarm() { return this.run(async () => { await this.sweep(); await this.schedule(); }); }
}
