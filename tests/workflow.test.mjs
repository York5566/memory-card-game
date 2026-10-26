import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowProfile,EDITOR_TOOLS} from '../public/js/workflow-core.js';
import {workflowMessages} from '../public/js/workflow-text.js';
import {suitePage} from '../src/suite-pages.mjs';
import {validateShortcuts} from '../public/js/focus-core.js';

test('editors do not offer fullscreen, including in their initial HTML',()=>{
 for(const kind of EDITOR_TOOLS){
  assert.equal(workflowProfile(kind).fullscreen,false,kind);
  for(const lang of ['zh-Hant','en','ja','ko'])assert.ok(!suitePage(kind,lang,'/','/').includes('id="suite-fullscreen"'),kind+' '+lang);
 }
 assert.equal(workflowProfile('unrecognized-new-tool').fullscreen,false);
 for(const kind of ['timer','scoreboard','picker','groups','quiz','bingo','tournament','dice','whiteboard','memory','pk','puzzle','reveal','sequence','reaction','differences','charades','drawing'])assert.equal(workflowProfile(kind).fullscreen,true,kind);
});
test('removing irrelevant shortcut actions preserves remaining custom bindings',()=>{
 const old={primary:'KeyG',undo:'KeyU',fullscreen:'KeyF',settings:'KeyS',more:'KeyM'};
 assert.deepEqual(validateShortcuts(old,['primary','undo']),{primary:'KeyG',undo:'KeyU'});
 for(const kind of ['qr','image','badges','certificates'])assert.equal(workflowProfile(kind).keys,false);
});
test('individual tool workflow messages cover four languages and keep placeholders consistent',()=>{
 for(const [key,values]of Object.entries(workflowMessages)){
  assert.equal(values.length,4,key);assert.ok(values.every(s=>typeof s==='string'&&s.trim()),key);
  const params=values.map(s=>(s.match(/\{\d+\}/g)||[]).sort());for(const p of params)assert.deepEqual(p,params[0],key);
 }
 for(const kind of EDITOR_TOOLS)assert.ok(workflowMessages[workflowProfile(kind).resultLabel]);
});
