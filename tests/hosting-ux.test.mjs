import test from 'node:test';
import assert from 'node:assert/strict';
import {playDefaults,playRequiresRestart,makeBingo,initialTournament,tournamentMatches,recordMatch,initialQuiz,quizControl,jumpQuiz,awardQuiz,revokeQuizAward,quizScores,validatePlayState} from '../public/js/play-core.js';
import {audienceView} from '../public/js/presentation-core.js';
import {toolText} from '../public/js/tools-text.js';
test('hosting appearance changes preserve progress for each game',()=>{
 for(const kind of ['bingo','tournament','quiz']){
  const c=playDefaults(kind),next={...c,title:'New title',background:'#ffffff',accent:'#000000',scale:140,sound:true};
  assert.equal(playRequiresRestart(c,next),false);assert.equal(playRequiresRestart(c,structuredClone(c)),false);
 }
});
test('restart decisions distinguish safe rules from structural changes',()=>{
 const b=playDefaults('bingo');assert.equal(playRequiresRestart(b,{...b,diagonal:false,winLines:2}),false);
 for(const patch of [{size:3},{cardCount:5},{freeCenter:false},{items:b.items.slice().reverse()}])assert.equal(playRequiresRestart(b,{...b,...patch}),true);
 for(const kind of ['tournament','quiz']){const c=playDefaults(kind);const teams=c.teams.map((t,i)=>({...t,color:'#000000',members:['Member '+i]}));assert.equal(playRequiresRestart(c,{...c,teams}),false);teams[0].name='Changed';assert.equal(playRequiresRestart(c,{...c,teams}),true);}
 const t=playDefaults('tournament');assert.equal(playRequiresRestart(t,{...t,winPoints:10}),false);assert.equal(playRequiresRestart(t,{...t,format:'roundRobin'}),true);assert.equal(playRequiresRestart(t,{...t,seeding:'random'}),true);
 const q=playDefaults('quiz');assert.equal(playRequiresRestart(q,{...q,autoReveal:true}),false);assert.equal(playRequiresRestart(q,{...q,wrongPenalty:3}),true);assert.equal(playRequiresRestart(q,{...q,questions:q.questions.slice().reverse()}),true);
});
test('safe settings retain restorable cards, results and awards',()=>{
 const b=playDefaults('bingo'),bs=makeBingo(b);bs.called=[1,2,3];assert.deepEqual(validatePlayState({...b,diagonal:false,winLines:3},bs),bs);
 const t=playDefaults('tournament'),ts=recordMatch(t,initialTournament(t),'0-0',2,0);assert.deepEqual(validatePlayState({...t,title:'Final',winPoints:10},ts),ts);
 const q=playDefaults('quiz'),qs=awardQuiz(q,initialQuiz(q),0,true);assert.deepEqual(validatePlayState({...q,autoReveal:true},qs),qs);
});
test('resaving an unchanged earlier result keeps an already completed final',()=>{
 const c={...playDefaults('tournament'),teams:Array.from({length:8},(_,i)=>({name:'T'+i,color:'#47715d',members:[]}))};let s=initialTournament(c);
 while(true){const m=tournamentMatches(c,s).find(m=>m.ready&&!m.result);if(!m)break;s=recordMatch(c,s,m.id,2,1);}
 const unchanged=recordMatch(c,s,'0-0',2,1);assert.deepEqual(unchanged,s);assert.ok(unchanged.results['2-0']);
});
test('direct question navigation keeps awards and reveals, resets only a changed question',()=>{
 const c=playDefaults('quiz');let s=awardQuiz(c,initialQuiz(c),0,true);s=quizControl(c,s,'reveal',1000);s=quizControl(c,s,'start',1000);
 const same=jumpQuiz(c,s,0,2000);assert.equal(same.clock.remaining,29000);assert.equal(same.clock.deadline,31000);
 const next=jumpQuiz(c,s,2,2000);assert.equal(next.index,2);assert.equal(next.clock.status,'idle');assert.equal(next.clock.remaining,30000);assert.deepEqual(next.awards,s.awards);assert.deepEqual(next.revealed,[0]);
 assert.equal(quizControl(c,s,'previous',2000).clock.status,'running');assert.throws(()=>jumpQuiz(c,s,99,2000));
});
test('correcting an earlier team award leaves all other question and team scores intact',()=>{
 const c={...playDefaults('quiz'),wrongPenalty:2};let s=awardQuiz(c,initialQuiz(c),0,true);s=awardQuiz(c,s,1,true);s=jumpQuiz(c,s,1,0);s=awardQuiz(c,s,0,true);s=jumpQuiz(c,s,0,0);
 const corrected=awardQuiz(c,revokeQuizAward(s,0),0,false);
 assert.deepEqual(quizScores(c,corrected),[3,5]);assert.equal(corrected.awards.length,3);assert.deepEqual(validatePlayState(c,corrected),corrected);assert.deepEqual(quizScores(c,s),[10,5]);
});
test('directly selected unrevealed questions do not leak their answers to the audience',()=>{
 const c=playDefaults('quiz');c.questions[2].answer='PRIVATE';let s=jumpQuiz(c,initialQuiz(c),2,0);
 const T=(k,...v)=>toolText(k,'en',...v);assert.ok(!JSON.stringify(audienceView(c,s,T)).includes('PRIVATE'));s=quizControl(c,s,'reveal',0);assert.ok(JSON.stringify(audienceView(c,s,T)).includes('PRIVATE'));
});

