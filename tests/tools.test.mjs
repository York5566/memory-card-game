import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FILE_BYTES, entries, draw, group, csv, importList, defaults, validateConfig, teamCount, randomInt } from '../public/js/tools-core.js';
import { toolText, toolMessages } from '../public/js/tools-text.js';
import { toolPage } from '../src/tools-pages.mjs';
import { pageMetadata, siteAddress } from '../scripts/seo.mjs';
const names = n => Array.from({length:n},(_,i)=>`Person ${i+1}`).join('\n');
const items = n => entries(names(n)).items;
const code = expected => error => error.code === expected;

test('每個加權區間都能抽中對應項目，無放回連抽不重複且不改輸入',()=>{
 const input=entries('A | 1\nB | 3\nC | 2',{weighted:true}).items;
 assert.deepEqual(Array.from({length:6},(_,ticket)=>draw(input,1,false,()=>ticket)[0].name),['A','B','B','B','C','C']);
 assert.deepEqual(draw(input,3,false,()=>0).map(x=>x.name),['A','B','C']);
 assert.equal(input.length,3);assert.deepEqual(draw(input,3,true,()=>0).map(x=>x.name),['A','A','A']);
 assert.throws(()=>draw(input,4,false),code('notEnough'));assert.throws(()=>draw([],1),code('empty'));
});
test('名單保留可識別的獨立籤，重複與權重都有明確界限',()=>{
 assert.equal(entries(' A \nA\nB').duplicates,1);assert.equal(entries('A\nA',{dedupe:false}).items.length,2);
 assert.notEqual(entries('A\nA',{dedupe:false}).items[0].id,entries('A\nA',{dedupe:false}).items[1].id);
 for(const value of ['A | 0','A | 1001','A | 1.5','A |','A | 1 | 2'])assert.throws(()=>entries(value,{weighted:true}),code('weightError'));
 assert.equal(entries('A | 2',{weighted:false}).items[0].name,'A | 2');
 assert.throws(()=>entries(names(501)),code('limit'));assert.throws(()=>entries('x'.repeat(81)),code('nameError'));
});
test('分組覆蓋每一人且無重複，各種人數與組數都盡量均衡',()=>{
 for(let n=2;n<=80;n++)for(let count=1;count<=Math.min(n,15);count++){
  const out=group(items(n),{mode:'count',value:count});const sizes=out.map(x=>x.length);
  assert.equal(new Set(out.flat().map(x=>x.id)).size,n);assert.equal(out.flat().length,n);
  assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
 }
 const bySize=group(items(23),{mode:'size',value:5});assert.deepEqual(bySize.map(x=>x.length).sort(),[4,4,5,5,5]);
 assert.equal(teamCount(23,'size',5),5);assert.throws(()=>group(items(2),{value:3}),code('groupCount'));
});
test('指定隊員優先、重分不離組，最多人數模式與失效指定會明確拒絕',()=>{
 const fixed={'entry-0':1,'entry-1':1,'entry-2':1};
 for(let attempt=0;attempt<20;attempt++){
  const out=group(items(8),{mode:'count',value:3,fixed});
  for(const id of Object.keys(fixed))assert.ok(out[1].some(item=>item.id===id));
  assert.equal(out.flat().length,8);
 }
 assert.throws(()=>group(items(8),{mode:'size',value:2,fixed}),code('fixedFull'));
 assert.throws(()=>group(items(8),{value:2,fixed:{'entry-0':2}}),code('fixedInvalid'));
});
test('設定匯入驗證工具種類、版本、欄位與固定隊員，不接受任意物件',()=>{
 for(const kind of ['picker','groups'])assert.deepEqual(validateConfig(defaults(kind),kind),defaults(kind));
 const config={...defaults('groups'),names:names(5),fixed:{'entry-2':1}};
 assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(config)),'groups'),config);
 const sameNames={...defaults('groups'),names:'Alex\nAlex',dedupe:false,fixed:{'entry-1':1}};
 assert.deepEqual(validateConfig(sameNames,'groups'),sameNames);
 assert.equal(group(entries(sameNames.names,{dedupe:false}).items,{value:2,fixed:sameNames.fixed}).flat().length,2);
 const longest={...defaults('groups'),value:50,names:Array.from({length:500},(_,i)=>'名'.repeat(76)+String(i).padStart(4,'0')).join('\n')};
 const exported=JSON.stringify(longest,null,2);
 assert.ok(Buffer.byteLength(exported,'utf8')<=MAX_FILE_BYTES);
 assert.deepEqual(validateConfig(JSON.parse(exported),'groups'),longest);
 for(const patch of [{kind:'picker'},{version:2},{textSize:999},{names:123},{theme:'<script>'},{fixed:{bad:0}},{fixed:{'entry-1':9}}])assert.throws(()=>validateConfig({...config,...patch},'groups'),code('configError'));
});
test('CSV 匯入處理引號、逗號、BOM、標題列；匯出避免公式執行',()=>{
 assert.equal(importList('\uFEFFname,weight\r\n"A, B",3\r\n"C ""D""",2',true),'A, B | 3\nC "D" | 2');
 assert.equal(importList('Alex\nTaylor'),'Alex\nTaylor');
 assert.equal(importList('Doe, Jane\nLee, Sam',false,'text'),'Doe, Jane\nLee, Sam');
 assert.equal(importList('name\n"Alex"\n"Taylor"',false,'csv'),'Alex\nTaylor');assert.throws(()=>importList('"broken,2'),code('invalid'));
 const out=csv([['=1+1','  @SUM(1)','-2','A"B','韓文']]);
 assert.ok(out.startsWith('\uFEFF'));assert.ok(out.includes('"\'=1+1"'));assert.ok(out.includes('"\'  @SUM(1)"'));assert.ok(out.includes('A""B'));
});
test('安全亂數介於合法範圍，拒絕非法範圍',()=>{
 for(const max of [1,2,6,500000])for(let i=0;i<50;i++){const n=randomInt(max);assert.ok(n>=0 && n<max && Number.isInteger(n));}
 assert.throws(()=>randomInt(0));assert.throws(()=>randomInt(1.5));
});
test('工具文案四語完整，變數一致；四語頁面輸出可爬取標題、範例與導覽',()=>{
 const slots=s=>[...s.matchAll(/\{\d+\}/g)].map(x=>x[0]).sort();
 for(const [key,values] of Object.entries(toolMessages)){
  assert.equal(values.length,4,key);for(const value of values){assert.ok(value.trim(),key);assert.deepEqual(slots(value),slots(values[0]),key);}
 }
 for(const lang of ['zh-Hant','en','ja','ko'])for(const page of ['home','picker','groups']){
  const prefix=lang==='zh-Hant'?'':lang+'/'; const html=toolPage(page,lang,'/','/'+prefix);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);assert.ok(html.includes('href="/'+prefix));
  if(lang==='en'||lang==='ko')assert.ok(!/[\u3400-\u9fff]/.test(html),page+lang);
  if(page!=='home'){assert.ok(html.includes(toolText(page+'Example',lang)));assert.ok(html.includes('type="module" src="/js/tools.js"'));}
 }
});
test('工具站首頁與工具頁結構化資料符合各自內容，不再把所有頁面當遊戲',()=>{
 const config={name:'一起玩工具箱',domain:'https://wwwne1198.party',basePath:'/',toolsPortal:true};
 for(const [page,route] of [['home',''],['picker','tools/random-picker'],['groups','tools/random-groups']]){
  const output=pageMetadata({page,route,title:page,description:'test'},config,siteAddress(config),'en');
  const graph=JSON.parse(output.meta.match(/application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
  assert.ok(graph[2].url.includes('tools-'));assert.equal((output.meta.match(/hreflang=/g)||[]).length,5);
  assert.equal(graph[1].mainEntity['@type'],page==='home'?'ItemList':'WebApplication');
  if(page==='home')assert.equal(graph[1].mainEntity.itemListElement.length,3);else assert.equal(graph[1].mainEntity.applicationCategory,'UtilitiesApplication');
 }
});
