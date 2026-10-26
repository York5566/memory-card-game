import {createSuite,T,el,button,input,download,canvasBlob,downloadZip,SuiteError} from './suite-ui.js';
import {cropRect} from './suite-core.js';

export function images(){
 const s=createSuite('image');let records=[],selected=0,upload,processButton,zip;
 const urls=new Set(),size=n=>n>=1000000?(n/1000000).toFixed(2)+' MB':(n/1000).toFixed(1)+' KB';
 s.onRestore(()=>{for(const r of records){r.settings={...s.state};invalidate(r);}});
 function revoke(r){for(const url of [r.url,r.outURL])if(url){URL.revokeObjectURL(url);urls.delete(url);}}
 function invalidate(r){if(r.outURL){URL.revokeObjectURL(r.outURL);urls.delete(r.outURL);}r.result=null;r.outURL=null;}
 function sync(){if(records[selected]){const v=s.get();if(JSON.stringify(v)!==JSON.stringify(records[selected].settings))invalidate(records[selected]);records[selected].settings=v;}}
 async function result(record){const bitmap=await createImageBitmap(record.file);try{const o=record.settings,rect=cropRect(bitmap.width,bitmap.height,o),c=document.createElement('canvas');c.width=rect.width;c.height=rect.height;const ctx=c.getContext('2d');if(o.format==='image/jpeg'){ctx.fillStyle=o.background;ctx.fillRect(0,0,c.width,c.height);}ctx.drawImage(bitmap,rect.sx,rect.sy,rect.sw,rect.sh,0,0,c.width,c.height);const blob=await canvasBlob(c,o.format,o.quality/100);if(blob.type!==o.format)throw new SuiteError('imgError');return{blob,w:c.width,h:c.height};}finally{bitmap.close();}}
 const outputName=(r,i)=>(i+1)+'-'+r.file.name.replace(/\.[^.]*$/,'').replace(/[^\p{L}\p{N}_-]/gu,'_')+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[r.result.blob.type]);
 function visibility(){const c=s.controls;for(const k of ['x','y'])c[k].parentElement.hidden=c.ratio.value==='original';c.quality.parentElement.hidden=c.format.value==='image/png';c.background.parentElement.hidden=c.format.value!=='image/jpeg';}
 function output(){
  s.stage.replaceChildren();if(processButton)processButton.disabled=!records.length;if(zip){zip.hidden=!records.length;zip.disabled=!records.length||records.some(r=>!r.result);}
  if(!records.length){const empty=el('div','workflow-empty');empty.append(el('p','',T('workImageEmpty')),button(T('imgAdd'),()=>upload.click(),'button primary'));s.stage.append(empty);return;}
  const list=el('div','image-file-list');list.setAttribute('role','group');list.ariaLabel=T('workImageList',records.length);
  records.forEach((r,i)=>{const choice=button((i+1)+'. '+r.file.name,()=>s.run(()=>{sync();selected=i;s.set(r.settings);s.refresh();}));choice.setAttribute('aria-pressed',String(i===selected));list.append(choice);});
  const r=records[selected],card=el('article','image-result selected'),head=el('div','image-selected-heading');
  head.append(el('h3','',r.file.name),button(T('sRemove'),()=>s.run(()=>{revoke(r);records.splice(selected,1);selected=Math.min(selected,Math.max(0,records.length-1));if(records[selected])s.set(records[selected].settings);s.refresh();})));
  const compare=el('div','image-comparison');
  function figure(src,title,w,h,bytes){const box=el('figure'),image=el('img');image.src=src;image.alt=title;box.append(el('figcaption','',title),image,el('p','tool-note',`${w} × ${h} · ${size(bytes)}`));return box;}
  compare.append(figure(r.url,T('imgBefore'),r.w,r.h,r.file.size));
  if(r.result){const after=figure(r.outURL,T('imgAfter'),r.result.w,r.result.h,r.result.blob.size);after.append(button(T('sDownloadOne'),()=>s.run(()=>{sync();if(!r.result){output();throw new SuiteError('imgPending');}download(r.result.blob,outputName(r,selected),r.result.blob.type);}),'button primary'));compare.append(after);}
  else compare.append(el('p','image-pending',T('workImageAfter')));
  card.append(head,compare);s.stage.append(el('p','tool-note',T('workImageList',records.length)),list,card);
 }
 s.build(()=>{
  upload=input('file','',{accept:'image/png,image/jpeg,image/webp',multiple:''});upload.hidden=true;
  s.form.append(upload,button(T('imgAdd'),()=>upload.click()),el('p','tool-note',T('imgLimit')));
  upload.onchange=()=>s.run(async()=>{
   const incoming=[...upload.files];upload.value='';if(!incoming.length)return;
   if(records.length+incoming.length>12||[...records.map(r=>r.file),...incoming].reduce((n,f)=>n+f.size,0)>100000000)throw new SuiteError('imgError');
   const additions=[];try{for(const file of incoming){if(file.size>20000000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new SuiteError('imgError');let bitmap;try{bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>24000000)throw new SuiteError('imgError');const url=URL.createObjectURL(file);urls.add(url);additions.push({file,w:bitmap.width,h:bitmap.height,url,settings:s.get()});}catch{throw new SuiteError('imgError');}finally{bitmap?.close();}}}catch(e){additions.forEach(revoke);throw e;}
   records.push(...additions);s.dirty();output();s.note('');
  });
  s.field('ratio','imgRatio',[['original',T('imgOriginal')],...['1:1','4:3','3:4','16:9','9:16'].map(r=>[r,r])]);
  s.field('x','imgX','range',{min:0,max:100});s.field('y','imgY','range',{min:0,max:100});s.field('width','imgWidth','number',{min:32,max:4096});
  s.field('format','imgFormat',[['image/webp','WebP'],['image/jpeg','JPEG'],['image/png','PNG']]);s.field('quality','imgQuality','range',{min:10,max:100});s.field('upscale','imgUpscale','checkbox');s.field('background','sBackground','color');visibility();
  s.form.append(el('p','tool-note',T('imgBackup')));
  s.action('imgAll',()=>{const settings=s.get();s.set(settings);records.forEach(r=>{r.settings={...settings};invalidate(r);});output();s.note(T('imgPending'));},false,s.form);
  processButton=s.action('imgProcess',async()=>{sync();if(!records.length)throw new SuiteError();s.note(T('suiteBusy'));const results=[];for(const r of records)results.push(await result(r));records.forEach((r,i)=>{if(r.outURL){URL.revokeObjectURL(r.outURL);urls.delete(r.outURL);}r.result=results[i];r.outURL=URL.createObjectURL(r.result.blob);urls.add(r.outURL);});output();s.note(T('suiteReady'));if(matchMedia('(max-width:700px)').matches)s.root.querySelector('#suite-stage').scrollIntoView({block:'start'});},true);
  zip=s.action('suiteZIP',async()=>{sync();if(!records.length||records.some(r=>!r.result))throw new SuiteError('imgPending');await downloadZip(records.map((r,i)=>({name:outputName(r,i),blob:async()=>r.result.blob})),'images.zip');});
  output();s.note('');
 });
 s.form.addEventListener('input',e=>{if(!e.target.dataset.suiteField)return;visibility();if(!records[selected])return;try{sync();output();s.note(T('imgPending'));}catch{}});
 window.addEventListener('pagehide',()=>urls.forEach(URL.revokeObjectURL));return s;
}
