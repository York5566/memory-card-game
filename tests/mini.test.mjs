import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsMini,validateMini,validatePack,answersMatch,puzzleStart,puzzleMove,puzzleSolved,growSequence,hitSpot,reactionBoard,makeRun,pauseRun,resumeRun,runRemaining} from '../public/js/mini-core.js';
import {partyConfig,partyRoom,partyJoin,partyAction,partyView,advanceParty} from '../public/js/party-rules.js';
import {toolMessages} from '../public/js/tools-text.js';
const items=[{label:'Cat',answer:'cat|kitten',image:'scene'},{label:'Dog',answer:'dog'}];
const config=(mode='draw')=>({mode,questions:[{prompt:'cat',answer:'cat|kitten'},{prompt:'dog',answer:'dog'}],seconds:30,rounds:2});
function room(mode='draw'){const r=partyRoom('ABCDEFGH','host','Host',config(mode),1000);partyJoin(r,'guest','Guest',1000);partyAction(r,'host',{type:'start'},1000);return r;}
test('七種遊戲設定的界限、壞檔與未知圖片來源都會驗證',()=>{for(const kind of ['puzzle','reveal','sequence','reaction','differences','charades','drawing']){const c=defaultsMini(kind,items);assert.deepEqual(validateMini(c),c);assert.throws(()=>validateMini({...c,grid:100}));assert.throws(()=>validateMini({...c,rotate:'yes'}));assert.throws(()=>validateMini({...c,kind:'unknown'}));assert.throws(()=>validateMini({...c,items:[{image:'https://other.test/x.png'}]}));}assert.throws(()=>validatePack({version:1,type:'game-materials',title:'',items:[]}));});
test('答案比對支援四語、全半形與別名，但空答案不能命中',()=>{assert.ok(answersMatch('ＣＡＴ','cat|kitten'));assert.ok(answersMatch('公 園！','遊樂場|公園'));assert.ok(answersMatch('고양이','고양이'));assert.ok(answersMatch('ねこ','猫|ねこ'));assert.ok(!answersMatch('',''));assert.ok(!answersMatch('dog','cat'));});
test('拼圖開始不直接完成、交換保持所有拼圖、旋轉必須還原',()=>{for(const size of [2,3,8])for(let i=0;i<15;i++){const p=puzzleStart(size,size,true);assert.ok(!puzzleSolved(p));const moved=puzzleMove(p,0,1);assert.deepEqual([...moved.tiles].sort((a,b)=>a-b),Array.from({length:size*size},(_,j)=>j));assert.equal(moved.moves,1);}const p={tiles:[1,0,2,3],angles:[0,0,0,0],moves:0};assert.ok(puzzleSolved(puzzleMove(p,0,1)));assert.ok(!puzzleSolved(puzzleMove(puzzleMove(p,0,1),0,0,true)));});
test('順序、反應格與差異命中維持合法範圍',()=>{let s=[];for(let i=0;i<70;i++)s=growSequence(s,8);assert.equal(s.length,70);assert.ok(s.every(n=>n>=0&&n<8));for(let size=2;size<=8;size++){const r=reactionBoard(size,'numbers');assert.equal(new Set(r.values).size,size*size);}const spots=[{x:50,y:50,r:5}];assert.equal(hitSpot(spots,53,52),0);assert.equal(hitSpot(spots,70,50),-1);assert.equal(hitSpot(spots,50,50,[0]),-1);});
test('暫停的倒數不會在背景耗盡，恢復接續剩餘時間',()=>{const r=makeRun({seconds:10},1000);pauseRun(r,3000);assert.equal(runRemaining(r,99999),8000);resumeRun(r,50000);assert.equal(runRemaining(r,52000),6000);assert.equal(runRemaining(r,60000),0);assert.equal(runRemaining(makeRun({seconds:0},1)),null);});
test('房間只接受有限題目與規則，限制筆畫與任意外部圖片',()=>{assert.throws(()=>partyConfig({...config(),seconds:0}));assert.throws(()=>partyConfig({...config(),questions:Array(31).fill({prompt:'x'})}));const r=room();assert.throws(()=>partyAction(r,'host',{type:'stroke',round:0,stroke:{color:'#000000',width:5,points:[[1200,0]]}},1200));assert.equal(partyConfig({...config(),questions:[{prompt:'x',image:'https://bad.test'}]}).questions[0].image,'');});
test('猜圖只有畫家收到題目，答對記分且不洩露他人猜中的文字',()=>{const r=room();assert.equal(partyView(r,'guest',1000).prompt,'');assert.equal(partyView(r,'guest',1000).answer,undefined);assert.equal(partyView(r,'host',1000).prompt,'cat');partyAction(r,'guest',{type:'guess',round:0,text:'kitten'},2000);assert.equal(r.members[1].score,2);assert.equal(r.phase,'reveal');assert.equal(r.guesses[0].text,undefined);assert.throws(()=>partyAction(r,'guest',{type:'guess',round:0,text:'cat'},2000));});
test('只有主持人開始揭曉與換題，舊回合封包不改變新局',()=>{const r=room();assert.throws(()=>partyAction(r,'guest',{type:'reveal'},2000));partyAction(r,'host',{type:'reveal'},2000);partyAction(r,'host',{type:'next'},2000);assert.equal(r.round,1);assert.throws(()=>partyAction(r,'guest',{type:'stroke',round:0},2001));assert.equal(r.members[0].score,0);});
test('手機作答送出後鎖定，揭曉前其他玩家看不到答案',()=>{const r=partyRoom('ABCDEFGH','host','Host',config('quiz'),1000);partyJoin(r,'a','A',1000);partyJoin(r,'b','B',1000);partyAction(r,'host',{type:'start'},1000);partyAction(r,'a',{type:'answer',round:0,text:'CAT'},1100);assert.equal(partyView(r,'b').answers,undefined);assert.equal(partyView(r,'b').answer,undefined);assert.throws(()=>partyAction(r,'a',{type:'answer',round:0,text:'dog'},1200));partyAction(r,'host',{type:'reveal'},1500);assert.equal(r.members[1].score,1);assert.throws(()=>partyAction(r,'host',{type:'reveal'},1600));assert.equal(r.members[1].score,1);});
test('搶答依抵達順序，主持人不能替未搶答者或重複加分',()=>{const r=room('buzzer');partyAction(r,'guest',{type:'buzz',round:0},1100);assert.throws(()=>partyAction(r,'guest',{type:'buzz',round:0},1200));assert.throws(()=>partyAction(r,'host',{type:'award',sid:'host',correct:true},1200));partyAction(r,'host',{type:'award',sid:'guest',correct:true},1300);assert.equal(r.members[1].score,1);assert.throws(()=>partyAction(r,'host',{type:'award',sid:'guest',correct:true},1400));});
test('畫圖接龍只給下一位上一段內容，全部完成才公開整條鏈',()=>{const r=room('telephone');assert.equal(partyView(r,'host').chains,undefined);assert.equal(partyView(r,'host').previous.text,'cat');assert.equal(partyView(r,'guest').previous.text,'dog');const drawing=[{color:'#000000',width:5,points:[[0,0],[100,100]]}];partyAction(r,'host',{type:'submit',round:0,drawing},1200);partyAction(r,'guest',{type:'submit',round:0,drawing},1300);assert.equal(r.round,1);assert.ok(partyView(r,'host').previous.drawing);partyAction(r,'host',{type:'submit',round:1,text:'my guess'},1400);partyAction(r,'guest',{type:'submit',round:1,text:'other guess'},1500);assert.equal(r.phase,'finished');assert.equal(partyView(r,'guest').chains.length,2);assert.equal(r.chains[0].steps[1].text,'other guess');});
test('超時揭曉、離房與斷線期限都有可恢復或結束的狀態',()=>{const r=room('quiz');assert.ok(advanceParty(r,31001));assert.equal(r.phase,'reveal');const d=room();d.members[1].offline=1000;advanceParty(d,92000);assert.equal(d.phase,'ended');const p=room('telephone');advanceParty(p,31001);assert.equal(p.round,1);assert.equal(p.chains[0].steps[0].missed,true);partyAction(p,'host',{type:'leave'},32000);assert.equal(p.phase,'ended');});
test('新遊戲文案四語及插值完整，總目錄包含所有新入口',async()=>{const {TOOL_CATALOG}=await import('../public/js/tool-catalog.js');assert.equal(TOOL_CATALOG.length,23);for(const[key,v]of Object.entries(toolMessages)){assert.equal(v.length,4,key);for(const s of v){assert.ok(s,key);assert.deepEqual([...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...v[0].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),key);}}});
test('手機題目與搶答沿用題目配分與答錯扣分，未作答不扣分',()=>{
 for(const mode of ['quiz','buzzer']){
  const r=partyRoom('ABCDEFGH','host','Host',{...config(mode),questions:[{prompt:'cat',answer:'cat',points:9}],wrongPenalty:3},1000);
  for(const sid of ['a','b','c'])partyJoin(r,sid,sid,1000);
  partyAction(r,'host',{type:'start'},1000);
  if(mode==='quiz'){
   partyAction(r,'a',{type:'answer',round:0,text:'cat'},1100);
   partyAction(r,'b',{type:'answer',round:0,text:'dog'},1100);
   partyAction(r,'host',{type:'reveal'},1200);
  }else{
   for(const sid of ['a','b'])partyAction(r,sid,{type:'buzz',round:0},1100);
   partyAction(r,'host',{type:'award',sid:'a',correct:true},1200);
   partyAction(r,'host',{type:'award',sid:'b',correct:false},1200);
   assert.deepEqual(partyView(r,'a').awarded,['a','b']);
  }
  assert.deepEqual(r.members.map(m=>m.score),[0,9,-3,0]);
 }
});
