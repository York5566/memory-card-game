import { toolBridge } from './tool-bridge.js';
import { audienceView } from './presentation-core.js';
let bridge=null;
import { saveHandoff, takeHandoff, activityURL } from './activity-handoff.js';
import { MAX_FILE_BYTES, entries, draw, group, teamCount, defaults, validateConfig, csv, importList, ToolError } from './tools-core.js';
import { toolText } from './tools-text.js';

const host = document.querySelector('[data-tool]');
const kind = host.dataset.tool, lang = document.documentElement.lang;
const T = (key, ...values) => toolText(key, lang, ...values);
const $ = id => document.getElementById('tool-' + id);
const form = $('form'), fields = $('fields'), stage = $('stage'), results = $('results');
const storageKey = `activity-tools-${kind}-v1`;
let config = defaults(kind), rounds = [], teams = [], removed = new Set(), undoStack = [], busy = false, angle = 0, pending = null, frame = 0;
let audio, navigationConfirmed = false;
const palettes = { forest:['#47715d','#dcead6','#edc68d','#bad8c5','#f3dfc0','#93b7a4'], sunset:['#a15336','#f1cf9a','#f5e4c3','#d99d7b','#e2b0a7','#ecd3b7'], ocean:['#346c85','#b9d9df','#e7d9ae','#9cbfce','#d4e8ec','#94b0b9'] };
const el = (tag, className, text) => { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; };
const button = (label, fn, className='button small') => { const b=el('button',className,label); b.type='button'; b.addEventListener('click',fn); return b; };
function feedback(message, error=false) { $('feedback').textContent=message; $('feedback').classList.toggle('is-error',error); }
function fail(error) { feedback(T(error instanceof ToolError ? error.code : 'invalid'),true); }
function getEntries() { return entries(config.names,{weighted:kind==='picker' && config.weighted,dedupe:config.dedupe}); }
function pool() { return getEntries().items.filter(item=>!removed.has(item.id)); }
function titleOfTeam(index) { return config.teamNames.split(/\r?\n/)[index]?.trim().slice(0,80) || T('team',index+1); }
function hasResults() { return rounds.length>0 || teams.length>0; }
function writeForm() {
  for(const [key,value] of Object.entries(config)) { const input=form.elements.namedItem(key==='value'?'groupNumber':key); if(!input) continue; if(input.type==='checkbox') input.checked=value; else input.value=value; }
}
function readForm() {
  const next={...config,fixed:{...config.fixed}};
  for(const key of ['names','title','theme','teamNames','mode']) { const input=form.elements.namedItem(key); if(input) next[key]=input.value; }
  for(const key of ['count','duration','textSize','value']) { const input=form.elements.namedItem(key==='value'?'groupNumber':key); if(input) next[key]=Number(input.value); }
  for(const key of ['weighted','dedupe','replacement','sound']) { const input=form.elements.namedItem(key); if(input) next[key]=input.checked; }
  return next;
}
function save() {
  let checked;
  if(form.elements.remember.checked) { try { checked=validateConfig(config,kind); } catch { return; } }
  try { if(checked) localStorage.setItem(storageKey,JSON.stringify(checked)); else localStorage.removeItem(storageKey); }
  catch { form.elements.remember.checked=false; feedback(T('storageError'),true); }
}
function clearResults() { rounds=[]; teams=[]; removed=new Set(); undoStack=[]; angle=0; }
function structural(c) { return JSON.stringify([c.names,c.weighted,c.dedupe,c.replacement,c.mode,c.value]); }
function commit({ask=true}={}) {
  const next=readForm();
  if(structural(next)!==structural(config)) {
    if(ask && hasResults() && !window.confirm(T('changeWarning'))) { writeForm(); return false; }
    if(next.names!==config.names || next.dedupe!==config.dedupe) next.fixed={};
    clearResults();
  }
  config=next; save(); render(); return true;
}
function snapshot() { undoStack.push({rounds:structuredClone(rounds),teams:structuredClone(teams),removed:[...removed],fixed:{...config.fixed}}); if(undoStack.length>100) undoStack.shift(); }
function setupAudio() { if(!config.sound) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(()=>{}); } catch { /* Sound is optional. */ } }
function chime() {
  if(!config.sound || !audio || audio.state!=='running') return;
  [523.25,659.25,783.99].forEach((frequency,i)=>{ const osc=audio.createOscillator(), gain=audio.createGain(), time=audio.currentTime+i*.09; osc.type='sine'; osc.frequency.value=frequency; gain.gain.setValueAtTime(0,time); gain.gain.linearRampToValueAtTime(.045,time+.015); gain.gain.exponentialRampToValueAtTime(.001,time+.24); osc.connect(gain).connect(audio.destination); osc.start(time); osc.stop(time+.26); osc.onended=()=>{osc.disconnect();gain.disconnect();}; });
}
function drawWheel(items=[]) {
  if(kind!=='picker') return;
  const canvas=$('wheel'), ctx=canvas.getContext('2d'), colors=palettes[config.theme] || palettes.forest;
  ctx.clearRect(0,0,800,800); ctx.save(); ctx.translate(400,400); ctx.rotate(angle);
  const list=items.length ? items : Array.from({length:8},(_,i)=>({name:'',weight:1}));
  const total=list.reduce((sum,item)=>sum+item.weight,0); let start=-Math.PI/2;
  list.forEach((item,i)=>{
    const size=item.weight/total*Math.PI*2, end=start+size;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,382,start,end); ctx.closePath(); ctx.fillStyle=colors[i%colors.length]; ctx.fill(); ctx.strokeStyle='#fff9'; ctx.lineWidth=2; ctx.stroke();
    if(item.name && size>.055 && (list.length<=40 || i%Math.ceil(list.length/40)===0)) {
      ctx.save(); ctx.rotate(start+size/2); ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillStyle=i%colors.length===0?'#fff':'#233e34'; ctx.font='600 25px system-ui, sans-serif';
      let name=item.name; while(ctx.measureText(name).width>240 && name.length>1) name=name.slice(0,-1); if(name!==item.name) name+='…'; ctx.fillText(name,345,0); ctx.restore();
    }
    start=end;
  });
  ctx.restore();
}
function renderAssignments(items) {
  if(kind!=='groups') return;
  const target=$('assignments'); target.replaceChildren();
  let count; try { count=teamCount(items.length,config.mode,config.value); } catch { return; }
  if(count<1 || count>50 || count>items.length) return;
  for(const item of items) {
    const label=el('label','tool-assignment'), name=el('span','',item.name), input=el('input');
    input.type='number'; input.min='1'; input.max=String(count); input.step='1'; input.placeholder=T('unassigned');
    input.value=config.fixed[item.id]===undefined?'':String(config.fixed[item.id]+1); input.setAttribute('aria-label',item.name+' — '+T('team',`1–${count}`));
    input.addEventListener('change',()=>{
      const next={...config.fixed};
      if(input.value==='') delete next[item.id];
      else { const value=Number(input.value); if(!Number.isInteger(value) || value<1 || value>count) { fail(new ToolError('fixedInvalid')); input.value=config.fixed[item.id]===undefined?'':String(config.fixed[item.id]+1); return; } next[item.id]=value-1; }
      try { group(items,{mode:config.mode,value:config.value,fixed:next}); } catch(error) { fail(error); input.value=config.fixed[item.id]===undefined?'':String(config.fixed[item.id]+1); return; }
      snapshot(); config.fixed=next; teams=[]; save(); render();
    });
    label.append(name,input); target.append(label);
  }
}
function chooseMove(item, from) {
  const dialog=el('dialog','tool-move-dialog'); dialog.setAttribute('aria-labelledby','tool-move-title');
  const heading=el('h2','',item.name); heading.id='tool-move-title';
  const label=el('label','tool-field'), select=el('select'); label.append(el('span','',T('move')),select);
  teams.forEach((team,i)=>{const option=el('option','',titleOfTeam(i)); option.value=String(i); option.selected=i===from; select.append(option);});
  const close=()=>{dialog.close();dialog.remove();};
  const actions=el('div','dialog-actions');
  actions.append(button(T('cancel'),close),button(T('move'),()=>{
    const to=Number(select.value); if(to===from){close();return;}
    if(config.mode==='size' && teams[to].length>=config.value){fail(new ToolError('fixedFull'));close();return;}
    snapshot(); teams[from]=teams[from].filter(member=>member.id!==item.id); teams[to].push(item); config.fixed[item.id]=to; save(); render(); close(); feedback(T('finished',teams.length));
  },'button primary'));
  dialog.append(heading,label,actions); stage.append(dialog); dialog.addEventListener('close',()=>dialog.remove(),{once:true}); dialog.showModal(); select.focus();
}
function renderResults() {
  results.replaceChildren(); $('empty').hidden=hasResults(); if($('group-art')) $('group-art').hidden=teams.length>0;
  if(kind==='picker' && rounds.length) {
    results.append(el('h2','tool-result-heading',T('results')));
    const list=el('ol','tool-winners'); rounds.at(-1).forEach(item=>list.append(el('li','',item.name))); results.append(list);
    $('history').hidden=false; const history=$('history-list'); history.replaceChildren();
    rounds.forEach((round,i)=>{const row=el('li'); row.append(el('strong','',T('round',i+1)),el('span','',round.map(item=>item.name).join(' / ')));history.append(row);});
  } else if(kind==='picker') $('history').hidden=true;
  if(kind==='groups' && teams.length) {
    const grid=el('div','tool-team-grid');
    teams.forEach((team,index)=>{
      const card=el('article','tool-team'), header=el('div','tool-team-header'); card.style.setProperty('--team-color',palettes[config.theme][index%6]);
      header.append(el('h3','',titleOfTeam(index)),el('span','',T('people',team.length))); card.append(header);
      const list=el('ul','tool-members');
      team.forEach(item=>{ const row=el('li'); const b=button(item.name,()=>chooseMove(item,index),'tool-member'); b.setAttribute('aria-label',item.name+' — '+T('move')); b.title=T('move'); b.append(el('span','tool-member-mark',config.fixed[item.id]===index?'●':'↗')); row.append(b); list.append(row); });
      card.append(list);
      const pinned=team.length>0 && team.every(item=>config.fixed[item.id]===index);
      const pin=button(T(pinned?'unpin':'pin'),()=>{snapshot(); for(const item of team) {if(pinned)delete config.fixed[item.id];else config.fixed[item.id]=index;}save();render();});pin.disabled=!team.length;pin.setAttribute('aria-pressed',String(pinned));card.append(pin);grid.append(card);
    });results.append(grid);
  }
  $('result-actions').hidden=!hasResults(); $('undo').disabled=undoStack.length===0 || busy; $('reset').disabled=!hasResults() || busy;
  $('run').textContent=T(kind==='picker'?(rounds.length?'drawAgain':'draw'):(teams.length?'reshuffle':'makeGroups'));
}
function render() {
  stage.dataset.theme=config.theme; stage.style.setProperty('--result-size',config.textSize+'px');
  $('stage-title').textContent=config.title.trim() || T(kind); $('font-value').value=config.textSize;
  let items=[];
  try { const parsed=getEntries();items=parsed.items; $('count').textContent=T('namesCount',items.length)+(parsed.duplicates?' '+T('skipped',parsed.duplicates):''); }
  catch(error){$('count').textContent=T(error.code || 'invalid');}
  renderAssignments(items);renderResults();
  if(kind==='picker') { const remaining=items.filter(item=>!removed.has(item.id)); $('summary').textContent=T('available',remaining.length)+' · '+T('rulesSummary',config.count,T(config.replacement?'repeatsOn':'repeatsOff')); drawWheel(remaining); }
  else { form.elements.groupNumber.closest('label').querySelector('span').textContent=T(config.mode==='size'?'bySize':'byCount'); let count;try{count=teamCount(items.length,config.mode,config.value);}catch{count=0;} $('summary').textContent=T('people',items.length)+(count>0?' · '+T('teamCountLabel',count):''); }
}
function finishDraw() {
  if(!pending)return;cancelAnimationFrame(frame);const {winners,items,target}=pending;pending=null;angle=target;drawWheel(items);
  snapshot();rounds.push(winners);if(!config.replacement)winners.forEach(item=>removed.add(item.id));
  busy=false;fields.disabled=false;$('skip').hidden=true;$('run').hidden=false;
  // Preserve the final spin frame until the next interaction; the pointer matches winner 1.
  renderResults();$('summary').textContent=T('available',pool().length)+' · '+T('rulesSummary',config.count,T(config.replacement?'repeatsOn':'repeatsOff'));
  feedback(T('winnerMessage',winners.map(item=>item.name).join(' / ')));chime();results.focus({preventScroll:true});
}
function run() {
  if(busy || !form.reportValidity() || !commit())return;
  try {
    setupAudio();
    if(kind==='groups') {const next=group(getEntries().items,{mode:config.mode,value:config.value,fixed:config.fixed});snapshot();teams=next;render();feedback(T('finished',teams.length));chime();results.focus({preventScroll:true});return;}
    const items=pool(), winners=draw(items,config.count,config.replacement), first=winners[0];
    const total=items.reduce((sum,item)=>sum+item.weight,0);let before=0;for(const item of items){if(item.id===first.id)break;before+=item.weight;}
    const tau=Math.PI*2, desired=(tau-(before+first.weight/2)/total*tau)%tau;
    const start=angle, target=start+(tau-(start%tau)+desired)%tau+tau*5;
    pending={items,winners,target};busy=true;fields.disabled=true;$('run').hidden=true;$('skip').hidden=false;$('undo').disabled=true;$('reset').disabled=true;$('result-actions').hidden=true;feedback(T('drawing'));
    const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:config.duration*1000;
    if(!duration){finishDraw();return;}const started=performance.now();
    const animate=now=>{const p=Math.min(1,(now-started)/duration);angle=start+(target-start)*(1-Math.pow(1-p,4));drawWheel(items);if(p<1)frame=requestAnimationFrame(animate);else finishDraw();};frame=requestAnimationFrame(animate);
  }catch(error){fail(error);}
}
function download(text,filename,type) {const url=URL.createObjectURL(new Blob([text],{type})),link=el('a');link.href=url;link.download=filename;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback(T('saved'));}
function resultRows() {
  if(kind==='picker')return [[T('round',''),T('names')],...rounds.flatMap((round,index)=>round.map(item=>[index+1,item.name]))];
  return [[T('team',''),T('participants')],...teams.flatMap((team,index)=>team.map(item=>[titleOfTeam(index),item.name]))];
}
function replaceConfig(next) {config=next;clearResults();writeForm();save();render();feedback(T('loaded'));}
form.addEventListener('submit',event=>{event.preventDefault();run();});
form.addEventListener('change',event=>{if(event.target.closest('#tool-assignments'))return;commit();});
form.addEventListener('input',event=>{if(['title','textSize','theme','teamNames'].includes(event.target.name))commit({ask:false});});
$('go-stage').addEventListener('click',()=>{ if(!form.reportValidity() || !commit())return; stage.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}); $('run').focus({preventScroll:true}); });
$('run').addEventListener('click',run);$('skip').addEventListener('click',finishDraw);
$('undo').addEventListener('click',()=>{if(busy || !undoStack.length)return;const previous=undoStack.pop();rounds=previous.rounds;teams=previous.teams;removed=new Set(previous.removed);config.fixed=previous.fixed;save();render();feedback(T('undoDone'));});
$('reset').addEventListener('click',()=>{if(busy || !window.confirm(T('resetWarning')))return;clearResults();render();feedback('');});
$('unpin')?.addEventListener('click',()=>{snapshot();config.fixed={};save();render();});
$('sample').addEventListener('click',()=>{
  if((config.names.trim() || hasResults()) && !window.confirm(T('replaceWarning')))return;
  const names=lang==='zh-Hant'?['小春','阿哲','晴晴','小宇','阿樂','小安','米米','阿凱']:lang==='ja'?['はる','あおい','そら','ゆい','れん','さくら','かい','りん']:lang==='ko'?['하늘','바다','지우','서준','지민','민서','도윤','수아']:['Alex','Sam','Taylor','Jordan','Casey','Morgan','Jamie','Riley'];
  replaceConfig({...config,names:names.join('\n'),fixed:{}});
});
let fileMode='list';
$('import-list').addEventListener('click',()=>{fileMode='list';$('file').accept='.txt,.csv,text/plain,text/csv';$('file').click();});
$('import-config').addEventListener('click',()=>{fileMode='config';$('file').accept='.json,application/json';$('file').click();});
$('file').addEventListener('change',async()=>{
  const file=$('file').files[0];$('file').value='';if(!file)return;
  try{if(file.size>MAX_FILE_BYTES)throw new ToolError('fileLimit');const text=await file.text();let next;
    if(fileMode==='config'){try{next=validateConfig(JSON.parse(text),kind);}catch(error){throw error instanceof ToolError?error:new ToolError('configError');}}
    else{const names=importList(text,kind==='picker'&&config.weighted,/\.csv$/i.test(file.name)?'csv':'text');entries(names,{weighted:kind==='picker'&&config.weighted,dedupe:config.dedupe});next={...config,names,fixed:{}};}
    if((config.names.trim() || hasResults()) && !window.confirm(T('replaceWarning')))return;replaceConfig(next);
  }catch(error){fail(error);}
});
$('export-config').addEventListener('click',()=>{try{if(!commit())return;const checked=validateConfig(config,kind);download(JSON.stringify(checked,null,2),`${kind}-settings.json`,'application/json');}catch(error){fail(error);}});
$('clear').addEventListener('click',()=>{if(!window.confirm(T('clearWarning')))return;form.elements.remember.checked=false;replaceConfig(defaults(kind));feedback(T('cleared'));});
$('csv').addEventListener('click',()=>{if(hasResults())download(csv(resultRows()),`${kind}-results.csv`,'text/csv;charset=utf-8');});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(resultRows().map(row=>row.join('\t')).join('\n'));feedback(T('copied'));}catch{feedback(T('copyError'),true);}});
$('transfer-list').addEventListener('click',()=>{
 if(busy||!form.reportValidity()||!commit())return;
 try{const items=getEntries().items;if(!items.length)throw new ToolError('empty');
 const target=kind==='picker'?'groups':'picker';
 if(hasResults()&&!confirm(T('leaveWarning')))return;
 saveHandoff(sessionStorage,{version:1,target,title:config.title,names:items.map(x=>x.name).join('\n')});navigationConfirmed=true;location.assign(transferURL(target));
 }catch(error){fail(error instanceof ToolError?error:new ToolError('transferError'));}
});
$('transfer-scoreboard')?.addEventListener('click',()=>{
 if(busy||!form.reportValidity()||!commit()||!teams.length)return;
 try{saveHandoff(sessionStorage,{version:1,target:'scoreboard',title:config.title,teams:teams.map((members,i)=>({name:titleOfTeam(i),color:palettes[config.theme][i%6],members:members.map(m=>m.name)}))});navigationConfirmed=true;location.assign(transferURL('scoreboard'));}catch{fail(new ToolError('transferError'));}
});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{feedback(T('fullscreenError'),true);}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=T(document.fullscreenElement===stage?'exitFullscreen':'fullscreen');});
function needsLeaveWarning() {
  try{if(bridge?.isSaved()&&JSON.stringify(readForm())===JSON.stringify(config))return false;}catch{}
  if(hasResults())return true;
  if(!form.elements.names.value.trim())return false;
  if(form.elements.remember.checked) { try { if(JSON.stringify(validateConfig(readForm(),kind))===localStorage.getItem(storageKey))return false; } catch { /* Invalid or unsaved edits still need a warning. */ } }
  return true;
}
function allowNavigation() {
  if(busy) { feedback(T('drawing')); return false; }
  if(needsLeaveWarning() && !window.confirm(T('leaveWarning'))) return false;
  navigationConfirmed = true; return true;
}
document.addEventListener('languagechange-request',event=>{if(!allowNavigation())event.preventDefault();});
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link || link.hasAttribute('data-language-link') || link.hasAttribute('download') || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button!==0 || link.target==='_blank')return;
  const next=new URL(link.href,location.href);
  if(!['http:','https:'].includes(next.protocol))return;
  if(next.origin===location.origin && next.pathname===location.pathname && next.search===location.search)return;
  if(!allowNavigation())event.preventDefault();
});
window.addEventListener('beforeunload',event=>{if(!navigationConfirmed && needsLeaveWarning()){event.preventDefault();event.returnValue='';}});

try{const stored=localStorage.getItem(storageKey);if(stored){config=validateConfig(JSON.parse(stored),kind);form.elements.remember.checked=true;}}catch{feedback(T('storageError'),true);}
writeForm();render();

try{const data=takeHandoff(sessionStorage,kind);if(data){if(config.names.trim()&&!confirm(T('transferReplace')))feedback(T('transferCancelled'));else{replaceConfig({...config,names:data.names,title:data.title,weighted:false,dedupe:false,fixed:{}});feedback(T('transferSuccess'));}}}catch{fail(new ToolError('transferError'));}

for(const target of ['tournament','quiz'])$('transfer-'+target)?.addEventListener('click',()=>{
 if(busy||!form.reportValidity()||!commit()||!teams.length)return;
 try{if(teams.length>(target==='quiz'?20:32)||target==='tournament'&&teams.length<2)throw new ToolError(target==='quiz'?'quizRules':'tournamentRules');saveHandoff(sessionStorage,{version:1,target,title:config.title,teams:teams.map((members,i)=>({name:titleOfTeam(i),color:palettes[config.theme][i%6],members:members.map(m=>m.name)}))});navigationConfirmed=true;location.assign(transferURL(target));}catch(e){fail(e);}
});
bridge=toolBridge(host,{kind,config:()=>config,busy:()=>busy,progress:()=>kind==='picker'?{rounds:rounds.map(r=>r.map(i=>i.id))}:{teams:teams.map(r=>r.map(i=>i.id))},prepare:()=>!busy&&form.reportValidity()&&commit(),load:(c,p)=>{config=structuredClone(c);clearResults();if(p){const items=new Map(getEntries().items.map(i=>[i.id,i]));if(kind==='picker'){rounds=p.rounds.map(r=>r.map(id=>items.get(id)));removed=new Set(config.replacement?[]:p.rounds.flat());}else teams=p.teams.map(r=>r.map(id=>items.get(id)));}writeForm();save();render();},view:()=>audienceView(config,{rounds,teams},T)});

function transferURL(target){const url=new URL(activityURL(target,document.body.dataset.base,lang),location.origin);if(bridge?.eventID){url.searchParams.set('event',bridge.eventID);url.searchParams.set('handoff','1');}return url.href;}
