import test from 'node:test';
import assert from 'node:assert/strict';
import { activityDefaults,validateActivity,initialScores,updateScore,initialTimer,controlTimer,tickTimer,formatDuration } from '../public/js/activity-core.js';
import { HANDOFF_KEY,saveHandoff,takeHandoff,validateHandoff,activityURL } from '../public/js/activity-handoff.js';
import { activityPage } from '../src/activity-pages.mjs';
import { toolText } from '../public/js/tools-text.js';
import { MAX_FILE_BYTES } from '../public/js/tools-core.js';
const code=expected=>error=>error.code===expected;
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const clock=(manual=false)=>({...activityDefaults('timer'),cycles:2,autoAdvance:!manual,phases:[{name:'Play',seconds:2},{name:'Break',seconds:3}]});
test('活動設定只接受合法數值和欄位，最大隊員設定可匯出再匯入',()=>{
 for(const kind of ['scoreboard','timer']){
  const c=activityDefaults(kind);assert.deepEqual(validateActivity(JSON.parse(JSON.stringify(c)),kind),c);
  assert.deepEqual(validateActivity({...c,unexpected:'ignored'},kind),c);
  for(const patch of [{version:2},{kind:'other'},{scale:161},{scale:NaN},{sound:'true'},{background:'red'},{title:'x'.repeat(81)}])assert.throws(()=>validateActivity({...c,...patch},kind));
 }
 const c=activityDefaults('scoreboard');c.teams=Array.from({length:50},(_,i)=>({name:'Team '+i,color:'#47715d',members:Array.from({length:10},()=> '名'.repeat(80))}));
 assert.ok(Buffer.byteLength(JSON.stringify(c,null,2))<MAX_FILE_BYTES);assert.deepEqual(validateActivity(c,'scoreboard'),c);
 for(const patch of [{step:0},{step:1001},{initial:-1},{target:-1},{teams:[]},{teams:[...c.teams,c.teams[0]]}])assert.throws(()=>validateActivity({...c,...patch},'scoreboard'));
 assert.throws(()=>validateActivity({...c,teams:[{name:'A',color:'#47715d',members:['A\nB']}]},'scoreboard'));
 for(const phases of [[],[{name:'x',seconds:0}],[{name:'x',seconds:86401}],Array.from({length:13},()=>({name:'x',seconds:1}))])assert.throws(()=>validateActivity({...activityDefaults('timer'),phases},'timer'));
});
test('比分更新不改其他隊伍或輸入，允許負分與極限值可控',()=>{
 const c=activityDefaults('scoreboard'),start=initialScores(c);
 assert.deepEqual(updateScore(c,start,1,8),[0,8]);assert.deepEqual(start,[0,0]);
 assert.throws(()=>updateScore(c,start,0,-1),code('negativeScore'));
 assert.deepEqual(updateScore({...c,allowNegative:true},start,0,-1000000),[-1000000,0]);
 for(const [index,value]of [[2,1],[0,1000001],[0,1.5],[0,NaN]])assert.throws(()=>updateScore(c,start,index,value),code('scoreRange'));
});
test('計時跨背景延遲仍正確推進階段與循環，完成後停在最後一階段',()=>{
 const c=clock();const running=controlTimer(c,initialTimer(c),'start',1000);
 assert.equal(tickTimer(c,running,2999).remaining,1);
 const second=tickTimer(c,running,3000);assert.equal(second.index,1);assert.equal(second.remaining,3000);
 const delayed=tickTimer(c,running,6500);assert.equal(delayed.index,0);assert.equal(delayed.cycle,1);assert.equal(delayed.remaining,1500);
 const finished=tickTimer(c,running,11000);assert.equal(finished.status,'finished');assert.equal(finished.remaining,0);assert.equal(finished.index,1);assert.equal(finished.cycle,1);
 assert.equal(tickTimer(c,running,1e10).status,'finished');
 const again=controlTimer(c,finished,'start',20000);assert.equal(again.deadline,22000);assert.equal(again.cycle,0);
});
test('手動換階段、暫停、加減時間與跳過階段保持主持人控制',()=>{
 const c=clock(true);let state=controlTimer(c,initialTimer(c),'start',1000);
 state=tickTimer(c,state,20000);assert.equal(state.status,'paused');assert.equal(state.index,1);assert.equal(state.remaining,3000);
 state=controlTimer(c,state,'start',20000);state=controlTimer(c,state,'pause',21000);assert.equal(state.remaining,2000);assert.equal(tickTimer(c,state,30000).remaining,2000);
 state=controlTimer(c,state,'adjust',30000,30);assert.equal(state.remaining,32000);
 state=controlTimer(c,state,'start',30000);assert.equal(state.deadline,62000);
 state=controlTimer(c,state,'next',31000);assert.equal(state.index,0);assert.equal(state.cycle,1);assert.equal(state.deadline,33000);
 state=controlTimer(c,state,'adjust',31000,-30);assert.equal(state.deadline,32000);
 state=controlTimer(c,state,'adjust',31000,86400);assert.equal(state.remaining,86400000);
 assert.deepEqual(controlTimer(c,state,'reset',31000),initialTimer(c));
 assert.throws(()=>controlTimer(c,state,'adjust',31000,1.5),code('durationError'));
 assert.equal(formatDuration(1),'00:01');assert.equal(formatDuration(3600000),'01:00:00');assert.equal(formatDuration(86400000),'24:00:00');
});
test('名單轉用保留同名參與者、僅供指定工具讀一次並限時過期',()=>{
 const s=storage(),payload={version:1,target:'groups',title:'Class',names:'Alex\nAlex\nB'};
 saveHandoff(s,payload,1000);assert.equal(takeHandoff(s,'picker',1000),null);assert.ok(s.getItem(HANDOFF_KEY));
 assert.deepEqual(takeHandoff(s,'groups',1000),payload);assert.equal(takeHandoff(s,'groups',1000),null);
 saveHandoff(s,payload,1000);assert.throws(()=>takeHandoff(s,'groups',7201001),code('transferError'));assert.equal(s.getItem(HANDOFF_KEY),null);
 s.setItem(HANDOFF_KEY,'broken');assert.throws(()=>takeHandoff(s,'groups',1000),code('transferError'));
 assert.throws(()=>saveHandoff({setItem(){throw Error('blocked');}},payload));
});
test('分組轉用保留隊名順序成員與顏色，不將名單放入網址',()=>{
 const p={version:1,target:'scoreboard',title:'Class',teams:[{name:'Red',color:'#FF0000',members:['A','B']},{name:'Blue',color:'#0000ff',members:['C','A']}]};
 assert.deepEqual(validateHandoff(p),p);const s=storage();saveHandoff(s,p);assert.deepEqual(takeHandoff(s,'scoreboard'),p);
 assert.throws(()=>validateHandoff({...p,teams:[{...p.teams[0],members:Array(501).fill('A')}]}));
 for(const lang of ['zh-Hant','en','ja','ko'])assert.equal(activityURL('scoreboard','/prefix/',lang),'/prefix/'+(lang==='zh-Hant'?'':lang+'/')+'tools/scoreboard/');
 assert.throws(()=>activityURL('bad'));
});
test('計分板與計時器四語可爬取操作說明，子目錄資產和跨工具連結正確',()=>{
 for(const lang of ['zh-Hant','en','ja','ko'])for(const kind of ['scoreboard','timer']){
 const base='/prefix/',localized=base+(lang==='zh-Hant'?'':lang+'/'),html=activityPage(kind,lang,base,localized);
 assert.equal((html.match(/<h1>/g)||[]).length,1);assert.ok(html.includes('href="'+localized+'privacy/"'));
 assert.ok(html.includes('src="'+base+'js/activity.js"'));assert.ok(html.includes(toolText(kind==='timer'?'timerExample':'boardExample',lang)));
 if(lang==='en'||lang==='ko')assert.ok(!/[\u3400-\u9fff]/.test(html),kind+lang);
 }
});
