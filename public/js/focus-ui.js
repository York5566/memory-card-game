import {T,el,button} from './tool-ui.js';
import {validateShortcuts,validShortcut,shortcutName} from './focus-core.js';
import {workflowProfile} from './workflow-core.js';

const controllers = new Map();
let active = null, initialized = false;
const visible = node => Boolean(node && node.getClientRects().length && !node.closest('[hidden],[inert]') &&
  (!document.fullscreenElement || document.fullscreenElement.contains(node) || node.closest('dialog[open]')));
const usable = node => visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
const editing = node => Boolean(node?.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]'));
const actionLabel = action => T(({primary:'focusPrimary',pause:'focusPause',next:'focusNext',previous:'focusPrevious',undo:'focusUndo',redo:'focusRedo',hint:'focusHint',reveal:'focusReveal',scoreUp:'focusScoreUp',scoreDown:'focusScoreDown',scoreNext:'focusScoreNext',scorePrevious:'focusScorePrevious',fullscreen:'fullscreen',settings:'focusSettings',more:'focusMore'})[action]);
const configurations = [
  ['#tool-stage','#tool-fullscreen','#tool-form','.tool-stage-top'],
  ['#activity-stage','#activity-fullscreen','#activity-form','.tool-stage-top'],
  ['#play-stage','#play-fullscreen','#play-form','.tool-stage-top'],
  ['#suite-stage','#suite-fullscreen','.suite-settings','.suite-stage-top'],
  ['#mini-stage','#mini-fullscreen','#mini-settings','.mini-stage-header'],
  ['.solo-panel','#fullscreen',null,'.solo-tools'],
  ['#pk-panel','#pk-fullscreen',null,'.pk-top-actions'],
  ['.party-panel',null,null,null]
];

function install(stage, fullSelector, settingsSelector, headingSelector) {
  if(stage.matches('.party-panel')&&!stage.querySelector('.party-setup'))return;
  if (controllers.has(stage)) return;
  const owner = stage.closest('[data-mini],[data-suite],[data-play],[data-activity],[data-tool]'),
    kind = stage.matches('.party-panel') ? 'party' : owner?.dataset.mini || owner?.dataset.suite || owner?.dataset.play || owner?.dataset.activity || owner?.dataset.tool ||
      (stage.matches('.solo-panel')?'memory':stage.id==='pk-panel'?'pk':'party');
  const profile = workflowProfile(kind);
  const settings = settingsSelector && document.querySelector(settingsSelector);
  let heading = headingSelector && stage.querySelector(headingSelector);
  if (!heading) { heading = el('div','focus-party-heading'); stage.prepend(heading); }
  stage.classList.add('focus-stage'); stage.tabIndex = -1;
  stage.dataset.focusKind=kind;
  if(profile.editor)owner?.classList.add('workflow-editor');
  if(owner?.dataset.suite&&heading?.querySelector('h2'))heading.querySelector('h2').textContent=T(profile.resultLabel||kind);
  const full = (fullSelector && stage.querySelector(fullSelector)) || button('⛶',()=>{});
  if (!full) return;
  const menu = el('div','focus-toolbar'), more = button(T('focusMore'),()=>toggleMore()),
    keys = button('⌨',()=>openKeys()), gear = button('⚙',()=>showSettings());
  keys.ariaLabel = T('focusKeys'); keys.title = T('focusKeys');
  keys.append(el('span','focus-key-label',T('focusKeys')));
  gear.ariaLabel = T('focusSettings'); gear.title = T('focusSettings');
  full.classList.add('focus-fullscreen');
  menu.append(more,keys);
  keys.hidden=!profile.keys;
  if (!profile.editor && (settings || kind==='memory' || kind==='pk')) menu.append(gear);
  if(profile.fullscreen)menu.append(full);else full.remove();
  heading.append(menu);
  let wrapper = null, marker = null, dialog = null, focusedBefore = null, expanded = false, changedInert = [], oldOverflow = '', frame = 0;
  if (settings && settings.id !== 'mini-settings' && !profile.editor) {
    wrapper = el('details','focus-settings-wrap');
    wrapper.open = profile.settingsOpen;
    settings.before(wrapper); wrapper.append(el('summary','',T(profile.settingsLabel)),settings);
    const workspace = wrapper.parentElement;
    workspace.classList.add('focus-workspace');
    const sync = () => workspace.classList.toggle('settings-collapsed',!wrapper.open);
    wrapper.addEventListener('toggle',sync); sync();
    const back = button(T('focusBack'),()=>{ wrapper.open=false; stage.scrollIntoView({block:'start',behavior:'instant'}); stage.focus({preventScroll:true}); },'button focus-settings-back');
    settings.append(back);
    gear.classList.add('focus-fullscreen-only');
  }
  if (kind==='memory') gear.hidden=true; // Memory already has its own settings dialog and visible button.
  if (kind==='pk') gear.hidden=true;
  const supported = {
    picker:['primary','undo'],groups:['primary','undo'],scoreboard:['scoreUp','scoreDown','scoreNext','scorePrevious','undo'],timer:['pause','next'],
    bingo:['primary','undo'],quiz:['pause','next','previous','undo','reveal'],tournament:[],
    puzzle:['primary','pause','hint','next'],reveal:['primary','pause','hint','next'],sequence:['primary','pause','hint','next'],
    reaction:['primary','pause','next'],differences:['primary','pause','hint','next'],charades:['primary','pause','next','reveal'],
    drawing:['primary','pause','next','reveal'],dice:['primary','undo'],seating:['primary','undo'],
    whiteboard:['undo','redo','next','previous'],memory:['primary','pause'],pk:['primary'],
    party:['primary','next','reveal']
  }[kind] || [];
  const actions = profile.keys ? [...supported,...(profile.fullscreen?['fullscreen']:[]),...(!profile.editor&&(settings||kind==='memory'||kind==='pk')?['settings']:[]),...(!profile.editor?['more']:[])] : [];
  const storageKey = 'toolbox-shortcuts-v1:'+kind;
  let bindings = validateShortcuts({},actions);
  let selectedTeam = '0';
  try { bindings = validateShortcuts(JSON.parse(localStorage.getItem(storageKey))||{},actions); } catch { /* Defaults remain usable. */ }

  function toggleMore() {
    const open = stage.classList.toggle('focus-more-open');
    more.textContent=T(open?'focusLess':'focusMore'); more.setAttribute('aria-expanded',String(open)); schedule();
  }
  function closeDialog() {
    if (!dialog) return;
    const closing = dialog; dialog=null;
    if (marker) { marker.replaceWith(settings); marker=null; }
    closing.close(); closing.remove();
    focusedBefore?.focus({preventScroll:true});
  }
  function baseDialog(title) {
    closeDialog(); focusedBefore=document.activeElement;
    const d=el('dialog','focus-dialog'), top=el('div','focus-dialog-heading'), h=el('h2','',title);
    h.id='focus-dialog-title-'+kind;d.setAttribute('aria-labelledby',h.id);
    const close=button('×',closeDialog);close.ariaLabel=T('close');
    top.append(h,close);d.append(top);stage.append(d);dialog=d;
    d.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
    d.addEventListener('close',()=>{if(dialog===d)closeDialog();});
    return d;
  }
  function showSettings() {
    stage.dispatchEvent(new Event('focus-menu-opening'));
    if (!settings) { document.querySelector(kind==='memory'?'#settings-open':'#pk-settings')?.click(); return; }
    if (stage.classList.contains('is-fullscreen')) {
      const d=baseDialog(T('focusSettings')); marker=document.createComment('settings position');settings.before(marker);
      d.append(settings,button(T('focusBack'),closeDialog,'button primary focus-dialog-back'));
      if (settings.tagName==='DETAILS') settings.open=true;
      d.showModal();
    } else {
      if (wrapper) wrapper.open=true; else settings.open=true;
      settings.scrollIntoView({block:'start',behavior:'instant'});
      (wrapper?.querySelector('summary')||settings.querySelector('summary')||settings).focus({preventScroll:true});
    }
  }
  function openKeys() {
    stage.dispatchEvent(new Event('focus-menu-opening'));
    const d=baseDialog(T('focusKeys'));d.classList.add('focus-key-dialog');
    d.append(el('p','tool-note',T('focusKeysHint')));
    d.append(el('p','tool-note',T('focusKeyLocal')));
    const rows=el('div','focus-key-list'),note=el('p','tool-feedback');note.setAttribute('role','status');
    let recording=null;
    function save(){try{localStorage.setItem(storageKey,JSON.stringify(bindings));note.textContent=T('focusKeySaved');}catch{note.textContent=T('focusKeyStorage');}refresh();}
    function render(){rows.replaceChildren();for(const action of actions){
      const row=el('div','focus-key-row'),label=el('span','',actionLabel(action));
      const set=button(recording===action?T('focusKeyRecord'):shortcutName(bindings[action]),()=>{recording=action;render();rows.querySelector('[data-recording]')?.focus();});
      set.dataset.keyAction=action;set.setAttribute('aria-label',actionLabel(action)+': '+shortcutName(bindings[action]));
      if(recording===action)set.dataset.recording='';
      const clear=button(T('focusKeyClear'),()=>{bindings[action]='';recording=null;save();render();});
      clear.ariaLabel=T('focusKeyClear')+' · '+actionLabel(action);
      row.append(label,set,clear);rows.append(row);
    }}
    d.append(rows,note,button(T('focusKeyReset'),()=>{bindings=validateShortcuts({},actions);recording=null;save();render();}));
    d.addEventListener('keydown',e=>{
      if(!recording)return;
      e.stopPropagation();e.preventDefault();
      if(e.key==='Escape'){recording=null;render();return;}
      if(e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||!validShortcut(e.code)||!e.code){note.textContent=T('focusKeyInvalid');return;}
      if(Object.entries(bindings).some(([a,key])=>a!==recording&&key===e.code)){note.textContent=T('focusKeyConflict');return;}
      bindings[recording]=e.code;const action=recording;recording=null;save();render();rows.querySelector('[data-key-action="'+action+'"]')?.focus();
    });
    render();d.showModal();
  }
  function fallback(on) {
    expanded=on;stage.classList.toggle('focus-expanded',on);
    if(on){
      oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
      let child=stage;
      while(child.parentElement&&child!==document.body){for(const n of child.parentElement.children)if(n!==child&&!n.inert){n.inert=true;changedInert.push(n);}child=child.parentElement;}
    }else{for(const n of changedInert)n.inert=false;changedInert=[];document.body.style.overflow=oldOverflow;}
  }
  const roomReady=()=>kind!=='party'||Boolean(stage.querySelector('.party-room')?.childElementCount);
  async function toggleFullscreen() {
    if(!profile.fullscreen)return;
    active=controller;closeDialog();
    if(expanded){fallback(false);syncFullscreen();return;}
    if(document.fullscreenElement===stage){await document.exitFullscreen().catch(()=>{});return;}
    if(!roomReady())return;
    try{await stage.requestFullscreen();}catch{fallback(true);syncFullscreen();}
  }
  full.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();void toggleFullscreen();},true);
  function syncFullscreen() {
    const focused=document.fullscreenElement===stage||expanded;
    const wasFocused=stage.classList.contains('is-fullscreen');
    if(focused&&!stage.classList.contains('is-fullscreen')){stage.classList.remove('focus-more-open');more.textContent=T('focusMore');more.setAttribute('aria-expanded','false');}
    if(!focused&&dialog)closeDialog();
    stage.classList.toggle('is-fullscreen',focused);
    full.textContent=focused?'⛶':T(profile.fullscreenLabel);full.ariaLabel=T(focused?'exitFullscreen':profile.fullscreenLabel);full.title=full.ariaLabel;
    full.setAttribute('aria-pressed',String(focused));
    if(focused){active=controller;stage.focus({preventScroll:true});}
    else if(wasFocused)full.focus({preventScroll:true});
    schedule();
  }
  function candidate(selector) { return [...stage.querySelectorAll(selector)].find(usable); }
  function target(action) {
    if(kind==='scoreboard'&&['scoreUp','scoreDown'].includes(action))return stage.querySelector('[data-team-index="'+selectedTeam+'"][data-score-action="'+(action==='scoreUp'?'1':'-1')+'"]');
    if(kind==='memory')return action==='primary'?[document.querySelector('#start'),document.querySelector('#pause')].find(usable):action==='pause'?document.querySelector('#pause'):null;
    if(kind==='pk')return action==='primary'?['#pk-ready','#pk-again','#pk-join'].map(s=>stage.querySelector(s)).find(usable):null;
    if(action==='primary'){
      if(kind==='picker'||kind==='groups')return stage.querySelector('#tool-run');
      if(kind!=='party'&&owner?.dataset.mini){
        const again=candidate('.mini-result .button');if(again)return again;
        if(!stage.querySelector('.mini-board'))return candidate('.mini-ready-start')||document.querySelector('#mini-direct');
        return candidate('[data-shortcut-action="pause"]');
      }
      return candidate('[data-shortcut-action="primary"]')||candidate('#suite-actions .primary');
    }
    if(action==='pause')return candidate('#activity-pause:not([hidden]),#activity-start:not([hidden]),[data-shortcut-action="pause"]');
    if(action==='undo')return candidate('#tool-undo,#activity-undo,[data-shortcut-action="undo"]');
    if(action==='next')return candidate('#activity-next,[data-shortcut-action="next"]');
    if(action==='hint')return candidate('[data-shortcut-action="hint"]');
    return candidate('[data-shortcut-action="'+action+'"]');
  }
  function invoke(action) {
    if(kind==='party'&&!roomReady())return false;
    if(action==='fullscreen'){if(!profile.fullscreen)return false;void toggleFullscreen();return true;}
    if(action==='settings'){showSettings();return true;}
    if(action==='more'){toggleMore();return true;}
    if(kind==='scoreboard'&&action.startsWith('score')){
      const cards=[...stage.querySelectorAll('.score-team')];
      if(!cards.length)return false;
      if(action==='scoreNext'||action==='scorePrevious'){
        const index=Math.max(0,cards.findIndex(card=>card.querySelector('.score-value')?.dataset.teamIndex===selectedTeam));
        selectedTeam=cards[(index+(action==='scoreNext'?1:-1)+cards.length)%cards.length].querySelector('.score-value').dataset.teamIndex;
        markTeam();stage.querySelector('.is-keyboard-team')?.scrollIntoView({block:'nearest'});return true;
      }
      const control=stage.querySelector('[data-team-index="'+selectedTeam+'"][data-score-action="'+(action==='scoreUp'?'1':'-1')+'"]');
      if(!usable(control))return false;control.click();return true;
    }
    const control=target(action);if(!usable(control))return false;control.click();return true;
  }
  function refresh() {
    markTeam();
    for(const selector of ['.tool-session-note','.wheel-note','.tool-history','.score-members','#tool-result-actions','#tool-reset','#activity-reset','.activity-stage>.tool-result-actions','.timer-timeline','.pk-color-key','.pk-how','.pk-steps']){
      stage.querySelectorAll(selector).forEach(n=>n.dataset.focusSecondary='');
    }
    stage.querySelectorAll('#tool-summary,.tool-pin-note').forEach(n=>n.dataset.focusDetail='');
    if(kind==='groups')stage.querySelectorAll('#tool-result-actions').forEach(n=>{delete n.dataset.focusSecondary;n.dataset.focusDetail='';});
    if(kind==='timer'){
      stage.querySelectorAll('.tool-result-actions').forEach(n=>delete n.dataset.focusSecondary);
      const reset=stage.querySelector('#activity-reset');if(reset){delete reset.dataset.focusSecondary;reset.dataset.focusDetail='';}
    }
    const suiteStatus=stage.querySelector('#suite-status');
    if(suiteStatus){if([T('suiteStart'),T('focusWhiteboardHint')].includes(suiteStatus.textContent))suiteStatus.dataset.focusDetail='';else delete suiteStatus.dataset.focusDetail;}
    if(profile.editor)stage.querySelectorAll('[data-focus-secondary],[data-focus-detail]').forEach(n=>{delete n.dataset.focusSecondary;delete n.dataset.focusDetail;});
    more.hidden=profile.editor||![...stage.querySelectorAll('[data-focus-secondary],[data-focus-detail]')].some(n=>!n.hidden&&!n.closest('[hidden]'));
    menu.hidden=profile.editor&&!profile.keys||!roomReady();
    if(!roomReady()){
      if(expanded){fallback(false);syncFullscreen();}
      else if(document.fullscreenElement===stage)document.exitFullscreen().catch(()=>{});
    }
    more.setAttribute('aria-expanded',String(stage.classList.contains('focus-more-open')));
    const hints=new Map();
    for(const action of actions){const control=target(action);if(control){if(!hints.has(control))hints.set(control,[]);if(bindings[action])hints.get(control).push(shortcutName(bindings[action]));}}
    for(const [control,names]of hints)control.title=(control.getAttribute('aria-label')||control.textContent).trim()+(names.length?' ('+names.join(' / ')+')':'');
    schedule();
  }
  function markTeam(){
    if(kind!=='scoreboard')return;
    const cards=[...stage.querySelectorAll('.score-team')];
    if(!cards.some(card=>card.querySelector('.score-value')?.dataset.teamIndex===selectedTeam))selectedTeam=cards[0]?.querySelector('.score-value')?.dataset.teamIndex;
    for(const card of cards)card.classList.toggle('is-keyboard-team',card.querySelector('.score-value')?.dataset.teamIndex===selectedTeam);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;fit();});}
  function fit(){
    if(!stage.classList.contains('is-fullscreen')){stage.style.removeProperty('--focus-board-width');stage.style.removeProperty('--focus-canvas-width');return;}
    const available=stage.clientHeight-heading.offsetHeight-32;
    const board=stage.querySelector('.mini-board'), area=stage.querySelector('.mini-play-area');
    if(board&&area){
      const status=stage.querySelector('#mini-status'),summary=stage.querySelector('.mini-summary'),controls=stage.querySelector('.mini-controls');
      let height=Math.max(100,available-(status?.offsetHeight||0)-(summary?.offsetHeight||0)-(controls?.offsetHeight||0)-36), ratio=4/3;
      if(board.classList.contains('mini-pattern')){const cols=Number(board.style.getPropertyValue('--mini-cols'))||4;ratio=cols/Math.ceil(board.children.length/cols);}
      else if(board.classList.contains('mini-differences')){const img=board.querySelector('img'),cols=getComputedStyle(board).gridTemplateColumns.split(' ').length;ratio=(img?.naturalWidth/img?.naturalHeight||4/3)*(cols===2?2:.5);height-=16;}
      else if(board.classList.contains('mini-reveal'))height-=board.querySelector('.mini-guess')?.offsetHeight||0;
      if(!board.matches('.mini-charades,.mini-practice-drawing'))stage.style.setProperty('--focus-board-width',Math.floor(Math.min(area.clientWidth,Math.max(120,height*ratio)))+'px');
      if(board.classList.contains('mini-practice-drawing')){
        const canvas=board.querySelector('canvas'),other=[...board.children].filter(n=>n!==canvas&&visible(n)).reduce((n,x)=>n+x.offsetHeight+8,0);
        const sideways=matchMedia('(min-width:650px) and (max-height:600px)').matches;
        stage.style.setProperty('--focus-canvas-width',Math.floor(sideways?Math.min(area.clientWidth-260,Math.max(60,height)*1.6):Math.min(area.clientWidth,Math.max(60,height-other)*1.6))+'px');
      }
    }
    const whiteboard=stage.querySelector('.whiteboard-canvas');
    if(whiteboard){const tools=stage.querySelector('.whiteboard-tools'),actions=stage.querySelector('#suite-actions'),status=stage.querySelector('#suite-status'),sideways=matchMedia('(min-width:650px) and (max-height:600px)').matches;stage.style.setProperty('--focus-canvas-width',Math.floor(Math.max(60,available-(sideways?0:tools?.offsetHeight||0)-(actions?.offsetHeight||0)-(status?.offsetHeight||0)-32)*1.5)+'px');}
  }
  const controller={stage,bindings:()=>bindings,invoke,exit(){if(expanded){fallback(false);syncFullscreen();return true;}return false;}};
  controllers.set(stage,controller);
  stage.addEventListener('load',schedule,true);
  stage.addEventListener('toggle',schedule,true);
  stage.addEventListener('pointerdown',e=>{active=controller;const team=e.target.closest('.score-team')?.querySelector('.score-value');if(team){selectedTeam=team.dataset.teamIndex;markTeam();}});
  stage.addEventListener('focusin',()=>active=controller);
  stage.addEventListener('focus-settings-applied',()=>{closeDialog();if(wrapper)wrapper.open=false;if(!profile.editor){stage.scrollIntoView({block:'start',behavior:'instant'});stage.focus({preventScroll:true});}});
  stage.addEventListener('focus-request-settings',showSettings);
  stage.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&expanded&&!dialog){const nodes=[...stage.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter(usable);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===stage)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  settings?.addEventListener('invalid',e=>{
    if(!visible(e.target))showSettings();
    for(let p=e.target.closest('details');p;p=p.parentElement?.closest('details'))p.open=true;
  },true);
  document.addEventListener('fullscreenchange',syncFullscreen);
  new ResizeObserver(schedule).observe(stage);
  new MutationObserver(refresh).observe(stage,{childList:true,subtree:true,characterData:true});
  syncFullscreen();refresh();
}
export function initFocusUI() {
  function scan(){for(const[selector,full,settings,heading]of configurations)document.querySelectorAll(selector).forEach(stage=>install(stage,full,settings,heading));}
  scan();if(initialized)return;initialized=true;
  document.addEventListener('focus-stage-ready',scan);
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||document.querySelector('dialog[open]'))return;
    const onScreen=c=>{const r=c.stage.getBoundingClientRect();return visible(c.stage)&&r.bottom>0&&r.top<innerHeight;};
    const controller=[...controllers.values()].find(c=>c.stage===document.fullscreenElement)||[...controllers.values()].find(c=>c.stage.classList.contains('focus-expanded'))||
      (active&&onScreen(active)?active:[...controllers.values()].find(onScreen));
    if(!controller)return;
    if(e.key==='Escape'&&controller.exit()){e.preventDefault();return;}
    if(editing(e.target)||e.isComposing)return;
    if(e.code==='Space'&&e.target.closest('button,a,summary'))return;
    const action=Object.entries(controller.bindings()).find(([,code])=>code&&code===e.code)?.[0];
    if(action&&controller.invoke(action))e.preventDefault();
  });
}
