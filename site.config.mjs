// 暫用站名。正式網域尚未決定，因此不產生 canonical / sitemap。
export default {
  name: '翻牌遊戲',
  description: '翻開卡牌、找出相同圖案，可調整玩法、圖庫與畫面。',
  // Pages 工作流程傳入網站子目錄；本機預覽仍預設使用 /。
  basePath: process.env.SITE_BASE_PATH || '/',
  domain: '',
  ads: {
    enabled: false,
    demo: false,
    publisher: '',
    slot: '',
    // 取得真實帳號、政策審查與適用地區同意管理後，才能啟用。
    consentReady: false,
  },
};
