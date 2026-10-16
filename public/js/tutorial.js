import { t, msg, html } from './i18n.js';

export const GUIDE_KEY = 'memory-quick-guide-v1';
export const GUIDE_STEPS = [
  ['直接開始，找出相同的兩張', '按「開始遊戲」，記住牌面後一次翻兩張。聲音開關同時控制音樂與音效；＋／− 可以調整卡牌大小。', '開始遊戲'],
  ['把照片變成自己的卡牌', '開啟「設定 → 卡牌與圖庫」，點圖案下方的「編輯圖片」上傳照片。需要時展開構圖調整，預覽後按「儲存並套用」。', '設定 → 卡牌與圖庫'],
  ['邀請朋友，或找一位對手', '按「雙人 PK」選擇邀請朋友或線上配對。兩人都按「我準備好了」才開局；準備期間可返回選擇玩法。', '雙人 PK'],
];
export function guideSeen(storage) { try { return storage?.getItem(GUIDE_KEY) === 'done'; } catch { return false; } }
export function markGuideSeen(storage) { try { storage?.setItem(GUIDE_KEY, 'done'); } catch { /* Guidance remains usable with storage disabled. */ } }

export function initTutorial() {
  let dialog, step = 0, prior;
  function finish() {
    try { markGuideSeen(localStorage); } catch { /* Storage may be disabled. */ }
    dialog.close(); prior?.focus({preventScroll:true});
  }
  function draw() {
    const [title, text, action] = GUIDE_STEPS[step];
    dialog.innerHTML = html`<div class="guide-top"><span>快速上手</span><button type="button" class="button small" data-guide-skip>跳過教學</button></div><div class="guide-art" aria-hidden="true"><span>${['✦','▧','⚡'][step]}</span><strong>${t(action)}</strong></div><p class="guide-progress" aria-live="polite">${msg`第 ${step + 1} 步，共 ${GUIDE_STEPS.length} 步`}</p><h2 id="guide-title">${t(title)}</h2><p id="guide-description">${t(text)}</p><p class="hint">之後可在「使用說明」重新查看教學。</p><div class="guide-actions"><button class="button" data-guide-back ${step ? '' : 'hidden'}>上一步</button><button class="button primary" data-guide-next>${t(step === GUIDE_STEPS.length - 1 ? '開始體驗' : '下一步')}</button></div>`;
    dialog.querySelector('[data-guide-skip]').onclick = finish;
    dialog.querySelector('[data-guide-back]').onclick = () => { step--; draw(); };
    dialog.querySelector('[data-guide-next]').onclick = () => { if (step === GUIDE_STEPS.length - 1) finish(); else { step++; draw(); } };
    dialog.querySelector('[data-guide-next]').focus();
  }
  function open() {
    if (dialog?.open) return;
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.className = 'guide-dialog';
      dialog.setAttribute('aria-labelledby', 'guide-title'); dialog.setAttribute('aria-describedby', 'guide-description');
      dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); }); document.body.append(dialog);
    }
    prior = document.activeElement; step = 0; draw(); dialog.showModal(); dialog.querySelector('[data-guide-next]').focus();
  }
  document.querySelectorAll('[data-open-guide]').forEach(button => button.addEventListener('click', open));
  let seen = false; try { seen = guideSeen(localStorage); } catch { /* First visit when storage is unavailable. */ }
  if (!seen && ['home','game'].includes(document.body.dataset.page)) requestAnimationFrame(() => {
    // Avoid stacking on an existing settings/confirmation dialog.
    if (!document.querySelector('dialog[open]')) open();
  });
}
