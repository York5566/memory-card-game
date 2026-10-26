import { toolBridge } from './tool-bridge.js';
import { audienceView } from './presentation-core.js';
let bridge=null;
import { activityDefaults, validateActivity, TEAM_COLORS, initialScores, updateScore, initialTimer, controlTimer, tickTimer, formatDuration } from './activity-core.js';
import { MAX_FILE_BYTES, csv, ToolError } from './tools-core.js';
import { takeHandoff } from './activity-handoff.js';
import { toolText } from './tools-text.js';
const host=document.querySelector('[data-activity]'),kind=host.dataset.activity,board=kind==='scoreboard';
const T=(key,...values)=>toolText(key,document.documentElement.lang,...values),$=id=>document.getElementById('activity-'+id);
const form=$('form'),stage=$('stage'),storageKey='activity-tools-'+kind+'-v1';
let config=activityDefaults(kind),scores=initialScores(activityDefaults('scoreboard')),timer=initialTimer(activityDefaults('timer')),history=[],undos=[],audio,navigationConfirmed=false;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const btn=(label,fn,cls='button small')=>{const b=el('button',cls,label);b.type='button';b.onclick=fn;return b;};
const teamName=i=>config.teams[i].name.trim()||T('team',i+1),phaseName=i=>config.phases[i].name.trim()||T('phase',i+1);
const feedback=(text,error=false)=>{$('feedback').textContent=text;$('feedback').classList.toggle('is-error',error);};
const fail=error=>feedback(T(error instanceof ToolError?error.code:'invalid'),true);
function label(text,input){const l=el('label','tool-field');l.append(el('span','',text),input);return l;}
function input(type,value,attrs={}){const n=el('input');n.type=type;n.value=value;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;}
function setupAudio(){if(!config.sound)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{/* Optional sound. */}}
function chime(){if(!config.sound||audio?.state!=='running')return;for(const[i,f]of [523.25,659.25,783.99].entries()){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.12;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.055,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.35);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.36);o.onended=()=>{o.disconnect();g.disconnect();};}}
function structural(c){return JSON.stringify(board?[c.teams.length,c.initial]:[c.phases.map(p=>p.seconds),c.cycles,c.autoAdvance]);}
function hasProgress(){return board?history.length>0||scores.some(s=>s!==config.initial):timer.status!=='idle';}
function resetProgress(){if(board){scores=initialScores(config);history=[];undos=[];}else timer=initialTimer(config);}
function save(){try{if(form.elements.activityRemember.checked)localStorage.setItem(storageKey,JSON.stringify(config));else localStorage.removeItem(storageKey);}catch{form.elements.activityRemember.checked=false;feedback(T('storageError'),true);}}
function readForm(){
 const next={...config};for(const key of ['title','background','accent'])next[key]=form.elements[key].value;
 next.scale=Number(form.elements.scale.value);next.sound=form.elements.sound.checked;
 if(board){for(const key of ['step','initial','target'])next[key]=Number(form.elements[key].value);for(const key of ['allowNegative','sort','showMembers'])next[key]=form.elements[key].checked;
 next.teams=[...$('editors').children].map(row=>({name:row.querySelector('[data-field=name]').value,color:row.querySelector('[data-field=color]').value,members:row.querySelector('textarea').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)}));
 }else{next.cycles=Number(form.elements.cycles.value);next.autoAdvance=form.elements.autoAdvance.checked;next.phases=[...$('editors').children].map(row=>{const mins=Number(row.querySelector('[data-field=minutes]').value),secs=Number(row.querySelector('[data-field=seconds]').value);if(!Number.isInteger(mins)||mins<0||!Number.isInteger(secs)||secs<0||secs>59)throw new ToolError('durationError');return {name:row.querySelector('[data-field=name]').value,seconds:mins*60+secs};});}
 return validateActivity(next,kind);
}
function commit(){
 try{const next=readForm(),changed=structural(next)!==structural(config);
 if(changed&&hasProgress()&&!confirm(T(board?'changeTeamsWarning':'timerChangeWarning'))){writeForm();return false;}
 if(board&&!next.allowNegative&&scores.some(n=>n<0)&&!changed)throw new ToolError('negativeScore');
 config=next;if(changed)resetProgress();if($('feedback').classList.contains('is-error'))feedback('');setupAudio();save();render();return true;
 }catch(error){fail(error);return false;}
}
function changeList(action,index){
 if(!commit())return;
 if(hasProgress()&&!confirm(T(board?'changeTeamsWarning':'timerChangeWarning')))return;
 const list=board?config.teams:config.phases;
 if(action==='add'){if(list.length>=(board?50:12))return;list.push(board?{name:'',color:TEAM_COLORS[list.length%6],members:[]}:{name:'',seconds:60});}
 else if(action==='remove'){if(list.length===1)return;list.splice(index,1);}
 else {const to=index+(action==='up'?-1:1);if(to<0||to>=list.length)return;[list[index],list[to]]=[list[to],list[index]];}
 resetProgress();writeForm();save();render();
}
function writeEditors(){
 const target=$('editors');target.replaceChildren();const list=board?config.teams:config.phases;
 list.forEach((item,i)=>{
  const row=el('div','activity-editor'),top=el('div','activity-editor-top'),actions=el('div','activity-editor-actions');top.append(el('strong','',T(board?'team':'phase',i+1)),actions);
  for(const[action,symbol,key,disabled]of [['up','↑','moveUp',i===0],['down','↓','moveDown',i===list.length-1],['remove','×','remove',list.length===1]]){const b=btn(symbol,()=>changeList(action,i));b.setAttribute('aria-label',T(key)+' '+T(board?'team':'phase',i+1));b.disabled=disabled;actions.append(b);}
  const name=input('text',item.name,{'data-field':'name',maxlength:'80',placeholder:T(board?'team':'phase',i+1)});row.append(top);
  if(board){const group=el('div','activity-team-name');group.append(label(T('teamName'),name),label(T('teamColor'),input('color',item.color,{'data-field':'color'})));const members=el('textarea');members.rows=3;members.maxLength=60000;members.value=item.members.join('\n');const detail=el('details');detail.append(el('summary','',T('people',item.members.length)),label(T('teamMembers'),members));row.append(group,detail);}
  else{const times=el('div','activity-time-inputs');times.append(label(T('minutes'),input('number',Math.floor(item.seconds/60),{'data-field':'minutes',min:0,max:1440,step:1,required:''})),label(T('seconds'),input('number',item.seconds%60,{'data-field':'seconds',min:0,max:59,step:1,required:''})));row.append(label(T('phaseName'),name),times);}
  target.append(row);
 });$('add').disabled=list.length>=(board?50:12);
}
function writeForm(){for(const[key,value]of Object.entries(config)){const field=form.elements[key];if(!field)continue;if(field.type==='checkbox')field.checked=value;else field.value=value;}writeEditors();}
function readable(hex){const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4),l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];return (l+.05)/.05>1.05/(l+.05)?'#17241e':'#ffffff';}
function appearance(){stage.style.backgroundColor=config.background;stage.style.setProperty('--activity-accent',config.accent);stage.style.setProperty('--activity-ink',readable(config.background));stage.style.setProperty('--activity-button-ink',readable(config.accent));stage.style.setProperty('--display-scale',config.scale/100);$('title').textContent=config.title.trim()||T(kind);$('scale-value').value=config.scale;}
function scoreEdit(index){
 const d=el('dialog','activity-score-dialog'),h=el('h2','',T('editScore',teamName(index)));h.id='activity-score-edit-heading';d.setAttribute('aria-labelledby',h.id);
 const n=input('number',scores[index],{min:config.allowNegative?-1000000:0,max:1000000,step:1,required:''}),f=el('form'),actions=el('div','dialog-actions');n.setAttribute('aria-label',T('score'));
 const close=()=>{d.close();d.remove();stage.querySelector(`[data-team-index="${index}"][data-score-action="edit"]`)?.focus({preventScroll:true});};const ok=btn(T('apply'),()=>{if(n.reportValidity()&&changeScore(index,Number(n.value)))close();},'button primary');actions.append(btn(T('cancel'),close),ok);f.append(n,actions);f.onsubmit=e=>{e.preventDefault();ok.click();};d.append(h,f);stage.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();n.focus();n.select();
}
function changeScore(index,value){
 if(!form.reportValidity()||!commit())return false;
 try{const next=updateScore(config,scores,index,value);if(value===scores[index])return true;undos.push({scores:[...scores],history:structuredClone(history)});if(undos.length>100)undos.shift();const before=scores[index];scores=next;history.push({index,name:teamName(index),before,after:value,time:new Date().toISOString()});if(history.length>1000)history.shift();renderBoard();feedback(T('scoreChanged',teamName(index),value));if(config.target>0&&before<config.target&&value>=config.target)chime();return true;}catch(error){fail(error);return false;}
}
function renderBoard(){
 const focused=document.activeElement?.dataset?.scoreAction,focusTeam=document.activeElement?.dataset?.teamIndex;
 const target=$('board');target.replaceChildren();const order=config.teams.map((_,i)=>i);if(config.sort)order.sort((a,b)=>scores[b]-scores[a]||a-b);
 for(const i of order){const article=el('article','score-team'),reached=config.target>0&&scores[i]>=config.target;article.style.setProperty('--team-color',config.teams[i].color);article.classList.toggle('is-target',reached);article.append(el('h2','',teamName(i)));
 article.style.setProperty('--score-chars',String(Math.max(3,String(scores[i]).length)));
 const value=btn(String(scores[i]),()=>scoreEdit(i),'score-value');value.setAttribute('aria-label',T('editScore',teamName(i))+': '+scores[i]);value.dataset.teamIndex=i;value.dataset.scoreAction='edit';article.append(value,el('p','score-target',reached?'★ '+T('reached'):''));
 const actions=el('div','score-adjust');for(const sign of [-1,1]){const b=btn((sign<0?'−':'＋')+config.step,()=>changeScore(i,scores[i]+sign*config.step),'button '+(sign>0?'score-plus':''));b.setAttribute('aria-label',teamName(i)+' '+(sign>0?'+':'−')+config.step);b.dataset.teamIndex=i;b.dataset.scoreAction=String(sign);b.disabled=!config.allowNegative&&scores[i]+sign*config.step<0;actions.append(b);}article.append(actions);
 if(config.showMembers&&config.teams[i].members.length){const d=el('details','score-members');d.append(el('summary','',T('people',config.teams[i].members.length)),el('p','',config.teams[i].members.join(' · ')));article.append(d);}target.append(article);}
 const max=Math.max(...scores),leaders=order.filter(i=>scores[i]===max);$('summary').textContent=leaders.length===config.teams.length&&leaders.length>1?T('equalScores'):T('leader',leaders.map(teamName).join(' / '));
 $('undo').disabled=!undos.length;const list=$('history');list.replaceChildren();if(!history.length)list.append(el('li','',T('noHistory')));else for(const item of history.toReversed()){const row=el('li');row.append(el('strong','',item.name),el('span','',`${item.before} → ${item.after} (${item.after-item.before>=0?'+':''}${item.after-item.before})`));list.append(row);}
 if(focused&&focusTeam!==undefined)target.querySelector(`[data-team-index="${focusTeam}"][data-score-action="${focused}"]`)?.focus({preventScroll:true});
}
let timerAnnouncement='';
function renderTimer(){
 timer=tickTimer(config,timer,Date.now());const status=timer.status,index=timer.index;
 $('time').textContent=formatDuration(timer.remaining);$('time').classList.toggle('has-hours',Math.ceil(timer.remaining/1000)>=3600);$('phase').textContent=phaseName(index);
 $('progress').value=Math.min(1,timer.remaining/(config.phases[index].seconds*1000));stage.classList.toggle('is-finished',status==='finished');
 const announcement=[status,index,timer.cycle,config.cycles,config.phases.length].join(':');
 if(announcement!==timerAnnouncement){$('summary').textContent=T('cycleProgress',timer.cycle+1,config.cycles)+' · '+T('phaseProgress',index+1,config.phases.length)+' · '+T({idle:'timerReady',running:'timerRunning',paused:'timerPaused',finished:'timerFinished'}[status]);
 if(timerAnnouncement&&status!=='idle'&&(status==='finished'||announcement.split(':').slice(1,3).join()!==timerAnnouncement.split(':').slice(1,3).join()))chime();timerAnnouncement=announcement;
 const timeline=$('timeline');timeline.replaceChildren();config.phases.forEach((p,i)=>{const tag=el('span','timer-stage-tag',phaseName(i)+' · '+formatDuration(p.seconds*1000));tag.classList.toggle('is-current',i===index);timeline.append(tag);});}
 $('start').hidden=status==='running';$('pause').hidden=status!=='running';$('start').textContent=T(status==='finished'?'timerAgain':status==='idle'?'timerStart':'timerResume');for(const key of ['next','plus','minus'])$(key).disabled=status==='finished';
}
function render(){appearance();if(board)renderBoard();else{timerAnnouncement='';renderTimer();}}
function timerControl(action,seconds=0){if(!form.reportValidity()||!commit())return;setupAudio();timer=controlTimer(config,timer,action,Date.now(),seconds);renderTimer();}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback(T('saved'));}
function rows(){return [[T('recordType'),T('teamName'),T('teamMembers'),T('score'),T('changeColumn'),T('timeColumn')],...config.teams.map((team,i)=>[T('results'),teamName(i),team.members.join(' / '),scores[i],'','']),...history.map(h=>[T('scoreHistory'),h.name,'',h.after,h.after-h.before,h.time])];}
function load(next){config=next;resetProgress();writeForm();save();render();feedback(T('loaded'));}
form.addEventListener('invalid',e=>{let p=e.target.closest('details');while(p){p.open=true;p=p.parentElement?.closest('details');}},true);
form.onsubmit=e=>e.preventDefault();form.addEventListener('change',()=>commit());form.addEventListener('input',e=>{if(['background','accent','scale','title'].includes(e.target.name))commit();});
$('add').onclick=()=>changeList('add');$('go').onclick=()=>{if(!form.reportValidity()||!commit())return;stage.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});(board?stage.querySelector('.score-value'):$('start')).focus({preventScroll:true});};
$('reset').onclick=()=>{if(!confirm(T(board?'resetScoreWarning':'timerResetWarning')))return;resetProgress();render();feedback('');};
if(board){$('undo').onclick=()=>{const previous=undos.pop();if(!previous)return;scores=previous.scores;history=previous.history;renderBoard();feedback(T('undoDone'));};$('csv').onclick=()=>{if(!commit())return;download(csv(rows()),'scoreboard-results.csv','text/csv;charset=utf-8');};$('copy').onclick=async()=>{try{if(!commit())return;await navigator.clipboard.writeText(rows().map(row=>row.join('\t')).join('\n'));feedback(T('copied'));}catch{feedback(T('copyError'),true);}};}
else{for(const[action,key]of [['start','start'],['pause','pause'],['next','next']])$(key).onclick=()=>timerControl(action);$('plus').onclick=()=>timerControl('adjust',30);$('minus').onclick=()=>timerControl('adjust',-30);$('sample').onclick=()=>{if(!confirm(T('replaceWarning')))return;load({...config,cycles:3,phases:[{name:T('discussion'),seconds:300},{name:T('presentation'),seconds:120},{name:T('break'),seconds:60}]});};setInterval(()=>renderTimer(),200);document.addEventListener('visibilitychange',()=>renderTimer());}

$('export').onclick=()=>{if(!form.reportValidity()||!commit())return;download(JSON.stringify(config,null,2),kind+'-settings.json','application/json');};$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];$('file').value='';if(!file)return;try{if(file.size>MAX_FILE_BYTES)throw new ToolError('fileLimit');let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new ToolError('configError');}const next=validateActivity(parsed,kind);if(!confirm(T('replaceWarning')))return;load(next);}catch(error){fail(error);}};
$('clear').onclick=()=>{if(!confirm(T('clearWarning')))return;form.elements.activityRemember.checked=false;load(activityDefaults(kind));feedback(T('cleared'));};
function needsWarning(){try{if(bridge?.isSaved()&&JSON.stringify(readForm())===JSON.stringify(config))return false;}catch{}if(hasProgress())return true;try{const draft=readForm(),same=JSON.stringify(draft);if(same===JSON.stringify(activityDefaults(kind)))return false;if(form.elements.activityRemember.checked&&same===localStorage.getItem(storageKey))return false;}catch{}return true;}
function mayLeave(){if(needsWarning()&&!confirm(T(!board&&hasProgress()?'timerLeaveWarning':'settingsLeaveWarning')))return false;navigationConfirmed=true;return true;}
document.addEventListener('languagechange-request',e=>{if(!mayLeave())e.preventDefault();});document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.hasAttribute('download')||a.hasAttribute('data-language-link')||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.target==='_blank')return;const to=new URL(a.href,location.href);if(!['http:','https:'].includes(to.protocol)||to.pathname===location.pathname&&to.search===location.search&&to.origin===location.origin)return;if(!mayLeave())e.preventDefault();});window.addEventListener('beforeunload',e=>{if(!navigationConfirmed&&needsWarning()){e.preventDefault();e.returnValue='';}});
try{const stored=localStorage.getItem(storageKey);if(stored){config=validateActivity(JSON.parse(stored),kind);form.elements.activityRemember.checked=true;}}catch{feedback(T('storageError'),true);}
resetProgress();writeForm();render();
if(board){try{const received=takeHandoff(sessionStorage,kind);if(received){if(JSON.stringify(config)!==JSON.stringify(activityDefaults(kind))&&!confirm(T('transferReplace')))feedback(T('transferCancelled'));else{load(validateActivity({...config,title:received.title,teams:received.teams,allowNegative:received.scores?.some(s=>s<0)||config.allowNegative},kind));if(received.scores){scores=[...received.scores];render();}feedback(T('transferTeamsSuccess'));}}}catch{feedback(T('transferError'),true);}}

bridge=toolBridge(host,{kind,config:()=>config,progress:()=>board?{scores:[...scores],history:structuredClone(history)}:tickTimer(config,timer,Date.now()),prepare:()=>form.reportValidity()&&commit(),load:(c,p)=>{config=structuredClone(c);resetProgress();if(p){if(board){scores=[...p.scores];history=structuredClone(p.history||[]);}else timer={...p};}writeForm();save();render();},view:()=>audienceView(config,board?{scores}:timer,T)});
