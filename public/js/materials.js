import {T,el,button,input,label,download,editorItems,readMiniFile,checkImages,MiniError} from './mini-ui.js';
import {validatePack} from './mini-core.js';
import {listMaterials,saveMaterials,deleteMaterials} from './mini-store.js';
const root=document.querySelector('[data-materials]'),list=root.querySelector('#material-list'),editor=root.querySelector('#material-editor'),status=root.querySelector('#material-status');
const fresh=()=>({version:1,type:'game-materials',title:'',items:[{label:'',answer:'',hint:'',taboo:'',image:'',image2:'',spots:[]}]});
let data=fresh(),id=null,snapshot=JSON.stringify(data),busy=false,leaving=false,checkpoint=false,saveState;
const dirty=()=>snapshot!==JSON.stringify(data);
const update=()=>{if(saveState)saveState.textContent=dirty()?T('uxMaterialDraft'):checkpoint?T('uxMaterialClean'):T('uxMaterialNew');};
const note=s=>{status.textContent=s;update();},fail=e=>note(T(e instanceof MiniError?e.code:'miniInvalid'));
async function run(fn){if(busy)return;busy=true;editor.inert=true;root.setAttribute('aria-busy','true');try{await fn();}catch(e){fail(e);}finally{busy=false;editor.inert=false;root.removeAttribute('aria-busy');}}
const mayReplace=()=>!dirty()||confirm(T('miniReplace'));
async function save(copy=false){const record=await saveMaterials(validatePack(data),copy?null:id);id=record.id;data=record.data;snapshot=JSON.stringify(data);checkpoint=Boolean(id);render();await refresh();note(T('matSaved'));}
function render(){
 editor.replaceChildren();const top=el('div','material-save-row'),actions=el('div','tool-row');saveState=el('p','tool-note');top.append(actions,saveState);
 actions.append(button(T('save'),()=>run(()=>save()),'button primary'),button(T('exportConfig'),()=>run(()=>{download(JSON.stringify(validatePack(data)),'game-materials.json');snapshot=JSON.stringify(data);checkpoint=true;note(T('saved'));})));
 if(id)actions.append(button(T('uxMaterialCopy'),()=>run(()=>save(true))));
 const title=input('text',data.title,{maxlength:100});title.oninput=()=>{data.title=title.value;update();};editor.append(top,label(T('matTitle'),title),el('p','tool-note',T('uxGameMaterialHint')));
 const items=el('div');editor.append(items);editorItems(items,data.items,update,fail);
 if(id){const more=el('details','tool-details');more.append(el('summary','',T('focusMore')),button(T('delete'),()=>run(async()=>{if(!confirm(T('matDeleteAsk')))return;await deleteMaterials(id);id=null;data=fresh();snapshot=JSON.stringify(data);checkpoint=Boolean(id);render();await refresh();note(T('suiteDeleted'));})));editor.append(more);}
 update();
}
async function refresh(){
 list.replaceChildren();const packs=await listMaterials();
 for(const pack of packs){const b=button(pack.data.title||T('materials'),()=>run(async()=>{if(!mayReplace())return;await checkImages(pack.data);data=structuredClone(pack.data);id=pack.id;snapshot=JSON.stringify(data);checkpoint=Boolean(id);render();await refresh();note('');editor.scrollIntoView({behavior:'smooth',block:'start'});}),'button');b.setAttribute('aria-pressed',String(id===pack.id));list.append(b);}
 if(!packs.length)list.append(el('p','',T('matBlank')));
}
root.querySelector('#material-new').onclick=()=>run(async()=>{if(!mayReplace())return;id=null;data=fresh();snapshot=JSON.stringify(data);checkpoint=Boolean(id);render();await refresh();note('');});
const file=root.querySelector('#material-file');root.querySelector('#material-import').onclick=()=>{if(!busy)file.click();};file.onchange=()=>run(async()=>{const f=file.files[0];file.value='';if(!f)return;const next=await readMiniFile(f);if(!mayReplace())return;data=next;id=null;checkpoint=false;render();await refresh();note(T('loaded'));});
document.addEventListener('languagechange-request',e=>{if(!mayReplace())e.preventDefault();else leaving=true;});
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.hasAttribute('download')||a.target==='_blank'||a.hasAttribute('data-language-link'))return;const u=new URL(a.href,location.href);if(!/^https?:$/.test(u.protocol)||u.pathname===location.pathname&&u.search===location.search)return;if(!mayReplace())e.preventDefault();else leaving=true;});
window.addEventListener('beforeunload',e=>{if(!leaving&&dirty()){e.preventDefault();e.returnValue='';}});
render();run(refresh);
