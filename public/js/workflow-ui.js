import {T,el} from './tool-ui.js';
import {EDITOR_TOOLS} from './workflow-core.js';

export function organizeEditor(root,form,kind) {
  if(!EDITOR_TOOLS.has(kind))return;
  root.classList.add('workflow-editor');
  const heading=root.querySelector('.suite-settings>h2');
  if(heading)heading.textContent=T(({qr:'workQRSetup',image:'workImageSetup',badges:'workPaperSetup',certificates:'workPaperSetup',seating:'workSeatSetup'})[kind]);
  function group(title,fields,folded=true){
    const items=fields.map(k=>form.querySelector('[data-suite-field="'+k+'"]')?.closest('label')||form.querySelector('[data-image-field="'+k+'"]')).filter(Boolean);
    if(!items.length)return;
    const box=el(folded?'details':'section',folded?'tool-details workflow-options':'workflow-fields');
    box.append(el(folded?'summary':'h3','',T(title)));
    const body=el('div','workflow-field-body');box.append(body);items[0].before(box);body.append(...items);
  }
  if(kind==='qr')group('workQRStyle',['caption','width','ink','background','margin','level']);
  if(kind==='image'){
    group('workImageSettings',['ratio','x','y'],false);
    group('workImageExport',['width','format','quality','upscale','background'],false);
  }
  if(kind==='badges')group('workPrintLayout',['style','width','height','cols','rows','paper']);
  if(kind==='certificates'){
    group('workSignature',['issuer','date','signature','signImage']);
    group('workPrintLayout',['orientation','paper']);
  }
  if(kind==='seating')group('workSeatSetup',['rows','cols','perTable','front'],false);
  if(kind==='seating')root.querySelector('#suite-preview').before(root.querySelector('#suite-actions'));
  const key=({qr:'qrGenerate',image:'imgProcess',badges:'paperRefresh',certificates:'paperRefresh'})[kind];
  const action=key&&root.querySelector('[data-tool-action="'+key+'"]');
  if(action){const row=el('div','workflow-submit');row.append(action);form.append(row);}
  root.querySelectorAll('#suite-actions [data-focus-secondary]').forEach(n=>delete n.dataset.focusSecondary);
}
