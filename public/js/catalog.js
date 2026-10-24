import {toolText} from './tools-text.js';
const search=document.querySelector('#catalog-search'),cards=[...document.querySelectorAll('[data-tool-category]')],filters=[...document.querySelectorAll('[data-category]')];let category='all';
function update(){const q=search.value.trim().toLocaleLowerCase();let n=0;for(const c of cards){c.hidden=!(category==='all'||category===c.dataset.toolCategory)||!c.textContent.toLocaleLowerCase().includes(q);if(!c.hidden)n++;}document.querySelector('#catalog-count').textContent=toolText('foundTools',document.documentElement.lang,n);document.querySelector('#catalog-empty').hidden=n>0;}
search.addEventListener('input',update);for(const b of filters)b.addEventListener('click',()=>{category=b.dataset.category;for(const a of filters)a.setAttribute('aria-pressed',String(a===b));update();});

