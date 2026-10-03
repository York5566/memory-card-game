export const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
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
  const documentTitle = page === 'home' ? `${config.name}｜免費線上記憶配對小遊戲` : `${title}｜${config.name}`;
  const canonical = domain && route !== null ? `${domain}${base}${route ? route + '/' : ''}` : '';
  const tags = [
    `<meta name="robots" content="${page === '404' ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">`,
    `<meta property="og:type" content="website">`, `<meta property="og:locale" content="zh_TW">`,
    `<meta property="og:site_name" content="${escapeHTML(config.name)}">`,
    `<meta property="og:title" content="${escapeHTML(documentTitle)}">`,
    `<meta property="og:description" content="${escapeHTML(description)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHTML(documentTitle)}">`,
    `<meta name="twitter:description" content="${escapeHTML(description)}">`,
  ];
  if (canonical) {
    const home = domain + base;
    tags.push(`<link rel="canonical" href="${escapeHTML(canonical)}">`, `<meta property="og:url" content="${escapeHTML(canonical)}">`);
    const graph = [
      { '@type': 'WebSite', '@id': home + '#website', url: home, name: config.name, inLanguage: 'zh-Hant' },
      { '@type': 'WebPage', '@id': canonical + '#webpage', url: canonical, name: documentTitle, description, inLanguage: 'zh-Hant', isPartOf: { '@id': home + '#website' } },
    ];
    if (page === 'game') graph[1].mainEntity = { '@type': 'WebApplication', name: config.name, url: canonical, applicationCategory: 'GameApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', inLanguage: 'zh-Hant', isAccessibleForFree: true, description };
    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return { documentTitle, canonical, meta: tags.join('\n  ') };
}
