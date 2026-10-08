import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { messages } from '../public/js/locales/messages.js';
import { t, localizeMarkup, LOCALES } from '../public/js/i18n.js';
import { pageMetadata, siteAddress } from '../scripts/seo.mjs';

test('所有翻譯有英日韓版本，動態變數數量與順序索引完整', () => {
  const slots = text => [...text.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
  assert.ok(Object.keys(messages).length >= 460);
  for (const [source, translations] of Object.entries(messages)) for (const language of ['en','ja','ko']) {
    assert.ok(translations[language]?.trim(), source + ':' + language);
    assert.deepEqual(slots(translations[language]), slots(source), source + ':' + language);
  }
});

test('可爬取的正文、圖片替代文字與導覽都有翻譯，不只標題', () => {
  for (const name of ['layout.html', ...['home','game','help','404'].map(p => 'pages/'+p+'.html')]) {
    const source = readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
    for (const part of source.split(/(<[^>]*>)/g)) {
      const strings = part.startsWith('<') ? [...part.matchAll(/\b(?:alt|title|aria-label|placeholder)="([^"]*)"/g)].map(m=>m[1]) : [part];
      for (const text of strings.map(s=>s.trim()).filter(s=>/[\u3400-\u9fff]/.test(s))) {
        assert.ok(Object.hasOwn(messages,text), name+': '+text);
        for(const language of ['en','ja','ko']) assert.ok(t(text,language));
      }
    }
  }
});

test('HTML 翻譯保留屬性語法、模板與色碼正規式，不將數字花括號當變數', () => {
  const source = '<input pattern="#[0-9a-fA-F]{6}" value="{{BASE}}"><span>設定</span>';
  assert.equal(localizeMarkup(source,'en'), '<input pattern="#[0-9a-fA-F]{6}" value="{{BASE}}"><span>Settings</span>');
  assert.equal(localizeMarkup('<span>&amp;</span>','en'),'<span>&amp;</span>');
});

test('各語言執行真正的格式化程式，保留自訂文字、CSV 安全與相同規則 ID', () => {
  const results=[];
  for (const language of Object.keys(LOCALES)) {
    const child = async function () {
      const {t,msg,html}=await import('./public/js/i18n.js');
      const {defaults,ruleKey,historicalRecord,toCSV}=await import('./public/js/core.js');
      const {displaySetting,escapeHTML,assetURL,productName}=await import('./public/js/stage.js');
      const config=defaults(),custom='設定 <b>& {0}';
      config.products[0].label=custom;
      const markup=html`<input pattern="#[0-9a-fA-F]{6}" aria-label="${t('標題')}色碼"><span>${escapeHTML(custom)}</span><b>設定</b>`;
      const row=historicalRecord({elapsedMs:12345,outcome:'won',flips:12},config,'id',0,custom);
      console.log(JSON.stringify({key:ruleKey(config),markup,custom:displaySetting(custom,'title.text'),stock:displaySetting(defaults().title.text,'title.text'),product:productName(config,'everyday-1'),csv:toCSV([row]),rule:msg`${6} 對 / ${12} 張・${t('不限時')}`,back:assetURL('assets/back-mint.svg')}));
    };
    const code = `globalThis.document={documentElement:{lang:${JSON.stringify(language)}},body:{dataset:{base:'/'}}};await (${child.toString()})();`;
    const run=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);results.push(result);
    assert.ok(result.markup.includes('pattern="#[0-9a-fA-F]{6}"'));
    assert.ok(result.markup.includes('設定 &lt;b&gt;&amp; {0}'));
    assert.ok(!result.markup.includes('undefined'));
    assert.equal(result.custom,'設定 <b>& {0}');assert.equal(result.product,result.custom);
    assert.ok(result.csv.includes(result.custom));assert.ok(result.csv.includes('12345'));
    assert.equal(result.stock,t('找出所有相同的圖案',language));
    assert.ok(result.csv.includes(t('成績識別碼',language)));
    if(language!=='zh-Hant') {assert.ok(!result.rule.includes('不限時'));assert.ok(result.back.includes('/'+language+'/'));}
  }
  assert.equal(new Set(results.map(r=>r.key)).size,1,'Switching languages must not change rule grouping');
});

test('四種語言有獨立 canonical、雙向 hreflang、OG 與結構化語言', () => {
  const config={name:'翻牌遊戲',domain:'https://wwwne1198.party',basePath:'/nested/'};
  for(const [language,info] of Object.entries(LOCALES)) {
    const {canonical,meta}=pageMetadata({page:'game',route:'games/memory',title:t('上傳照片，自訂記憶配對卡牌',language),description:t('自訂圖案',language)},config,siteAddress(config),language);
    assert.equal(canonical,config.domain+'/nested/'+info.prefix+'games/memory/');
    for(const [id,other] of Object.entries(LOCALES)) assert.ok(meta.includes(`hreflang="${id}" href="${config.domain}/nested/${other.prefix}games/memory/"`));
    assert.ok(meta.includes('hreflang="x-default" href="https://wwwne1198.party/nested/games/memory/"'));
    assert.ok(meta.includes(`property="og:locale" content="${info.og}"`));
    const graph=JSON.parse(meta.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
    assert.equal(graph[1].inLanguage,language);assert.equal(graph[1].mainEntity.inLanguage,language);
    assert.equal(graph[0].url,config.domain+'/nested/'+info.prefix);
  }
});

test('既有 Worker 的可見錯誤訊息都有前端翻譯，不需要更動已部署的資料庫', () => {
  const source=readFileSync(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
  for(const match of source.matchAll(/'([^'\n]*[\u3400-\u9fff][^'\n]*)'/g)) assert.ok(Object.hasOwn(messages,match[1]),match[1]);
});
