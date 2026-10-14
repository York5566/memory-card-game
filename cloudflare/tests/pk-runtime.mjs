import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { arenaRuntime } from './pk-harness.mjs';
import { defaults } from '../../public/js/core.js';
import { encodeProfile, decodeProfile, sha256 } from '../../public/js/profile-format.js';
const origin='https://wwwne1198.party', mf=await arenaRuntime();
let ips=1;const sockets=[];
const api=(path,body,headers={})=>mf.dispatchFetch('https://api.local/api/pk/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Turnstile-Token':'pk','CF-Connecting-IP':'192.0.2.'+ips++,...headers},body:JSON.stringify(body)});
async function socket(session) {
  const res=await mf.dispatchFetch('https://api.local/api/pk/socket',{headers:{Origin:origin,Upgrade:'websocket','Sec-WebSocket-Protocol':'memory-pk, session.'+session.token,'CF-Connecting-IP':'192.0.2.'+ips++}});
  if(res.status!==101) throw Error(await res.text());
  const ws=res.webSocket; ws.accept(); sockets.push(ws);
  const messages=[],waiters=[];
  ws.addEventListener('message',e=>{if(e.data==='pong')return;const data=JSON.parse(e.data);messages.push(data);for(const callback of [...waiters]) callback();});
  return {ws,messages,send:data=>ws.send(JSON.stringify(data)),next:predicate=>new Promise((resolve,reject)=>{
    let timer;const check=()=>{const index=messages.findIndex(predicate);if(index<0)return;clearTimeout(timer);waiters.splice(waiters.indexOf(check),1);resolve(messages.splice(index,1)[0]);};
    timer=setTimeout(()=>{waiters.splice(waiters.indexOf(check),1);reject(Error('Message timeout: '+JSON.stringify(messages)));},6000);waiters.push(check);check();
  })};
}
async function player(name) {const res=await api('session',{name});assert.equal(res.status,200,await res.clone().text());const session=await res.json();const p={...await socket(session),session};await p.next(x=>x.type==='idle');return p;}
const room=p=>p.next(x=>x.type==='room');
try {
  assert.equal((await api('session',{name:'blocked'},{Origin:'https://other.example'})).status,403);
  assert.notEqual((await api('session',{name:'blocked'},{'X-Turnstile-Token':'bad'})).status,200);
  const a=await player('Alice <script>'),b=await player('Bob');
  const config={...defaults(),pairs:2,previewSeconds:0};
  a.send({type:'create',source:{config}});const created=await room(a);assert.equal(created.view.state,'lobby');assert.ok(created.view.cards.every(x=>x===null));
  b.send({type:'join',id:created.id});const joined=await room(b);assert.equal(joined.view.players[0].name,'Alice <script>');assert.equal(joined.view.config.pairs,2);
  a.send({type:'ready'});b.send({type:'ready'});
  const av=await a.next(x=>x.type==='room'&&x.view.state==='playing'),bv=await b.next(x=>x.type==='room'&&x.view.state==='playing');
  assert.deepEqual(av.view.cards,bv.view.cards);assert.ok(av.view.cards.every(x=>x===null));
  const turn=av.view.turn, current=turn===0?a:b, other=turn===0?b:a;
  other.send({type:'flip',index:0,rev:av.view.rev});await other.next(x=>x.type==='room'&&x.view.state==='playing');
  current.send({type:'flip',index:0,rev:av.view.rev});const flipped=await current.next(x=>x.type==='room'&&x.view.open.length===1);
  assert.equal(flipped.view.cards.filter(Boolean).length,1);assert.equal(flipped.view.flips,1);assert.equal(flipped.view.cardOwners[0],turn);assert.equal(flipped.view.cardOwners.filter(x=>x!==null).length,1);
  const mirror=await other.next(x=>x.type==='room'&&x.view.open.length===1);assert.deepEqual(flipped.view.cards,mirror.view.cards);assert.deepEqual(flipped.view.cardOwners,mirror.view.cardOwners);
  current.ws.close(1000,'network');const disconnected=await other.next(x=>x.type==='room'&&!x.view.connected[turn]);assert.equal(disconnected.view.state,'playing');
  const reconnected=await socket(current.session);const restored=await room(reconnected);assert.equal(restored.view.flips,1);assert.equal(restored.view.cardOwners[0],turn);assert.ok(restored.view.connected.every(Boolean));
  reconnected.send({type:'leave'});const ended=await other.next(x=>x.type==='room'&&x.view.state==='ended');assert.equal(ended.view.winner,1-turn);
  console.log('PASS invite, shared settings, hidden deck, ready, wrong-turn rejection, flip sync, reconnect, leave result');

  const c=await player('Carol'),d=await player('Dan');
  c.send({type:'queue',source:{config}});await c.next(x=>x.type==='queue');
  d.send({type:'queue',source:{config:{...config,pairs:5}}});const matchedC=await room(c),matchedD=await room(d);
  assert.equal(matchedC.id,matchedD.id);assert.equal(matchedD.view.config.pairs,2);
  c.send({type:'leave'});await d.next(x=>x.type==='room'&&x.view.state==='ended');
  console.log('PASS atomic matchmaking uses first player settings');

  const r=await player('Replay host'),q=await player('Replay guest');
  r.send({type:'create',source:{config:{...config,timed:true,limitSeconds:5}}});const replay=await room(r);
  q.send({type:'join',id:replay.id});await room(q);r.send({type:'ready'});q.send({type:'ready'});
  await r.next(x=>x.type==='room'&&x.view.state==='playing');
  const result=await r.next(x=>x.type==='room'&&x.view.state==='ended');await q.next(x=>x.type==='room'&&x.view.state==='ended');
  assert.equal(result.view.canRematch,true);r.send({type:'rematch',round:1});
  const voted=await r.next(x=>x.type==='room'&&x.view.rematch[0]);assert.equal(voted.view.state,'ended');
  const notice=await q.next(x=>x.type==='room'&&x.view.rematch[0]);assert.equal(notice.view.rematch[1],false);
  q.send({type:'rematch',round:1});
  const replayR=await r.next(x=>x.type==='room'&&x.view.round===2),replayQ=await q.next(x=>x.type==='room'&&x.view.round===2);
  assert.equal(replayR.id,replay.id);assert.equal(replayQ.id,replay.id);assert.equal(replayR.view.state,'playing');
  assert.deepEqual(replayR.view.scores,[0,0]);assert.ok(replayR.view.cardOwners.every(x=>x===null));assert.deepEqual(replayR.view.players,replayQ.view.players);assert.ok(replayR.view.cards.every(x=>x===null));
  r.send({type:'rematch',round:1});const stale=await r.next(x=>x.type==='room'&&x.view.round===2);assert.equal(stale.view.state,'playing');
  await r.next(x=>x.type==='room'&&x.view.round===2&&x.view.state==='ended');await q.next(x=>x.type==='room'&&x.view.round===2&&x.view.state==='ended');
  q.ws.close(1000,'network');const away=await r.next(x=>x.type==='room'&&x.view.round===2&&!x.view.connected[1]);assert.equal(away.view.canRematch,false);
  const resumedQ=await socket(q.session);await room(resumedQ);await r.next(x=>x.type==='room'&&x.view.round===2&&x.view.canRematch);
  resumedQ.send({type:'leave'});const left=await r.next(x=>x.type==='room'&&x.view.round===2&&!x.view.canRematch);assert.equal(left.view.connected[1],false);assert.equal(left.view.rematchClosed,true);
  r.send({type:'rematch',round:2});assert.equal((await r.next(x=>x.type==='room'&&x.view.round===2)).view.state,'ended');
  r.send({type:'leave'});
  console.log('PASS two-party rematch, same room, reset scores, stale votes, result reconnect and departed opponent');

  const bytes=await readFile(new URL('../../tests/fixtures/alpha.webp',import.meta.url));const id=await sha256(bytes), custom=structuredClone(config);custom.back.upload=id;
  const packed=await encodeProfile(custom,()=>new Blob([bytes]));
  const save=await mf.dispatchFetch('https://api.local/api/settings',{method:'POST',headers:{Origin:origin,'X-Turnstile-Token':'save','X-Request-Id':crypto.randomUUID(),'X-Owner-Token':'e'.repeat(64),'Content-Type':'application/octet-stream'},body:packed});
  assert.equal(save.status,201,await save.clone().text());const receipt=await save.json();
  const e=await player('Eve'),f=await player('Finn');e.send({type:'create',source:{code:receipt.code}});const customRoom=await room(e);assert.equal(customRoom.assets,true);
  f.send({type:'join',id:customRoom.id});await room(f);
  const unauthorized=await api('assets',{room:customRoom.id},{Authorization:'Bearer '+c.session.token});assert.notEqual(unauthorized.status,200);
  const assets=await api('assets',{room:customRoom.id},{Authorization:'Bearer '+f.session.token});assert.equal(assets.status,200,await assets.clone().text());
  const decoded=await decodeProfile(new Uint8Array(await assets.arrayBuffer()));assert.equal(decoded.config.back.upload,id);assert.equal(decoded.images.length,1);
  for(let n=0;n<2;n++) assert.equal((await api('assets',{room:customRoom.id},{Authorization:'Bearer '+f.session.token})).status,200);
  assert.notEqual((await api('assets',{room:customRoom.id},{Authorization:'Bearer '+f.session.token})).status,200,'download allowance enforced');
  console.log('PASS custom image room, authorized cross-device download, outsider rejection');

  const g=await player('Grace');g.send({type:'queue',source:{config}});await g.next(x=>x.type==='queue');g.send({type:'leave'});await g.next(x=>x.type==='idle');
  let h=await player('Hal');h.send({type:'queue',source:{config}});const waiting=await h.next(x=>x.type==='queue');
  const reconnectSession=h.session;h.ws.close(1000,'network');
  h={...await socket(reconnectSession),session:reconnectSession};
  assert.equal((await h.next(x=>x.type==='queue')).until,waiting.until,'queue reconnect keeps the original deadline');
  assert.ok(waiting.until-waiting.since>=15000&&waiting.until-waiting.since<=30000);
  console.log('Waiting for random 15–30-second queue deadline…');
  const fallback=await new Promise((resolve,reject)=>{const limit=setTimeout(()=>reject(Error('fallback timeout')),35000);const check=setInterval(()=>{const index=h.messages.findIndex(x=>x.type==='fallback');if(index>=0){clearTimeout(limit);clearInterval(check);resolve(h.messages.splice(index,1)[0]);}},50);});
  assert.equal(fallback.type,'fallback');h.send({type:'fallback-ack'});await h.next(x=>x.type==='released');
  const i=await player('Ivy');i.send({type:'queue',source:{config}});await i.next(x=>x.type==='queue');i.send({type:'leave'});
  assert.ok(!h.messages.some(x=>x.type==='room'));assert.ok(!g.messages.some(x=>x.type==='fallback'));
  console.log('PASS cancellation, queue reconnect, deadline alarm, fallback removal and no late human pairing');
  for(const p of [e,f])p.send({type:'leave'});
} finally {for(const ws of sockets)try{ws.close();}catch{}await mf.dispose();}
