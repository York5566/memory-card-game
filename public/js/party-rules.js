import {answersMatch} from './mini-core.js';
export class PartyError extends Error{constructor(code='partyInvalid'){super(code);this.code=code;}}
const need=(v,c='partyInvalid')=>{if(!v)throw new PartyError(c);};
const str=(v,n)=>{need(typeof v==='string'&&v.trim().length>0&&v.length<=n);return v.trim();};
export function partyConfig(raw){
 need(raw&&['draw','telephone','quiz','buzzer'].includes(raw.mode));
 need(Array.isArray(raw.questions)&&raw.questions.length>=1&&raw.questions.length<=30);
 need(raw.questions.every(q=>q&&((q.points===undefined)||(Number.isInteger(q.points)&&q.points>=0&&q.points<=1000))));
 need(raw.wrongPenalty===undefined||(Number.isInteger(raw.wrongPenalty)&&raw.wrongPenalty>=0&&raw.wrongPenalty<=1000));
 const questions=raw.questions.map(q=>({points:q.points??1,prompt:str(q.prompt,300),answer:str(q.answer||q.prompt,300),image:typeof q.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(q.image)&&q.image.length<=18000?q.image:''}));
 need(Number.isInteger(raw.seconds)&&raw.seconds>=15&&raw.seconds<=300);
 need(Number.isInteger(raw.rounds)&&raw.rounds>=1&&raw.rounds<=30);
 need(JSON.stringify(questions).length<=110000,'partyCapacity');
 return {mode:raw.mode,questions,seconds:raw.seconds,rounds:raw.rounds,wrongPenalty:raw.wrongPenalty??0};
}
export function partyRoom(id,host,name,config,now=Date.now()){
 return {id,host,config:partyConfig(config),phase:'lobby',members:[{sid:host,name:str(name,30),score:0,offline:0}],round:0,version:0,created:now,expires:now+90*60000,deadline:0,strokes:[],guesses:[],solved:[],buzz:[],answers:{},awarded:[],chains:[],submitted:[],reason:''};
}
const member=(r,sid)=>r.members.find(p=>p.sid===sid);
const current=r=>r.config.questions[r.round%r.config.questions.length];
const artist=r=>r.members[r.round%r.members.length]?.sid;
const players=r=>['quiz','buzzer'].includes(r.config.mode)?r.members.filter(p=>p.sid!==r.host):r.members;
function resetRound(r,now){r.phase='playing';r.deadline=now+r.config.seconds*1000;r.strokes=[];r.guesses=[];r.solved=[];r.buzz=[];r.answers={};r.awarded=[];}
export function endParty(r,reason='partyEnded'){r.phase='ended';r.reason=reason;r.deadline=0;r.version++;}
export function partyJoin(r,sid,name,now=Date.now()){need(r.expires>now&&r.phase==='lobby','partyClosed');const p=member(r,sid);if(p)return;need(r.members.length<8,'partyFull');r.members.push({sid,name:str(name,30),score:0,offline:0});r.version++;}
export function cleanStroke(s){need(s&&/^#[a-fA-F0-9]{6}$/.test(s.color)&&Number.isFinite(s.width)&&s.width>=1&&s.width<=30&&Array.isArray(s.points)&&s.points.length>0&&s.points.length<=60);return {color:s.color,width:s.width,points:s.points.map(p=>{need(Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1000));return p.map(Math.round);})};}
function appendPhone(r,sid,payload){const pos=r.members.findIndex(p=>p.sid===sid),chain=(pos-r.round+r.members.length)%r.members.length;if(r.round%2===0)need(Array.isArray(payload.drawing)&&payload.drawing.length<=100);const value=r.round%2===0?{drawing:payload.drawing.map(cleanStroke)}:{text:str(payload.text,300)};if(value.drawing)need(value.drawing.length<=100);r.chains[chain].steps.push({by:member(r,sid).name,...value});r.submitted.push(sid);}
function phoneAdvance(r,now){r.round++;r.submitted=[];if(r.round>=r.members.length){r.phase='finished';r.deadline=0;}else r.deadline=now+r.config.seconds*1000;}
export function advanceParty(r,now=Date.now()){
 if(['ended','finished'].includes(r.phase))return false;
 if(now>=r.expires){endParty(r,'partyExpired');return true;}
 if(r.members.some(p=>p.offline&&now-p.offline>90000)){endParty(r,'partyDisconnectedEnd');return true;}
 if(r.phase==='playing'&&r.deadline<=now){if(r.config.mode==='telephone'){for(const p of r.members)if(!r.submitted.includes(p.sid)){const pos=r.members.indexOf(p),chain=(pos-r.round+r.members.length)%r.members.length;r.chains[chain].steps.push({by:p.name,missed:true});}phoneAdvance(r,now);}else revealParty(r);r.version++;return true;}return false;
}
function revealParty(r){r.phase='reveal';r.deadline=0;if(r.config.mode==='quiz'){for(const p of players(r)){if(Object.hasOwn(r.answers,p.sid))p.score+=answersMatch(r.answers[p.sid],current(r).answer)?current(r).points:-r.config.wrongPenalty;}}}
export function partyAction(r,sid,a,now=Date.now()){
 advanceParty(r,now);need(member(r,sid),'partyAuth');need(a&&typeof a.type==='string');if(a.type==='leave'){endParty(r,'partyLeft');return;}need(!['ended','finished'].includes(r.phase),'partyClosed');
 const host=sid===r.host;
 if(['start','next','reveal','end','kick','award'].includes(a.type))need(host,'partyHostOnly');
 if(a.type==='end'){endParty(r);return;}
 if(a.type==='kick'){need(r.phase==='lobby'&&a.sid!==sid);r.members=r.members.filter(p=>p.sid!==a.sid);r.version++;return;}
 if(a.type==='start'){need(r.phase==='lobby'&&r.members.length>=2,'partyNeedPlayers');resetRound(r,now);if(r.config.mode==='telephone'){r.chains=r.members.map((p,i)=>({seed:r.config.questions[i%r.config.questions.length].prompt,steps:[]}));r.submitted=[];}}
 else if(a.type==='next'){need(r.phase==='reveal');if(r.round+1>=r.config.rounds){r.phase='finished';r.deadline=0;}else{r.round++;resetRound(r,now);}}
 else if(a.type==='reveal'){need(r.phase==='playing'&&r.config.mode!=='telephone');revealParty(r);}
 else if(a.type==='award'){need(['reveal','playing'].includes(r.phase)&&r.config.mode==='buzzer'&&r.buzz[0]===a.sid&&!r.awarded.includes(a.sid));need(typeof a.correct==='boolean');member(r,a.sid).score+=a.correct?current(r).points:-r.config.wrongPenalty;r.awarded.push(a.sid);r.buzz.shift();}
 else {
  need(r.phase==='playing','partyWait');need(a.round===r.round,'partyStale');
  if(a.type==='stroke'){need(r.config.mode==='draw'&&sid===artist(r)&&r.strokes.length<160);r.strokes.push(cleanStroke(a.stroke));}
  else if(a.type==='clear'){need(r.config.mode==='draw'&&sid===artist(r));r.strokes=[];}
  else if(a.type==='guess'){need(r.config.mode==='draw'&&sid!==artist(r)&&!r.solved.includes(sid));const guess=str(a.text,120);if(answersMatch(guess,current(r).answer)){r.solved.push(sid);member(r,sid).score+=2;member(r,artist(r)).score++;r.guesses.push({name:member(r,sid).name,correct:true});if(r.solved.length===r.members.length-1)revealParty(r);}else r.guesses.push({name:member(r,sid).name,text:guess});r.guesses=r.guesses.slice(-20);}
  else if(a.type==='answer'){need(r.config.mode==='quiz'&&sid!==r.host&&!Object.hasOwn(r.answers,sid));r.answers[sid]=str(a.text,300);}
  else if(a.type==='buzz'){need(r.config.mode==='buzzer'&&sid!==r.host&&!r.buzz.includes(sid)&&!r.awarded.includes(sid));r.buzz.push(sid);}
  else if(a.type==='submit'){need(r.config.mode==='telephone'&&!r.submitted.includes(sid));need(r.round%2!==0||Array.isArray(a.drawing));appendPhone(r,sid,a);if(r.submitted.length===r.members.length)phoneAdvance(r,now);}
  else throw new PartyError();
 }
 r.version++;
}
export function partyView(r,sid,now=Date.now()){
 const me=member(r,sid);if(!me)return {id:r.id,phase:'ended',reason:'partyRemoved',serverNow:now,members:[],round:0,rounds:0};
 const host=sid===r.host,mode=r.config.mode,publicAnswer=['reveal','finished'].includes(r.phase),playing=r.phase==='playing';
 const v={id:r.id,host,me:sid,mode,phase:r.phase,round:r.round,rounds:mode==='telephone'?r.members.length:r.config.rounds,deadline:r.deadline,serverNow:now,version:r.version,expires:r.expires,reason:r.reason,members:r.members.map(p=>({...p,host:p.sid===r.host})),submitted:r.submitted.includes(sid),answered:Object.hasOwn(r.answers,sid),buzz:r.buzz};
 if(['draw','quiz','buzzer'].includes(mode)){const q=current(r);v.prompt=mode==='draw'?(sid===artist(r)||publicAnswer?q.prompt:''):q.prompt;v.image=mode==='draw'?'':q.image;if((host&&mode!=='draw')||publicAnswer)v.answer=q.answer;if(mode==='draw'){v.artist=artist(r);v.strokes=r.strokes;v.guesses=r.guesses;v.solved=r.solved.includes(sid);}if(mode==='quiz'){v.answerCount=Object.keys(r.answers).length;if(publicAnswer||host)v.answers=r.answers;}}
 if(mode==='telephone'&&playing){const i=(r.members.findIndex(p=>p.sid===sid)-r.round+r.members.length)%r.members.length,chain=r.chains[i];v.task=r.round%2===0?'draw':'describe';v.previous=chain.steps.at(-1)||{text:chain.seed};v.submittedCount=r.submitted.length;}
 if(['quiz','buzzer'].includes(mode)){v.points=current(r).points;v.wrongPenalty=r.config.wrongPenalty;}
 if(mode==='buzzer')v.awarded=r.awarded;
 if(mode==='telephone'&&r.phase==='finished')v.chains=r.chains;
 return v;
}
