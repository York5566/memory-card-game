import test from 'node:test';
import assert from 'node:assert/strict';
import {fitPKBoard,roomEvents,matchedOwner,waitingCopy} from '../public/js/pk-presentation.js';
import {defaults} from '../public/js/core.js';
import {makeRoom,readyRoom,flipRoom,advanceRoom,roomView,finishRoom,requestRematch} from '../public/js/pk-rules.js';

test('PK auto fit enlarges twelve cards on desktop and keeps a phone board within its viewport',()=>{
 const desktop=fitPKBoard({width:1160,height:500,count:12});assert.ok(desktop.cardWidth>160);assert.ok(desktop.width<=1160);assert.ok(desktop.height<=500);
 for(const count of [4,12,24]) {const mobile=fitPKBoard({width:310,height:430,count});assert.ok(mobile.width<=310);if(count<=12)assert.ok(mobile.height<=430.001);assert.ok(mobile.cardWidth>=58);}
 const normal=fitPKBoard({width:1160,height:500,count:12}),large=fitPKBoard({width:1160,height:500,count:12,zoom:1.4});assert.equal(large.columns,normal.columns);assert.ok(large.cardWidth>normal.cardWidth);
});
test('PK scaling stays finite for narrow windows, custom ratios and fixed columns',()=>{
 for(const ratio of [.1,.8,1,10])for(const columns of [0,2,8]) {const x=fitPKBoard({width:100,height:100,count:24,ratio,columns});assert.ok(Number.isFinite(x.width));assert.ok(x.cardWidth>0);assert.ok(x.cardHeight>=64);}
});
test('boundary dimensions fit without rounding-induced overflow and repeated layout is deterministic',()=>{
 for(const width of [310,375,448,449,450,598,599,600,648,649,650,780,820,1160])for(const height of [340,380,430,500,710])for(const count of [4,12,24]) {
  const input={width,height,count,gap:14};const result=fitPKBoard(input);
  assert.deepEqual(result,fitPKBoard(input));
  if(result.cardWidth>58&&result.cardHeight>64) {assert.ok(result.width<=width+.001,JSON.stringify(input));assert.ok(result.height<=height+.001,JSON.stringify(input));}
 }
});
test('unmatched cards never retain a visible owner, including old server snapshots',()=>{
 const view={cardOwners:[0,1,0,1],matched:[2,3]};
 assert.equal(matchedOwner(view,0),null);assert.equal(matchedOwner(view,1),null);
 assert.equal(matchedOwner(view,2),0);assert.equal(matchedOwner(view,3),1);
 assert.equal(matchedOwner({...view,matched:[]},2),null);
 assert.equal(matchedOwner({matched:[0]},0),null);
});
test('invitation creation and joining do not show matchmaking copy',()=>{
 assert.match(waitingCopy('connecting','create')[0],/建立邀請/);
 assert.match(waitingCopy('connecting','join')[0],/朋友/);
 assert.equal(waitingCopy('connecting','')[0],'正在連線');
 for(const intent of ['create','join','queue',''])assert.ok(!waitingCopy('connecting',intent).join('').includes('尋找'));
 assert.equal(waitingCopy('queue','queue')[0],'正在尋找你的對手');
 assert.equal(waitingCopy('queue','queue')[2],'取消配對');
});
const snapshot=(extra={})=>({round:1,seat:0,state:'lobby',players:[{name:'a'},{name:'b'}],connected:[true,true],rematch:[false,false],turn:0,settleAt:0,...extra});
test('match, start and turn notices fire only on transitions rather than each flip or clock update',()=>{
 const waiting=snapshot({players:[{name:'a'},null]}),joined=snapshot();assert.deepEqual(roomEvents(waiting,joined),['found']);assert.deepEqual(roomEvents(joined,joined),[]);
 const preview=snapshot({state:'preview'});assert.deepEqual(roomEvents(joined,preview),['start']);
 const play=snapshot({state:'playing'});assert.deepEqual(roomEvents(preview,play),['your-turn']);assert.deepEqual(roomEvents(play,{...play,rev:3}),[]);
 assert.deepEqual(roomEvents(play,{...play,turn:1}),['their-turn']);
});
test('rematch, peer departure and temporary disconnect are distinguishable and do not repeat',()=>{
 const ended=snapshot({state:'ended'}),invited={...ended,rematch:[false,true]};assert.deepEqual(roomEvents(ended,invited),['rematch']);assert.deepEqual(roomEvents(invited,invited),[]);
 assert.deepEqual(roomEvents(ended,{...ended,connected:[true,false]}),['offline']);
 const left={...ended,connected:[true,false],rematchClosed:true};assert.deepEqual(roomEvents(ended,left),['left']);assert.deepEqual(roomEvents(left,left),[]);
 assert.deepEqual(roomEvents(invited,{...ended,round:2,state:'preview',rematch:[false,false]}),['start']);
});
test('card ownership is authoritative public history, survives turnover and resets on rematch without exposing card faces',()=>{
 const r=makeRoom({...defaults(),pairs:2,previewSeconds:0},{name:'a'},1000,()=>.1);r.players[1]={name:'b'};r.connected=[true,true];readyRoom(r,0,1000);readyRoom(r,1,1000);
 const a=r.turn,b=1-a;flipRoom(r,a,0,1001,r.rev);const wrong=r.cards.findIndex(id=>id!==r.cards[0]);flipRoom(r,a,wrong,1002,r.rev);advanceRoom(r,1002+r.config.mismatchMs);
 const v=roomView(r,b,1900);assert.equal(v.cardOwners[0],a);assert.ok(v.cards.every(id=>id===null));
 flipRoom(r,b,0,1900,r.rev);assert.equal(roomView(r,a,1900).cardOwners[0],b);const mate=r.cards.findIndex((id,i)=>i!==0&&id===r.cards[0]);flipRoom(r,b,mate,1901,r.rev);assert.equal(r.scores[b],1);assert.equal(r.cardOwners[mate],b);
 finishRoom(r,2000,'complete');requestRematch(r,0,2001,1);requestRematch(r,1,2002,1);assert.ok(r.cardOwners.every(v=>v===null));
 delete r.cardOwners;const old=roomView(r,0,2002);assert.equal(old.cardOwners.length,4);assert.ok(old.cardOwners.every(v=>v===null));
});
