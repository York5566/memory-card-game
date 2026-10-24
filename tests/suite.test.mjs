import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSuite,validateSuite,arrangeSeats,seatingValid,swapSeats,nextDice,wifiPayload,cropRect,zipFiles,paperFit} from '../public/js/suite-core.js';
import {TOOL_CATALOG,SUITE_KINDS} from '../public/js/tool-catalog.js';
import {toolMessages,toolText} from '../public/js/tools-text.js';
import {hubPage,suitePage,guidePage} from '../src/suite-pages.mjs';
import {pageMetadata} from '../scripts/seo.mjs';
const seed=()=>{let n=4321;return max=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n%max;};};
test('15 tools have unique stable addresses and seven new tools round-trip defaults',()=>{
 assert.equal(TOOL_CATALOG.length,15);assert.equal(new Set(TOOL_CATALOG.map(t=>t.path)).size,15);
 for(const kind of SUITE_KINDS){const state=validateSuite(defaultSuite(kind),kind);assert.deepEqual(validateSuite(JSON.parse(JSON.stringify(state)),kind),state);}
});
test('backups reject wrong tools, versions, remote images and resource exhaustion',()=>{
 assert.throws(()=>validateSuite(defaultSuite('qr'),'badges'));
 assert.throws(()=>validateSuite({...defaultSuite('dice'),version:99}));
 assert.throws(()=>validateSuite({...defaultSuite('badges'),logo:'https://example.com/logo.png'}));
 assert.throws(()=>validateSuite({...defaultSuite('whiteboard'),pages:Array.from({length:21},()=>[])}));
 assert.throws(()=>validateSuite({...defaultSuite('seating'),rows:10,cols:10,perTable:12}));
});
test('seating enforces same-table groups, separated pairs and unique assignment across repeated shuffles',()=>{
 const v={...defaultSuite('seating'),rules:[{a:0,b:1,same:true},{a:1,b:2,same:false}]},rng=seed();
 for(let i=0;i<100;i++){const seats=arrangeSeats(v,rng);assert.ok(seatingValid(v,seats,true));assert.equal(new Set(seats.filter(v=>v!==null)).size,6);assert.equal(Math.floor(seats.indexOf(0)/2),Math.floor(seats.indexOf(1)/2));}
});
test('locked occupied and empty seats stay fixed, blocked seats stay empty',()=>{
 const v=defaultSuite('seating');v.seats=Array(12).fill(null);v.seats[0]=0;v.locked=[0,1];v.blocked=[2];
 const result=arrangeSeats(v,seed());assert.equal(result[0],0);assert.equal(result[1],null);assert.equal(result[2],null);assert.ok(seatingValid(v,result,true));
 assert.throws(()=>swapSeats({...v,seats:result},0,3));assert.throws(()=>swapSeats({...v,seats:result},2,3));
});
test('contradictory and over-capacity seat constraints fail without mutating input',()=>{
 const v={...defaultSuite('seating'),rules:[{a:0,b:1,same:true},{a:1,b:2,same:true},{a:0,b:2,same:false}]},before=JSON.stringify(v);
 assert.throws(()=>arrangeSeats(v,seed()));assert.equal(JSON.stringify(v),before);
 assert.throws(()=>arrangeSeats({...defaultSuite('seating'),rows:1,cols:1,perTable:2},seed()));
});
test('manual swaps enforce rules and permit swaps within a table',()=>{
 const v={...defaultSuite('seating'),seats:[0,1,2,3,4,5,null,null,null,null,null,null],rules:[{a:0,b:1,same:true}]};
 assert.throws(()=>swapSeats(v,0,2));assert.equal(swapSeats(v,0,1)[0],1);
});
test('dice preserve held values, deck draws do not repeat and reset is explicit',()=>{
 let v={...defaultSuite('dice'),results:[2,3],held:[true,false]};v=nextDice(v,()=>0);assert.deepEqual(v.results,[2,0]);
 v={...defaultSuite('dice'),mode:'deck',count:2};const drawn=[];for(let i=0;i<3;i++){v=nextDice(v,seed());drawn.push(...v.results);}assert.equal(new Set(drawn).size,6);assert.throws(()=>nextDice(v,seed()));
 v=nextDice({...v,replacement:true},()=>0);assert.deepEqual(v.results,[0,0]);
});
test('Wi-Fi escapes delimiter characters and passwords are excluded from saved configuration',()=>{
 assert.equal(wifiPayload('a;b','p:q\\x','WPA',true),'WIFI:T:WPA;S:a\\;b;P:p\\:q\\\\x;H:true;;');
 assert.ok(wifiPayload('open','secret','nopass').includes('P:;'));
 const v=validateSuite({...defaultSuite('qr'),password:'secret'});assert.ok(!JSON.stringify(v).includes('secret'));
});
test('crop positions, ratios, no-upscale and output height limit are consistent',()=>{
 const v=defaultSuite('image');
 assert.deepEqual(cropRect(1200,600,{...v,ratio:'1:1',x:100}),{sx:600,sy:0,sw:600,sh:600,width:600,height:600});
 assert.equal(cropRect(100,50,v).width,100);
 const r=cropRect(100,1000,{...v,ratio:'original',upscale:true,width:4096});assert.equal(r.height,4096);assert.equal(r.width,410);
});
test('paper geometry includes fold height and rejects clipping',()=>{
 assert.equal(paperFit(defaultSuite('badges')),true);
 assert.throws(()=>paperFit({...defaultSuite('badges'),style:'fold'}));
 assert.equal(paperFit({...defaultSuite('badges'),style:'fold',rows:2}),true);
 assert.throws(()=>paperFit({...defaultSuite('badges'),cols:3}));
});
test('whiteboard preserves negative-slope lines and validates coordinates and pen bounds',()=>{
 const v=defaultSuite('whiteboard');v.pages=[[{type:'line',x:10,y:20,w:100,h:80,flip:true,color:'#123456',width:3,fill:false}]];
 assert.equal(validateSuite(v).pages[0][0].flip,true);
 v.pages[0][0].x=Infinity;assert.throws(()=>validateSuite(v));
});
test('ZIP output contains UTF-8 names, correct offsets, CRC and file contents',async()=>{
 const data=new TextEncoder().encode('123456789'),blob=zipFiles([{name:'名單.txt',data}]),bytes=new Uint8Array(await blob.arrayBuffer()),v=new DataView(bytes.buffer);
 assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint16(6,true),0x800);assert.equal(v.getUint32(14,true),0xcbf43926);
 const nameLength=v.getUint16(26,true);assert.equal(new TextDecoder().decode(bytes.slice(30,30+nameLength)),'名單.txt');assert.deepEqual(bytes.slice(30+nameLength,30+nameLength+9),data);
 assert.equal(v.getUint32(30+nameLength+9,true),0x02014b50);assert.equal(v.getUint32(bytes.length-22,true),0x06054b50);
});
test('new tools and guide have localized, static content and correct metadata in all four languages',()=>{
 for(const [lang,prefix]of [['zh-Hant',''],['en','en/'],['ja','ja/'],['ko','ko/']]){
  const home=hubPage(lang,'/','/'+prefix);assert.equal((home.match(/data-tool-category=/g)||[]).length,15);assert.ok(home.includes('id="catalog-search"'));
  assert.ok(guidePage(lang,'/','/'+prefix).includes('href="/'+prefix+'help/"'));
  for(const kind of SUITE_KINDS){const html=suitePage(kind,lang,'/','/'+prefix);assert.ok(html.includes('data-suite="'+kind+'"'));assert.ok(html.includes('id="suite-backup"'));if(lang==='en'||lang==='ko')assert.ok(!/[\u3400-\u9fff]/.test(html),kind+' '+lang);
   const meta=pageMetadata({page:kind,route:'tools/'+kind,title:toolText(kind,lang),description:toolText(kind+'Meta',lang)},{name:'一起玩工具箱',toolsPortal:true},{domain:'https://example.test',base:'/'},lang);
   assert.ok(meta.meta.includes('UtilitiesApplication'));assert.ok(meta.meta.includes('assets/social/'+prefix+kind+'.png'));
  }
 }
});
