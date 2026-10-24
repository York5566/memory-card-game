import { defaults, validateConfig, entries, ToolError } from './tools-core.js';
import { activityDefaults, validateActivity, initialTimer, color } from './activity-core.js';
import { playDefaults, validatePlay, validatePlayState, integer, shortText } from './play-core.js';
export const EVENT_KINDS=['picker','groups','scoreboard','timer','bingo','tournament','quiz'];
export const EVENT_PREFIX='activity-workspace-v1:';
export const EVENT_FILE_LIMIT=16000000;
export const validID=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
export function toolDefaults(kind){if(!EVENT_KINDS.includes(kind))throw new ToolError('configError');return ['picker','groups'].includes(kind)?defaults(kind):['scoreboard','timer'].includes(kind)?activityDefaults(kind):playDefaults(kind);}
export function validateTool(raw,kind){toolDefaults(kind);return ['picker','groups'].includes(kind)?validateConfig(raw,kind):['scoreboard','timer'].includes(kind)?validateActivity(raw,kind):validatePlay(raw,kind);}
export function validateProgress(c,p){
 if(p===null||p===undefined)return null;if(!p||typeof p!=='object')throw new ToolError('progressError');
 if(['bingo','tournament','quiz'].includes(c.kind))return validatePlayState(c,p);
 if(c.kind==='scoreboard'){
  if(!Array.isArray(p.scores)||p.scores.length!==c.teams.length||!p.scores.every(s=>integer(s,c.allowNegative?-1000000:0,1000000)))throw new ToolError('progressError');
  const history=p.history??[];if(!Array.isArray(history)||history.length>1000)throw new ToolError('progressError');
  const checked=history.map(h=>{if(!h||!integer(h.index,0,c.teams.length-1)||!shortText(h.name)||!integer(h.before,-1000000,1000000)||!integer(h.after,-1000000,1000000)||typeof h.time!=='string'||!Number.isFinite(Date.parse(h.time)))throw new ToolError('progressError');return {index:h.index,name:h.name,before:h.before,after:h.after,time:new Date(h.time).toISOString()};});
  return {scores:[...p.scores],...(p.history?{history:checked}:{})};
 }
 if(c.kind==='timer'){
  if(!['idle','running','paused','finished'].includes(p.status)||!integer(p.index,0,c.phases.length-1)||!integer(p.cycle,0,c.cycles-1)||!Number.isFinite(p.remaining)||p.remaining<0||p.remaining>86400000)throw new ToolError('progressError');
  return {...initialTimer(c),status:p.status==='running'?'paused':p.status,index:p.index,cycle:p.cycle,remaining:p.remaining,deadline:null};
 }
 const items=entries(c.names,{weighted:c.kind==='picker'&&c.weighted,dedupe:c.dedupe}).items,map=new Map(items.map(i=>[i.id,i]));
 const restore=list=>{if(!Array.isArray(list)||list.length>500||!list.every(i=>typeof i==='string'&&map.has(i)))throw new ToolError('progressError');return [...list];};
 if(c.kind==='picker'){
  if(!Array.isArray(p.rounds)||p.rounds.length>1000)throw new ToolError('progressError');const rounds=p.rounds.map(restore),all=rounds.flat();if(all.length>10000||rounds.some(r=>!r.length||r.length>50)||!c.replacement&&new Set(all).size!==all.length)throw new ToolError('progressError');return {rounds};
 }
 if(!Array.isArray(p.teams)||p.teams.length>50)throw new ToolError('progressError');const teams=p.teams.map(restore),all=teams.flat();if(teams.length&&(all.length!==items.length||new Set(all).size!==all.length))throw new ToolError('progressError');return {teams};
}
export function presentationDefaults(){return {visible:[...EVENT_KINDS],announcement:'',scale:100,background:'#f0f5ec',accent:'#47715d',layout:'grid',showMembers:true};}
export function validatePresentation(p){if(!p||!Array.isArray(p.visible)||p.visible.length>7||new Set(p.visible).size!==p.visible.length||!p.visible.every(k=>EVENT_KINDS.includes(k))||!shortText(p.announcement,200)||!integer(p.scale,70,160)||!color(p.background)||!color(p.accent)||!['grid','stack'].includes(p.layout)||typeof p.showMembers!=='boolean')throw new ToolError('configError');return {visible:[...p.visible],announcement:p.announcement,scale:p.scale,background:p.background,accent:p.accent,layout:p.layout,showMembers:p.showMembers};}
export function newEvent(title,id=crypto.randomUUID()){if(!shortText(title)||!title.trim()||!validID(id))throw new ToolError('eventNameError');return {version:1,id,title:title.trim(),revision:0,updatedAt:Date.now(),slots:{},presentation:presentationDefaults()};}
export function validateEvent(raw){
 if(!raw||raw.version!==1||!validID(raw.id)||!shortText(raw.title)||!raw.title.trim()||!integer(raw.revision,0,1e9)||!Number.isFinite(raw.updatedAt)||!raw.slots||Array.isArray(raw.slots)||typeof raw.slots!=='object'||Object.keys(raw.slots).some(k=>!EVENT_KINDS.includes(k)))throw new ToolError('configError');
 const out=newEvent(raw.title,raw.id);out.revision=raw.revision;out.updatedAt=raw.updatedAt;out.presentation=validatePresentation(raw.presentation);
 for(const[k,s]of Object.entries(raw.slots)){if(!s||!integer(s.revision,0,1e9))throw new ToolError('configError');const config=validateTool(s.config,k);out.slots[k]={config,progress:validateProgress(config,s.progress),revision:s.revision};}
 if(new TextEncoder().encode(JSON.stringify(out)).length>EVENT_FILE_LIMIT)throw new ToolError('largeActivity');return out;
}
export function readEvent(storage,id){if(!validID(id))throw new ToolError('eventMissing');const raw=storage.getItem(EVENT_PREFIX+id);if(!raw)throw new ToolError('eventMissing');return validateEvent(JSON.parse(raw));}
export function listEvents(storage){const out=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(EVENT_PREFIX))continue;try{const e=readEvent(storage,key.slice(EVENT_PREFIX.length));out.push({id:e.id,title:e.title,updatedAt:e.updatedAt});}catch{/* Keep other valid activities available. */}}return out.sort((a,b)=>b.updatedAt-a.updatedAt);}
export function writeEvent(storage,event,expected=null){const checked=validateEvent(event),key=EVENT_PREFIX+checked.id,raw=storage.getItem(key);if(raw){if(expected===null||validateEvent(JSON.parse(raw)).revision!==expected)throw new ToolError('eventConflict');}else if(expected!==null)throw new ToolError('eventMissing');else if(listEvents(storage).length>=20)throw new ToolError('eventLimit');checked.revision++;checked.updatedAt=Date.now();storage.setItem(key,JSON.stringify(checked));return checked;}
export function saveSlot(storage,id,kind,config,progress,expected=0){const event=readEvent(storage,id);if((event.slots[kind]?.revision||0)!==expected)throw new ToolError('eventConflict');const c=validateTool(config,kind);event.slots[kind]={config:c,progress:validateProgress(c,progress),revision:expected+1};return writeEvent(storage,event,event.revision);}
export function duplicateEvent(raw,title,includeProgress=false,id=crypto.randomUUID()){const copy=validateEvent(raw);copy.id=id;copy.title=title;copy.revision=0;for(const s of Object.values(copy.slots)){s.revision=0;if(!includeProgress)s.progress=null;}return validateEvent(copy);}
