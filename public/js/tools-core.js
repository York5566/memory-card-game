// Browser-local activity tools. No network or game state dependencies.
export const LIMIT = 500;
export const MAX_FILE_BYTES = 256000;
export class ToolError extends Error { constructor(code) { super(code); this.code = code; } }
export function randomInt(max) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new ToolError('invalid');
  const limit = Math.floor(0x100000000 / max) * max, bytes = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % max;
}
export function shuffle(items, rand = randomInt) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = rand(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function entries(text, { weighted = false, dedupe = true } = {}) {
  if (typeof text !== 'string' || text.length > 60000) throw new ToolError('limit');
  const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (rows.length > LIMIT) throw new ToolError('limit');
  const seen = new Set(); let duplicates = 0;
  const items = [];
  for (const [i, row] of rows.entries()) {
    const parts = weighted ? row.split('|') : [row];
    if (parts.length > 2) throw new ToolError('weightError');
    const name = parts[0].trim(), weight = parts.length === 2 ? Number(parts[1].trim()) : 1;
    if (!name || name.length > 80) throw new ToolError('nameError');
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) throw new ToolError('weightError');
    if (dedupe && seen.has(name)) { duplicates++; continue; }
    seen.add(name); items.push({ id: `entry-${i}`, name, weight });
  }
  return { items, duplicates };
}
export function draw(items, count, replacement = false, rand = randomInt) {
  if (!items.length) throw new ToolError('empty');
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new ToolError('countError');
  if (!replacement && count > items.length) throw new ToolError('notEnough');
  const pool = [...items], winners = [];
  for (let i = 0; i < count; i++) {
    let ticket = rand(pool.reduce((sum, item) => sum + item.weight, 0)), index = 0;
    while (ticket >= pool[index].weight) ticket -= pool[index++].weight;
    winners.push(pool[index]); if (!replacement) pool.splice(index, 1);
  }
  return winners;
}
export function teamCount(total, mode, value) {
  if (!Number.isInteger(value) || value < 1 || value > 50) throw new ToolError('groupValue');
  return mode === 'size' ? Math.ceil(total / value) : value;
}
export function group(items, { mode = 'count', value = 2, fixed = {} } = {}, rand = randomInt) {
  if (items.length < 2) throw new ToolError('twoPeople');
  const count = teamCount(items.length, mode, value);
  if (count < 1 || count > 50 || count > items.length) throw new ToolError('groupCount');
  const teams = Array.from({ length: count }, () => []), free = [];
  for (const item of items) {
    const target = fixed[item.id];
    if (target === undefined) free.push(item);
    else {
      if (!Number.isInteger(target) || target < 0 || target >= count) throw new ToolError('fixedInvalid');
      teams[target].push(item);
    }
  }
  if (mode === 'size' && teams.some(team => team.length > value)) throw new ToolError('fixedFull');
  for (const item of shuffle(free, rand)) {
    const smallest = Math.min(...teams.map(team => team.length));
    const eligible = teams.map((team, index) => team.length === smallest ? index : -1).filter(index => index >= 0);
    teams[eligible[rand(eligible.length)]].push(item);
  }
  return teams.map(team => shuffle(team, rand));
}
export function csv(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
// Explicit manual moves may change group balance; swaps keep both group sizes.
export function moveGroupMember(teams,fixed,from,to,id,swapId=null,{mode='count',value=50}={}){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||!teams[from]||!teams[to])throw new ToolError('fixedInvalid');
 const source=teams[from].find(p=>p.id===id),other=swapId===null?null:teams[to].find(p=>p.id===swapId);
 if(!source||(swapId!==null&&!other))throw new ToolError('fixedInvalid');
 if(!other&&mode==='size'&&teams[to].length>=value)throw new ToolError('fixedFull');
 const next=teams.map(row=>[...row]),pins={...fixed};
 if(other){const a=next[from].findIndex(p=>p.id===id),b=next[to].findIndex(p=>p.id===swapId);next[from][a]=other;next[to][b]=source;pins[other.id]=from;}
 else{next[from]=next[from].filter(p=>p.id!==id);next[to].push(source);}
 pins[id]=to;return {teams:next,fixed:pins};
}
// A name list or a standard CSV (first column = name, optional second = weight).
export function importList(text, weighted = false, format = 'auto') {
  if (typeof text !== 'string' || text.length > 100000) throw new ToolError('fileLimit');
  text = text.replace(/^\uFEFF/, '');
  if (format === 'text' || format === 'auto' && !text.includes(',')) return text.trim();
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) throw new ToolError('invalid');
  row.push(cell.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row);
  if (rows.length && /^(name|名字|名稱|姓名|名前|이름)$/i.test(rows[0][0].trim())) rows.shift();
  if (rows.some(row => /[\r\n]/.test(row[0]))) throw new ToolError('nameError');
  return rows.filter(row => row[0].trim()).map(row => row[0].trim() + (weighted && row[1]?.trim() ? ` | ${row[1].trim()}` : '')).join('\n');
}
export const defaults = kind => ({ kind, version: 1, title: '', names: '', theme: 'forest', textSize: 24, sound: false,
  weighted: false, dedupe: true, replacement: false, count: 1, duration: 4, mode: 'count', value: 2, teamNames: '', fixed: {} });
export function validateConfig(raw, kind) {
  if (!raw || typeof raw !== 'object' || raw.kind !== kind || raw.version !== 1) throw new ToolError('configError');
  const out = defaults(kind);
  for (const key of ['title', 'names', 'teamNames']) {
    if (typeof raw[key] !== 'string' || raw[key].length > (key === 'names' ? 60000 : key === 'teamNames' ? 4000 : 80)) throw new ToolError('configError');
    out[key] = raw[key];
  }
  for (const key of ['weighted','dedupe','replacement','sound']) { if (typeof raw[key] !== 'boolean') throw new ToolError('configError'); out[key] = raw[key]; }
  for (const [key, min, max] of [['textSize',16,48],['count',1,50],['duration',0,10],['value',1,50]]) {
    if (!Number.isInteger(raw[key]) || raw[key] < min || raw[key] > max) throw new ToolError('configError'); out[key] = raw[key];
  }
  if (!['forest','sunset','ocean'].includes(raw.theme) || !['count','size'].includes(raw.mode)) throw new ToolError('configError');
  out.theme = raw.theme; out.mode = raw.mode;
  const parsed = entries(out.names, { weighted: kind === 'picker' && out.weighted, dedupe: out.dedupe });
  if (kind === 'groups' && raw.fixed) {
    if (typeof raw.fixed !== 'object' || Array.isArray(raw.fixed) || Object.keys(raw.fixed).length > LIMIT) throw new ToolError('configError');
    const ids = new Set(parsed.items.map(item => item.id)), count = teamCount(parsed.items.length, out.mode, out.value);
    for (const [id, target] of Object.entries(raw.fixed)) {
      if (!ids.has(id) || !Number.isInteger(target) || target < 0 || target >= count) throw new ToolError('configError');
      out.fixed[id] = target;
    }
  }
  return out;
}
