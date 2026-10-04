// Pure browser-independent rules. Inject a monotonic clock for deterministic checks.
export const VERSION = 1;
export const MAX_RECORDS = 500;
export const copy = value => structuredClone(value);
export const FIELDS = { nickname: '暱稱', cardCount: '卡牌數量', elapsedMs: '挑戰用時', flips: '翻牌次數', completedAt: '完成時間', outcome: '挑戰結果', matchedPairs: '完成配對', accuracy: '配對成功率', event: '活動名稱' };
const names = ['無線耳機', '隨行杯', '經典相機', '香氛', '智慧手錶', '輕巧音箱', '運動鞋', '太陽眼鏡', '保養精華', '手提包', '檯燈', '遊戲手把'];
export const PRODUCTS = names.map((name, i) => ({ id: `everyday-${i + 1}`, name, version: 1, path: `assets/products/${String(i + 1).padStart(2, '0')}.svg` }));
export const ASSETS = {
  back: [{ id: 'mint-v1', name: '薄荷卡背', path: 'assets/back-mint.svg' }, { id: 'peach-v1', name: '杏桃卡背', path: 'assets/back-peach.svg' }],
  background: [{ id: 'dots-v1', name: '柔色波浪', path: 'assets/soft-waves.svg' }, { id: 'none', name: '不顯示背景圖片', path: '' }],
  logo: [{ id: 'memory-v1', name: '翻牌遊戲標記', path: 'assets/logo.svg' }, { id: 'none', name: '不顯示 LOGO', path: '' }],
};
export function transform(extra = {}) { return { fit: 'contain', zoom: 100, x: 0, y: 0, opacity: 100, rotation: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, ...extra }; }
export function defaults() {
  return {
    version: VERSION, pairs: 6, timed: false, limitSeconds: 90, previewSeconds: 3, mismatchMs: 850, sound: true, showLabels: true,
    ratioW: 4, ratioH: 5, columns: 0, gap: 14, radius: 16, boardScale: 100,
    cardColor: '#fffdf8', backColor: '#dfede6', matchColor: '#78a98c', backgroundColor: '#f4f7f0',
    headerText: '翻牌遊戲 / MEMORY GAME',
    title: { text: '找出所有相同的圖案', subtitle: '每次翻開兩張卡牌，完成全部配對。', x: 0, y: 0, size: 24, opacity: 100, color: '#355849', align: 'left' },
    back: transform({ asset: 'mint-v1', fit: 'cover' }),
    background: transform({ asset: 'dots-v1', fit: 'cover' }),
    logo: transform({ asset: 'none', canvasW: 180, canvasH: 54, boxX: 0, boxY: 0 }),
    products: PRODUCTS.map(p => ({ id: p.id, enabled: true, image: transform({ zoom: 90 }) })),
    records: { enabled: false, leaderboard: true, fields: Object.keys(FIELDS) }, event: '',
  };
}
export const TRANSFORM_SPECS = [
  ['fit', '顯示方式', 'select', [['contain', '完整顯示'], ['cover', '填滿裁切'], ['stretch', '拉伸填滿']]],
  ['zoom', '圖案縮放（%）', 'number', 10, 400, 1], ['x', '水平位置（%）', 'number', -100, 100, 1], ['y', '垂直位置（%）', 'number', -100, 100, 1],
  ['opacity', '透明度（%）', 'number', 0, 100, 1], ['rotation', '旋轉（度）', 'number', -180, 180, 1],
  ['cropLeft', '左側裁切（%）', 'number', 0, 45, 1], ['cropRight', '右側裁切（%）', 'number', 0, 45, 1],
  ['cropTop', '上側裁切（%）', 'number', 0, 45, 1], ['cropBottom', '下側裁切（%）', 'number', 0, 45, 1],
];
export const SPECS = {
  play: [ ['pairs', '配對數量', 'number', 2, 12, 1], ['timed', '限時挑戰', 'boolean'], ['limitSeconds', '限時時長（秒）', 'number', 5, 3600, 1], ['previewSeconds', '開局記憶預覽（秒）', 'number', 0, 15, 0.5], ['mismatchMs', '失敗停留時間（毫秒）', 'number', 250, 3000, 50], ['sound', '音效', 'boolean'] ],
  cards: [ ['ratioW', '卡牌比例寬', 'number', 1, 10, 0.5], ['ratioH', '卡牌比例高', 'number', 1, 10, 0.5], ['columns', '每列張數（0 為自動）', 'number', 0, 8, 1], ['gap', '卡牌間距', 'number', 4, 32, 1], ['radius', '卡牌圓角', 'number', 0, 40, 1], ['boardScale', '卡牌區大小（%）', 'number', 40, 100, 1], ['showLabels', '顯示圖案名稱', 'boolean'], ['cardColor', '卡牌正面底色', 'color'], ['backColor', '卡牌背面底色', 'color'], ['matchColor', '配對成功提示色', 'color'], ['back.asset', '內建卡背', 'select', ASSETS.back.map(a => [a.id, a.name])] ],
  screen: [ ['headerText', '頁首文字', 'text', 180], ['title.text', '標題', 'text', 120], ['title.subtitle', '副標題', 'text', 180], ['title.size', '標題大小', 'number', 14, 64, 1], ['title.x', '標題水平位置（%）', 'number', -20, 20, 1], ['title.y', '標題垂直位置（%）', 'number', -20, 20, 1], ['title.opacity', '標題透明度（%）', 'number', 0, 100, 1], ['title.color', '標題顏色', 'color'], ['title.align', '標題對齊', 'select', [['left', '靠左'], ['center', '置中'], ['right', '靠右']]], ['backgroundColor', '背景底色', 'color'], ['background.asset', '內建背景', 'select', ASSETS.background.map(a => [a.id, a.name])], ['logo.asset', '內建 LOGO', 'select', ASSETS.logo.map(a => [a.id, a.name])], ['logo.canvasW', 'LOGO 畫布寬', 'number', 20, 400, 1], ['logo.canvasH', 'LOGO 畫布高', 'number', 20, 180, 1], ['logo.boxX', 'LOGO 畫布水平位置（%）', 'number', -50, 50, 1], ['logo.boxY', 'LOGO 畫布垂直位置（%）', 'number', -50, 50, 1] ],
  records: [ ['records.enabled', '保存成績紀錄', 'boolean'], ['records.leaderboard', '啟用排行榜', 'boolean'], ['event', '活動名稱', 'text', 80] ],
};
export const get = (obj, path) => path.split('.').reduce((o, key) => o?.[key], obj);
export function set(obj, path, value) { const parts = path.split('.'); const key = parts.pop(); let target = obj; for (const p of parts) target = target[p]; target[key] = value; }
function sanitizeLayer(incoming, base) {
  const out = copy(base);
  for (const [key, , type, lo, hi] of TRANSFORM_SPECS) {
    const v = incoming?.[key];
    if (type === 'select') { if (lo.some(([id]) => v === id)) out[key] = v; }
    else if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.max(lo, Math.min(hi, v));
  }
  return out;
}
export function sanitize(incoming) {
  const out = defaults();
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return out;
  for (const list of Object.values(SPECS)) for (const [path, , type, lo, hi] of list) {
    const value = get(incoming, path);
    if (type === 'boolean' && typeof value === 'boolean') set(out, path, value);
    if (type === 'text' && typeof value === 'string') set(out, path, value.slice(0, lo));
    if (type === 'color' && /^#[0-9a-f]{6}$/i.test(value || '')) set(out, path, value);
    if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) set(out, path, Math.max(lo, Math.min(hi, value)));
    if (type === 'select' && lo.some(([id]) => value === id)) set(out, path, value);
  }
  for (const key of ['pairs', 'columns', 'limitSeconds', 'mismatchMs']) out[key] = Math.round(out[key]);
  for (const key of ['back', 'background', 'logo']) out[key] = { ...out[key], ...sanitizeLayer(incoming[key], out[key]) };
  out.products = out.products.map(p => {
    const saved = Array.isArray(incoming.products) ? incoming.products.find(x => x && x.id === p.id) : null;
    return { id: p.id, enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : true, image: sanitizeLayer(saved?.image, p.image) };
  });
  if (out.products.filter(p => p.enabled).length < 2) out.products.slice(0, 2).forEach(p => p.enabled = true);
  out.pairs = Math.min(out.pairs, out.products.filter(p => p.enabled).length);
  if (Array.isArray(incoming.records?.fields)) out.records.fields = [...new Set(incoming.records.fields.filter(key => key in FIELDS))];
  return out;
}
export function elapsedText(ms) { return Number.isFinite(ms) ? `${Math.floor(ms / 1000)} 秒 ${Math.floor(ms % 1000)} 毫秒` : '未記錄'; }
export function ruleSnapshot(c) {
  return {
    version: 'web-rules-v1', pairs: c.pairs, timed: c.timed, limitSeconds: c.timed ? c.limitSeconds : null,
    previewSeconds: c.previewSeconds, mismatchMs: c.mismatchMs, ratioW: c.ratioW, ratioH: c.ratioH, columns: c.columns,
    showLabels: c.showLabels, cardColor: c.cardColor,
    products: c.products.filter(p => p.enabled).map(p => ({ id: p.id, version: PRODUCTS.find(a => a.id === p.id).version, image: copy(p.image) })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  };
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
// Complete canonical ID is collision-free for this rule format, and portable without async hashing.
export const ruleKey = config => canonical(ruleSnapshot(config));
export function groupLabel(rule) { return `${rule.pairs * 2} 張・${rule.timed ? `限時 ${rule.limitSeconds} 秒` : '不限時'}・預覽 ${rule.previewSeconds} 秒・${rule.products.length} 種圖案`; }
export function rankRows(rows, group) { return rows.filter(r => r.outcome === 'won' && (!group || r.groupId === group)).map((r, i) => ({ r, i })).sort((a, b) => a.r.elapsedMs - b.r.elapsedMs || a.r.flips - b.r.flips || a.r.completedAt - b.r.completedAt || a.i - b.i).map(x => x.r); }
export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export class Game {
  constructor(config, clock = () => performance.now(), random = Math.random) { this.clock = clock; this.random = random; this.reset(config); }
  reset(config) {
    this.config = sanitize(config); this.state = 'ready'; this.cards = []; this.matched = new Set(); this.open = []; this.flips = 0; this.elapsedMs = 0; this.beforePause = null; this.pauseAt = null; this.result = null;
    const pool = this.config.products.filter(p => p.enabled);
    this.selected = shuffle(pool, this.random).slice(0, this.config.pairs).map(p => p.id);
    this.cards = shuffle(this.selected.flatMap(id => [id, id]), this.random);
  }
  start() {
    if (this.state !== 'ready') return;
    const now = this.clock(); this.startedAt = now + this.config.previewSeconds * 1000; this.previewEnd = this.startedAt;
    this.state = this.config.previewSeconds > 0 ? 'preview' : 'playing';
  }
  tick() {
    const now = this.clock();
    if (this.state === 'preview' && now >= this.previewEnd) this.state = 'playing';
    if (this.state !== 'playing') return;
    this.elapsedMs = Math.max(0, Math.floor(now - this.startedAt));
    // Deadline wins ties; evaluate before resolving a pending mismatch or a card click.
    if (this.config.timed && this.elapsedMs >= this.config.limitSeconds * 1000) {
      this.elapsedMs = this.config.limitSeconds * 1000; this.finish('timeout'); return;
    }
    if (this.open.length === 2 && now >= this.mismatchEnd) this.open = [];
  }
  flip(index) {
    this.tick();
    if (this.state !== 'playing' || !Number.isInteger(index) || index < 0 || index >= this.cards.length || this.open.length >= 2 || this.matched.has(index) || this.open.includes(index)) return 'ignored';
    this.open.push(index); this.flips++;
    if (this.open.length === 1) return 'flip';
    if (this.cards[this.open[0]] === this.cards[index]) {
      this.open.forEach(i => this.matched.add(i)); this.open = [];
      if (this.matched.size === this.cards.length) { this.finish('won'); return 'won'; }
      return 'match';
    }
    this.mismatchEnd = this.clock() + this.config.mismatchMs;
    return 'miss';
  }
  pause() {
    this.tick();
    if (!['preview', 'playing'].includes(this.state)) return false;
    this.beforePause = this.state; this.pauseAt = this.clock(); this.state = 'paused'; return true;
  }
  resume() {
    if (this.state !== 'paused') return;
    const delta = this.clock() - this.pauseAt;
    this.startedAt += delta; this.previewEnd += delta;
    if (Number.isFinite(this.mismatchEnd)) this.mismatchEnd += delta;
    this.state = this.beforePause; this.beforePause = null;
  }
  finish(outcome) {
    if (this.result) return;
    this.state = outcome;
    this.result = { outcome, elapsedMs: this.elapsedMs, flips: this.flips, matchedPairs: this.matched.size / 2, cardCount: this.cards.length, accuracy: this.flips ? Math.round((this.matched.size / this.flips) * 10000) / 100 : 0 };
  }
  isRevealed(index) { return this.state !== 'paused' && (['preview', 'won', 'timeout'].includes(this.state) || this.open.includes(index) || this.matched.has(index)); }
}
export class History {
  constructor(value) { this.value = copy(value); this.past = []; this.future = []; this.pending = null; }
  begin() { if (!this.pending) this.pending = copy(this.value); }
  update(path, value) { this.begin(); set(this.value, path, value); }
  commit() { if (this.pending && canonical(this.pending) !== canonical(this.value)) { this.past.push(this.pending); this.past = this.past.slice(-100); this.future = []; } this.pending = null; }
  replace(value) { this.begin(); this.value = copy(value); this.commit(); }
  undo() { this.commit(); if (!this.past.length) return false; this.future.push(copy(this.value)); this.value = this.past.pop(); return true; }
  redo() { this.commit(); if (!this.future.length) return false; this.past.push(copy(this.value)); this.value = this.future.pop(); return true; }
}
export class LocalStore {
  constructor(storage, warning = () => {}) { this.storage = storage; this.warning = warning; this.recordsUnsafe = false; }
  read(key, fallback) {
    try { const raw = this.storage.getItem(key); return raw === null ? copy(fallback) : JSON.parse(raw); }
    catch { if (key === 'slow-play-records') this.recordsUnsafe = true; this.warning('無法讀取本機資料，可能已損壞或被瀏覽器阻擋。遊戲仍可使用；原始資料不會自動覆寫。'); return copy(fallback); }
  }
  write(key, value) {
    try { this.storage.setItem(key, JSON.stringify(value)); return true; }
    catch { this.warning('無法保存到此瀏覽器，可能是儲存空間不足或權限限制。這次操作仍會生效，但重新整理後可能遺失。'); return false; }
  }
  settings() {
    const raw = this.read('slow-play-settings', { version: VERSION, config: defaults() });
    if (raw?.version > VERSION) { this.warning('設定來自較新的網站版本，目前先使用預設；原始資料保留。'); this.settingsReadOnly = true; return defaults(); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (raw.config !== undefined && (!raw.config || typeof raw.config !== 'object' || Array.isArray(raw.config)))) {
      this.warning('設定資料格式無法讀取，已暫用預設設定。'); return defaults();
    }
    const config = sanitize(raw?.config || raw); // v0 direct config -> v1 wrapper; do not rewrite on read.
    // Replace only the former stock copy; preserve player-authored titles and other settings.
    const base = defaults();
    if (config.title.text === '把每一對，慢慢找回來。') config.title.text = base.title.text;
    if (config.title.subtitle === '記住小小的日常，翻開一點好心情。') config.title.subtitle = base.title.subtitle;
    return config;
  }
  saveSettings(config) { if (this.settingsReadOnly) { this.warning('較新版本的設定已保留，請使用對應網站版本後再保存。'); return false; } return this.write('slow-play-settings', { version: VERSION, config: sanitize(config) }); }
  records() {
    const data = this.read('slow-play-records', { version: VERSION, rows: [] });
    if (!data || data.version !== VERSION || !Array.isArray(data.rows) || data.rows.some(r => !r || typeof r.id !== 'string' || typeof r.groupId !== 'string' || !validRule(r.rule) || typeof r.values !== 'object' || !r.values || Array.isArray(r.values))) {
      this.recordsUnsafe = true; this.warning('成績資料格式無法讀取，已保留原資料。這次成績可先下載 CSV；需明確刪除損壞資料後才能重新保存。'); return [];
    }
    return data.rows.slice(-MAX_RECORDS).map(r => ({ id: r.id, groupId: r.groupId, rule: copy(r.rule), values: Object.fromEntries(Object.entries(r.values).filter(([k]) => k in FIELDS)) }));
  }
  saveRecords(rows) { if (this.recordsUnsafe) { this.warning('原成績資料無法安全讀取，因此未覆寫。本次新增成績保留在頁面內，請先匯出。'); return false; } return this.write('slow-play-records', { version: VERSION, rows: rows.slice(-MAX_RECORDS) }); }
  clearRecords() { const ok = this.write('slow-play-records', { version: VERSION, rows: [] }); if (ok) this.recordsUnsafe = false; return ok; }
}
function validRule(rule) {
  return rule && rule.version === 'web-rules-v1' && Number.isInteger(rule.pairs) && rule.pairs >= 2 && rule.pairs <= 12 && typeof rule.timed === 'boolean' && (!rule.timed || Number.isFinite(rule.limitSeconds)) && Number.isFinite(rule.previewSeconds) && Number.isFinite(rule.mismatchMs) && Array.isArray(rule.products) && rule.products.length >= rule.pairs && rule.products.every(p => p && typeof p.id === 'string' && Number.isFinite(p.version));
}
export function historicalRecord(result, config, id, completedAt, nickname) {
  const values = { ...result, nickname, completedAt, event: config.event };
  return { id, groupId: ruleKey(config), rule: ruleSnapshot(config), values: Object.fromEntries(config.records.fields.map(k => [k, values[k]])) };
}
function csvCell(value) {
  let s = value === undefined || value === null ? '未記錄' : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function toCSV(rows) {
  const keys = Object.keys(FIELDS).filter(k => rows.some(r => Object.hasOwn(r.values, k)));
  const header = ['成績識別碼', '完整組別識別碼', '是否限時', '限時時長（秒）', ...keys.map(k => FIELDS[k]), ...(keys.includes('elapsedMs') ? ['挑戰用時（毫秒）'] : [])];
  const content = rows.map(r => [r.id, r.groupId, r.rule.timed ? '是' : '否（不限時）', r.rule.timed ? (r.rule.limitSeconds ?? '未記錄') : '不限時', ...keys.map(k => {
    const v = r.values[k];
    if (v === undefined || v === null) return '未記錄';
    if (k === 'elapsedMs') return elapsedText(v);
    if (k === 'completedAt') return new Date(v).toLocaleString('zh-TW', { hour12: false });
    if (k === 'outcome') return v === 'won' ? '過關' : '時間到';
    if (k === 'accuracy') return `${v}%`;
    return v;
  }), ...(keys.includes('elapsedMs') ? [r.values.elapsedMs ?? '未記錄'] : [])]);
  return '\uFEFF' + [header, ...content].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
