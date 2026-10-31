import {toolText} from './tools-text.js';
import {TOOL_CATALOG,catalogMatches,catalogFilter} from './catalog-core.js';
const search=document.querySelector('#catalog-search'),cards=[...document.querySelectorAll('[data-tool-category]')],filters=[...document.querySelectorAll('[data-category]')],lang=document.documentElement.lang;
let {category,query}=catalogFilter(location.hash);search.value=query;
const clear=document.createElement('button');clear.type='button';clear.className='button small catalog-clear';clear.textContent=toolText('uxCatalogReset',lang);search.parentElement.append(clear);
search.placeholder=toolText('uxCatalogHint',lang);
function update(write=true){
 const q=search.value;let n=0;
 for(const [i,c]of cards.entries()){c.hidden=!catalogMatches(TOOL_CATALOG[i],lang,q,category);if(!c.hidden)n++;}
 for(const b of filters)b.setAttribute('aria-pressed',String(b.dataset.category===category));
 document.querySelector('#catalog-count').textContent=toolText('foundTools',lang,n);document.querySelector('#catalog-empty').hidden=n>0;clear.hidden=!q&&category==='all';
 if(write){const p=new URLSearchParams();if(q)p.set('q',q);if(category!=='all')p.set('category',category);const hash=p.size?'#tools?'+p:'#tools';history.replaceState(history.state,'',location.pathname+location.search+hash);}
}
clear.onclick=()=>{search.value='';category='all';update();search.focus();};
search.addEventListener('input',()=>update());search.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();clear.click();}});
for(const b of filters)b.addEventListener('click',()=>{category=b.dataset.category;update();});
window.addEventListener('hashchange',()=>{const state=catalogFilter(location.hash);category=state.category;search.value=state.query;update(false);});
update(false);
