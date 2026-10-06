import { defaults, copy, History, SPECS, TRANSFORM_SPECS, PRODUCTS, FIELDS, get, set, canonical, sanitize } from './core.js';
import { createStage, createCard, productName, escapeHTML as esc, assetURL } from './stage.js';
import { imageURL, importImage, pruneImages } from './images.js';
import { cloudReady, saveCloud, loadCloud, deleteCloud, receipts } from './cloud.js';
import { formatCode } from './profile-format.js';
import { previewCards, previewTarget } from './preview.js';
import { toast, confirmAction } from './site.js';
const TABS = { play: '玩法', cards: '卡牌與圖庫', screen: '畫面', records: '成績', cloud: '雲端代碼' };
export function openSettings(applied, apply) {
  const dialog = document.querySelector('#settings-dialog'); if (dialog.open) return;
  let saved = copy(applied), history = new History(applied), tab = 'play', product = 0, preview, frameRequest = 0;
  let showing = { view: 'board', face: 'front' };
  let busy = false, lastCode = '';
  const base = defaults(); const prior = document.activeElement;
  dialog.innerHTML = `<header class="dialog-header"><div><h2 id="settings-title">設定</h2><p>調整草稿；儲存並套用後，遊戲回到準備畫面。</p></div><button class="icon-button close-settings" aria-label="關閉設定">×</button></header>
    <div class="settings-body"><div class="settings-form"><div class="settings-tabs" role="tablist" aria-label="設定分頁">${Object.entries(TABS).map(([id, name]) => `<button class="tab" id="tab-${id}" role="tab" aria-controls="settings-fields" data-tab="${id}">${name}</button>`).join('')}</div><div id="settings-fields" class="settings-fields" role="tabpanel"></div></div>
    <aside class="settings-preview" aria-label="設定即時預覽"><div class="preview-heading"><h3>即時預覽</h3><button type="button" class="button small" id="preview-expand" aria-expanded="false">放大預覽</button></div>
    <div class="preview-tools"><div role="group" aria-label="預覽範圍"><button type="button" data-view="board">整體畫面</button><button type="button" data-view="card">卡牌細節</button></div><div role="group" aria-label="預覽牌面"><button type="button" data-face="front">正面</button><button type="button" data-face="back">卡背</button><button type="button" data-face="matched">配對成功</button></div></div>
    <div class="preview-frame"><div id="preview-stage" class="stage"></div><div id="preview-card"></div><div id="preview-records" hidden></div></div><p class="preview-caption" id="preview-caption"></p><p class="preview-hint" id="preview-summary"></p></aside></div>
    <footer class="settings-footer"><div><div class="undo-row"><button class="button small" id="settings-undo">復原</button><button class="button small" id="settings-redo">重做</button><button class="reset-field" id="settings-reset-all">全部設定恢復預設</button></div><div class="save-status" id="save-status" role="status">僅儲存在此瀏覽器。</div></div><div class="footer-actions"><button class="button" id="settings-close">關閉</button><button class="button primary" id="settings-apply">儲存並套用</button></div></footer>`;
  const status = message => { dialog.querySelector('#save-status').textContent = message; };
  async function operation(message, task) {
    if (busy) return; busy = true; status(message);
    const controls = [...dialog.querySelectorAll('button,input,select')].map(node => [node, node.disabled]);
    controls.forEach(([node]) => node.disabled = true); dialog.setAttribute('aria-busy', 'true');
    try { await task(); } catch (error) { status(error.message || '操作失敗，請再試一次。'); }
    finally { busy = false; dialog.removeAttribute('aria-busy'); controls.forEach(([node, disabled]) => node.disabled = disabled); syncFields(); }
  }
  const dirty = () => canonical(history.value) !== canonical(saved);
  function updateButtons() { dialog.querySelector('#settings-undo').disabled = busy || (!history.past.length && !history.pending); dialog.querySelector('#settings-redo').disabled = busy || !history.future.length; }
  function previewRender() {
    if (frameRequest) return;
    frameRequest = requestAnimationFrame(() => { frameRequest = 0; drawPreview(); });
  }
  function drawPreview() {
    preview?.destroy(); const c = sanitize(history.value);
    const selected = { ...PRODUCTS[product], name: productName(c, PRODUCTS[product].id) }, cards = previewCards(c, selected.id);
    const stage = dialog.querySelector('#preview-stage');
    preview = createStage(stage, c, cards, () => {}, true);
    preview.update({ state: 'preview', isRevealed: () => showing.face !== 'back', matched: new Set(showing.face === 'matched' ? [0, 1] : []), open: [] });
    const card = createCard(c, selected.id); card.disabled = true; card.tabIndex = -1;
    card.classList.toggle('revealed', showing.face !== 'back'); card.classList.toggle('matched', showing.face === 'matched');
    card.setAttribute('aria-label', showing.face === 'back' ? '卡背預覽' : `${selected.name}預覽`);
    card.querySelector('.card-front').setAttribute('aria-hidden', String(showing.face === 'back'));
    card.querySelector('.card-back').setAttribute('aria-hidden', String(showing.face !== 'back'));
    dialog.querySelector('#preview-card').replaceChildren(card);
    dialog.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === showing.view)));
    dialog.querySelectorAll('[data-face]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.face === showing.face)));
    dialog.querySelector('#preview-caption').textContent = showing.view === 'board' ? `${c.pairs} 對 / ${cards.length} 張・排版與遊戲同步，開局會隨機選圖洗牌` : `${showing.face === 'back' ? '卡背' : selected.name}・放大查看構圖${showing.face !== 'back' && !c.products[product].enabled ? '（未勾選，不會出現在遊戲中）' : ''}`;
    dialog.querySelector('#preview-summary').textContent = tab === 'records' ? `排行榜${c.records.leaderboard ? '開啟' : '關閉'} · 成績保存${c.records.enabled ? `開啟，選取 ${c.records.fields.length} 個欄位` : '關閉'}${c.event ? ` · ${c.event}` : ''}` : `${c.timed ? `限時 ${c.limitSeconds} 秒` : '不限時'} · 記憶預覽 ${c.previewSeconds} 秒 · 失敗停留 ${c.mismatchMs / 1000} 秒 · 音效${c.sound ? '開' : '關'}`;
    dialog.querySelector('.preview-tools').hidden = tab === 'records';
    const recordPreview = dialog.querySelector('#preview-records'); recordPreview.hidden = tab !== 'records';
    recordPreview.innerHTML = `<h4>排行榜${c.records.leaderboard ? '已開啟' : '已關閉'}</h4><p>${c.records.leaderboard ? '完成遊戲後，將加入這次的排行榜。' : '完成遊戲後，不加入排行榜。'}</p><h4>成績保存${c.records.enabled ? '已開啟' : '已關閉'}</h4><p>${c.records.enabled ? `保存欄位：${c.records.fields.map(key => FIELDS[key]).join('、') || '只保存必要識別資料'}。` : '新成績不寫入此瀏覽器，舊紀錄保留。'}</p>${c.event ? `<p>活動：${esc(c.event)}</p>` : ''}`;
    if (tab === 'records') dialog.querySelector('#preview-caption').textContent = '以上顯示目前草稿，按「儲存並套用」後生效。';
    resize.observe(stage);
    sizePreview(); updateButtons();
  }
  function sizePreview() {
    if (!preview || !dialog.open) return;
    const stage = dialog.querySelector('#preview-stage'), frame = dialog.querySelector('.preview-frame');
    const main = document.querySelector('#game-stage'), detail = dialog.querySelector('#preview-card');
    stage.style.width = `${main.clientWidth || 680}px`; stage.style.padding = getComputedStyle(main).padding;
    stage.querySelector('.card-grid').style.maxWidth = getComputedStyle(main.querySelector('.card-grid')).maxWidth;
    detail.style.width = `${preview.buttons[0]?.offsetWidth || 120}px`;
    for (const [element, visible] of [[stage, tab !== 'records' && showing.view === 'board'], [detail, tab !== 'records' && showing.view === 'card']]) {
      element.style.visibility = visible ? 'visible' : 'hidden'; element.setAttribute('aria-hidden', String(!visible));
      const scale = Math.min(visible && showing.view === 'card' ? 2.4 : 1, (frame.clientWidth - 8) / element.offsetWidth, (frame.clientHeight - 8) / element.offsetHeight);
      element.style.transform = `translate(${Math.max(0, (frame.clientWidth - element.offsetWidth * scale) / 2)}px, ${Math.max(0, (frame.clientHeight - element.offsetHeight * scale) / 2)}px) scale(${Math.max(.01, scale)})`;
    }
  }
  const resize = new ResizeObserver(sizePreview);
  function focusPreview(path) { showing = previewTarget(path, showing); previewRender(); }
  dialog.querySelectorAll('[data-view]').forEach(button => button.onclick = () => { showing.view = button.dataset.view; previewRender(); });
  dialog.querySelectorAll('[data-face]').forEach(button => button.onclick = () => { showing.face = button.dataset.face; previewRender(); });
  dialog.querySelector('#preview-expand').onclick = event => {
    const expanded = dialog.querySelector('.settings-body').classList.toggle('preview-expanded');
    event.currentTarget.textContent = expanded ? '返回調整' : '放大預覽'; event.currentTarget.setAttribute('aria-expanded', String(expanded));
    sizePreview();
  };
  function field(spec, prefix = '') {
    const [key, label, type, lo, hi, step = 1] = spec; const path = prefix + key; const value = get(history.value, path); const id = 'setting-' + path.replaceAll('.', '-');
    let control;
    if (type === 'boolean') control = `<input id="${id}" type="checkbox" data-path="${path}" ${value ? 'checked' : ''}>`;
    if (type === 'text') control = `<input id="${id}" type="text" data-path="${path}" maxlength="${lo}" value="${esc(value ?? '')}">`;
    if (type === 'select') control = `<select id="${id}" data-path="${path}">${lo.map(([id, text]) => `<option value="${id}" ${value === id ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
    if (type === 'color') control = `<input id="${id}" type="color" data-path="${path}" value="${value}"><input type="text" class="color-code" aria-label="${label}色碼" data-path="${path}" data-color-code="true" pattern="#[0-9a-fA-F]{6}" maxlength="7" value="${value}" spellcheck="false">`;
    if (type === 'number') { const max = key === 'pairs' ? history.value.products.filter(p => p.enabled).length : hi;
      control = `<input type="range" aria-label="${label}滑桿" min="${lo}" max="${max}" step="${step}" value="${value}" data-path="${path}"><input id="${id}" type="number" data-path="${path}" min="${lo}" max="${max}" step="${step}" value="${value}">`; }
    return `<div class="field"><div class="field-label"><label for="${id}">${label}</label><button type="button" class="reset-field" data-reset="${path}" aria-label="${label}恢復預設">恢復預設</button></div><div class="field-control">${control}</div>${key === 'pairs' ? `<p class="field-note" id="pairs-description">${value} 對 = ${value * 2} 張卡牌；已啟用 ${history.value.products.filter(p => p.enabled).length} 種圖案。</p>` : ''}</div>`;
  }
  function transformFields(prefix, title) { return `<details class="details-block"><summary>${title}</summary><div class="details-body">${TRANSFORM_SPECS.map(s => field(s, prefix)).join('')}</div></details>`; }
  // Update values in place: rebuilding the form closes <details>, loses focus,
  // and changes its scroll height while the user is editing a lower section.
  function syncFields() {
    const host = dialog.querySelector('#settings-fields');
    const enabled = history.value.products.filter(p => p.enabled).length;
    host.querySelectorAll('[data-path]').forEach(input => {
      const value = get(history.value, input.dataset.path);
      if (input.dataset.path === 'pairs') input.max = enabled;
      if (input.type === 'checkbox') input.checked = value; else input.value = value ?? '';
      input.setCustomValidity('');
    });
    host.querySelectorAll('[data-product]').forEach(input => { input.checked = history.value.products[Number(input.dataset.product)].enabled; });
    host.querySelectorAll('[data-record-field]').forEach(input => { input.checked = history.value.records.fields.includes(input.dataset.recordField); });
    const desc = host.querySelector('#pairs-description');
    if (desc) desc.textContent = `${history.value.pairs} 對 = ${history.value.pairs * 2} 張卡牌；已啟用 ${enabled} 種圖案。`;
    host.querySelectorAll('[data-upload-state]').forEach(node => { const id = get(history.value, node.dataset.uploadState)?.upload; node.textContent = id ? (imageURL(id) ? '使用自訂圖片' : '圖片遺失，請重新選取') : '使用內建圖片'; });
    host.querySelectorAll('[data-remove-image]').forEach(node => node.hidden = !get(history.value, node.dataset.removeImage)?.upload);
    host.querySelectorAll('[data-thumbnail]').forEach(node => { const i = Number(node.dataset.thumbnail); node.src = imageURL(history.value.products[i].image.upload) || assetURL(PRODUCTS[i].path); });
    host.querySelectorAll('[data-product-name]').forEach(node => node.textContent = productName(history.value, PRODUCTS[Number(node.dataset.productName)].id));
    host.querySelectorAll('#edit-product option').forEach(node => node.textContent = productName(history.value, PRODUCTS[Number(node.value)].id));
    previewRender(); updateButtons();
  }
  function uploadField(path, label) {
    const custom = get(history.value, path)?.upload;
    return `<div class="upload-panel"><strong>${label}</strong><p class="field-note">PNG、JPG、WebP，原圖最多 10 MiB；自動壓縮至 256 KiB。圖片先保存在此瀏覽器，產生雲端代碼時才上傳。</p><label class="upload-label">選擇圖片<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${path}"></label><div class="upload-status"><span data-upload-state="${path}">${custom ? '使用自訂圖片' : '使用內建圖片'}</span><button class="button small" data-remove-image="${path}" ${custom ? '' : 'hidden'}>移除自訂圖片</button></div></div>`;
  }
  function productFields() { return uploadField(`products.${product}.image`, '替換這個圖案') + field(['label', '圖案名稱', 'text', 30], `products.${product}.`) + TRANSFORM_SPECS.map(s => field(s, `products.${product}.image.`)).join(''); }
  function library() {
    return `<details class="details-block" open><summary>遊戲圖庫</summary><div class="details-body"><p class="hint">勾選要加入遊戲的圖案，至少保留 2 種。可替換 12 個圖案；在下方選擇圖案後上傳自己的圖片，並調整名稱與構圖。</p><div class="library-list">${PRODUCTS.map((p, i) => `<label class="library-item"><img data-thumbnail="${i}" src="${imageURL(history.value.products[i].image.upload) || assetURL(p.path)}" alt=""><span class="label-line"><input type="checkbox" data-product="${i}" ${history.value.products[i].enabled ? 'checked' : ''}><span data-product-name="${i}">${esc(productName(history.value, p.id))}</span></span></label>`).join('')}</div><label class="field-label" for="edit-product">調整正面圖案</label><select id="edit-product">${PRODUCTS.map((p, i) => `<option value="${i}" ${product === i ? 'selected' : ''}>${esc(productName(history.value, p.id))}</option>`).join('')}</select><div id="product-fields">${productFields()}</div></div></details>`;
  }
  function renderCloud(host) {
    const ready = cloudReady();
    host.innerHTML = `<h3>把設定帶到另一台裝置</h3><p>產生 12 位數字代碼，保存目前草稿、構圖與自訂圖片。另一台裝置輸入代碼後，按「儲存並套用」即可使用。</p>${ready ? '' : '<p class="cloud-notice">此預覽未連接雲端，或雲端功能尚未啟用。本機圖片上傳與設定仍可正常使用。</p>'}<div class="cloud-card"><h4>1. 保存目前草稿</h4><p>每份最多 15 張圖片、4 MiB。只傳送設定與圖片，不傳送暱稱、排行榜或成績紀錄。</p><p>持有代碼的人都能讀取圖片與設定，請勿放入私密內容。最後一次透過代碼讀取起，30 天未使用自動刪除；只在本機玩遊戲不會延長期限。</p><button class="button primary" id="cloud-save" ${ready ? '' : 'disabled'}>產生代碼</button><output id="cloud-result" class="cloud-code" aria-live="polite">${esc(formatCode(lastCode))}</output></div><div class="cloud-card"><h4>2. 載入雲端設定</h4><label for="cloud-code-input">12 位數字代碼</label><input id="cloud-code-input" type="text" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="1234 5678 9012"><button class="button" id="cloud-load" ${ready ? '' : 'disabled'}>載入到草稿</button><p>載入會替換目前草稿，可用「復原」回到先前設定。成功載入後圖片會保存在此裝置，不必每局重新下載。</p></div><div id="turnstile-host"></div><p class="hint">每個網路每日最多產生 5 組、讀取 60 次；達到全站配額時，雲端功能暫停，本機遊戲仍可繼續。清除瀏覽器資料會移除本機圖片與刪除憑證。</p><details class="details-block"><summary>此瀏覽器建立的代碼（${receipts().length}）</summary><div id="cloud-receipts"></div></details>`;
    const challengeHost = host.querySelector('#turnstile-host');
    host.querySelector('#cloud-save').onclick = () => operation('正在保存草稿，請完成下方驗證…', async () => {
      history.commit(); const result = await saveCloud(history.value, challengeHost); lastCode = result.code;
      host.querySelector('#cloud-result').textContent = formatCode(result.code); drawReceipts();
      status(`已保存，代碼 ${formatCode(result.code)}。30 天未透過代碼讀取將自動刪除。`);
    });
    host.querySelector('#cloud-load').onclick = () => operation('正在載入設定，請完成下方驗證…', async () => {
      const next = await loadCloud(host.querySelector('#cloud-code-input').value, challengeHost); history.replace(next); status('雲端設定已載入草稿。請檢查預覽，再按「儲存並套用」。');
    });
    function drawReceipts() {
      host.querySelector('#cloud-receipts').innerHTML = receipts().map(row => `<div class="cloud-receipt"><code>${esc(formatCode(row.code))}</code><button class="button small" data-delete-code="${esc(row.code)}" ${ready ? '' : 'disabled'}>刪除雲端檔</button></div>`).join('') || '<p>尚未建立代碼。</p>';
      host.querySelectorAll('[data-delete-code]').forEach(button => button.onclick = async () => {
        if (!await confirmAction('刪除這份雲端設定？', '代碼將立即失效；已下載到裝置的設定與圖片會保留。', '刪除雲端檔')) return;
        operation('正在刪除，請完成下方驗證…', async () => { await deleteCloud(button.dataset.deleteCode, challengeHost); drawReceipts(); status('雲端設定已刪除。'); });
      });
    }
    drawReceipts(); previewRender();
  }
  function renderTab() {
    const host = dialog.querySelector('#settings-fields');
    host.setAttribute('aria-labelledby', `tab-${tab}`);
    for (const button of dialog.querySelectorAll('[data-tab]')) { button.setAttribute('aria-selected', String(button.dataset.tab === tab)); button.tabIndex = button.dataset.tab === tab ? 0 : -1; }
    if (tab === 'cloud') { renderCloud(host); host.scrollTop = 0; return; }
    host.innerHTML = `<div class="tab-top"><h3>${TABS[tab]}</h3><button class="button small" id="reset-page">本頁恢復預設</button></div>${SPECS[tab].map(s => field(s)).join('')}`;
    if (tab === 'cards') host.insertAdjacentHTML('beforeend', uploadField('back', '自訂卡背') + transformFields('back.', '卡背圖片構圖') + library());
    if (tab === 'screen') host.insertAdjacentHTML('beforeend', uploadField('background', '自訂背景') + transformFields('background.', '背景圖片構圖') + uploadField('logo', '自訂 LOGO') + transformFields('logo.', 'LOGO 畫布內圖片構圖'));
    if (tab === 'records') host.insertAdjacentHTML('beforeend', `<p class="hint">成績紀錄最多 500 筆，僅儲存在此瀏覽器。關閉保存不刪除舊成績。排行榜不會加入歷史明細。</p><h3>保存的成績欄位</h3><div class="fields-list">${Object.entries(FIELDS).map(([key, name]) => `<div><label><input type="checkbox" data-record-field="${key}" ${history.value.records.fields.includes(key) ? 'checked' : ''}>${name}</label><button class="reset-field" data-reset-record-field="${key}" aria-label="${name}欄位恢復預設">恢復預設</button></div>`).join('')}</div><p class="hint">成績識別碼、完整組別識別碼、是否限時與限時時長固定保留。即使排行榜開啟，也只保存你勾選的其他欄位。</p>`);
    host.querySelector('#reset-page').onclick = () => {
      history.begin(); SPECS[tab].forEach(([path]) => set(history.value, path, copy(get(base, path))));
      if (tab === 'cards') { history.value.back = copy(base.back); history.value.products = copy(base.products); }
      if (tab === 'screen') { history.value.background = copy(base.background); history.value.logo = copy(base.logo); history.value.title = copy(base.title); }
      if (tab === 'records') history.value.records = copy(base.records);
      history.value = sanitize(history.value); history.commit(); syncFields(); status('已恢復本頁預設，尚未套用。');
    };
    const picker = host.querySelector('#edit-product'); if (picker) picker.onchange = () => {
      history.commit(); product = Number(picker.value);
      const fields = host.querySelector('#product-fields'); fields.innerHTML = productFields(); bindFields(fields);
      focusPreview(`products.${product}.image`);
    };
    bindFields(host); host.scrollTop = 0; previewRender();
  }
  function bindFields(host) {
    host.querySelectorAll('[data-upload]').forEach(input => input.onchange = () => {
      const file = input.files[0], path = input.dataset.upload; if (!file) return;
      operation('正在處理圖片…', async () => { const result = await importImage(file, path === 'background'); history.update(`${path}.upload`, result.id); history.commit(); focusPreview(`${path}.upload`); status(`圖片已保存於本機（${Math.ceil(result.bytes / 1024)} KiB），尚未套用。可繼續調整縮放、位置、旋轉與裁切。`); }); input.value = '';
    });
    host.querySelectorAll('[data-remove-image]').forEach(button => button.onclick = () => { history.begin(); delete get(history.value, button.dataset.removeImage).upload; history.commit(); syncFields(); focusPreview(`${button.dataset.removeImage}.upload`); status('已移除自訂圖片，尚未套用。'); });
    host.querySelectorAll('[data-path]').forEach(input => {
      const path = input.dataset.path;
      const update = () => {
        let value = input.type === 'checkbox' ? input.checked : input.value;
        if (['number', 'range'].includes(input.type)) {
          if (input.value === '' || !Number.isFinite(Number(value))) return;
          value = Math.max(Number(input.min), Math.min(Number(input.max), Number(value)));
        }
        if (input.dataset.colorCode) { if (!/^#[0-9a-f]{6}$/i.test(value)) { input.setCustomValidity('請填入完整的 #RRGGBB 色碼。'); return; } input.setCustomValidity(''); }
        history.update(path, value);
        if (path.endsWith('.asset')) { delete get(history.value, path.split('.')[0]).upload; syncFields(); }
        host.querySelectorAll('[data-path]').forEach(other => { if (other !== input && other.dataset.path === path) { if (other.type === 'checkbox') other.checked = value; else other.value = value; } });
        const desc = host.querySelector('#pairs-description'); if (path === 'pairs' && desc) desc.textContent = `${value} 對 = ${value * 2} 張卡牌；已啟用 ${history.value.products.filter(p => p.enabled).length} 種圖案。`;
        focusPreview(path); status('草稿已變更，尚未套用。');
      };
      input.addEventListener('focus', () => { history.begin(); focusPreview(path); }); input.addEventListener('pointerdown', () => history.begin());
      input.addEventListener('input', update);
      input.addEventListener('change', () => { update(); history.commit(); if (path.endsWith('.label')) syncFields(); updateButtons(); });
      input.addEventListener('blur', () => { history.commit(); if (['number', 'range'].includes(input.type)) input.value = get(history.value, path); updateButtons(); });
    });
    host.querySelectorAll('[data-reset]').forEach(button => button.onclick = () => {
      const path = button.dataset.reset; history.update(path, copy(get(base, path))); if (path.endsWith('.asset')) delete get(history.value, path.split('.')[0]).upload; history.value = sanitize(history.value); history.commit(); syncFields(); focusPreview(path); status('已恢復此項預設，尚未套用。');
    });
    host.querySelectorAll('[data-product]').forEach(input => input.onchange = () => {
      const index = Number(input.dataset.product);
      if (!input.checked && history.value.products.filter(p => p.enabled).length <= 2) { input.checked = true; status('至少需要 2 種不同的圖案。'); return; }
      history.update(`products.${index}.enabled`, input.checked);
      history.value.pairs = Math.min(history.value.pairs, history.value.products.filter(p => p.enabled).length);
      history.commit(); previewRender(); status(`圖庫已變更，已勾選 ${history.value.products.filter(p => p.enabled).length} 種圖案，配對數 ${history.value.pairs} 對。`);
    });
    host.querySelectorAll('[data-record-field],[data-reset-record-field]').forEach(input => {
      const handler = () => { const key = input.dataset.recordField || input.dataset.resetRecordField; const fields = new Set(history.value.records.fields); if (input.dataset.resetRecordField || input.checked) fields.add(key); else fields.delete(key); history.update('records.fields', Object.keys(FIELDS).filter(k => fields.has(k))); history.commit(); syncFields(); status('保存欄位已變更，尚未套用。'); };
      if (input.dataset.recordField) input.onchange = handler; else input.onclick = handler;
    });
  }
  async function close() {
    if (busy) { status('圖片或雲端操作進行中，請等候完成。'); return; }
    history.commit();
    if (dirty() && !await confirmAction('捨棄未套用的設定？', '已套用的設定與成績紀錄會保留，這次未套用的草稿將捨棄。', '捨棄草稿')) return;
    cancelAnimationFrame(frameRequest); frameRequest = 0; preview?.destroy(); resize.disconnect(); dialog.close(); prior?.focus(); void pruneImages(saved).catch(() => {});
  }
  dialog.oncancel = event => { event.preventDefault(); close(); };
  dialog.querySelector('.close-settings').onclick = close; dialog.querySelector('#settings-close').onclick = close;
  function changeTab(next) { if (busy) return; history.commit(); tab = next; if (tab === 'play' || tab === 'screen') showing.view = 'board'; renderTab(); }
  dialog.querySelectorAll('[data-tab]').forEach(button => {
    button.onclick = () => changeTab(button.dataset.tab);
    button.onkeydown = event => { const ids = Object.keys(TABS); let index = ids.indexOf(tab); if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); index = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + ids.length) % ids.length; changeTab(ids[index]); dialog.querySelector(`#tab-${tab}`).focus(); };
  });
  const undo = () => { if (history.undo()) { syncFields(); status('已復原一步，尚未套用。'); } };
  const redo = () => { if (history.redo()) { syncFields(); status('已重做一步，尚未套用。'); } };
  dialog.querySelector('#settings-undo').onclick = undo; dialog.querySelector('#settings-redo').onclick = redo;
  dialog.onkeydown = event => {
    if (busy) return;
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    if (event.target.matches('input[type=text],textarea,[contenteditable=true]')) return;
    event.preventDefault(); if (event.shiftKey) redo(); else undo();
  };
  dialog.querySelector('#settings-reset-all').onclick = () => { history.replace(base); syncFields(); status('全部設定已恢復預設，尚未套用。成績紀錄保持原樣。'); };
  dialog.querySelector('#settings-apply').onclick = async () => {
    const invalid = [...dialog.querySelectorAll('input')].find(input => !input.checkValidity());
    if (invalid) { if (dialog.querySelector('.preview-expanded')) dialog.querySelector('#preview-expand').click(); invalid.reportValidity(); return; }
    history.commit(); const next = sanitize(history.value); history.value = copy(next);
    const ok = apply(copy(next)); saved = copy(next);
    status(ok ? '已儲存並套用。設定面板會保持開啟。' : '已套用到這次畫面，但本機保存失敗。'); toast(ok ? '設定已儲存並套用' : '設定已套用，本機保存失敗'); previewRender();
  };
  dialog.showModal(); renderTab(); resize.observe(dialog.querySelector('.preview-frame')); dialog.querySelector('#tab-play').focus();
}
