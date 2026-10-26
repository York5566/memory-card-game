import QRCode from './vendor/qrcode.js';
import {createSuite,T,el,button,input,label,canvasBlob,saveCanvas,downloadZip,SuiteError,wrappedText} from './suite-ui.js';
import {wifiPayload,lines} from './suite-core.js';
function luminance(hex){const c=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}

export function qr(){
 const s=createSuite('qr');let canvases=[],password='',changed=false,zip;
 s.onRestore(()=>{password='';});
 const downloads=()=>{if(zip){zip.hidden=canvases.length<2;zip.disabled=changed;}s.stage.querySelectorAll('button').forEach(b=>b.disabled=changed);s.stage.classList.toggle('is-outdated',changed);};
 s.form.addEventListener('input',()=>{if(canvases.length){changed=true;downloads();s.note(T('workQRChanged'));}});
 s.build(()=>{
  canvases=[];changed=false;
  s.field('mode','qrMode',[['text',T('qrText')],['batch',T('qrBatch')],['wifi',T('qrWifi')]]);
  const text=s.field('content','qrContent','textarea',{rows:5,maxlength:30000}),ssid=s.field('ssid','qrSSID','text',{maxlength:100});
  const pass=input('password',password,{maxlength:200,autocomplete:'off'});
  const security=s.field('security','qrSecurity',[['WPA','WPA / WPA2'],['WEP','WEP'],['nopass',T('qrNoSecurity')]]),hidden=s.field('hidden','qrHidden','checkbox');
  s.form.append(label(T('qrPassword'),pass));pass.oninput=()=>{password=pass.value;s.dirty();};
  const hints=el('p','tool-note',T('qrSecret'));s.form.append(hints);
  function visibility(){const wifi=s.controls.mode.value==='wifi';text.parentElement.hidden=wifi;for(const n of [ssid,security,hidden])n.parentElement.hidden=!wifi;pass.parentElement.hidden=!wifi||security.value==='nopass';hints.hidden=!wifi;}
  s.controls.mode.onchange=visibility;security.onchange=visibility;visibility();
  s.field('caption','sTitle','text',{maxlength:100});s.field('width','qrSize','number',{min:256,max:2048,step:1});s.field('ink','qrInk','color');s.field('background','sBackground','color');s.field('margin','qrMargin','number',{min:4,max:16});s.field('level','qrLevel',[['L','L'],['M','M'],['Q','Q'],['H','H']]);
  s.action('qrGenerate',async()=>{
   const v=s.get();if(luminance(v.ink)>=luminance(v.background)||(luminance(v.background)+.05)/(luminance(v.ink)+.05)<4.5)throw new SuiteError('qrContrast');
   const contents=v.mode==='wifi'?[wifiPayload(v.ssid,password,v.security,v.hidden)]:v.mode==='batch'?lines(v.content,50,2000):[v.content.trim()];
   if(!contents.every(Boolean)||v.mode==='wifi'&&!v.ssid.trim())throw new SuiteError();
   const next=[];
   for(const content of contents){
    let symbol;try{symbol=QRCode.create(content,{errorCorrectionLevel:v.level});}catch{throw new SuiteError('qrLong');}
    if(symbol.modules.size+v.margin*2>v.width/2)throw new SuiteError('qrLong');
    const code=document.createElement('canvas');try{await QRCode.toCanvas(code,content,{width:v.width,margin:v.margin,errorCorrectionLevel:v.level,color:{dark:v.ink,light:v.background}});}catch{throw new SuiteError('qrLong');}
    const c=document.createElement('canvas');c.width=code.width;c.height=code.height+(v.caption?Math.ceil(code.width*.16):0);const ctx=c.getContext('2d');ctx.fillStyle=v.background;ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(code,0,0);
    if(v.caption){ctx.font=Math.max(12,Math.round(c.width*.035))+'px sans-serif';ctx.fillStyle=v.ink;ctx.textAlign='center';wrappedText(ctx,v.caption,c.width/2,code.height+c.width*.045,c.width*.9,c.width*.045,3);}next.push(c);
   }
   s.set(v);canvases=next;changed=false;s.stage.replaceChildren();s.stage.classList.add('qr-results');
   canvases.forEach((c,i)=>{const figure=el('figure','qr-item');figure.append(c,button(T('sDownloadOne'),()=>s.run(()=>{if(changed)throw new SuiteError('workQRChanged');return saveCanvas(c,'qr-'+(i+1)+'.png');})));s.stage.append(figure);});
   downloads();s.note(T('workQRDone',canvases.length));
   if(matchMedia('(max-width:700px)').matches)s.root.querySelector('#suite-stage').scrollIntoView({block:'start'});
  },true);
  zip=s.action('suiteZIP',async()=>{if(changed||!canvases.length)throw new SuiteError('workQRChanged');await downloadZip(canvases.map((c,i)=>({name:'qr-'+(i+1)+'.png',blob:()=>canvasBlob(c)})),'qr-codes.zip');});
  downloads();s.stage.append(el('p','workflow-empty',T('workQREmpty')));s.note('');
 });return s;
}
