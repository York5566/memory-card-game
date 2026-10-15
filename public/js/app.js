import { t, msg, html, localizeMarkup } from './i18n.js';
import { Game, LocalStore, ruleKey, ruleSnapshot, groupLabel, rankRows, historicalRecord, elapsedText, MAX_RECORDS } from './core.js';
import { createStage, escapeHTML as esc } from './stage.js';
import { toast, confirmAction, navigateLanguage } from './site.js';
import { createSounds } from './audio.js';
import { createGameMusic } from './pk-music.js';
import { loadImages } from './images.js';
import { initPK } from './pk.js';
const $ = selector => document.querySelector(selector);
function warning(message) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = message; }
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw Error(); }, setItem() { throw Error(); } }; }
const store = new LocalStore(storage, warning);
let config = store.settings();
if ((await loadImages(config)).length) warning(t('部分自訂圖片不在此瀏覽器，已暫用內建圖片。請重新上傳，或使用數字代碼載入。'));
let records = store.records();
let sessionRows = []; // Intentionally memory-only; never persisted or restored from history.
let game = new Game(config);
let stage, soloZoom = 1;
let handledResult = null;
let activeNickname = t('玩家');
let resultDate = 0;
let soundOn = config.sound;
const soloMusic = createGameMusic();
let pkActive = false;
let starting = false, startRequest = 0;
let pk;
document.addEventListener('languagechange-request', async event => {
  if (!pk?.active && !starting && !['playing', 'preview', 'paused'].includes(game.state) && !sessionRows.length) return;
  event.preventDefault();
  const resume = game.pause(); render();
  if (await confirmAction(t('切換語言？'), t('切換語言會重新載入此頁，結束目前遊戲並清空本次排行榜。已保存的設定、圖片與成績紀錄會保留。'), t('切換語言'))) navigateLanguage(event.detail.href, event.detail.language);
  else if (resume) { game.resume(); render(); }
});
const sounds = createSounds(document.body.dataset.base, { onError: () => toast(t('音效暫時無法播放，請檢查音量或再開啟音效。')) });
function playSound(name) { if (soundOn) { soloMusic.duck(); void sounds.play(name); } }
function setSoundEnabled(value) {
  soundOn = config.sound = Boolean(value);
  sounds.setEnabled(soundOn); soloMusic.setEnabled(soundOn); pk?.syncSound();
  $('#sound').setAttribute('aria-pressed', String(soundOn));
  $('#sound').textContent = t(soundOn ? '♫ 聲音：開' : '♪ 聲音：關');
}
function unlockSoloMusic() {
  if (soundOn) void soloMusic.unlock().then(ok => { if (!ok) toast(t('無法播放背景音樂，遊戲仍可繼續。')); });
}
function toggleSound() { setSoundEnabled(!soundOn); store.saveSettings(config); }
setSoundEnabled(soundOn);
function makeStage() {
  stage?.destroy(); stage = createStage($('#game-stage'), game.config, game.cards, index => {
    const action = game.flip(index);
    if (action !== 'ignored') playSound({ flip: 'flip', match: 'match', miss: 'miss', won: 'win' }[action]);
    render();
  }, false, {fit:true});
  stage.setZoom(soloZoom);
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
  soloMusic.setPhase(!pkActive && ['playing', 'preview', 'paused'].includes(game.state) ? 'playing' : 'off');
  $('#elapsed').innerHTML = clockText(game.elapsedMs);
  $('#flips').textContent = game.flips;
  $('#matched').innerHTML = `${game.matched.size / 2} <small>/ ${game.config.pairs}</small>`;
  $('#rules-label').textContent = msg`${game.config.pairs} 對 / ${game.cards.length} 張・${game.config.timed ? msg`限時 ${game.config.limitSeconds} 秒` : t('不限時')}`;
  $('#pause').disabled = !['playing', 'preview', 'paused'].includes(game.state);
  $('#restart').hidden = !['playing', 'preview', 'paused'].includes(game.state);
  $('#pause').textContent = game.state === 'paused' ? t('繼續') : t('暫停');
  $('#start').disabled = starting || !['ready', 'won', 'timeout'].includes(game.state);
  $('#start').textContent = starting ? t('準備遊戲…') : (['won', 'timeout'].includes(game.state) ? t('再玩一局') : t('開始遊戲'));
  $('#nickname').disabled = game.state !== 'ready' && !['won', 'timeout'].includes(game.state);
  const states = {
    ready: t('按「開始遊戲」，先記住牌面，再找出相同的兩張。'), preview: msg`記憶預覽，還有 ${Math.max(1, Math.ceil((game.previewEnd - performance.now()) / 1000))} 秒。預覽不計時。`,
    playing: game.open.length === 2 ? t('這兩張不一樣，再記住一次。') : (game.config.timed ? msg`剩餘 ${Math.max(0, Math.ceil((game.config.limitSeconds * 1000 - game.elapsedMs) / 1000))} 秒，找出下一對。` : t('一次翻開兩張，找到相同的圖案。')),
    paused: t('已暫停。準備好時按「繼續」。'), won: msg`全部配對完成！挑戰用時 ${elapsedText(game.elapsedMs)}，翻牌 ${game.flips} 次。`, timeout: msg`時間到！完成 ${game.matched.size / 2} / ${game.config.pairs} 對。再試一次吧。`,
  };
  const ended = ['won','timeout'].includes(game.state);
  $('#solo-result').hidden = !ended;
  if (ended) {
    $('#solo-result-title').textContent = t(game.state === 'won' ? '全部配對完成！' : '時間到！');
    $('#solo-result-note').textContent = states[game.state];
    $('#solo-result .pk-result').dataset.outcome = game.state === 'won' ? 'win' : 'loss';
  }
  const status = states[game.state]; if ($('#game-status').textContent !== status) $('#game-status').textContent = status;
}
function renderRanking() {
  const select = $('#rank-group'); const old = select.value; const currentId = ruleKey(config);
  const groups = new Map([[currentId, ruleSnapshot(config)]]); sessionRows.forEach(r => groups.set(r.groupId, r.rule));
  select.replaceChildren();
  let i = 0;
  groups.forEach((rule, key) => { const option = document.createElement('option'); option.value = key; option.textContent = `${groupLabel(rule)}${groups.size > 1 ? msg`・設定 ${++i}` : ''}`; select.append(option); });
  select.value = groups.has(old) ? old : currentId;
  updateRankList();
}
function updateRankList() {
  const host = $('#rank-list');
  if (!config.records.leaderboard) { host.innerHTML = localizeMarkup('<div class="empty-state"><span aria-hidden="true">◎</span><p>排行榜已關閉</p><small>在設定內開啟，保留接下來的本次過關成績。</small></div>'); return; }
  const rows = rankRows(sessionRows, $('#rank-group').value);
  if (!rows.length) { host.innerHTML = localizeMarkup('<div class="empty-state"><span aria-hidden="true">✧</span><p>第一個位置，等你來</p><small>完成一局，就留下這次的好成績。</small></div>'); return; }
  host.innerHTML = '<ol class="rank-items">' + rows.map((r, i) => html`<li><span class="rank-number">${i + 1}</span><div><strong>${esc(r.nickname)}</strong><span>${elapsedText(r.elapsedMs)}</span></div><small>${r.flips} 次翻牌</small></li>`).join('') + '</ol>';
}
function newRound(start = false) { startRequest++; starting = false; game = new Game(config); handledResult = null; makeStage(); if (start) { activeNickname = $('#nickname').value.trim() || t('玩家'); game.start(); } render(); }
$('#start').onclick = async () => {
  if (starting) return;
  if (game.state !== 'ready') newRound();
  const request = ++startRequest;
  const ready = sounds.prepare(); // Synchronous gesture unlock before rendering/await.
  unlockSoloMusic();
  starting = true; render();
  await ready;
  if (request !== startRequest) return;
  starting = false;
  if (!document.querySelector('dialog[open]')) {
    activeNickname = $('#nickname').value.trim() || t('玩家');
    game.start();
    if (document.hidden) game.pause();
  }
  render();
};
$('#solo-again').onclick = () => $('#start').click();
$('#pause').onclick = () => { void sounds.prepare(); unlockSoloMusic(); if (game.state === 'paused') game.resume(); else game.pause(); render(); };
$('#restart').onclick = async () => {
  if (['preview', 'playing', 'paused'].includes(game.state)) {
    const wasPaused = game.state === 'paused'; game.pause(); render();
    if (!await confirmAction(t('重新開始這一局？'), t('這局尚未完成的進度會清除，本次排行榜與已保存成績會保留。'), t('重新開始'))) { if (!wasPaused) game.resume(); render(); return; }
  }
  newRound(); $('#start').focus();
};
$('#sound').onclick = () => { toggleSound(); if (soundOn) { void sounds.prepare(); unlockSoloMusic(); } };
$('#rank-group').onchange = updateRankList;
const playPanel = $('.game-layout .play-panel');
function zoomSolo(value) {
  soloZoom = Math.max(.6, Math.min(2, Math.round(value * 10) / 10)); stage.setZoom(soloZoom);
  $('#solo-zoom-reset').textContent = Math.round(soloZoom * 100) + '%';
  $('#solo-zoom-out').disabled = soloZoom <= .6; $('#solo-zoom-in').disabled = soloZoom >= 2;
}
$('#solo-zoom-out').onclick = () => zoomSolo(soloZoom - .2);
$('#solo-zoom-in').onclick = () => zoomSolo(soloZoom + .2);
$('#solo-zoom-reset').onclick = () => zoomSolo(1);
document.addEventListener('visibilitychange', () => { if (document.hidden && game.pause()) render(); });
window.addEventListener('pagehide', () => { sessionRows = []; soloMusic.stop(); });
window.addEventListener('pageshow', event => { if (event.persisted) { sessionRows = []; renderRanking(); } });
$('#fullscreen').onclick = async () => {
  const panel = playPanel;
  if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
  if (panel.classList.contains('expanded-view')) { panel.classList.remove('expanded-view'); $('#fullscreen').setAttribute('aria-label', t('全螢幕')); return; }
  try { if (!panel.requestFullscreen) throw Error(); await panel.requestFullscreen(); }
  catch { panel.classList.add('expanded-view'); $('#fullscreen').setAttribute('aria-label', t('退出放大遊戲檢視')); toast(t('此瀏覽器不支援全螢幕，已切換放大遊戲檢視。再按一次或按 Esc 即可退出。')); }
};
document.addEventListener('fullscreenchange', () => {
  $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? t('退出全螢幕') : t('全螢幕'));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { playPanel.classList.remove('expanded-view'); $('#fullscreen').setAttribute('aria-label', t('全螢幕')); } });
// Secondary panels are loaded only when opened; primary game is immediately playable.
async function showSettings(onApply = () => {}) {
  game.pause(); render();
  const { openSettings } = await import('./settings.js');
  openSettings(config, next => { config = next; setSoundEnabled(config.sound); void sounds.prepare(); const saved = store.saveSettings(config); newRound(); renderRanking(); onApply(); return saved; });
}
$('#settings-open').onclick = () => showSettings();
$('#records-open').onclick = async () => {
  game.pause(); render();
  const { openRecords } = await import('./records.js');
  openRecords(records, () => { if (store.clearRecords()) { records = []; return true; } return false; });
};
makeStage(); renderRanking(); render();
pk = initPK({ openSettings: showSettings, getConfig: () => config, getName: () => $('#nickname').value, prepare: () => sounds.prepare(), playSound, toggleSound,
  setActive(active) {
    pkActive = active;
    document.body.classList.toggle('pk-active', active);
    if (active) { startRequest++; starting = false; game.pause(); }
    $('.game-layout').hidden = active;
    $('#settings-open').disabled = active; $('#records-open').disabled = active; $('#pk-open').disabled = active;
    render();
  },
});
setInterval(render, 40);
