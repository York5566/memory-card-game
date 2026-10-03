// GitHub Pages 部署時提供正式 origin 與子路徑，本機不宣告測試網址為 canonical。
export default {
  name: '翻牌遊戲',
  description: '免費線上翻牌遊戲，翻開卡牌找出相同圖案，挑戰記憶配對。免下載、免登入，支援手機與電腦，可調整配對數、限時、內建圖庫及遊戲畫面。',
  // Pages 工作流程傳入網站子目錄；本機預覽仍預設使用 /。
  basePath: process.env.SITE_BASE_PATH || '/',
  domain: process.env.SITE_ORIGIN || '',
  ads: {
    enabled: false,
    demo: false,
    publisher: '',
    slot: '',
    // 取得真實帳號、政策審查與適用地區同意管理後，才能啟用。
    consentReady: false,
  },
};
