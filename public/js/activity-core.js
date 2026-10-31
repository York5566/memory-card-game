import { ToolError } from './tools-core.js';
export const TEAM_COLORS=['#47715d','#be7043','#467d9b','#916ab1','#b88929','#b05275'];
const num=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const text=(v,max=80)=>typeof v==='string'&&v.length<=max&&!/[\r\n]/.test(v);
export const color=v=>typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v);
export function activityDefaults(kind) {
 const common={kind,version:1,title:'',background:'#f0f5ec',accent:'#47715d',scale:100,sound:false};
 if(kind==='scoreboard')return {...common,step:1,initial:0,target:0,allowNegative:false,sort:false,showMembers:true,teams:[0,1].map(i=>({name:'',color:TEAM_COLORS[i],members:[]}))};
 if(kind==='timer')return {...common,cycles:1,autoAdvance:true,phases:[{name:'',seconds:300}]};
 throw new ToolError('configError');
}
export function validateActivity(raw,kind) {
 if(!raw||raw.kind!==kind||raw.version!==1)throw new ToolError('configError');
 const out=activityDefaults(kind);
 if(!text(raw.title)||!color(raw.background)||!color(raw.accent)||!num(raw.scale,70,160)||typeof raw.sound!=='boolean')throw new ToolError('configError');
 for(const key of ['title','background','accent','scale','sound'])out[key]=raw[key];
 if(kind==='scoreboard'){
  if(!num(raw.step,1,1000)||!num(raw.initial,-1000000,1000000)||!num(raw.target,0,1000000)||!['allowNegative','sort','showMembers'].every(k=>typeof raw[k]==='boolean')||!Array.isArray(raw.teams)||raw.teams.length<1||raw.teams.length>50)throw new ToolError('configError');
  if(!raw.allowNegative&&raw.initial<0)throw new ToolError('negativeScore');
  let total=0;
  out.teams=raw.teams.map(team=>{
   if(!team||!text(team.name)||!color(team.color)||!Array.isArray(team.members)||team.members.length>500||!team.members.every(n=>text(n)&&n.trim()))throw new ToolError('configError');
   total+=team.members.length;return {name:team.name,color:team.color,members:[...team.members]};
  });
  if(total>500)throw new ToolError('configError');
  for(const key of ['step','initial','target','allowNegative','sort','showMembers'])out[key]=raw[key];
 }else{
  if(!num(raw.cycles,1,50)||typeof raw.autoAdvance!=='boolean'||!Array.isArray(raw.phases)||raw.phases.length<1||raw.phases.length>12)throw new ToolError('configError');
  out.cycles=raw.cycles;out.autoAdvance=raw.autoAdvance;
  out.phases=raw.phases.map(p=>{if(!p||!text(p.name)||!num(p.seconds,1,86400))throw new ToolError('durationError');return {name:p.name,seconds:p.seconds};});
 }
 return out;
}
export function initialScores(config){return config.teams.map(()=>config.initial);}
// Map each new position to its previous team; -1 represents a newly added team.
export function remapScoreProgress(progress,order,initial=0){
 if(!Array.isArray(order)||order.length<1||order.length>50||order.some(i=>!Number.isInteger(i)||i< -1||i>=progress.scores.length)||new Set(order.filter(i=>i>=0)).size!==order.filter(i=>i>=0).length)throw new ToolError('configError');
 const positions=new Map(order.map((oldIndex,newIndex)=>[oldIndex,newIndex]));
 return {scores:order.map(i=>i===-1?initial:progress.scores[i]),history:progress.history.filter(h=>positions.has(h.index)).map(h=>({...h,index:positions.get(h.index)}))};
}
export function updateScore(config,scores,index,value){
 if(!num(index,0,config.teams.length-1)||scores.length!==config.teams.length||!num(value,-1000000,1000000))throw new ToolError('scoreRange');
 if(value<0&&!config.allowNegative)throw new ToolError('negativeScore');
 const next=[...scores];next[index]=value;return next;
}
export function initialTimer(config){return {status:'idle',index:0,cycle:0,remaining:config.phases[0].seconds*1000,deadline:null};}
function nextPhase(config,state,now,carry=true){
 let index=state.index+1,cycle=state.cycle;
 if(index===config.phases.length){index=0;cycle++;}
 if(cycle>=config.cycles)return {...state,status:'finished',remaining:0,deadline:null};
 const remaining=config.phases[index].seconds*1000;
 const running=state.status==='running'&&(carry?config.autoAdvance:true);
 return {status:running?'running':'paused',index,cycle,remaining,deadline:running?(carry?state.deadline:now)+remaining:null};
}
export function tickTimer(config,state,now){
 let next={...state};
 // Absolute deadlines catch up after a background tab or delayed callback.
 while(next.status==='running'&&now>=next.deadline)next=nextPhase(config,next,now);
 if(next.status==='running')next.remaining=Math.max(0,next.deadline-now);
 return next;
}
export function controlTimer(config,state,action,now,seconds=0){
 if(action==='reset')return initialTimer(config);
 let next=tickTimer(config,state,now);
 if(action==='start'){
  if(next.status==='finished')next=initialTimer(config);
  if(next.status!=='running')next={...next,status:'running',deadline:now+next.remaining};
 }else if(action==='pause'&&next.status==='running')next={...next,status:'paused',deadline:null};
 else if(action==='next'&&next.status!=='finished')next=nextPhase(config,next,now,false);
 else if(action==='adjust'&&next.status!=='finished'){
  if(!num(seconds,-86400,86400))throw new ToolError('durationError');
  const remaining=Math.min(86400000,Math.max(1000,next.remaining+seconds*1000));
  next={...next,remaining,deadline:next.status==='running'?now+remaining:null};
 }
 return next;
}
export function formatDuration(ms){const seconds=Math.max(0,Math.ceil(ms/1000));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
