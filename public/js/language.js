// Runs before analytics and the game. Language-specific URLs stay addressable.
(() => {
  const key = 'memory-game-language';
  const prefixes = { 'zh-Hant': '', en: 'en/', ja: 'ja/', ko: 'ko/' };
  const valid = language => Object.hasOwn(prefixes, language);
  const script = document.currentScript;
  const base = script?.dataset.base || '/';
  const page = script?.dataset.page;

  function remember(language) {
    if (!valid(language)) return false;
    try {
      window.localStorage.setItem(key, language);
      return window.localStorage.getItem(key) === language;
    } catch { return false; }
  }
  function navigate(href, language) {
    if (!valid(language)) return;
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) return;
    const saved = remember(language);
    // An explicit choice of Chinese must work even when storage is blocked.
    if (language === 'zh-Hant' && !saved) target.searchParams.set('lang', language);
    window.location.assign(target.href);
  }
  const api = window.memoryGameLanguage = { remember, navigate, redirecting: false };

  function browserLanguage() {
    let languages;
    try { languages = navigator.languages?.length ? navigator.languages : [navigator.language]; }
    catch { return 'zh-Hant'; }
    for (const language of languages) {
      if (typeof language !== 'string') continue;
      const primary = language.toLowerCase().split('-')[0];
      if (primary === 'zh') return 'zh-Hant';
      if (['en', 'ja', 'ko'].includes(primary)) return primary;
    }
    return languages.some(language => typeof language === 'string' && language) ? 'en' : 'zh-Hant';
  }
  function automaticDestination() {
    if (!['home', 'game', 'help', 'privacy'].includes(page)) return null;
    const here = new URL(window.location.href);
    if (!base.startsWith('/') || !base.endsWith('/') || !here.pathname.startsWith(base)) return null;
    const relative = here.pathname.slice(base.length);
    // Explicit English/Japanese/Korean URLs override both saved and browser preferences.
    if (['en/', 'ja/', 'ko/'].some(prefix => relative.startsWith(prefix))) return null;
    const route = relative.replace(/index\.html$/, '');
    if (!['', 'games/memory/', 'help/', 'privacy/'].includes(route)) return null;
    const explicit = here.searchParams.get('lang');
    let language;
    if (valid(explicit)) language = explicit;
    else {
      // Keep crawlers on the requested static HTML, and do not reroute internal navigation.
      if (/bot|spider|crawler|slurp|facebookexternalhit|bingpreview|GoogleOther|Google-InspectionTool|Mediapartners-Google|APIs-Google/i.test(navigator.userAgent || '')) return null;
      if (document.referrer) {
        try { if (new URL(document.referrer).origin === here.origin) return null; } catch { /* Invalid referrers are ignored. */ }
      }
      try { language = window.localStorage.getItem(key); } catch { /* Detection works without storage. */ }
      if (!valid(language)) language = browserLanguage();
    }
    if (language === 'zh-Hant') return null;
    here.pathname = base + prefixes[language] + route;
    return here.href;
  }
  try {
    const destination = automaticDestination();
    if (destination) { api.redirecting = true; window.location.replace(destination); }
  } catch { api.redirecting = false; /* Detection must never prevent opening or playing the site. */ }
})();
