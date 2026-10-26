import {randomInt, shuffle} from './tools-core.js';
export const MINI_KINDS=['puzzle','reveal','sequence','reaction','differences','charades','drawing'];
export const MINI_LIMIT=8*1024*1024;
export class MiniError extends Error {constructor(code='miniInvalid'){super(code);this.code=code;}}
const check=(ok,code)=>{if(!ok)throw new MiniError(code);};
const num=(v,a,b)=>{check(Number.isInteger(v)&&v>=a&&v<=b);return v;};
const text=(v,max=160)=>{check(typeof v==='string'&&v.length<=max);return v.trim();};
const color=v=>{check(/^#[a-fA-F0-9]{6}$/.test(v));return v;};
export function validPicture(v){check(typeof v==='string'&&(v===''||['scene','scene-different'].includes(v)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)&&v.length<=320000));return v;}
export function validateItems(items){check(Array.isArray(items)&&items.length>0&&items.length<=80);return items.map(x=>{check(x&&typeof x==='object'&&!Array.isArray(x));return {label:text(x.label||'',120),answer:text(x.answer||'',300),hint:text(x.hint||'',300),taboo:text(x.taboo||'',300),image:validPicture(x.image||''),image2:validPicture(x.image2||''),spots:(()=>{check(Array.isArray(x.spots||[])&&(x.spots||[]).length<=20);return (x.spots||[]).map(p=>{check(p&&[p.x,p.y,p.r].every(Number.isFinite)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100&&p.r>=1&&p.r<=20);return {x:p.x,y:p.y,r:p.r};});})()};});}
export function validatePack(v){check(v&&v.version===1&&v.type==='game-materials');const next={version:1,type:'game-materials',title:text(v.title,100),items:validateItems(v.items)};check(JSON.stringify(next).length<=MINI_LIMIT,'miniTooLarge');return next;}
export function defaultsMini(kind,items){check(MINI_KINDS.includes(kind));return {version:1,kind,title:'',items:validateItems(items),rows:3,cols:3,rotate:false,reference:true,seconds:120,hints:3,revealStyle:'tiles',speed:5,startLength:3,lives:3,rounds:5,grid:4,reactionMode:'numbers',penalty:2,teams:'A\nB',skips:3,points:1,accent:'#416d58',background:'#edf4ec',sound:true};}
export function validateMini(v,kind=v?.kind){check(v&&v.version===1&&v.kind===kind&&MINI_KINDS.includes(kind));const b=defaultsMini(kind,v.items);b.title=text(v.title,120);for(const[k,a,z]of [['rows',2,8],['cols',2,8],['seconds',0,1800],['hints',0,20],['speed',1,30],['startLength',1,12],['lives',1,10],['rounds',1,30],['grid',2,8],['penalty',0,30],['skips',0,30],['points',1,100]])b[k]=num(v[k],a,z);for(const k of ['rotate','reference','sound']){check(typeof v[k]==='boolean');b[k]=v[k];}check(['tiles','blur'].includes(v.revealStyle));b.revealStyle=v.revealStyle;check(['numbers','target'].includes(v.reactionMode));b.reactionMode=v.reactionMode;b.teams=text(v.teams,1000);check(b.teams.split('\n').filter(Boolean).length<=12);b.accent=color(v.accent);b.background=color(v.background);check(JSON.stringify(b).length<=MINI_LIMIT,'miniTooLarge');return b;}
export const normalAnswer=s=>String(s).normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export const answersMatch=(guess,answer)=>Boolean(normalAnswer(guess))&&answer.split('|').some(a=>normalAnswer(a)===normalAnswer(guess));
export function puzzleStart(rows,cols,rotate=false){const count=rows*cols;check(Number.isInteger(count)&&count>=4&&count<=64);const tiles=shuffle(Array.from({length:count},(_,i)=>i));if(tiles.every((x,i)=>x===i))[tiles[0],tiles[1]]=[tiles[1],tiles[0]];return {tiles,angles:tiles.map(()=>rotate?randomInt(4):0),moves:0};}
export function puzzleMove(state,from,to,turn=false){const s=structuredClone(state);check(Number.isInteger(from)&&Number.isInteger(to)&&from>=0&&to>=0&&from<s.tiles.length&&to<s.tiles.length);if(turn){s.angles[from]=(s.angles[from]+1)%4;}else if(from!==to){[s.tiles[from],s.tiles[to]]=[s.tiles[to],s.tiles[from]];[s.angles[from],s.angles[to]]=[s.angles[to],s.angles[from]];}else return s;s.moves++;return s;}
export const puzzleSolved=s=>s.tiles.every((v,i)=>v===i&&s.angles[i]===0);
export function growSequence(list,choices){check(Number.isInteger(choices)&&choices>=2&&choices<=16&&list.length<80);return [...list,randomInt(choices)];}
export const hitSpot=(spots,x,y,found=[])=>spots.findIndex((p,i)=>!found.includes(i)&&Math.hypot(x-p.x,y-p.y)<=p.r);
export function reactionBoard(size,mode){const n=size*size;check(n>=4&&n<=64);const values=shuffle(Array.from({length:n},(_,i)=>i+1));return {values,target:mode==='numbers'?1:values[randomInt(n)]};}
export function charadeDeck(items){check(items.length>0);return shuffle(items.map((_,i)=>i));}
export function makeRun(config,now=Date.now()){return {started:now,deadline:config.seconds?now+config.seconds*1000:0,paused:0,remaining:config.seconds*1000,score:0,round:0,mistakes:0,hints:0,ended:false};}
export function pauseRun(run,now=Date.now()){if(run.ended)return;run.paused=now;run.remaining=run.deadline?Math.max(0,run.deadline-now):0;}
export function resumeRun(run,now=Date.now()){if(!run.paused)return;run.deadline=run.deadline?now+run.remaining:0;run.started+=now-run.paused;run.paused=0;}
export const runRemaining=(run,now=Date.now())=>run.paused?run.remaining:run.deadline?Math.max(0,run.deadline-now):null;
