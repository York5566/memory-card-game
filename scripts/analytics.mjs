// 只在正式建置的內容頁輸出 GA4；正式成品在 localhost 開啟也不送出測試流量。
export function analyticsMarkup(config, { domain }, page) {
  const id = config.ga4MeasurementId || '';
  if (!domain || page === '404' || !id) return '';
  if (!/^G-[A-Z0-9]+$/.test(id)) throw Error('GA4 評估 ID 格式不正確，應為 G- 開頭的英數字');
  return `<!-- Google tag (gtag.js) -->
  <script data-site-analytics="ga4">
  (function () {
    if (window.memoryGameLanguage?.redirecting || window.location.origin !== ${JSON.stringify(domain)} || document.getElementById('site-ga4-loader')) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ${JSON.stringify(id)});
    var tag = document.createElement('script');
    tag.id = 'site-ga4-loader';
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=${id}';
    document.head.appendChild(tag);
  })();
  </script>`;
}
