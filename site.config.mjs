// 正式網站使用自訂網域根目錄；資產、SEO 與部署共用這份設定。
export default {
  name: '翻牌遊戲',
  description: "免費線上翻牌遊戲，支援好友邀請連結、線上配對與雙人 PK。上傳自己的照片，自訂配對圖案、卡背與背景；挑戰 2 至 12 對卡牌，與對手輪流翻牌比記憶力。免下載、免登入，手機與電腦都能玩。",
  basePath: process.env.SITE_BASE_PATH ?? '/',
  domain: process.env.SITE_ORIGIN ?? 'https://wwwne1198.party',
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION || '',
  ga4MeasurementId: process.env.GA4_MEASUREMENT_ID ?? 'G-VXMTJFXBHE',
  cloud: {
    apiURL: process.env.CLOUD_API_URL ?? 'https://memory-game-api.wwwne1198.workers.dev',
    siteKey: process.env.TURNSTILE_SITE_KEY ?? '0x4AAAAAAFO-lRDUAUd9M0PH',
  },
  ads: {
    enabled: false,
    demo: false,
    publisher: '',
    slot: '',
    // 取得真實帳號、政策審查與適用地區同意管理後，才能啟用。
    consentReady: false,
  },
};
