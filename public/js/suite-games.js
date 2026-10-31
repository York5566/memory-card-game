import {createSuite,T,el,button,input,label,select,nameImporter,csvDownload,printNodes,imagePicker} from './suite-ui.js';
function remember(stack,state){stack.push(structuredClone(state));while(stack.length>1&&(stack.length>30||stack.reduce((n,v)=>n+JSON.stringify(v).length,0)>12000000))stack.shift();}
import {lines,arrangeSeats,swapSeats,placeSeat,seatingValid,validateSuite,nextDice,diceSettingsPlan,diceRemaining,SuiteError} from './suite-core.js';
export function seating(){
 const s=createSuite('seating');let mode='assign',view=matchMedia('(max-width:700px)').matches?'list':'map',selected=null,undoButton=null,showRules=()=>{};const undo=[];
 s.onRestore(()=>{undo.length=0;selected=null;});
 s.readWith(next=>{if(lines(next.names).join('\n')!==s.state.names||['rows','cols','perTable'].some(k=>next[k]!==s.state[k]))throw new SuiteError('suiteApplyFirst');return next;});
 const ensureLayout=()=>{if(lines(s.controls.names.value).join('\n')!==s.state.names||['rows','cols','perTable'].some(k=>Number(s.controls[k].value)!==s.state[k]))throw new SuiteError('suiteApplyFirst');};
 const focusSeat=i=>s.stage.querySelector('[data-seat="'+i+'"]')?.focus({preventScroll:true});
 function assign(i){
  ensureLayout();const v=s.state,names=lines(v.names),dialog=el('dialog','tool-move-dialog seat-assign-dialog'),title=el('h2','',T('seatTable',Math.floor(i/v.perTable)+1)+' · '+(i%v.perTable+1));
  title.id='seat-assign-title';dialog.setAttribute('aria-labelledby',title.id);
  const values=[['',T('uxSeatKeepEmpty')],...names.map((name,n)=>{const at=v.seats.indexOf(n);return [String(n),at<0?T('uxSeatUnassigned',name):T('uxSeatAt',name,Math.floor(at/v.perTable)+1,at%v.perTable+1)];})];
  const person=select(values,v.seats[i]==null?'':String(v.seats[i]));person.dataset.seatPerson='';
  for(const o of person.options){const at=o.value===''?-1:v.seats.indexOf(Number(o.value));o.disabled=at>=0&&at!==i&&v.locked.includes(at);}
  const pin=input('checkbox','');pin.dataset.seatPin='';const pinLabel=el('label','tool-check');pinLabel.append(pin,el('span','',T('uxSeatPinAfter')));
  const error=el('p','tool-feedback');error.setAttribute('role','alert');const actions=el('div','dialog-actions');
  actions.append(button(T('cancel'),()=>dialog.close()),button(T('uxSeatConfirm'),()=>{
   try{ensureLayout();const seats=placeSeat(s.state,i,person.value===''?null:Number(person.value)),next={...s.state,seats,locked:pin.checked?[...new Set([...s.state.locked,i])]:s.state.locked};if(JSON.stringify(next)!==JSON.stringify(s.state)){remember(undo,s.state);s.set(next);}dialog.close();render();s.note(T('uxSeatSaved'));}
   catch(e){error.textContent=T(e.code||'seatRuleError');error.classList.add('is-error');}
  },'button primary'));
  dialog.append(title,label(T('uxSeatPerson'),person),el('p','tool-note',T('uxSeatPlaceHint')),pinLabel,error,actions);s.root.querySelector('#suite-stage').append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();focusSeat(i);},{once:true});dialog.showModal();person.focus();
 }
 function render(){
  const active=s.stage.querySelector(':focus')?.dataset.seat;s.stage.replaceChildren();
  const v=s.state,names=lines(v.names),front=el('div','seat-front',v.front),grid=el('div','seating-grid'+(view==='list'?' seating-by-table':''));grid.style.setProperty('--seat-cols',v.cols);grid.style.setProperty('--accent',v.accent);s.stage.style.background=v.background;grid.style.fontFamily=v.fontFamily;
  const swap=(a,b)=>{ensureLayout();const next=swapSeats(s.state,a,b);if(a!==b){remember(undo,s.state);s.set({...s.state,seats:next});}selected=null;render();focusSeat(b);};
  for(let t=0;t<v.rows*v.cols;t++){
   const table=el('section','seat-table');table.append(el('h3','',T('seatTable',t+1)));
   for(let j=0;j<v.perTable;j++){
    const i=t*v.perTable+j,n=v.seats[i],blocked=v.blocked.includes(i),locked=v.locked.includes(i);
    const b=button(blocked?'—':n==null?T('seatEmpty'):names[n],()=>{
     if(mode==='assign'){void s.run(()=>assign(i));return;}
     if(mode==='swap'){void s.run(()=>{ensureLayout();if(selected===null){selected=i;render();focusSeat(i);}else if(selected===i){selected=null;render();focusSeat(i);}else swap(selected,i);});return;}
     void s.run(()=>{ensureLayout();const next=structuredClone(s.state),key=mode==='lock'?'locked':'blocked';if(mode==='block'&&next.locked.includes(i)||mode==='lock'&&next.blocked.includes(i))throw new SuiteError('seatLocked');if(next[key].includes(i))next[key]=next[key].filter(n=>n!==i);else{next[key].push(i);if(mode==='block')next.seats[i]=null;}validateSuite(next,'seating');remember(undo,s.state);s.set(next);selected=null;render();focusSeat(i);});
    },'seat'+(selected===i?' selected':'')+(locked?' locked':'')+(blocked?' blocked':'')+(n==null?' empty-seat':''));
    b.dataset.seat=i;b.style.fontSize=Math.min(40,v.fontSize)+'px';b.setAttribute('aria-label',T('seatTable',t+1)+' · '+(j+1)+' · '+b.textContent+(locked?' · '+T('seatLocked'):''));
    b.disabled=['assign','swap'].includes(mode)&&(locked||blocked);b.draggable=mode==='swap'&&!locked&&!blocked;
    b.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const data=e.dataTransfer.getData('text/plain'),from=Number(data);if(data!==''&&mode==='swap'&&Number.isInteger(from)&&from>=0&&from<v.seats.length)void s.run(()=>swap(from,i));};table.append(b);
   }grid.append(table);
  }
  const unseated=names.filter((_,i)=>!v.seats.includes(i)),open=v.seats.filter((n,i)=>n===null&&!v.blocked.includes(i)&&!v.locked.includes(i)).length;
  s.stage.append(el('p','seat-mode-help seat-editor-only',T(mode==='assign'?'uxSeatAssignHelp':mode==='swap'?(selected===null?'workSeatSwap':'workSeatSecond'):mode==='lock'?'workSeatLock':'workSeatBlock')),el('p','seat-progress',T('uxSeatAssigned',names.length-unseated.length,names.length,open)),front,grid);
  if(unseated.length)s.stage.append(el('p','seat-unassigned',T('uxSeatUnassigned',unseated.join(' · '))));
  if(view==='map')s.stage.append(el('p','tool-note seat-editor-only',T('uxSeatScroll')));
  if(!seatingValid(v))s.stage.prepend(el('p','tool-feedback is-error',T('uxSeatRulePending')));
  if(undoButton)undoButton.disabled=!undo.length;
  if(active!==undefined)focusSeat(active);
 }
 s.build(v=>{
  const n=s.field('names','sNames','textarea',{maxlength:15000,rows:6});nameImporter(s,n);
  s.form.append(el('p','tool-note',T('sNameHint')),el('p','tool-note',T('suiteRuleSummary')));
  for(const[key,title,min,max]of [['rows','seatRows',1,10],['cols','seatCols',1,10],['perTable','seatEach',1,12]])s.field(key,title,'number',{min,max});
  s.field('front','seatFront','text',{maxlength:100});
  const rules=el('details','tool-details');rules.append(el('summary','',T('seatRules')));s.form.append(rules);
  const list=el('div'),a=select(lines(v.names).map((name,i)=>[i,(i+1)+'. '+name]),0),b=select(lines(v.names).map((name,i)=>[i,(i+1)+'. '+name]),1),same=select([['same',T('seatSame')],['apart',T('seatApart')]],'apart');
  showRules=()=>{list.replaceChildren(...s.state.rules.map((r,i)=>{const row=el('div','tool-row');row.append(el('span','',lines(s.state.names)[r.a]+' · '+T(r.same?'seatSame':'seatApart')+' · '+lines(s.state.names)[r.b]),button(T('sRemove'),()=>s.run(()=>{ensureLayout();const next=structuredClone(s.state);next.rules.splice(i,1);remember(undo,s.state);s.set(next);showRules();render();})));return row;}));};
  rules.append(list,label(T('sName')+' 1',a),label(T('sName')+' 2',b),same,button(T('seatAddRule'),()=>s.run(()=>{
   ensureLayout();if(a.value===b.value)throw new SuiteError();
   const rule={a:Number(a.value),b:Number(b.value),same:same.value==='same'},existing=s.state.rules.find(r=>r.a===rule.a&&r.b===rule.b||r.a===rule.b&&r.b===rule.a);
   if(existing){if(existing.same!==rule.same)throw new SuiteError('seatRuleError');return;}
   const next=validateSuite({...s.state,rules:[...s.state.rules,rule]},'seating');remember(undo,s.state);s.set(next);showRules();render();
  })));showRules();s.style();
  s.action('suiteApply',()=>{
   const raw={...s.state,names:lines(n.value).join('\n'),rows:Number(s.controls.rows.value),cols:Number(s.controls.cols.value),perTable:Number(s.controls.perTable.value),front:s.controls.front.value,title:s.controls.title.value,accent:s.controls.accent.value,background:s.controls.background.value,fontSize:Number(s.controls.fontSize.value),fontFamily:s.controls.fontFamily.value};
   const rebuild=['names','rows','cols','perTable'].some(k=>raw[k]!==s.state[k]);
   if(rebuild){const checked=validateSuite({...raw,seats:[],locked:[],blocked:[],rules:[]},'seating');const hasLayout=s.state.seats.some(n=>n!=null)||s.state.locked.length||s.state.blocked.length||s.state.rules.length;if(hasLayout&&!confirm(T('workSeatRebuild')))return;Object.assign(raw,checked);}
   s.set(raw);if(rebuild){s.state.seats=new Array(raw.rows*raw.cols*raw.perTable).fill(null);undo.length=0;selected=null;}s.refresh();s.note(T('uxSeatSettings'));
  },true,s.form).textContent=T('uxSeatApply');
  const modes=select([['assign',T('uxSeatAssign')],['swap',T('seatSwap')],['lock',T('seatLock')],['block',T('seatBlock')]],mode);modes.dataset.seatMode='';modes.onchange=()=>{mode=modes.value;selected=null;render();};const views=select([['map',T('uxSeatMap')],['list',T('uxSeatList')]],view);views.dataset.seatView='';views.onchange=()=>{view=views.value;render();};const bar=el('div','seat-control-fields');bar.append(label(T('workSeatMode'),modes),label(T('uxSeatView'),views));s.actions.append(bar);
  s.action('seatRandom',()=>{ensureLayout();const next=s.get(),seats=arrangeSeats(next);remember(undo,s.state);s.set({...next,seats});render();},true);
  undoButton=s.action('sUndo',()=>{ensureLayout();if(undo.length){const previous=undo.pop();s.set({...s.state,seats:previous.seats,locked:previous.locked,blocked:previous.blocked,rules:previous.rules});selected=null;showRules();render();}});
  s.action('sExportCSV',()=>csvDownload([[T('seatTable',''),T('sName')],...s.state.seats.map((n,i)=>[Math.floor(i/s.state.perTable)+1,n==null?'':lines(s.state.names)[n]])],'seating.csv'));
  s.action('suitePrint',()=>{const print=s.stage.cloneNode(true);print.removeAttribute('id');print.querySelector('.seating-grid')?.classList.remove('seating-by-table');print.querySelectorAll('.seat-editor-only').forEach(n=>n.remove());printNodes([print]);});
  s.form.append(el('p','tool-note',T('uxSeatAssignHelp')),el('p','tool-note',T('seatHint')));
  if(!v.seats.length)s.state.seats=new Array(v.rows*v.cols*v.perTable).fill(null);render();
 });return s;
}
export function dice(){
 const s=createSuite('dice'),undo=[];let applying=false,rollButton,remainingButton,resetButton,undoButton,releaseButton;
 s.onRestore(()=>undo.length=0);
 const pending=()=>{s.get();};
 function render(){
  const active=s.stage.querySelector(':focus')?.dataset.die;s.note('');s.stage.replaceChildren();const v=s.state;
  s.stage.style.background=v.background;const results=el('div','dice-results');
  v.results.forEach((n,i)=>{
   const f=v.faces[n],held=Boolean(v.held[i]);
   const tile=v.mode==='dice'?button('',()=>s.run(()=>{pending();remember(undo,s.state);const held=[...s.state.held];held[i]=!held[i];s.set({...s.state,held});render();s.stage.querySelector('[data-die="'+i+'"]')?.focus({preventScroll:true});}),'dice-face'+(held?' held':'')):el('div','dice-face deck-card');
   if(v.mode==='dice'){tile.dataset.die=i;tile.setAttribute('aria-pressed',String(held));tile.setAttribute('aria-label',T('uxDiceTile',i+1,f.label,T(held?'uxDiceHeld':'uxDiceFree')));}
   tile.style.borderColor=v.accent;if(f.image){const img=el('img');img.src=f.image;img.alt='';tile.append(img);}
   tile.append(el('span','dice-label',f.label));tile.style.fontSize=v.fontSize+'px';tile.style.fontFamily=v.fontFamily;
   if(v.mode==='dice')tile.append(el('small','dice-hold-label',T(held?'uxDiceHeld':'uxDiceFree')));results.append(tile);
  });
  s.stage.append(el('h2','',v.title||T(v.mode==='dice'?'diceRoll':'diceDraw')),results);
  const held=v.results.filter((_,i)=>v.held[i]).length,allHeld=v.mode==='dice'&&v.results.length===v.count&&held===v.count,remaining=diceRemaining(v),short=v.mode==='deck'&&!v.replacement&&remaining<v.count;
  if(!v.results.length)s.stage.append(el('p','tool-empty',T(v.mode==='dice'?'uxDiceStart':'uxDeckStart',v.count)));
  if(v.mode==='dice'&&v.results.length)s.stage.append(el('p','dice-round-state',T(allHeld?'uxDiceAllHeld':'uxDiceHeldCount',held,v.count)),el('p','tool-note',T('workDiceHold')));
  if(v.mode==='deck')s.stage.append(el('p','dice-round-state',T(v.replacement?'uxDeckReplacement':remaining?'diceRemaining':'uxDeckEmpty',remaining)));
  rollButton.disabled=allHeld||short;rollButton.textContent=T(v.mode==='dice'?'diceRoll':short&&remaining===0?'uxDrawComplete':'diceDraw');
  remainingButton.hidden=!short||remaining===0;remainingButton.textContent=T('uxDeckRemainder',remaining);
  releaseButton.hidden=v.mode!=='dice'||!held;undoButton.disabled=!undo.length;resetButton.hidden=!v.history.length;
  const h=el('details','dice-history');h.hidden=!v.history.length;h.dataset.focusSecondary='';h.append(el('summary','',T('sHistory')));v.history.forEach(row=>h.append(el('p','',row.map(i=>v.faces[i].label).join(' · '))));s.stage.append(h);
  if(active!==undefined)s.stage.querySelector('[data-die="'+active+'"]')?.focus({preventScroll:true});
 }
 s.build(v=>{
  const mode=s.field('mode','diceMode',[['dice',T('diceRoll')],['deck',T('diceDraw')]]),faces=el('textarea');faces.rows=6;faces.maxLength=11000;faces.value=v.faces.map(f=>f.label).join('\n');faces.dataset.diceFaces='';faces.oninput=()=>s.dirty();
  s.readWith(next=>{const plan=diceSettingsPlan(s.state,next,faces.value);if(plan.reset&&!applying)throw new SuiteError('suiteApplyFirst');return plan.state;});
  s.form.append(label(T('diceFaces'),faces));s.field('count','diceCount','number',{min:1,max:12});const replacement=s.field('replacement','diceReplace','checkbox');
  const showMode=()=>replacement.closest('label').hidden=mode.value!=='deck';mode.addEventListener('change',showMode);showMode();
  const images=el('details','tool-details');images.append(el('summary','',T('diceImages')),el('p','tool-note',T('uxDiceImagesHint')));
  v.faces.forEach((f,i)=>{const box=el('div');box.append(el('p','',f.label));const draw=()=>{box.querySelector('.play-image-picker')?.remove();box.append(imagePicker(s.state.faces[i].image,value=>{try{pending();s.set({...s.state,faces:s.state.faces.map((f,j)=>i===j?{...f,image:value}:f)});draw();render();}catch(e){s.error(e);}},()=>s.error(new SuiteError('imgError'))));};draw();images.append(box);});s.form.append(images);s.style();
  s.action('suiteApply',()=>{
   let next;applying=true;try{next=s.get();}finally{applying=false;}
   const reset=diceSettingsPlan(s.state,next,faces.value).reset;
   if(reset&&(s.state.history.length||s.state.results.length)&&!confirm(T('uxDiceRestart')))return;
   s.set(next);if(reset)undo.length=0;s.refresh();s.note(T('uxDiceSettingsSaved'));
  },true,s.form).textContent=T('uxDiceApply');
  const roll=remainingOnly=>{pending();const next=nextDice(s.state,undefined,{remainingOnly});remember(undo,s.state);s.set(next);render();};
  rollButton=s.action(v.mode==='dice'?'diceRoll':'diceDraw',()=>roll(false),true);
  remainingButton=s.action('uxDeckRemainder',()=>roll(true),true);remainingButton.dataset.diceRemainder='';
  releaseButton=s.action('uxDiceRelease',()=>{pending();remember(undo,s.state);s.set({...s.state,held:[]});render();});releaseButton.dataset.diceRelease='';
  undoButton=s.action('sUndo',()=>{pending();if(undo.length){const p=undo.pop();s.set({...s.state,results:p.results,held:p.held,remaining:p.remaining,history:p.history});render();}});
  resetButton=s.action('diceReset',()=>{pending();if(confirm(T('uxDiceClear'))){remember(undo,s.state);s.set({...s.state,results:[],held:[],remaining:[],history:[]});render();}});delete resetButton.dataset.focusSecondary;
  s.form.append(el('p','tool-note',T('uxDiceSettingsHint')));render();
 });return s;
}
