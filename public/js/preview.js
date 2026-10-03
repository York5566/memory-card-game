// Deterministic preview: keep the selected enabled image in view, without
// changing the game's randomized deck or enabling an unchecked image.
export function previewCards(config, selectedId) {
  const pool = config.products.filter(p => p.enabled).map(p => p.id);
  if (pool.includes(selectedId)) pool.splice(0, 0, ...pool.splice(pool.indexOf(selectedId), 1));
  return pool.slice(0, config.pairs).flatMap(id => [id, id]);
}
export function previewTarget(path, current) {
  if (path === 'backColor' || path.startsWith('back.')) return { view: 'card', face: 'back' };
  if (path === 'matchColor') return { view: 'card', face: 'matched' };
  if (path.startsWith('products.') || ['cardColor', 'showLabels', 'radius'].includes(path)) return { view: 'card', face: 'front' };
  if (['ratioW', 'ratioH', 'columns', 'gap', 'boardScale', 'pairs'].includes(path) || /^(title\.|headerText|background|logo\.)/.test(path)) return { view: 'board', face: current.face };
  return current;
}
