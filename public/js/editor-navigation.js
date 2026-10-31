import {T,el,button} from './tool-ui.js';
export function editorNavigation(root,kind) {
 if(!['qr','image','badges','certificates'].includes(kind))return;
 const workspace=root.querySelector('.suite-workspace'),settings=root.querySelector('.suite-settings'),stage=root.querySelector('#suite-stage');
 const mobile=matchMedia('(max-width:700px)'),nav=el('div','editor-navigation');
 nav.setAttribute('role','tablist');nav.ariaLabel=T('setup');
 let current='edit';
 settings.id='suite-edit-panel';
 const edit=button(T('uxEdit'),()=>show('edit',true)),preview=button(T('uxPreview'),()=>show('preview',true));
 edit.id='suite-edit-tab';preview.id='suite-preview-tab';
 for(const[b,panel]of [[edit,settings],[preview,stage]]){b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);}
 nav.append(edit,preview);workspace.before(nav);
 function sync(){
  nav.hidden=!mobile.matches;
  for(const[b,panel,key]of [[edit,settings,'edit'],[preview,stage,'preview']]){
   const selected=current===key;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;
   panel.hidden=mobile.matches&&!selected;
   if(mobile.matches){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);}
   else {panel.removeAttribute('role');panel.removeAttribute('aria-labelledby');}
  }
 }
 function show(pane,move=false){
  current=pane;sync();
  if(move&&mobile.matches){nav.scrollIntoView({block:'start',behavior:'instant'});(pane==='edit'?edit:preview).focus({preventScroll:true});}
 }
 nav.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?'edit':e.key==='End'?'preview':e.target===edit?'preview':'edit',true);}});
 root.addEventListener('workflow-show-editor',()=>show('edit',true));
 root.addEventListener('workflow-show-preview',()=>show('preview',true));
 mobile.addEventListener('change',()=>{const focus=document.activeElement;sync();if(mobile.matches&&(settings.contains(focus)||stage.contains(focus))&&focus.closest('[hidden]'))(current==='edit'?edit:preview).focus({preventScroll:true});});
 sync();
}

