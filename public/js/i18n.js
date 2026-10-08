import { messages } from './locales/messages.js';

export const LOCALES = {
  'zh-Hant': { label: '繁體中文', prefix: '', region: 'zh-TW', og: 'zh_TW', turnstile: 'zh-tw' },
  en: { label: 'English', prefix: 'en/', region: 'en', og: 'en_US', turnstile: 'en' },
  ja: { label: '日本語', prefix: 'ja/', region: 'ja', og: 'ja_JP', turnstile: 'ja' },
  ko: { label: '한국어', prefix: 'ko/', region: 'ko', og: 'ko_KR', turnstile: 'ko' },
};
export const locale = typeof document !== 'undefined' && Object.hasOwn(LOCALES, document.documentElement.lang) ? document.documentElement.lang : 'zh-Hant';
export const region = LOCALES[locale].region;
export const localeBase = (base, language) => base + LOCALES[language].prefix;
export function t(source, language = locale) {
  return language === 'zh-Hant' ? source : messages[source]?.[language] ?? source;
}
export const knownMessage = source => Object.hasOwn(messages, source);
export const escapeTranslation = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Translate the author's literal text BEFORE substituting values. Uploaded names,
// player names and other user content are never looked up in the translation table.
export function segment(source, language = locale, escape = false) {
  const slots = [];
  const key = source.trim().replace(/\uE000(\d+)\uE001/g, (_, n) => `{${slots.push(n) - 1}}`);
  const translated = t(key, language);
  if (translated === key) return source;
  const result = (escape ? escapeTranslation(translated) : translated).replace(/\{(\d+)\}/g, (_, n) => `\uE000${slots[Number(n)]}\uE001`);
  return source.slice(0, source.length - source.trimStart().length) + result + source.slice(source.trimEnd().length);
}
export function localizeMarkup(source, language = locale) {
  return source.split(/(<[^>]*>)/g).map(part => part.startsWith('<')
    ? part.replace(/\b(alt|title|aria-label|placeholder)="([^"]*)"/g, (_, name, value) => `${name}="${segment(value, language, true)}"`)
    : segment(part, language, true)).join('');
}
function template(strings, values, markup) {
  const source = strings.reduce((out, text, i) => out + (i ? `\uE000${i - 1}\uE001` : '') + text, '');
  const translated = markup ? localizeMarkup(source) : segment(source);
  return translated.replace(/\uE000(\d+)\uE001/g, (_, n) => String(values[Number(n)]));
}
export const msg = (strings, ...values) => template(strings, values, false);
export const html = (strings, ...values) => template(strings, values, true);
