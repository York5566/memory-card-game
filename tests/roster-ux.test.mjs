import test from 'node:test';
import assert from 'node:assert/strict';
import {entries,moveGroupMember,group} from '../public/js/tools-core.js';
import {defaultSuite,placeSeat,arrangeSeats,seatingValid} from '../public/js/suite-core.js';
const items=()=>entries('A\nB\nC\nD').items;
const seat=patch=>({...defaultSuite('seating'),seats:[0,1,2,3,4,5,null,null,null,null,null,null],...patch});
const code=k=>e=>e.code===k;

test('full teams swap in place and preserve unrelated pins without changing the inputs',()=>{
 const p=items(),teams=[p.slice(0,2),p.slice(2)],fixed={'entry-1':0},before=JSON.stringify({teams,fixed});
 const out=moveGroupMember(teams,fixed,0,1,p[0].id,p[2].id,{mode:'size',value:2});
 assert.deepEqual(out.teams.map(t=>t.map(p=>p.name)),[['C','B'],['A','D']]);
 assert.deepEqual(out.fixed,{'entry-1':0,'entry-0':1,'entry-2':0});
 assert.equal(JSON.stringify({teams,fixed}),before);
 for(let i=0;i<15;i++){const reshuffled=group(p,{mode:'size',value:2,fixed:out.fixed});for(const [id,index] of Object.entries(out.fixed))assert.ok(reshuffled[index].some(p=>p.id===id));}
});
test('direct moves allow spare capacity, reject full teams and never duplicate people',()=>{
 const p=items(),teams=[p.slice(0,3),p.slice(3)];
 const out=moveGroupMember(teams,{},0,1,p[0].id,null,{mode:'size',value:3});
 assert.deepEqual(out.teams.map(t=>t.length),[2,2]);assert.equal(new Set(out.teams.flat().map(p=>p.id)).size,4);
 assert.throws(()=>moveGroupMember([p.slice(0,2),p.slice(2)],{},0,1,p[0].id,null,{mode:'size',value:2}),code('fixedFull'));
});
test('invalid group member or target is rejected before mutation',()=>{
 const p=items(),teams=[p.slice(0,2),p.slice(2)],before=JSON.stringify(teams);
 for(const args of [[0,0,p[0].id],[0,9,p[0].id],[0,1,p[3].id],[0,1,p[0].id,p[1].id],[-1,0,p[0].id]])assert.throws(()=>moveGroupMember(teams,{},...args),code('fixedInvalid'));
 assert.equal(JSON.stringify(teams),before);
});
test('assigning an empty seat moves the person without duplicates, and unseating frees them',()=>{
 const v=seat({}),before=JSON.stringify(v);const moved=placeSeat(v,8,0);
 assert.equal(moved[0],null);assert.equal(moved[8],0);assert.equal(new Set(moved.filter(n=>n!==null)).size,6);
 assert.equal(placeSeat({...v,seats:moved},8,null)[8],null);assert.equal(JSON.stringify(v),before);
});
test('assigning a seated person swaps positions; an unseated replacement leaves the old person unassigned',()=>{
 const v=seat({});const swapped=placeSeat(v,0,2);assert.deepEqual(swapped.slice(0,4),[2,1,0,3]);
 const partial=seat({seats:[0,1,null,null,null,null,null,null,null,null,null,null]});
 const replaced=placeSeat(partial,0,2);assert.equal(replaced[0],2);assert.ok(!replaced.includes(0));assert.equal(replaced[1],1);
 const empty=placeSeat({...v,seats:[]},0,3);assert.equal(empty.length,12);assert.equal(empty[0],3);
});
test('manual seating respects locked sources, locked destinations, blocked seats and table rules',()=>{
 for(const patch of [{locked:[0]},{locked:[2]},{blocked:[2],seats:[0,1,null,3,4,5,null,null,null,null,null,null]}]){
  assert.throws(()=>placeSeat(seat(patch),2,0));}
 const v=seat({rules:[{a:0,b:1,same:true}]});assert.throws(()=>placeSeat(v,2,0),code('seatRuleError'));
 assert.deepEqual(placeSeat(v,1,0).slice(0,2),[1,0]);
 const apart=seat({rules:[{a:0,b:2,same:false}]});assert.throws(()=>placeSeat(apart,1,2),code('seatRuleError'));
});
test('a manually pinned assignment survives random seating',()=>{
 const v=seat({seats:Array(12).fill(null)});v.seats=placeSeat(v,0,4);v.locked=[0];
 for(let i=0;i<20;i++){const result=arrangeSeats(v);assert.equal(result[0],4);assert.ok(seatingValid(v,result,true));}
});
test('manual seat assignment validates all indexes and does not mutate after errors',()=>{
 const v=seat({}),before=JSON.stringify(v);
 for(const [s,p] of [[-1,0],[12,0],[1.5,0],[0,-1],[0,6],[0,undefined],[0,'1']])assert.throws(()=>placeSeat(v,s,p));
 assert.equal(JSON.stringify(v),before);
});

