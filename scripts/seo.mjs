export const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
// A visible, text-free game illustration for search; social cards retain their page titles.
export const SEARCH_PREVIEW = { path: 'assets/previews/memory-card-game.png', width: 1200, height: 900, caption: '六張翻牌卡牌，隨行杯、相機與運動鞋各成一對' };
export function siteAddress(config) {
  const parts = config.basePath.split('/').filter(Boolean);
  if (parts.some(p => p === '.' || p === '..') || !parts.every(p => /^[a-zA-Z0-9\u3400-\u9fff_.-]+$/.test(p))) throw Error('basePath 格式不正確');
  const base = parts.length ? `/${parts.join('/')}/` : '/';
  let domain = '';
  if (config.domain) {
    const url = new URL(config.domain);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('正式網域請使用 https://你的網域（不含子路徑）');
    domain = url.origin;
  }
  return { base, domain };
}
export function pageMetadata({ page, route, title, description }, config, { base, domain }) {
  const documentTitle = page === 'home' ? `${config.name}｜免費線上記憶配對，可上傳自訂圖片` : `${title}｜${config.name}`;
  const canonical = domain && route !== null ? `${domain}${base}${route ? route + '/' : ''}` : '';
  const tags = [
    `<meta name="robots" content="${page === '404' || !domain ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">`,
    `<meta property="og:type" content="website">`, `<meta property="og:locale" content="zh_TW">`,
    `<meta property="og:site_name" content="${escapeHTML(config.name)}">`,
    `<meta property="og:title" content="${escapeHTML(documentTitle)}">`,
    `<meta property="og:description" content="${escapeHTML(description)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHTML(documentTitle)}">`,
    `<meta name="twitter:description" content="${escapeHTML(description)}">`,
  ];
  if (canonical) {
    const home = domain + base;
    const image = `${home}assets/social/${page}.png`;
    const searchImage = home + SEARCH_PREVIEW.path;
    const imageAlt = `${config.name}：${page === 'help' ? '圖片上傳與構圖設定教學' : '上傳照片，自訂記憶配對卡牌'}，可替換圖案、卡背、背景與 LOGO`;
    tags.push(`<link rel="canonical" href="${escapeHTML(canonical)}">`, `<meta property="og:url" content="${escapeHTML(canonical)}">`);
    for (const [property, value] of Object.entries({ 'og:image': image, 'og:image:secure_url': image, 'og:image:type': 'image/png', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': imageAlt })) tags.push(`<meta property="${property}" content="${escapeHTML(value)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHTML(image)}">`, `<meta name="twitter:image:alt" content="${escapeHTML(imageAlt)}">`);
    if (page === 'home' && config.googleSiteVerification) tags.push(`<meta name="google-site-verification" content="${escapeHTML(config.googleSiteVerification)}">`);
    const graph = [
      { '@type': 'WebSite', '@id': home + '#website', url: home, name: config.name, alternateName: new URL(domain).hostname, description: config.description || description, inLanguage: 'zh-Hant' },
      { '@type': 'WebPage', '@id': canonical + '#webpage', url: canonical, name: documentTitle, description, inLanguage: 'zh-Hant', isPartOf: { '@id': home + '#website' }, primaryImageOfPage: { '@id': canonical + '#image' } },
      { '@type': 'ImageObject', '@id': canonical + '#image', url: searchImage, contentUrl: searchImage, width: SEARCH_PREVIEW.width, height: SEARCH_PREVIEW.height, caption: SEARCH_PREVIEW.caption },
    ];
    if (page === 'game') graph[1].mainEntity = { '@type': 'WebApplication', name: config.name, url: canonical, image: searchImage, applicationCategory: 'GameApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', inLanguage: 'zh-Hant', isAccessibleForFree: true, description, featureList: ['上傳照片或圖片，自訂 12 種配對圖案', '自訂卡背、背景與 LOGO', '圖片縮放、位置、旋轉、透明度與裁切調整', '2 至 12 對卡牌、限時或不限時挑戰', '本機成績紀錄與 CSV 匯出'] };
    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return { documentTitle, canonical, meta: tags.join('\n  ') };
}
