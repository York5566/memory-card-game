import { Game, LocalStore, ruleKey, ruleSnapshot, groupLabel, rankRows, historicalRecord, elapsedText, MAX_RECORDS } from './core.js';
import { createStage, escapeHTML as esc } from './stage.js';
import { toast, confirmAction } from './site.js';
import { createSounds } from './audio.js';
import { loadImages } from './images.js';
const $ = selector => document.querySelector(selector);
function warning(message) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = message; }
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw Error(); }, setItem() { throw Error(); } }; }
const store = new LocalStore(storage, warning);
let config = store.settings();
if ((await loadImages(config)).length) warning('部分自訂圖片不在此瀏覽器，已暫用內建圖片。請重新上傳，或使用數字代碼載入。');
let records = store.records();
let sessionRows = []; // Intentionally memory-only; never persisted or restored from history.
let game = new Game(config);
let stage;
let handledResult = null;
let activeNickname = '玩家';
let resultDate = 0;
let soundOn = config.sound;
let starting = false, startRequest = 0;
const sounds = createSounds(document.body.dataset.base, { onError: () => toast('音效暫時無法播放，請檢查音量或再開啟音效。') });
sounds.setEnabled(soundOn);
function playSound(name) { if (soundOn) void sounds.play(name); }
function makeStage() {
  stage?.destroy(); stage = createStage($('#game-stage'), game.config, game.cards, index => {
    const action = game.flip(index);
    if (action !== 'ignored') playSound({ flip: 'flip', match: 'match', miss: 'miss', won: 'win' }[action]);
    render();
  });
  $('#game-stage .resume-overlay').onclick = () => { game.resume(); render(); };
}
function clockText(ms) { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}<span>.${String(ms % 1000).padStart(3, '0')}</span>`; }
function handleResult() {
  if (!game.result || handledResult === game.result) return;
  handledResult = game.result; resultDate = Date.now();
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${resultDate}-${Math.random().toString(36).slice(2)}`;
  if (game.config.records.leaderboard && game.result.outcome === 'won') sessionRows.push({ ...game.result, nickname: activeNickname, completedAt: resultDate, id, groupId: ruleKey(game.config), rule: ruleSnapshot(game.config) });
  if (game.config.records.enabled) { records.push(historicalRecord(game.result, game.config, id, resultDate, activeNickname)); records = records.slice(-MAX_RECORDS); store.saveRecords(records); }
  renderRanking();
}
function render() {
  game.tick(); handleResult(); stage.update(game);
  $('#elapsed').innerHTML = clockText(game.elapsedMs);
  $('#flips').textContent = game.flips;
  $('#matched').innerHTML = `${game.matched.size / 2} <small>/ ${game.config.pairs}</small>`;
  $('#rules-label').textContent = `${game.config.pairs} 對 / ${game.cards.length} 張・${game.config.timed ? `限時 ${game.config.limitSeconds} 秒` : '不限時'}`;
  $('#pause').disabled = !['playing', 'preview', 'paused'].includes(game.state);
  $('#restart').hidden = !['playing', 'preview', 'paused'].includes(game.state);
  $('#pause').textContent = game.state === 'paused' ? '繼續' : '暫停';
  $('#start').disabled = starting || !['ready', 'won', 'timeout'].includes(game.state);
  $('#start').textContent = starting ? '準備遊戲…' : (['won', 'timeout'].includes(game.state) ? '再玩一局' : '開始遊戲');
  $('#nickname').disabled = game.state !== 'ready' && !['won', 'timeout'].includes(game.state);
  $('#sound').textContent = soundOn ? '♫' : '♪'; $('#sound').setAttribute('aria-label', soundOn ? '關閉音效' : '開啟音效'); $('#sound').title = soundOn ? '關閉音效' : '開啟音效'; $('#sound').classList.toggle('off', !soundOn);
  const states = {
    ready: '準備好了嗎？開始後先看看所有圖案。', preview: `記憶預覽，還有 ${Math.max(1, Math.ceil((game.previewEnd - performance.now()) / 1000))} 秒。預覽不計時。`,
    playing: game.open.length === 2 ? '這兩張不一樣，再記住一次。' : (game.config.timed ? `剩餘 ${Math.max(0, Math.ceil((game.config.limitSeconds * 1000 - game.elapsedMs) / 1000))} 秒，找出下一對。` : '一次翻開兩張，找到相同的圖案。'),
    paused: '已暫停。準備好時按「繼續」。', won: `全部配對完成！挑戰用時 ${elapsedText(game.elapsedMs)}，翻牌 ${game.flips} 次。`, timeout: `時間到！完成 ${game.matched.size / 2} / ${game.config.pairs} 對。再試一次吧。`,
  };
  const status = states[game.state]; if ($('#game-status').textContent !== status) $('#game-status').textContent = status;
}
function renderRanking() {
  const select = $('#rank-group'); const old = select.value; const currentId = ruleKey(config);
  const groups = new Map([[currentId, ruleSnapshot(config)]]); sessionRows.forEach(r => groups.set(r.groupId, r.rule));
  select.replaceChildren();
  let i = 0;
  groups.forEach((rule, key) => { const option = document.createElement('option'); option.value = key; option.textContent = `${groupLabel(rule)}${groups.size > 1 ? `・設定 ${++i}` : ''}`; select.append(option); });
  select.value = groups.has(old) ? old : currentId;
  updateRankList();
}
function updateRankList() {
  const host = $('#rank-list');
  if (!config.records.leaderboard) { host.innerHTML = '<div class="empty-state"><span aria-hidden="true">◎</span><p>排行榜已關閉</p><small>在設定內開啟，保留接下來的本次過關成績。</small></div>'; return; }
  const rows = rankRows(sessionRows, $('#rank-group').value);
  if (!rows.length) { host.innerHTML = '<div class="empty-state"><span aria-hidden="true">✧</span><p>第一個位置，等你來</p><small>完成一局，就留下這次的好成績。</small></div>'; return; }
  host.innerHTML = '<ol class="rank-items">' + rows.map((r, i) => `<li><span class="rank-number">${i + 1}</span><div><strong>${esc(r.nickname)}</strong><span>${elapsedText(r.elapsedMs)}</span></div><small>${r.flips} 次翻牌</small></li>`).join('') + '</ol>';
}
function newRound(start = false) { startRequest++; starting = false; game = new Game(config); handledResult = null; makeStage(); if (start) { activeNickname = $('#nickname').value.trim() || '玩家'; game.start(); } render(); }
$('#start').onclick = async () => {
  if (starting) return;
  if (game.state !== 'ready') newRound();
  const request = ++startRequest;
  const ready = sounds.prepare(); // Synchronous gesture unlock before rendering/await.
  starting = true; render();
  await ready;
  if (request !== startRequest) return;
  starting = false;
  if (!document.querySelector('dialog[open]')) {
    activeNickname = $('#nickname').value.trim() || '玩家';
    game.start();
    if (document.hidden) game.pause();
  }
  render();
};
$('#pause').onclick = () => { void sounds.prepare(); if (game.state === 'paused') game.resume(); else game.pause(); render(); };
$('#restart').onclick = async () => {
  if (['preview', 'playing', 'paused'].includes(game.state)) {
    const wasPaused = game.state === 'paused'; game.pause(); render();
    if (!await confirmAction('重新開始這一局？', '這局尚未完成的進度會清除，本次排行榜與已保存成績會保留。', '重新開始')) { if (!wasPaused) game.resume(); render(); return; }
  }
  newRound(); $('#start').focus();
};
$('#sound').onclick = () => { soundOn = !soundOn; sounds.setEnabled(soundOn); if (soundOn) void sounds.prepare(); render(); };
$('#rank-group').onchange = updateRankList;
document.addEventListener('visibilitychange', () => { if (document.hidden && game.pause()) render(); });
window.addEventListener('pagehide', () => { sessionRows = []; });
window.addEventListener('pageshow', event => { if (event.persisted) { sessionRows = []; renderRanking(); } });
$('#fullscreen').onclick = async () => {
  const panel = $('.play-panel');
  if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
  if (panel.classList.contains('expanded-view')) { panel.classList.remove('expanded-view'); $('#fullscreen').setAttribute('aria-label', '全螢幕'); return; }
  try { if (!panel.requestFullscreen) throw Error(); await panel.requestFullscreen(); }
  catch { panel.classList.add('expanded-view'); $('#fullscreen').setAttribute('aria-label', '退出放大遊戲檢視'); toast('此瀏覽器不支援全螢幕，已切換放大遊戲檢視。再按一次或按 Esc 即可退出。'); }
};
document.addEventListener('fullscreenchange', () => $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全螢幕' : '全螢幕'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { $('.play-panel').classList.remove('expanded-view'); $('#fullscreen').setAttribute('aria-label', '全螢幕'); } });
// Secondary panels are loaded only when opened; primary game is immediately playable.
$('#settings-open').onclick = async () => {
  game.pause(); render();
  const { openSettings } = await import('./settings.js');
  openSettings(config, next => { config = next; soundOn = config.sound; sounds.setEnabled(soundOn); void sounds.prepare(); const saved = store.saveSettings(config); newRound(); renderRanking(); return saved; });
};
$('#records-open').onclick = async () => {
  game.pause(); render();
  const { openRecords } = await import('./records.js');
  openRecords(records, () => { if (store.clearRecords()) { records = []; return true; } return false; });
};
makeStage(); renderRanking(); render();
setInterval(render, 40);
