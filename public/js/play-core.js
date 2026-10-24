import { ToolError, shuffle, randomInt } from './tools-core.js';
import { TEAM_COLORS, color } from './activity-core.js';
export const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export const shortText=(v,max=80)=>typeof v==='string'&&v.length<=max&&!/[\r\n]/.test(v);
export const imageData=v=>v===''||typeof v==='string'&&v.length<=300000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v);
export const PLAY_FILE_LIMIT=8000000;
export function playDefaults(kind){
 const common={version:1,kind,title:'',background:'#f0f5ec',accent:'#47715d',scale:100,sound:false};
 if(kind==='bingo')return {...common,size:5,freeCenter:true,winLines:1,diagonal:true,cardCount:4,items:Array.from({length:25},(_,i)=>({label:String(i+1),image:''}))};
 const teams=[0,1].map(i=>({name:'',color:TEAM_COLORS[i],members:[]}));
 if(kind==='tournament')return {...common,teams,format:'knockout',seeding:'ordered',winPoints:3,drawPoints:1,lossPoints:0};
 if(kind==='quiz')return {...common,teams,autoReveal:false,wrongPenalty:0,questions:[{prompt:'2 + 3 = ?',answer:'5',points:5,seconds:30,image:''},{prompt:'8 − 3 = ?',answer:'5',points:5,seconds:30,image:''},{prompt:'3 × 4 = ?',answer:'12',points:5,seconds:30,image:''}]};
 throw new ToolError('configError');
}
export function validTeams(teams,max=50){
 if(!Array.isArray(teams)||teams.length<1||teams.length>max)throw new ToolError('configError');let count=0;
 const result=teams.map(t=>{if(!t||!shortText(t.name)||!color(t.color)||!Array.isArray(t.members)||!t.members.every(n=>shortText(n)&&n.trim()))throw new ToolError('configError');count+=t.members.length;return {name:t.name,color:t.color,members:[...t.members]};});
 if(count>500)throw new ToolError('configError');return result;
}
export function validatePlay(raw,kind){
 const out=playDefaults(kind);if(!raw||raw.version!==1||raw.kind!==kind||!shortText(raw.title)||!color(raw.background)||!color(raw.accent)||!integer(raw.scale,70,160)||typeof raw.sound!=='boolean')throw new ToolError('configError');
 for(const k of ['title','background','accent','scale','sound'])out[k]=raw[k];
 if(kind==='bingo'){
  if(!integer(raw.size,3,5)||typeof raw.freeCenter!=='boolean'||typeof raw.diagonal!=='boolean'||!integer(raw.winLines,1,raw.size*2+(raw.diagonal?2:0))||!integer(raw.cardCount,1,30)||!Array.isArray(raw.items)||raw.items.length<1||raw.items.length>100)throw new ToolError('bingoRules');
  out.items=raw.items.map(i=>{if(!i||!shortText(i.label)||!i.label.trim()||!imageData(i.image))throw new ToolError('bingoRules');return {label:i.label.trim(),image:i.image};});
  if(new Set(out.items.map(i=>i.label)).size!==out.items.length)throw new ToolError('bingoDuplicate');
  for(const k of ['size','freeCenter','diagonal','winLines','cardCount'])out[k]=raw[k];
 }else if(kind==='tournament'){
  out.teams=validTeams(raw.teams,32);if(out.teams.length<2||!['knockout','roundRobin'].includes(raw.format)||!['ordered','random'].includes(raw.seeding)||!['winPoints','drawPoints','lossPoints'].every(k=>integer(raw[k],0,100)))throw new ToolError('tournamentRules');
  for(const k of ['format','seeding','winPoints','drawPoints','lossPoints'])out[k]=raw[k];
 }else{
  out.teams=validTeams(raw.teams,20);if(typeof raw.autoReveal!=='boolean'||!integer(raw.wrongPenalty,0,1000)||!Array.isArray(raw.questions)||raw.questions.length<1||raw.questions.length>50)throw new ToolError('quizRules');
  out.autoReveal=raw.autoReveal;out.wrongPenalty=raw.wrongPenalty;out.questions=raw.questions.map(q=>{if(!q||!shortText(q.prompt,300)||!q.prompt.trim()||!shortText(q.answer,500)||!integer(q.points,0,1000)||!integer(q.seconds,0,3600)||!imageData(q.image))throw new ToolError('quizRules');return {prompt:q.prompt,answer:q.answer,points:q.points,seconds:q.seconds,image:q.image};});
 }
 if(new TextEncoder().encode(JSON.stringify(out)).length>PLAY_FILE_LIMIT)throw new ToolError('largeActivity');return out;
}
export function makeBingo(config,rand=randomInt){
 const needed=config.size**2-(config.freeCenter&&config.size%2?1:0);if(config.items.length<needed)throw new ToolError('bingoNotEnough');
 const seen=new Set(),cards=[];for(let i=0;i<config.cardCount;i++){let card,key,attempt=0;do{card=shuffle(config.items.map((_,i)=>i),rand).slice(0,needed);if(needed<config.size**2)card.splice(Math.floor(config.size**2/2),0,-1);key=card.join(',');if(++attempt>500)throw new ToolError('bingoGenerate');}while(seen.has(key));seen.add(key);cards.push(card);}
 return {cards,called:[],selected:0};
}
export function bingoLines(config,card,called){const hits=new Set([-1,...called]),n=config.size,lines=[];for(let i=0;i<n;i++){lines.push(Array.from({length:n},(_,j)=>i*n+j));lines.push(Array.from({length:n},(_,j)=>j*n+i));}if(config.diagonal){lines.push(Array.from({length:n},(_,i)=>i*n+i));lines.push(Array.from({length:n},(_,i)=>i*n+n-1-i));}return lines.filter(line=>line.every(i=>hits.has(card[i])));}
export function callBingo(config,state,index=null,rand=randomInt){const available=config.items.map((_,i)=>i).filter(i=>!state.called.includes(i));if(!available.length)throw new ToolError('bingoFinished');const pick=index===null?available[rand(available.length)]:index;if(!available.includes(pick))throw new ToolError('bingoCalled');return {...state,called:[...state.called,pick]};}
export function initialTournament(config,rand=randomInt){const order=config.teams.map((_,i)=>i);return {order:config.seeding==='random'?shuffle(order,rand):order,results:{}};}
export function tournamentMatches(config,state){
 if(config.format==='roundRobin'){
  const list=[...state.order];if(list.length%2)list.push(null);const matches=[];
  for(let round=0;round<list.length-1;round++){for(let i=0;i<list.length/2;i++){const a=list[i],b=list[list.length-1-i];if(a!==null&&b!==null){const id=`${round}-${i}`;matches.push({id,round,a,b,ready:true,result:state.results[id]||null});}}list.splice(1,0,list.pop());}return matches;
 }
 let size=2;while(size<state.order.length)size*=2;let seeds=[1,2];for(let n=4;n<=size;n*=2)seeds=seeds.flatMap(seed=>[seed,n+1-seed]);
 let previous=seeds.map(seed=>({team:state.order[seed-1]??null,complete:true}));const matches=[];let round=0;
 while(previous.length>1){const next=[];for(let i=0;i<previous.length;i+=2){const left=previous[i],right=previous[i+1],a=left.team,b=right.team,id=`${round}-${i/2}`,ready=left.complete&&right.complete&&a!==null&&b!==null;
 const candidate=state.results[id],result=ready&&candidate?.a===a&&candidate?.b===b?candidate:null;
 const bye=left.complete&&right.complete&&(a===null||b===null),winner=bye?(a??b):result?(result.sa>result.sb?a:result.sa<result.sb?b:result.tie):null;
 matches.push({id,round,a,b,ready,bye,result,winner});next.push({team:winner,complete:bye||result!==null});}previous=next;round++;}return matches;
}
export function recordMatch(config,state,id,sa,sb,tie=null){
 const matches=tournamentMatches(config,state),match=matches.find(m=>m.id===id);if(!match?.ready||!integer(sa,0,1000000)||!integer(sb,0,1000000))throw new ToolError('matchError');
 if(config.format==='knockout'&&sa===sb&&!([match.a,match.b].includes(tie)))throw new ToolError('tieWinner');
 const next=structuredClone(state);next.results[id]={a:match.a,b:match.b,sa,sb,tie:sa===sb?tie:null};
 if(config.format==='knockout'){// Changing an earlier result invalidates only its downstream branch.
  let round=match.round+1,index=Math.floor(Number(id.split('-')[1])/2);while(round<Math.ceil(Math.log2(config.teams.length))){delete next.results[`${round}-${index}`];round++;index=Math.floor(index/2);}
 }return next;
}
export function standings(config,state){const rows=config.teams.map((_,id)=>({id,played:0,won:0,drawn:0,lost:0,points:0,for:0,against:0}));for(const m of tournamentMatches(config,state)){if(!m.result)continue;const {sa,sb}=m.result;for(const[id,own,other]of [[m.a,sa,sb],[m.b,sb,sa]]){const r=rows[id];r.played++;r.for+=own;r.against+=other;if(own>other){r.won++;r.points+=config.winPoints;}else if(own===other){r.drawn++;r.points+=config.drawPoints;}else{r.lost++;r.points+=config.lossPoints;}}}rows.sort((a,b)=>b.points-a.points||(b.for-b.against)-(a.for-a.against)||b.for-a.for||a.id-b.id);return rows;}
export function initialQuiz(config){return {index:0,revealed:[],awards:[],clock:{status:'idle',remaining:config.questions[0].seconds*1000,deadline:null}};}
export function tickQuiz(config,state,now){const next=structuredClone(state);if(next.clock.status==='running'){next.clock.remaining=Math.max(0,next.clock.deadline-now);if(next.clock.remaining===0){next.clock.status='finished';next.clock.deadline=null;if(config.autoReveal&&!next.revealed.includes(next.index))next.revealed.push(next.index);}}return next;}
export function quizControl(config,state,action,now){let next=tickQuiz(config,state,now);const clock=next.clock;
 if(action==='reveal'&&!next.revealed.includes(next.index))next.revealed.push(next.index);
 if(action==='start'&&clock.remaining>0){clock.deadline=now+clock.remaining;clock.status='running';}
 if(action==='pause'&&clock.status==='running'){clock.status='paused';clock.deadline=null;}
 if(action==='resetClock')next.clock={status:'idle',remaining:config.questions[next.index].seconds*1000,deadline:null};
 if(action==='next'||action==='previous'){next.index=Math.max(0,Math.min(config.questions.length-1,next.index+(action==='next'?1:-1)));next.clock={status:'idle',remaining:config.questions[next.index].seconds*1000,deadline:null};}return next;
}
export function awardQuiz(config,state,team,correct){if(!integer(team,0,config.teams.length-1)||state.awards.some(a=>a.question===state.index&&a.team===team))throw new ToolError('alreadyAwarded');return {...state,awards:[...state.awards,{question:state.index,team,points:correct?config.questions[state.index].points:-config.wrongPenalty}]};}
export function quizScores(config,state){return config.teams.map((_,i)=>state.awards.filter(a=>a.team===i).reduce((sum,a)=>sum+a.points,0));}
export function validatePlayState(config,raw){
 if(raw===null)return null;if(!raw||typeof raw!=='object')throw new ToolError('progressError');
 if(config.kind==='bingo'){
  const count=config.size**2,free=config.freeCenter&&config.size%2?Math.floor(count/2):-1;
  if(!Array.isArray(raw.cards)||raw.cards.length!==config.cardCount||!Array.isArray(raw.called)||new Set(raw.called).size!==raw.called.length||!raw.called.every(i=>integer(i,0,config.items.length-1))||!integer(raw.selected,0,raw.cards.length-1))throw new ToolError('progressError');
  for(const card of raw.cards){if(!Array.isArray(card)||card.length!==count||new Set(card).size!==count||!card.every((i,n)=>n===free?i===-1:integer(i,0,config.items.length-1)))throw new ToolError('progressError');}
  return {cards:raw.cards.map(c=>[...c]),called:[...raw.called],selected:raw.selected};
 }
 if(config.kind==='tournament'){
  if(!Array.isArray(raw.order)||raw.order.length!==config.teams.length||new Set(raw.order).size!==raw.order.length||!raw.order.every(i=>integer(i,0,config.teams.length-1))||!raw.results||typeof raw.results!=='object'||Array.isArray(raw.results))throw new ToolError('progressError');
  let next={order:[...raw.order],results:{}};for(const [id,r]of Object.entries(raw.results).sort(([a],[b])=>Number(a.split('-')[0])-Number(b.split('-')[0]))){const match=tournamentMatches(config,next).find(m=>m.id===id);if(!match?.ready||r?.a!==match.a||r?.b!==match.b)throw new ToolError('progressError');next=recordMatch(config,next,id,r.sa,r.sb,r.tie);}return next;
 }
 if(!integer(raw.index,0,config.questions.length-1)||!Array.isArray(raw.revealed)||new Set(raw.revealed).size!==raw.revealed.length||!raw.revealed.every(i=>integer(i,0,config.questions.length-1))||!Array.isArray(raw.awards)||raw.awards.length>config.teams.length*config.questions.length)throw new ToolError('progressError');
 const seen=new Set(),awards=raw.awards.map(a=>{const key=a?.question+':'+a?.team;if(!a||!integer(a.question,0,config.questions.length-1)||!integer(a.team,0,config.teams.length-1)||![config.questions[a.question].points,-config.wrongPenalty].includes(a.points)||seen.has(key))throw new ToolError('progressError');seen.add(key);return {question:a.question,team:a.team,points:a.points};});
 const c=raw.clock;if(!c||!['idle','paused','finished','running'].includes(c.status)||!Number.isFinite(c.remaining)||c.remaining<0||c.remaining>3600000)throw new ToolError('progressError');
 return {index:raw.index,revealed:[...raw.revealed],awards,clock:{status:c.status==='running'?'paused':c.status,remaining:c.remaining,deadline:null}};
}
