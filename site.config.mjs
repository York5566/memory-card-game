// 正式網站使用自訂網域根目錄；資產、SEO 與部署共用這份設定。
export default {
  name: '翻牌遊戲',
  description: '免費線上翻牌遊戲，翻開卡牌找出相同圖案，挑戰記憶配對。免下載、免登入，支援手機與電腦，可調整配對數、限時、內建圖庫及遊戲畫面。',
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
