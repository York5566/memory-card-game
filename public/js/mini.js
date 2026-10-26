import {miniShell} from './mini-ui.js';
import {mountLocal} from './mini-local.js';
const kind=document.querySelector('[data-mini]')?.dataset.mini;
const shell=miniShell(kind);mountLocal(shell);
if(kind==='drawing'){const {mountParty}=await import('./party-ui.js');mountParty(document.querySelector('#mini-online'),()=>({...shell.config,mode:'draw'}));}
