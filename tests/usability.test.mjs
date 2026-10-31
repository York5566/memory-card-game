import test from 'node:test';import assert from 'node:assert/strict';
import {remapScoreProgress} from '../public/js/activity-core.js';
import {catalogMatches,catalogFilter,TOOL_CATALOG} from '../public/js/catalog-core.js';
import {usabilityMessages} from '../public/js/usability-text.js';
test('reordering, adding and removing teams keeps scores and maps remaining history',()=>{
 const p={scores:[8,3,10],history:[{index:0,after:8},{index:1,after:3},{index:2,after:10}]};
 const ordered=remapScoreProgress(p,[2,0,1]);assert.deepEqual(ordered.scores,[10,8,3]);assert.deepEqual(ordered.history.map(h=>h.index),[1,2,0]);
 const added=remapScoreProgress(ordered,[0,1,2,-1],5);assert.deepEqual(added.scores,[10,8,3,5]);
 const removed=remapScoreProgress(added,[0,2,3]);assert.deepEqual(removed.scores,[10,3,5]);assert.deepEqual(removed.history,[{index:1,after:3},{index:0,after:10}]);
 assert.deepEqual(p.scores,[8,3,10]);
 assert.throws(()=>remapScoreProgress(p,[0,0]));assert.throws(()=>remapScoreProgress(p,[3]));assert.throws(()=>remapScoreProgress(p,[]));
});
test('old undo snapshots follow the same team mapping',()=>{
 const now={scores:[9,4],history:[{index:0,after:9}]},undo={scores:[8,4],history:[]};
 assert.deepEqual(remapScoreProgress(now,[1,0,-1]).scores,[4,9,0]);assert.deepEqual(remapScoreProgress(undo,[1,0,-1]).scores,[4,8,0]);
});
test('tool search understands task words and safely restores filters',()=>{
 const image=TOOL_CATALOG.find(t=>t.id==='image');
 for(const q of ['壓縮','compress image','画像 圧縮','이미지 압축'])assert.equal(catalogMatches(image,'zh-Hant',q),true);
 assert.equal(catalogMatches(image,'en','compress','play'),false);
 assert.deepEqual(catalogFilter('#tools?q=qr&category=create'),{query:'qr',category:'create'});
 assert.deepEqual(catalogFilter('#tools?category=bad'),{query:'',category:'all'});
 assert.equal(catalogFilter('#tools?q='+('x'.repeat(120))).query.length,100);
});
test('usability guidance has all four languages and identical placeholders',()=>{
 for(const[key,values]of Object.entries(usabilityMessages)){assert.equal(values.length,4,key);assert.ok(values.every(s=>s.trim()),key);const marks=values.map(s=>(s.match(/\{\d+\}/g)||[]).sort());marks.forEach(v=>assert.deepEqual(v,marks[0],key));}
});

