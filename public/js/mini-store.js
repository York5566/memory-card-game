import {MiniError,validatePack,validateMini} from './mini-core.js';
const DB='toolbox-game-materials-v1';
function openDB(){return new Promise((resolve,reject)=>{let r;try{r=indexedDB.open(DB,1);}catch{reject(new MiniError('miniStorage'));return;}r.onupgradeneeded=()=>r.result.createObjectStore('records',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new MiniError('miniStorage'));});}
async function transaction(mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('records',mode),s=tx.objectStore('records');let result;try{const r=fn(s);r.onsuccess=()=>result=r.result;}catch(e){db.close();reject(e);return;}tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(new MiniError('miniStorage'));};});}
export const listMaterials=async()=> (await transaction('readonly',s=>s.getAll())).filter(r=>r.id.startsWith('pack:')).map(r=>({...r,data:validatePack(r.data)}));
export async function saveMaterials(pack,id){const data=validatePack(pack),all=await listMaterials();if(!id&&all.length>=20||all.filter(r=>r.id!==id).reduce((n,r)=>n+JSON.stringify(r.data).length,0)+JSON.stringify(data).length>30*1024*1024)throw new MiniError('miniTooLarge');const record={id:id||'pack:'+crypto.randomUUID(),data,updated:Date.now()};await transaction('readwrite',s=>s.put(record));return record;}
export const deleteMaterials=id=>transaction('readwrite',s=>s.delete(id));
export const saveMini=async config=>transaction('readwrite',s=>s.put({id:'game:'+config.kind,data:validateMini(config)}));
export const loadMini=async kind=>{const r=await transaction('readonly',s=>s.get('game:'+kind));return r?validateMini(r.data,kind):null;};
export const deleteMini=kind=>deleteMaterials('game:'+kind);
