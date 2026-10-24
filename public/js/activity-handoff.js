import { entries, ToolError } from './tools-core.js';
import { TEAM_COLORS, color } from './activity-core.js';
export const HANDOFF_KEY='activity-tools-handoff-v1';
const TTL=2*60*60*1000;
export function validateHandoff(raw){
 if(!raw||raw.version!==1||!['picker','groups','scoreboard','tournament','quiz'].includes(raw.target)||typeof raw.title!=='string'||raw.title.length>80)throw new ToolError('transferError');
 const out={version:1,target:raw.target,title:raw.title};
 if(['scoreboard','tournament','quiz'].includes(raw.target)){
  if(!Array.isArray(raw.teams)||!raw.teams.length||raw.teams.length>50)throw new ToolError('transferError');let count=0;
  out.teams=raw.teams.map((team,i)=>{
   if(!team||typeof team.name!=='string'||team.name.length>80||/[\r\n]/.test(team.name)||!Array.isArray(team.members)||!team.members.every(n=>typeof n==='string'&&n.trim()&&n.length<=80&&!/[\r\n]/.test(n)))throw new ToolError('transferError');
   count+=team.members.length;return {name:team.name,members:[...team.members],color:color(team.color)?team.color:TEAM_COLORS[i%TEAM_COLORS.length]};
  });if(count>500)throw new ToolError('transferError');
  if(raw.scores!==undefined){if(raw.target!=='scoreboard'||!Array.isArray(raw.scores)||raw.scores.length!==out.teams.length||!raw.scores.every(s=>Number.isInteger(s)&&Math.abs(s)<=1000000))throw new ToolError('transferError');out.scores=[...raw.scores];}
 }else{
  if(typeof raw.names!=='string')throw new ToolError('transferError');
  entries(raw.names,{dedupe:false});out.names=raw.names;
 }
 return out;
}
export function saveHandoff(storage,payload,now=Date.now()){
 const checked=validateHandoff(payload);storage.setItem(HANDOFF_KEY,JSON.stringify({...checked,expires:now+TTL}));
}
export function takeHandoff(storage,target,now=Date.now()){
 const value=storage.getItem(HANDOFF_KEY);if(!value)return null;let raw;
 try{raw=JSON.parse(value);if(!Number.isFinite(raw.expires)||raw.expires<now||raw.expires>now+TTL)throw new ToolError('transferError');const checked=validateHandoff(raw);if(checked.target!==target)return null;storage.removeItem(HANDOFF_KEY);return checked;}
 catch{storage.removeItem(HANDOFF_KEY);throw new ToolError('transferError');}
}
export function activityURL(kind,base='/',language='zh-Hant'){
 const paths={picker:'random-picker',groups:'random-groups',scoreboard:'scoreboard',timer:'timer',workspace:'workspace',bingo:'bingo',tournament:'tournament',quiz:'quiz'};
 if(!Object.hasOwn(paths,kind))throw new ToolError('transferError');
 return base+(language==='zh-Hant'?'':language+'/')+'tools/'+paths[kind]+'/';
}

