import { sanitize, shuffle } from './core.js';

export const PK = Object.freeze({ waitMs: 25000, lobbyMs: 180000, reconnectMs: 30000, turnMs: 20000, maxGameMs: 600000, resultMs: 60000 });
export const nickname = value => String(value || '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 24) || 'Player';

export function makeRoom(config, player, now, random = Math.random) {
  const clean = sanitize(config);
  clean.limitSeconds = Math.min(600, clean.limitSeconds);
  const pool = shuffle(clean.products.filter(p => p.enabled), random).slice(0, clean.pairs);
  return { config: clean, players: [player, null], ready: [false, false], connected: [true, false], away: [0, 0],
    cards: shuffle(pool.flatMap(p => [p.id, p.id]), random), matched: [], open: [], scores: [0, 0], misses: [0, 0],
    state: 'lobby', turn: random() < .5 ? 0 : 1, createdAt: now, expiresAt: now + PK.lobbyMs, rev: 0,
    flips: 0, winner: null, reason: '', settleAt: 0, turnEnd: 0, startedAt: 0, endAt: 0 };
}
export function finishRoom(room, now, reason, winner) {
  if (room.state === 'ended') return false;
  room.state = 'ended'; room.reason = reason;
  room.winner = winner === undefined ? (room.scores[0] === room.scores[1] ? null : room.scores[0] > room.scores[1] ? 0 : 1) : winner;
  room.expiresAt = now + PK.resultMs; room.endedAt = now; room.rev++;
  return true;
}
export function advanceRoom(room, now) {
  if (room.state === 'ended') return false;
  for (let seat = 0; seat < 2; seat++) if (room.players[seat] && room.away[seat] && now >= room.away[seat] + PK.reconnectMs) {
    return finishRoom(room, now, 'disconnect', room.players[1 - seat] && room.connected[1 - seat] ? 1 - seat : null);
  }
  if (room.state === 'lobby') return now >= room.expiresAt ? finishRoom(room, now, 'expired', null) : false;
  if (now >= room.endAt) return finishRoom(room, now, 'time');
  if (room.away.some(Boolean)) return false;
  let changed = false;
  if (room.state === 'preview' && now >= room.startedAt) { room.state = 'playing'; changed = true; }
  if (room.state === 'playing' && room.settleAt && now >= room.settleAt) {
    room.open = []; room.turn = 1 - room.turn; room.turnEnd = room.settleAt + PK.turnMs; room.settleAt = 0; changed = true;
  }
  // Bounded catch-up after sleep. Two missed turns ends an abandoned game.
  for (let i = 0; i < 4 && room.state === 'playing' && !room.settleAt && now >= room.turnEnd; i++) {
    room.misses[room.turn]++;
    if (room.misses[room.turn] >= 2) return finishRoom(room, now, 'idle', 1 - room.turn);
    room.open = []; room.turn = 1 - room.turn; room.turnEnd += PK.turnMs; changed = true;
  }
  if (changed) room.rev++;
  return changed;
}
export function readyRoom(room, seat, now) {
  advanceRoom(room, now);
  if (room.state !== 'lobby' || !room.players[seat] || !room.players[1 - seat] || !room.connected.every(Boolean)) return false;
  room.ready[seat] = true; room.rev++;
  if (room.ready.every(Boolean)) {
    room.startedAt = now + room.config.previewSeconds * 1000;
    room.state = room.config.previewSeconds ? 'preview' : 'playing';
    room.turnEnd = room.startedAt + PK.turnMs;
    room.endAt = room.startedAt + (room.config.timed ? room.config.limitSeconds * 1000 : PK.maxGameMs);
    room.expiresAt = room.endAt + PK.resultMs;
  }
  return true;
}
export function flipRoom(room, seat, index, now, rev) {
  advanceRoom(room, now);
  if (room.state !== 'playing' || room.turn !== seat || rev !== room.rev || !room.connected.every(Boolean) ||
      room.settleAt || !Number.isInteger(index) || index < 0 || index >= room.cards.length || room.open.includes(index) || room.matched.includes(index)) return 'ignored';
  room.open.push(index); room.flips++; room.misses[seat] = 0; room.rev++;
  if (room.open.length === 1) return 'flip';
  if (room.cards[room.open[0]] === room.cards[index]) {
    room.matched.push(...room.open); room.open = []; room.scores[seat]++; room.turnEnd = now + PK.turnMs;
    if (room.matched.length === room.cards.length) { finishRoom(room, now, 'complete'); return 'win'; }
    return 'match';
  }
  room.settleAt = now + room.config.mismatchMs;
  return 'miss';
}
export function roomView(room, seat, now) {
  const revealAll = room.state === 'preview' || room.state === 'ended';
  return { state: room.state, seat, config: room.config, players: room.players.map(p => p ? { name: p.name } : null),
    ready: room.ready, connected: room.connected, scores: room.scores, turn: room.turn, rev: room.rev, flips: room.flips,
    cards: room.cards.map((id, i) => revealAll || room.open.includes(i) || room.matched.includes(i) ? id : null),
    matched: room.matched, open: room.open, settleAt: room.settleAt, turnEnd: room.turnEnd, startedAt: room.startedAt,
    endAt: room.endAt, expiresAt: room.expiresAt, winner: room.winner, reason: room.reason, now };
}
export function nextDeadline(room) {
  if (room.state === 'ended') return room.expiresAt;
  if (room.state === 'lobby') return Math.min(room.expiresAt, ...room.away.filter(Boolean).map(t => t + PK.reconnectMs));
  if (room.away.some(Boolean)) return Math.min(room.endAt, ...room.away.filter(Boolean).map(t => t + PK.reconnectMs));
  return Math.min(room.endAt, room.state === 'preview' ? room.startedAt : room.settleAt || room.turnEnd,
    ...room.away.filter(Boolean).map(t => t + PK.reconnectMs));
}

// The local opponent only learns from public observations, never from the hidden deck.
export class MemoryOpponent {
  constructor(random = Math.random) { this.random = random; this.memory = new Map(); }
  observe(view) {
    for (const [index, id] of view.cards.entries()) if (id && !view.matched.includes(index) && this.random() < .72) this.memory.set(index, id);
    for (const index of view.matched) this.memory.delete(index);
    while (this.memory.size > 12) this.memory.delete(this.memory.keys().next().value);
  }
  choose(view) {
    const available = view.cards.map((_, i) => i).filter(i => !view.matched.includes(i) && !view.open.includes(i));
    if (!available.length) return null;
    if (this.random() < .88) {
      if (view.open.length) {
        const value = view.cards[view.open[0]];
        const mate = available.find(i => this.memory.get(i) === value);
        if (mate !== undefined) return mate;
      } else {
        const pairs = new Map();
        for (const i of available) { const id = this.memory.get(i); if (!id) continue; if (pairs.has(id)) return i; pairs.set(id, i); }
      }
    }
    const unknown = available.filter(i => !this.memory.has(i));
    const choices = unknown.length && this.random() < .8 ? unknown : available;
    return choices[Math.floor(this.random() * choices.length)];
  }
}
