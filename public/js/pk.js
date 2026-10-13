import { locale, t, msg, localizeMarkup } from './i18n.js';
import site from './site-config.js';
import { sanitize } from './core.js';
import { createStage } from './stage.js';
import { createFullscreenHint } from './fullscreen.js';
import { toast, confirmAction } from './site.js';
import { challenge, shareCloud } from './cloud.js';
import { imageIds, encodeProfile, decodeProfile, readLimited, LIMITS, sha256 } from './profile-format.js';
import { getImage, putImages, loadImages } from './images.js';
import { createPKMusic } from './pk-music.js';
import { PK, requestRematch, makeRoom, readyRoom, flipRoom, advanceRoom, roomView, MemoryOpponent } from './pk-rules.js';

const KEY = 'memory-pk-session';
const errorText = code => t(({ auth: '連線已到期，請重新進入 PK。', missing: '房間已結束、已滿或邀請者已離線，請重新索取邀請。',
  renew: '這個房間的連線即將到期，請離開後重新建立房間或配對。', images: '房間圖片已到期或無法讀取，請房主重新建立房間。', rate: 'PK 操作太頻繁，請稍後再試。',
  capacity: '目前 PK 名額或今日用量已滿，請稍後再試。', busy: '你已在房間或配對中，請先退出。',
  invalid: '這個操作無法完成，請重試。', unavailable: 'PK 服務暫時無法連線，請稍後再試。單人遊戲仍可使用。' })[code] || 'PK 服務暫時無法連線，請稍後再試。單人遊戲仍可使用。');
const readSession = () => { try { const s = JSON.parse(sessionStorage.getItem(KEY)); return s?.expires > Date.now() ? s : null; } catch { return null; } };
function persist(s) { try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch { /* live session still works without storage */ } }
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join('');
const internationalNames = ['MintFox','Mochi','StarBerry','LunaLeaf','PeachSky','MapleCat','CloudOtter','Cocoa','SunnyKoala','BlueFinch','Amber','Nori','Yuzu','Olive','PandaPop','Nova','KiwiBird','Sora','Mango','Ripple','LemonTea','Poppy','SnowBean','Clover'];

export function initPK({ getConfig, getName, setActive, prepare, playSound, openSettings }) {
  const panel = document.querySelector('#pk-panel');
  panel.innerHTML = localizeMarkup(`<div class="pk-top"><div><p class="eyebrow">一起挑戰記憶力</p><h2>雙人 PK</h2></div><div class="pk-top-actions"><button class="button" id="pk-music" aria-pressed="true">♫ 背景音樂：開</button><button class="icon-button" id="pk-fullscreen" aria-label="全螢幕">⛶</button><button class="button quiet" id="pk-exit">返回單人遊戲</button></div></div>
    <div id="pk-setup"><p>沿用目前設定，邀請朋友或尋找對手。每次輪流翻兩張，配對成功可繼續，配對最多者獲勝。</p><label for="pk-name">對戰暱稱</label><input id="pk-name" maxlength="24" autocomplete="nickname" placeholder="輸入對戰時顯示的名字"><p class="hint">暱稱、此局設定及圖片會分享給對手。自訂圖片會先保存到雲端。</p><p id="pk-config" class="pk-rule-summary"></p>
    <div class="pk-actions"><button class="button primary" id="pk-settings">⚙ 調整設定</button><button class="button primary" id="pk-create">建立邀請房間</button><button class="button primary" id="pk-match">開始配對</button><button class="button primary" id="pk-join" hidden>加入邀請房間</button></div></div>
    <div id="pk-challenge"></div><p id="pk-status" class="pk-status" role="status" aria-live="polite"></p><p id="pk-error" class="notice warning" role="alert" hidden></p>
    <div id="pk-invite" hidden><label for="pk-link">邀請連結</label><div class="pk-link-row"><input id="pk-link" readonly><button class="button" id="pk-copy">複製連結</button></div><p class="hint">請保持這個頁面開啟。房間等待時間為 3 分鐘，兩人都準備後開始。</p></div>
    <div id="pk-result" class="pk-result" hidden><span class="pk-result-symbol" aria-hidden="true"></span><div><strong id="pk-result-title"></strong><p id="pk-result-note"></p></div><div class="pk-result-particles" aria-hidden="true"></div></div><p id="pk-rematch-note" class="hint" role="status" hidden></p><div id="pk-match-area" hidden><div class="pk-scoreboard"><div id="pk-player-0"><span></span><strong>0</strong></div><b aria-hidden="true">VS</b><div id="pk-player-1"><span></span><strong>0</strong></div></div><p id="pk-rules" class="pk-rule-summary"></p><div class="pk-actions"><button id="pk-ready" class="button primary">我準備好了</button><button id="pk-again" class="button primary" hidden>再來一場</button><button id="pk-leave" class="button">離開房間</button></div><div id="pk-stage" class="stage"></div></div>
    <button class="button" id="pk-cancel" hidden>取消配對</button><p class="hint pk-footnote">每回合最多 20 秒；連續兩回合未操作視為離開。每局最多 10 分鐘。對戰不加入單人排行榜。</p><p class="hint">準備畫面可調整設定；房間建立或進入配對後，本局設定即鎖定。配對採先進入者的設定，雙方確認並準備後才開始。結束後 60 秒內，雙方按「再來一場」即可用同樣設定重新洗牌對戰。</p>`);
  const music = createPKMusic();
  let musicOn = getConfig().sound, musicPreference = false;
  try { const saved = localStorage.getItem('memory-pk-music'); if (saved !== null) { musicOn = saved === 'true'; musicPreference = true; } } catch {}
  const sound = name => { if (name === 'win') return; music.duck(); playSound(name); };
  const $ = id => panel.querySelector('#pk-' + id);
  const zoomNotice = document.createElement('div'); zoomNotice.id = 'pk-zoom-hint'; zoomNotice.hidden = true;
  zoomNotice.setAttribute('role', 'status'); panel.append(zoomNotice);
  const fullscreenHint = createFullscreenHint(zoomNotice, () => document.fullscreenElement === panel,
    () => { zoomNotice.innerHTML = localizeMarkup('<kbd>CTRL</kbd><span>+滾輪可以調整畫面大小</span>'); });
  document.addEventListener('fullscreenchange', () => {
    const full = document.fullscreenElement === panel;
    $('fullscreen').setAttribute('aria-label', t(full ? '退出全螢幕' : '全螢幕'));
    if (full) fullscreenHint.schedule(); else fullscreenHint.cancel();
  });
  let active = false, pending = false, session = null, ws = null, connected = false, intentional = false, retries = 0, heartbeat, heartbeatAt = 0;
  let timer, reconnectTimer, generation = 0, sourceConfig, inviteId = '', roomId = '', view = null, stage = null, stageId = '', assetsReady = false, loadingAssets = '', skew = 0;
  let resultKey = '', rematchPending = false, botRematchDue = 0, queueSince = 0;
  let mode = 'setup', queueUntil = 0, localRoom = null, opponent = null, botDue = 0, botSeen = -1, localReceipt = null, flipPending = false;
  const localAPI = site.pk?.local && ['127.0.0.1','localhost'].includes(location.hostname) && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(site.pk.apiURL || '');
  const api = site.pk?.apiURL || site.cloud?.apiURL;
  const showError = message => { $('error').hidden = false; $('error').textContent = message; };
  const status = value => { if ($('status').textContent !== value) $('status').textContent = value; };
  function busy(value) { pending = value; for (const id of ['create','match','join','settings']) $(id).disabled = value; $('name').disabled = value; }
  function stopSocket() { intentional = true; clearInterval(heartbeat); clearTimeout(reconnectTimer); ws?.close(1000, 'leave'); ws = null; connected = false; }
  function resetUI() {
    view = null; roomId = ''; assetsReady = false; loadingAssets = ''; localRoom = null; opponent = null; stage?.destroy(); stage = null; stageId = ''; flipPending = false;
    music.stop(); resultKey = ''; rematchPending = false; botRematchDue = 0; $('result').hidden = true; $('rematch-note').hidden = true;
    refreshConfig();
    mode = 'setup'; $('setup').hidden = false; $('match-area').hidden = true; $('invite').hidden = true; $('cancel').hidden = true; $('error').hidden = true; busy(false);
    $('settings').hidden = Boolean(inviteId);
    $('create').hidden = $('match').hidden = Boolean(inviteId); $('join').hidden = !inviteId;
    status(inviteId ? t('收到 PK 邀請，輸入暱稱後加入。') : t('可在此調整設定，再選擇邀請朋友或線上配對。'));
  }
  function refreshConfig() { sourceConfig = sanitize(getConfig()); $('config').textContent = msg`目前設定：${sourceConfig.pairs} 對卡牌，預覽 ${sourceConfig.previewSeconds} 秒。`; }
  function readInvitation() { const value = new URLSearchParams(location.hash.slice(1)).get('pk'); return /^[a-f0-9]{48}$/.test(value || '') ? value : ''; }
  function open() {
    if (active) return;
    active = true; setActive(true); panel.hidden = false; sourceConfig = sanitize(getConfig()); inviteId = readInvitation();
    $('name').value = getName() || ''; $('config').textContent = msg`目前設定：${sourceConfig.pairs} 對卡牌，預覽 ${sourceConfig.previewSeconds} 秒。`;
    resetUI(); panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); $('name').focus(); timer = setInterval(tick, 200);
  }
  async function request(path, options = {}, requireSession = true) {
    const response = await fetch(api + path, { ...options, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000), headers: { ...(requireSession ? { Authorization: 'Bearer ' + session.token } : {}), ...options.headers } });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw Error(errorText(data.error)); }
    return response;
  }
  function connect() {
    intentional = false;
    return new Promise((resolve, reject) => {
      const current = new WebSocket(api.replace(/^http/, 'ws') + '/api/pk/socket', ['memory-pk', 'session.' + session.token]); ws = current;
      let opened = false;
      const timeout = setTimeout(() => { current.close(); reject(Error(errorText('unavailable'))); }, 12000);
      current.onopen = () => {
        if (ws !== current) { current.close(); return; }
        clearTimeout(timeout); opened = true; connected = true; retries = 0; heartbeatAt = Date.now();
        clearInterval(heartbeat); heartbeat = setInterval(() => { if (Date.now() - heartbeatAt > 40000) current.close(); else if (current.readyState === 1) current.send('ping'); }, 15000);
        resolve();
      };
      current.onmessage = event => {
        if (ws !== current) return;
        heartbeatAt = Date.now(); if (event.data === 'pong') return;
        let data; try { data = JSON.parse(event.data); } catch { return; }
        void receive(data);
      };
      current.onerror = () => { if (!opened) { clearTimeout(timeout); reject(Error(errorText('unavailable'))); } };
      current.onclose = event => {
        clearTimeout(timeout); if (ws !== current) return;
        connected = false; clearInterval(heartbeat); flipPending = false;
        if (!opened) reject(Error(errorText('unavailable')));
        if (intentional || !active || mode === 'setup' || localRoom) return;
        if (event.code === 4001 || event.code === 1008 || retries >= 3) { showError(errorText(event.code === 1008 ? 'rate' : 'auth')); return; }
        status(t('連線中斷，正在重新連線…'));
        reconnectTimer = setTimeout(() => { retries++; void connect().catch(() => {}); }, 800 * 2 ** retries);
      };
    });
  }
  function send(data) { if (!connected || ws?.readyState !== 1) return false; ws.send(JSON.stringify(data)); return true; }
  async function prepareSource() {
    if (!imageIds(sourceConfig).length) return { config: sourceConfig };
    status(t('正在保存此局圖片與設定…'));
    if (!localAPI) return { code: (await shareCloud(sourceConfig, $('challenge'))).code };
    const pack = await encodeProfile(sourceConfig, getImage), digest = await sha256(pack);
    if (localReceipt?.digest === digest) return { code: localReceipt.code };
    const response = await request('/api/settings', { method: 'POST', body: pack, headers: { 'Content-Type': 'application/octet-stream', 'X-Turnstile-Token': 'save', 'X-Request-Id': crypto.randomUUID(), 'X-Owner-Token': randomToken() } }, false);
    localReceipt = { ...await response.json(), digest }; return { code: localReceipt.code };
  }
  async function begin(type) {
    if (pending) return; busy(true); $('error').hidden = true;
    if (ws) { send({ type: 'leave' }); stopSocket(); persist(null); }
    const attempt = ++generation;
    try {
      if (!site.pk?.available) throw Error(t('本機 PK 預覽需啟動對戰服務，請使用「開始 PK 預覽」。'));
      void music.unlock(); void prepare(); sourceConfig = sanitize(getConfig());
      status(t('正在準備 PK 連線…'));
      const source = type === 'join' ? undefined : await prepareSource();
      if (attempt !== generation) return;
      const token = localAPI ? 'pk' : await challenge($('challenge'), 'pk');
      if (attempt !== generation) return;
      session = await (await request('/api/pk/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Turnstile-Token': token }, body: JSON.stringify({ name: $('name').value.trim() || t('玩家') }) }, false)).json();
      if (attempt !== generation) return;
      persist(session);
      await connect(); if (attempt !== generation) { stopSocket(); return; }
      mode = type === 'queue' ? 'queue' : 'connecting'; music.setPhase('waiting'); $('setup').hidden = true; $('cancel').hidden = false;
      if (!send({ type, source, id: inviteId })) throw Error(errorText('unavailable'));
    } catch (error) { if (attempt !== generation) return; mode = 'setup'; $('setup').hidden = false; stopSocket(); persist(null); music.stop(); showError(error.message || errorText('unavailable')); busy(false); }
  }
  async function receive(data) {
    if (!active) return;
    if (data.type === 'error') { flipPending = false; rematchPending = false; if (view) renderRoom(); showError(errorText(data.error)); busy(false); if (!view) { send({ type: 'leave' }); stopSocket(); persist(null); $('setup').hidden = false; $('cancel').hidden = true; mode = 'setup'; music.stop(); } return; }
    if (data.type === 'queue') { mode = 'queue'; queueUntil = data.until; queueSince = data.since || data.now; music.setPhase('waiting'); skew = data.now - Date.now(); $('setup').hidden = true; $('cancel').hidden = false; tick(); return; }
    if (data.type === 'fallback') { send({ type: 'fallback-ack' }); mode = 'handoff'; return; }
    if (data.type === 'released') {
      if (mode !== 'handoff') return;
      stopSocket(); persist(null); mode = 'room'; roomId = 'local-' + crypto.randomUUID();
      const pool = locale === 'zh-Hant' ? ['抹茶拿鐵','海邊散步','橘子汽水','小栗子','貓在午睡','晚風','路過的阿柴','糯米糰','晴天','阿樂','山裡有霧','小島日記','木木','烤布蕾','星星糖','半糖去冰'] : locale === 'ja' ? ['こむぎ','ゆず茶','そら','しろくま','ねこ日和','はる','もちもち','あおい','月うさぎ','なつ'] : locale === 'ko' ? ['구름산책','라떼','달빛','보리','하루','귤나무','별사탕','소금빵','여름','모찌'] : internationalNames;
      const candidates = pool.filter(name => name !== $('name').value.trim());
      const name = candidates[Math.floor(Math.random() * candidates.length)];
      localRoom = makeRoom(sourceConfig, { name: $('name').value.trim() || t('玩家') }, Date.now());
      localRoom.players[1] = { name }; localRoom.connected = [true,true]; readyRoom(localRoom, 1, Date.now());
      opponent = new MemoryOpponent(); skew = 0; assetsReady = true; botSeen = -1; botDue = 0;
      acceptView(roomView(localRoom, 0, Date.now())); return;
    }
    if (data.type === 'idle') {
      // The initial idle handshake must not erase a just-sent create/join action.
      if (view?.state === 'ended') { stopSocket(); persist(null); resetUI(); }
      return;
    }
    if (data.type !== 'room') return;
    flipPending = false; skew = data.view.now - Date.now();
    if (roomId && roomId !== data.id) { stage?.destroy(); stage = null; assetsReady = false; }
    roomId = data.id; mode = 'room'; $('name').value = data.view.players[data.view.seat]?.name || $('name').value; acceptView(data.view);
    if (data.sound && data.sound !== 'ignored') sound(data.sound);
    if (!data.assets) { assetsReady = true; renderRoom(); }
    else if (!assetsReady && loadingAssets !== roomId) {
      const id = roomId, attempt = generation; loadingAssets = id;
      try {
        if ((await loadImages(data.view.config)).length) {
          const response = await request('/api/pk/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: id }) });
          const pack = await decodeProfile(await readLimited(response.body, LIMITS.packageBytes)); await putImages(pack.images);
        }
        if (attempt !== generation || roomId !== id) return;
        assetsReady = true; stage?.destroy(); stage = null; renderRoom();
      } catch (error) { if (attempt === generation) showError(error.message || errorText('images')); }
    }
  }
  function acceptView(next) {
    if (view?.round !== next.round) { botDue = 0; botRematchDue = 0; botSeen = -1; if (localRoom) opponent = new MemoryOpponent(); }
    rematchPending = false; view = next;
    if (localRoom && botSeen !== next.rev) { opponent.observe(next); botSeen = next.rev; }
    renderRoom();
  }
  function renderRoom() {
    if (!view) return;
    $('setup').hidden = true; $('cancel').hidden = true; $('match-area').hidden = false;
    $('invite').hidden = view.state !== 'lobby' || Boolean(view.players[1]) || Boolean(localRoom);
    if (!$('invite').hidden) { const link = new URL(location.href); link.search = ''; link.hash = 'pk=' + roomId; $('link').value = link.href; }
    music.setPhase(view.state === 'ended' ? 'off' : view.state === 'lobby' ? 'waiting' : 'playing');
    const key = roomId + ':' + view.round;
    if (!stage || stageId !== key) { stage?.destroy(); stage = createStage($('stage'), view.config, [...view.cards], flip); stageId = key; }
    stage.setCards(view.cards);
    stage.update({ state: view.state === 'preview' ? 'preview' : assetsReady && view.state === 'playing' && (localRoom || connected) && view.turn === view.seat && view.connected.every(Boolean) && !flipPending ? 'playing' : 'ready',
      matched: new Set(view.matched), open: view.open, isRevealed: i => Boolean(view.cards[i]) });
    for (let i = 0; i < 2; i++) {
      const el = $('player-' + i); el.querySelector('span').textContent = view.players[i] ? view.players[i].name + (i === view.seat ? t('（你）') : '') : t('等待對手');
      el.querySelector('strong').textContent = view.scores[i]; el.classList.toggle('is-turn', view.state === 'playing' && view.turn === i);
    }
    $('rules').textContent = msg`${view.config.pairs} 對卡牌・預覽 ${view.config.previewSeconds} 秒・${view.config.timed ? msg`限時 ${view.config.limitSeconds} 秒` : t('每局最多 10 分鐘')}・配對成功繼續翻牌`;
    $('ready').hidden = view.state !== 'lobby'; $('ready').disabled = !assetsReady || (!localRoom && !connected) || !view.players[1] || view.ready[view.seat] || !view.connected.every(Boolean);
    $('ready').textContent = view.ready[view.seat] ? t('已準備，等待對手') : t('我準備好了');
    $('again').hidden = view.state !== 'ended';
    $('again').disabled = rematchPending || !view.canRematch || view.rematch?.[view.seat] || (!localRoom && !connected);
    $('again').textContent = view.rematch?.[view.seat] ? t('已邀請再戰') : t('再來一場');
    renderResult();
    tickStatus();
  }
  function flip(index) {
    void prepare(); if (!view || view.state !== 'playing' || view.turn !== view.seat || flipPending) return;
    if (localRoom) { const effect = flipRoom(localRoom, 0, index, Date.now(), localRoom.rev); if (effect !== 'ignored') sound(effect); acceptView(roomView(localRoom, 0, Date.now())); }
    else if (send({ type: 'flip', index, rev: view.rev })) { flipPending = true; renderRoom(); }
  }
  function tickStatus() {
    const now = Date.now() + skew;
    if (mode === 'queue') { status(msg`正在尋找對手…已等待 ${Math.max(0, Math.floor((now - queueSince) / 1000))} 秒`); return; }
    if (!view) return;
    if (!localRoom && !connected) { status(t('連線中斷，正在重新連線…')); return; }
    if (view.state === 'ended') {
      const result = view.winner === null ? t('平手！') : view.winner === view.seat ? t('你贏了！') : t('這次由對手獲勝。');
      const reason = ['left','disconnect','idle'].includes(view.reason) ? t('有玩家離開或逾時，對戰已結束。') : view.reason === 'expired' ? t('房間等待時間已結束。') : t('對戰結束。');
      status(`${result} ${view.scores[0]} : ${view.scores[1]} · ${reason}`);
      const remaining = Math.max(0, Math.ceil((view.expiresAt - now) / 1000));
      $('again').disabled = rematchPending || !view.canRematch || !remaining || view.rematch?.[view.seat];
      $('rematch-note').textContent = !remaining ? t('再戰時間已結束，請返回準備畫面。') : !view.canRematch ? t('對手已離開或暫時離線，現在無法再戰。可離開房間重新配對。') : view.rematch?.[view.seat] ? msg`等待對手同意再戰…剩餘 ${remaining} 秒` : view.rematch?.[1 - view.seat] ? msg`對手邀請你再戰！剩餘 ${remaining} 秒` : msg`想和同一位對手再比一場？雙方在 ${remaining} 秒內按「再來一場」即可。`;
      return;
    }
    if (!assetsReady) { status(t('正在載入此局牌面…')); return; }
    if (view.state === 'lobby') { status(!view.players[1] ? t('房間已建立，分享連結邀請朋友加入。') : t('對手已加入，請確認此局設定後按「我準備好了」。')); return; }
    if (!view.connected.every(Boolean)) { status(t('對手暫時離線，保留 30 秒重新連線時間。')); return; }
    if (view.state === 'preview') { status(msg`記住牌面！${Math.max(0, Math.ceil((view.startedAt - now) / 1000))} 秒後開始。`); return; }
    if (view.settleAt) { status(t('這兩張不一樣，接著換另一位玩家。')); return; }
    status(msg`${view.turn === view.seat ? t('輪到你了') : t('對手正在翻牌')} · 本回合剩餘 ${Math.max(0, Math.ceil((view.turnEnd - now) / 1000))} 秒`);
  }
  function renderResult() {
    const ended = view.state === 'ended'; $('result').hidden = !ended || !view.players.every(Boolean); $('rematch-note').hidden = !ended;
    if (!ended || !view.players.every(Boolean)) { resultKey = ''; return; }
    const key = roomId + ':' + view.round;
    if (resultKey === key) return;
    resultKey = key;
    const outcome = view.winner === null ? 'draw' : view.winner === view.seat ? 'win' : 'loss';
    $('result').dataset.outcome = outcome;
    $('result').querySelector('.pk-result-symbol').textContent = outcome === 'win' ? '★' : outcome === 'draw' ? '∞' : '☾';
    $('result-title').textContent = t(outcome === 'win' ? '獲勝！' : outcome === 'draw' ? '平手！' : '敗北');
    $('result-note').textContent = t(outcome === 'win' ? '漂亮的記憶力，這一場由你拿下！' : outcome === 'draw' ? '勢均力敵，再比一場吧！' : '差一點，下次再挑戰！');
    const particles = $('result').querySelector('.pk-result-particles'); particles.replaceChildren();
    for (let i = 0; i < 16; i++) { const p = document.createElement('i'); p.style.setProperty('--i', i); particles.append(p); }
    if (outcome === 'win') { music.duck(); playSound('win'); }
    // Card clicks can scroll a small screen below the result banner. Bring the result into view once.
    requestAnimationFrame(() => {
      if (resultKey !== key || $('result').hidden) return;
      const bounds = $('result').getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > innerHeight) $('result').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function tick() {
    if (localRoom) {
      const now = Date.now(); let changed = advanceRoom(localRoom, now);
      if (botRematchDue && now >= botRematchDue) {
        botRematchDue = 0;
        changed = requestRematch(localRoom, 1, now, localRoom.round) !== 'ignored' || changed;
        if (changed) { opponent = new MemoryOpponent(); botSeen = -1; }
      }
      const observation = roomView(localRoom, 1, now);
      if (botSeen !== localRoom.rev) { opponent.observe(observation); botSeen = localRoom.rev; }
      if (localRoom.state === 'playing' && localRoom.turn === 1 && !localRoom.settleAt) {
        if (!botDue) botDue = now + 800 + Math.random() * 1400;
        if (now >= botDue) { const index = opponent.choose(observation); const effect = flipRoom(localRoom, 1, index, now, localRoom.rev); if (effect !== 'ignored') sound(effect); changed = true; botDue = 0; }
      } else botDue = 0;
      if (changed) acceptView(roomView(localRoom, 0, now));
    }
    tickStatus();
  }
  async function leave(closePanel = false) {
    if (view && view.state !== 'ended' && view.players[1] && !await confirmAction(t('離開這場 PK？'), t('離開後這場對戰會結束。'), t('離開房間'))) return false;
    generation++; send({ type: 'leave' }); stopSocket(); session = null; persist(null); inviteId = '';
    if (readInvitation()) history.replaceState(null, '', location.pathname + location.search);
    resetUI(); if (closePanel) { if (document.fullscreenElement === panel) await document.exitFullscreen().catch(() => {}); fullscreenHint.cancel(); active = false; clearInterval(timer); panel.hidden = true; setActive(false); document.querySelector('#pk-open').focus(); }
    return true;
  }
  $('create').onclick = () => begin('create'); $('match').onclick = () => begin('queue'); $('join').onclick = () => begin('join');
  $('cancel').onclick = () => leave(); $('leave').onclick = () => leave(); $('exit').onclick = () => leave(true);
  $('again').onclick = () => {
    if (!view?.canRematch || rematchPending || view.rematch?.[view.seat]) return;
    void music.unlock(); void prepare(); $('error').hidden = true;
    if (localRoom) {
      if (requestRematch(localRoom, 0, Date.now(), view.round) === 'waiting') botRematchDue = Date.now() + 1000 + Math.random() * 1800;
      acceptView(roomView(localRoom, 0, Date.now()));
    } else if (send({ type: 'rematch', round: view.round })) { rematchPending = true; renderRoom(); }
  };
  $('settings').onclick = () => {
    if (mode !== 'setup' || pending || inviteId) return;
    void openSettings(() => { refreshConfig(); if (!musicPreference) { musicOn = getConfig().sound; updateMusic(); } });
  };
  function updateMusic() {
    music.setEnabled(musicOn); $('music').setAttribute('aria-pressed', String(musicOn));
    $('music').textContent = t(musicOn ? '♫ 背景音樂：開' : '♫ 背景音樂：關');
  }
  $('music').onclick = () => {
    musicOn = !musicOn; musicPreference = true; updateMusic();
    try { localStorage.setItem('memory-pk-music', String(musicOn)); } catch {}
    if (musicOn) void music.unlock().then(ok => { if (!ok) toast(t('無法播放背景音樂，遊戲仍可繼續。')); });
  };
  updateMusic(); music.setVisible(!document.hidden);
  document.addEventListener('visibilitychange', () => music.setVisible(!document.hidden));
  $('ready').onclick = async () => { void music.unlock(); await prepare(); if (localRoom) { readyRoom(localRoom, 0, Date.now()); acceptView(roomView(localRoom, 0, Date.now())); } else send({ type: 'ready' }); };
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText($('link').value); toast(t('邀請連結已複製')); } catch { $('link').focus(); $('link').select(); toast(t('請複製上方的邀請連結。')); } };
  $('fullscreen').onclick = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await panel.requestFullscreen?.().catch(() => toast(t('此瀏覽器不支援全螢幕。'))); };
  window.addEventListener('pagehide', () => { music.stop(); stopSocket(); });
  document.querySelector('#pk-open').onclick = open;
  const previous = readSession();
  if (previous) { open(); session = previous; mode = 'connecting'; busy(true); $('setup').hidden = true; $('cancel').hidden = false; status(t('正在恢復 PK 連線…')); void connect().then(() => { if (mode === 'connecting') { mode = 'setup'; busy(false); $('setup').hidden = false; } }).catch(() => { showError(errorText('auth')); persist(null); resetUI(); }); }
  else if (readInvitation() || new URLSearchParams(location.search).get('mode') === 'pk') open();
  return { get active() { return active; } };
}
