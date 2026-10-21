// 正式網站使用自訂網域根目錄；資產、SEO 與部署共用這份設定。
export default {
  name: '一起玩工具箱',
  toolsPortal: true,
  description: '免費活動工具：自訂圖片翻牌遊戲、好友 PK 與線上配對、抽籤轉盤、隨機分組。自由設定名單、權重、分組規則與呈現方式，支援全螢幕及四種語言，免登入即可使用。',
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
