import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../public/js/core.js';
import { PK, makeRoom, readyRoom, flipRoom, advanceRoom, roomView, nextDeadline, MemoryOpponent, nickname } from '../public/js/pk-rules.js';

const start = (overrides = {}) => {
  const room = makeRoom({ ...defaults(), pairs: 2, previewSeconds: 0, ...overrides }, { name:'Alice' }, 1000, () => .1);
  room.players[1] = { name:'Bob' }; room.connected[1] = true;
  readyRoom(room, 0, 1000); readyRoom(room, 1, 1000); return room;
};
test('PK waits for two ready players, hides all unopened positions and has a random first turn', () => {
  const room = makeRoom(defaults(), { name: 'Alice' }, 1000, () => .9);
  assert.equal(readyRoom(room,0,1001),false);
  assert.ok(roomView(room,0,1001).cards.every(v=>v===null));
  room.players[1]={name:'Bob'};room.connected[1]=true;readyRoom(room,0,1001);
  assert.equal(room.state,'lobby');readyRoom(room,1,1002);assert.equal(room.state,'preview');assert.equal(room.turn,1);
  assert.ok(roomView(room,0,1002).cards.every(Boolean));advanceRoom(room,4002);
  assert.equal(room.state,'playing');assert.ok(roomView(room,0,4002).cards.every(v=>v===null));
});
test('PK rejects wrong turns, stale/double clicks and invalid indices; matching keeps the turn and determines a winner', () => {
  const room=start();const turn=room.turn;
  assert.equal(flipRoom(room,1-turn,0,1002,room.rev),'ignored');
  for(const index of [-1,100,1.5,NaN]) assert.equal(flipRoom(room,turn,index,1002,room.rev),'ignored');
  const rev=room.rev;assert.equal(flipRoom(room,turn,0,1002,rev),'flip');
  assert.equal(flipRoom(room,turn,1,1003,rev),'ignored');
  assert.equal(flipRoom(room,turn,0,1003,room.rev),'ignored');
  const mate=room.cards.findIndex((id,i)=>i!==0&&id===room.cards[0]);
  assert.equal(flipRoom(room,turn,mate,1004,room.rev),'match');assert.equal(room.turn,turn);assert.equal(room.scores[turn],1);
  const rest=room.cards.map((_,i)=>i).filter(i=>!room.matched.includes(i));
  flipRoom(room,turn,rest[0],1005,room.rev);assert.equal(flipRoom(room,turn,rest[1],1006,room.rev),'win');
  assert.equal(room.winner,turn);assert.equal(room.state,'ended');
});
test('PK mismatch shows both cards, then passes the turn; deadlines and disconnects terminate abandoned games', () => {
  const room=start();const turn=room.turn;
  flipRoom(room,turn,0,1010,room.rev);const miss=room.cards.findIndex(id=>id!==room.cards[0]);
  assert.equal(flipRoom(room,turn,miss,1020,room.rev),'miss');
  assert.equal(flipRoom(room,turn,2,1021,room.rev),'ignored');
  advanceRoom(room,1020+room.config.mismatchMs);assert.equal(room.turn,1-turn);assert.equal(room.open.length,0);
  advanceRoom(room,room.turnEnd+3*PK.turnMs);assert.equal(room.state,'ended');assert.equal(room.reason,'idle');
  const gone=start();gone.connected[0]=false;gone.away[0]=2000;advanceRoom(gone,2000+PK.reconnectMs);
  assert.equal(gone.state,'ended');assert.equal(gone.winner,1);assert.equal(gone.reason,'disconnect');
  assert.equal(nextDeadline(gone),gone.expiresAt,'ended rooms must not re-arm past disconnect alarms');
  const reconnecting=start();reconnecting.connected[0]=false;reconnecting.away[0]=2000;
  advanceRoom(reconnecting,25000);assert.equal(reconnecting.misses[0]+reconnecting.misses[1],0);
  assert.equal(nextDeadline(reconnecting),32000);
});
test('PK deadline takes precedence over a last click; settings are sanitized and never mutate the solo configuration', () => {
  const config=defaults();config.limitSeconds=3600; const room=makeRoom(config,{name:'a'},0);
  assert.equal(config.limitSeconds,3600);assert.equal(room.config.limitSeconds,600);
  const timed=start({timed:true,limitSeconds:5});
  assert.equal(flipRoom(timed,timed.turn,0,6000,timed.rev),'ignored');assert.equal(timed.state,'ended');assert.equal(timed.winner,null);
  assert.equal(nickname('\u202e\u0000 Alice '),'Alice');assert.equal(nickname('x'.repeat(50)).length,24);
});
test('local opponent learns only revealed observations, never receives the hidden deck, and picks valid cards', () => {
  const bot=new MemoryOpponent(()=>.1), room=start();
  let view=roomView(room,1,1000);bot.observe(view);assert.equal(bot.memory.size,0);
  const index=bot.choose(view);assert.ok(index>=0&&index<4);
  const turn=room.turn;flipRoom(room,turn,0,1010,room.rev);view=roomView(room,1,1010);bot.observe(view);
  assert.equal(bot.memory.size,1);assert.equal(bot.memory.get(0),room.cards[0]);assert.notEqual(bot.choose(view),0);
  for(let i=0;i<100;i++) {const choice=bot.choose(view);assert.ok(!view.open.includes(choice));assert.ok(!view.matched.includes(choice));}
});
