import { ASSETS, PRODUCTS } from './core.js';
import { imageURL } from './images.js';
export const productName = (config, id) => config.products.find(p => p.id === id)?.label || PRODUCTS.find(p => p.id === id)?.name || '自訂圖案';
export const escapeHTML = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const assetURL = path => document.body.dataset.base + path;
function imageLayer(path, layer, className = '') {
  const url = imageURL(layer.upload) || (path ? assetURL(path) : '');
  if (!url) return '';
  const fit = layer.fit === 'stretch' ? 'fill' : layer.fit;
  return `<div class="art-layer ${className}" style="opacity:${layer.opacity / 100};transform:translate(${layer.x}%,${layer.y}%) rotate(${layer.rotation}deg) scale(${layer.zoom / 100});clip-path:inset(${layer.cropTop}% ${layer.cropRight}% ${layer.cropBottom}% ${layer.cropLeft}%)"><img src="${escapeHTML(url)}" alt="" draggable="false" style="object-fit:${fit}"></div>`;
}
export function createCard(c, id, index = 0) {
  const p = PRODUCTS.find(p => p.id === id), setting = c.products.find(p => p.id === id);
  const back = ASSETS.back.find(a => a.id === c.back.asset);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'card'; button.dataset.index = index;
  button.style.aspectRatio = `${c.ratioW} / ${c.ratioH}`;
  button.style.minHeight = '54px';
  button.style.setProperty('--card-radius', `${c.radius}px`);
  button.style.setProperty('--match-color', c.matchColor);
  button.innerHTML = `<span class="card-turn"><span class="card-face card-back" style="background:${c.backColor}">${imageLayer(back?.path, c.back)}</span><span class="card-face card-front" style="background:${c.cardColor}"><span class="product-art">${imageLayer(p.path, setting.image)}</span>${c.showLabels ? `<span class="product-label">${escapeHTML(productName(c, id))}</span>` : ''}<span class="match-tick" aria-hidden="true">✓</span></span></span>`;
  button.setAttribute('aria-label', `第 ${index + 1} 張，尚未翻開`);
  return button;
}
export function createStage(container, config, cards, onFlip, preview = false) {
  const c = config;
  const bg = ASSETS.background.find(a => a.id === c.background.asset);
  const logo = ASSETS.logo.find(a => a.id === c.logo.asset);
  container.style.backgroundColor = c.backgroundColor;
  container.innerHTML = `${imageLayer(bg?.path, c.background, 'stage-background')}<div class="stage-heading">
    ${logo?.path || imageURL(c.logo.upload) ? `<div class="logo-canvas" style="width:${c.logo.canvasW}px;height:${c.logo.canvasH}px;transform:translate(${c.logo.boxX}%,${c.logo.boxY}%)">${imageLayer(logo?.path, c.logo)}</div>` : ''}
    <div class="stage-copy" style="text-align:${c.title.align};opacity:${c.title.opacity / 100};color:${c.title.color};transform:translate(${c.title.x}%,${c.title.y}%)"><p class="stage-eyebrow">${escapeHTML(c.headerText)}</p><h2 style="font-size:${c.title.size}px">${escapeHTML(c.title.text)}</h2><p class="stage-subtitle">${escapeHTML(c.title.subtitle)}</p></div></div><div class="board-wrap"><div class="card-grid"></div></div><div class="stage-overlay" hidden><span>遊戲已暫停</span><p>牌面已遮住，計時也暫停了。</p><button type="button" class="button primary resume-overlay">繼續</button></div>`;
  const grid = container.querySelector('.card-grid');
  grid.style.gap = `${c.gap}px`;
  grid.style.width = `${c.boardScale}%`;
  const buttons = cards.map((id, index) => {
    const button = createCard(c, id, index);
    if (preview) button.tabIndex = -1; else button.addEventListener('click', () => onFlip(index));
    grid.append(button); return button;
  });
  const resize = () => {
    const width = container.clientWidth;
    let columns = c.columns || (width < 450 ? 3 : width < 650 ? 4 : 6);
    const maxColumns = Math.max(2, Math.floor((width - 40) / 66));
    columns = Math.min(columns, cards.length, maxColumns);
    grid.style.gridTemplateColumns = `repeat(${Math.max(2, columns)}, minmax(0, 1fr))`;
    // Keep extreme ratios usable rather than turning a card into a thin, unclickable strip.
    for (const button of buttons) button.style.minHeight = '54px';
  };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  return {
    buttons,
    update(game) {
      buttons.forEach((button, i) => {
        const revealed = game.isRevealed(i), matched = game.matched.has(i);
        button.classList.toggle('revealed', revealed); button.classList.toggle('matched', matched && game.state !== 'paused');
        button.querySelector('.card-front').setAttribute('aria-hidden', String(!revealed));
        button.querySelector('.card-back').setAttribute('aria-hidden', String(revealed));
        button.disabled = preview || game.state !== 'playing' || matched || game.open.includes(i) || game.open.length >= 2;
        button.setAttribute('aria-label', revealed ? `第 ${i + 1} 張，${productName(c, cards[i])}${matched ? '，配對成功' : '，已翻開'}` : `第 ${i + 1} 張，尚未翻開`);
      });
      container.querySelector('.stage-overlay').hidden = game.state !== 'paused';
    },
    destroy() { observer.disconnect(); },
  };
}
