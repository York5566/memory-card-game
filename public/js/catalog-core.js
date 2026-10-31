import {TOOL_CATALOG,CATEGORIES} from './tool-catalog.js';
import {toolText} from './tools-text.js';
const aliases={
 timer:'countdown stopwatch 倒數 計時 タイマー カウントダウン 타이머 카운트다운',
 picker:'抽獎 轉盤 抽籤 lottery wheel raffle 抽選 ルーレット 추첨 룰렛',
 groups:'分隊 分組 teams groups チーム分け 팀',
 image:'縮圖 壓縮 轉檔 裁切 resize compress convert crop 画像 圧縮 이미지 압축',
 badges:'名牌 桌牌 座位牌 name tags labels ネーム 名札 명찰',
 certificates:'證書 獎狀 certificate award 証書 賞状 상장',
 qr:'qrcode 二維碼 QR コード 큐알',
};
export function catalogMatches(tool,language,query,category='all'){
 if(category!=='all'&&tool.category!==category)return false;
 const text=[tool.id,toolText(tool.id,language),toolText(tool.id+'Intro',language),aliases[tool.id]||''].join(' ').normalize('NFKC').toLocaleLowerCase();
 return query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).every(word=>text.includes(word));
}
export function catalogFilter(hash){
 const params=new URLSearchParams(hash.replace(/^#(?:tools\??)?/,''));
 return {query:(params.get('q')||'').slice(0,100),category:CATEGORIES.includes(params.get('category'))?params.get('category'):'all'};
}
export {TOOL_CATALOG};

