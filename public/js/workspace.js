import { EVENT_KINDS, EVENT_PREFIX, EVENT_FILE_LIMIT, listEvents, newEvent, readEvent, writeEvent, validateEvent, duplicateEvent, toolDefaults, validID } from './event-core.js';
import { ToolError } from './tools-core.js';
import { activityURL } from './activity-handoff.js';
import { T, el, button, input, label, select, download } from './tool-ui.js';
const list=document.getElementById('event-list'),detail=document.getElementById('event-detail'),status=document.getElementById('event-status');
let current=null,editor=null,externalChange=false,initialized=false;
const feedback=(s,error=false)=>{status.textContent=s;status.classList.toggle('is-error',error);};
const errorText=e=>T(e instanceof ToolError?e.code:'storageError'),fail=e=>feedback(errorText(e),true);
function commit(next){current=writeEvent(localStorage,next,current.revision);render();}
function toolLink(kind,resume){
 const slot=current.slots[kind],link=el('a','button'+(resume||!slot.progress?' primary':''),T(resume?'eventResume':slot.progress?'eventFresh':'open'));
 const url=new URL(activityURL(kind,document.body.dataset.base,document.documentElement.lang),location.origin);
 url.searchParams.set('event',current.id);url.searchParams.set('resume',resume?'1':'0');link.href=url.href;link.target='_blank';link.rel='noopener';link.dataset.eventOpen=kind;return link;
}
function openEditor(title,build,save){
 const opener=document.activeElement,dialog=el('dialog','tool-move-dialog event-editor'),heading=el('h2','',title),form=el('form'),error=el('p','tool-feedback');
 heading.id='event-editor-title';dialog.setAttribute('aria-labelledby',heading.id);error.setAttribute('role','alert');
 const read=build(form),actions=el('div','dialog-actions'),submit=el('button','button primary',T('eventSave'));submit.type='submit';
 actions.append(button(T('cancel'),()=>dialog.close()),submit);form.append(error,actions);dialog.append(heading,form);document.body.append(dialog);editor=dialog;
 form.onsubmit=e=>{e.preventDefault();try{save(read());dialog.close();feedback(T('eventSaved'));}catch(e){error.textContent=errorText(e);error.classList.add('is-error');}};
 dialog.addEventListener('close',()=>{dialog.remove();editor=null;if(externalChange){externalChange=false;refreshCurrent();feedback(T('uxActivityRefreshed'));}if(opener?.isConnected)opener.focus();else detail.querySelector('h2')?.focus();},{once:true});
 dialog.showModal();form.querySelector('input,select')?.focus();
}
function editName(copy=false){
 const snapshot=structuredClone(current);
 openEditor(T(copy?'eventCopy':'eventRename'),form=>{
  const name=input('text',copy?T('uxActivityCopyName',snapshot.title.slice(0,60)):snapshot.title,{maxlength:80,required:''}),progress=input('checkbox','');
  form.append(label(T('eventName'),name));
  if(copy){const check=el('label','tool-check');check.append(progress,el('span','',T('eventWithProgress')));form.append(check,el('p','tool-note',T('uxActivityCopyHint')));}
  return ()=>({title:name.value.trim(),progress:progress.checked});
 },value=>{
  const latest=readEvent(localStorage,snapshot.id);if(latest.revision!==snapshot.revision)throw new ToolError('eventConflict');
  if(copy)current=writeEvent(localStorage,duplicateEvent(snapshot,value.title,value.progress));
  else current=writeEvent(localStorage,{...snapshot,title:value.title},snapshot.revision);render();
 });
}
function editPresentation(){
 const snapshot=structuredClone(current),p=snapshot.presentation;
 openEditor(T('displaySettings'),form=>{
  const announcement=input('text',p.announcement,{maxlength:200}),scale=input('range',p.scale,{min:70,max:160,step:10}),value=el('output','',p.scale+'%'),bg=input('color',p.background),accent=input('color',p.accent),layout=select([['grid',T('displayGrid')],['stack',T('displayStack')]],p.layout),members=input('checkbox','');members.checked=p.showMembers;
  scale.oninput=()=>value.textContent=scale.value+'%';
  const checks=el('fieldset','display-tool-checks');checks.append(el('legend','',T('displayVisible')));
  for(const kind of EVENT_KINDS){const c=input('checkbox',kind);c.checked=p.visible.includes(kind);const l=el('label','tool-check');l.append(c,el('span','',T(kind)));checks.append(l);}
  const mem=el('label','tool-check');mem.append(members,el('span','',T('showMembers')));
  form.append(label(T('announcement'),announcement),checks,label(T('layout'),layout),label(T('activityScale'),scale),value,label(T('activityBackground'),bg),label(T('activityAccent'),accent),mem,el('p','tool-note',T('displayHint')));
  return ()=>({visible:[...checks.querySelectorAll('input:checked')].map(c=>c.value),announcement:announcement.value,scale:Number(scale.value),background:bg.value,accent:accent.value,layout:layout.value,showMembers:members.checked});
 },presentation=>{current=writeEvent(localStorage,{...snapshot,presentation},snapshot.revision);render();});
}
function refreshCurrent(){
 try{const events=listEvents(localStorage);current=current&&events.some(e=>e.id===current.id)?readEvent(localStorage,current.id):events.length?readEvent(localStorage,events[0].id):null;render();}catch(e){fail(e);}
}
function render(){
 const events=listEvents(localStorage);list.replaceChildren();list.append(el('h2','event-list-heading',T('uxActivityList',events.length)));
 for(const e of events){const b=button(e.title,()=>{try{current=readEvent(localStorage,e.id);render();feedback('');}catch(error){fail(error);}},'event-list-item');b.setAttribute('aria-current',String(current?.id===e.id));list.append(b);}
 detail.replaceChildren();const create=document.getElementById('event-new');if(create&&(!initialized||!events.length))create.open=!events.length;initialized=true;
 if(!current){const empty=el('div','event-empty');empty.append(el('h2','',T('uxActivityStart')),el('p','',T('uxActivityEmpty')),button(T('eventCreate'),()=>{if(create)create.open=true;document.querySelector('#event-create [name=title]').focus();},'button primary'));detail.append(empty);return;}
 const added=EVENT_KINDS.filter(k=>current.slots[k]),available=EVENT_KINDS.filter(k=>!current.slots[k]);
 const top=el('section','event-panel'),title=el('h2','',current.title);title.tabIndex=-1;
 top.append(title,el('p','tool-note',T('uxActivitySummary',added.length)),el('p','tool-note',T('uxActivityLocal')));
 const actions=el('div','tool-row');actions.append(button(T('eventExport'),()=>{try{download(JSON.stringify(readEvent(localStorage,current.id)),'activity-backup.json');}catch(e){fail(e);}}),button(T('displaySettings'),editPresentation));
 const management=el('details','event-management');management.append(el('summary','',T('uxActivityManage')));
 const manageRow=el('div','tool-row');manageRow.append(button(T('eventRename'),()=>editName()),button(T('eventCopy'),()=>editName(true)),button(T('eventReload'),()=>{refreshCurrent();feedback(T('loaded'));}),button(T('remove'),()=>{
  if(confirm(T('eventDelete')))try{const latest=readEvent(localStorage,current.id);if(latest.revision!==current.revision)throw new ToolError('eventConflict');localStorage.removeItem(EVENT_PREFIX+current.id);current=null;refreshCurrent();}catch(e){fail(e);}
 },'button small tool-danger'));management.append(manageRow);top.append(actions,management);detail.append(top);
 const cards=el('div','event-tools');
 for(const kind of added){
  const slot=current.slots[kind],card=el('article','event-tool');card.dataset.eventTool=kind;
  card.append(el('h3','',T(kind)),el('p','tool-note',T(slot.progress?'eventHasProgress':'eventNoProgress')));
  const row=el('div','tool-row');row.append(toolLink(kind,Boolean(slot.progress)));
  const more=el('details','event-tool-options');more.append(el('summary','',T('uxActivityToolOptions')));
  const options=el('div','tool-row');if(slot.progress)options.append(toolLink(kind,false));
  options.append(button(T('remove'),()=>{if(confirm(T('eventRemoveTool')))try{const next=structuredClone(current);delete next.slots[kind];commit(next);}catch(e){fail(e);}},'button small tool-danger'));
  more.append(options);card.append(row,more);cards.append(card);
 }
 if(added.length)detail.append(el('h2','event-section-title',T('uxActivityContinue')),el('p','tool-note',T('uxActivityReturnSave')),cards);
 if(available.length){
  const add=el('details','event-add-tools');add.open=!added.length;add.append(el('summary','',T('uxActivityAdd',available.length)),el('p','tool-note',T('uxActivityAddHint')));
  const choices=el('div','event-add-grid');for(const kind of available)choices.append(button(T('eventAddTool')+' · '+T(kind),()=>{
   try{const next=structuredClone(current);next.slots[kind]={config:toolDefaults(kind),progress:null,revision:1};commit(next);detail.querySelector('[data-event-open="'+kind+'"]')?.focus();feedback(T('uxActivityAdded',T(kind)));}catch(e){fail(e);}
  }));
  add.append(choices);detail.append(add);
 }
}
document.getElementById('event-create').onsubmit=e=>{e.preventDefault();try{current=writeEvent(localStorage,newEvent(e.target.elements.title.value));e.target.reset();document.getElementById('event-new').open=false;render();feedback(T('uxActivityCreated'));}catch(error){fail(error);}};
document.getElementById('event-import').onclick=()=>document.getElementById('event-file').click();
document.getElementById('event-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>EVENT_FILE_LIMIT)throw new ToolError('largeActivity');let raw;try{raw=JSON.parse(await file.text());}catch{throw new ToolError('configError');}const checked=validateEvent(raw);current=writeEvent(localStorage,duplicateEvent(checked,checked.title,true));render();feedback(T('loaded'));}catch(error){fail(error);}};
try{const id=new URL(location.href).searchParams.get('event');if(validID(id))current=readEvent(localStorage,id);else {const events=listEvents(localStorage);if(events.length)current=readEvent(localStorage,events[0].id);}render();}catch(e){render();fail(e);}
window.addEventListener('storage',e=>{if(!e.key||e.key.startsWith(EVENT_PREFIX)){if(editor){externalChange=true;feedback(T('eventConflict'));}else refreshCurrent();}});
