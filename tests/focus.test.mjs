import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHORTCUTS, validateShortcuts, validShortcut, shortcutName } from '../public/js/focus-core.js';
import { focusMessages } from '../public/js/focus-text.js';
import { toolText } from '../public/js/tools-text.js';
import { miniMessages } from '../public/js/mini-text.js';

test('partial shortcut settings preserve defaults and support clearing individual actions', () => {
  const actions=['primary','pause','fullscreen'];
  assert.deepEqual(validateShortcuts({primary:'KeyB',pause:''},actions),{primary:'KeyB',pause:'',fullscreen:'KeyF'});
  assert.equal(validateShortcuts(JSON.parse(JSON.stringify({primary:'Digit1'})),actions).primary,'Digit1');
  assert.deepEqual(validateShortcuts({}),DEFAULT_SHORTCUTS);
});
test('shortcut assignments reject collisions, unsafe keys and invalid stored values', () => {
  for(const code of ['Escape','Tab','Enter','F5','ControlLeft','Ctrl+KeyA',null,[],{},7])
    assert.equal(validShortcut(code),false);
  for(const value of [null,[], 'Space', {primary:'KeyP'}, {primary:[]}, {primary:'F5'}])
    assert.throws(()=>validateShortcuts(value,['primary','pause']));
  assert.throws(()=>validateShortcuts({},['missing']));
  assert.equal(validateShortcuts({primary:'',pause:''},['primary','pause']).pause,'');
});
test('key labels are readable and supported language strings are complete', () => {
  assert.equal(shortcutName('ArrowDown'),'↓');
  assert.equal(shortcutName('KeyA'),'A');
  assert.equal(shortcutName('Digit3'),'3');
  assert.equal(shortcutName(''),'—');
  for(const [key,values] of Object.entries(focusMessages)){
    assert.equal(values.length,4,key);
    assert.ok(values.every(s=>typeof s==='string'&&s.trim()),key);
  }
});
test('game names and quiz reveal controls cannot be overwritten by another tool state', () => {
  ['zh-Hant','en','ja','ko'].forEach((lang,i)=>{
    for(const kind of ['puzzle','reveal','sequence','reaction','differences','charades','drawing'])
      assert.equal(toolText(kind,lang),miniMessages[kind][i]);
    assert.notEqual(toolText('drawing',lang),toolText('pickerDrawing',lang));
    assert.notEqual(toolText('reveal',lang),toolText('quizRevealAction',lang));
  });
});
