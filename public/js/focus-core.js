export const DEFAULT_SHORTCUTS = Object.freeze({
  primary:'Space', pause:'KeyP', next:'ArrowRight', previous:'ArrowLeft',
  undo:'KeyZ', redo:'KeyY', hint:'KeyH', reveal:'KeyR',
  scoreUp:'KeyA', scoreDown:'KeyD', scoreNext:'ArrowDown', scorePrevious:'ArrowUp',
  fullscreen:'KeyF', settings:'KeyS', more:'KeyM'
});
export function validShortcut(code) {
  return typeof code === 'string' && (code === '' || /^(Key[A-Z]|Digit[0-9]|Space|Arrow(Left|Right|Up|Down))$/.test(code));
}
export function validateShortcuts(value, actions = Object.keys(DEFAULT_SHORTCUTS)) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid');
  const result = {}, used = new Set();
  for (const action of actions) {
    const code = Object.hasOwn(value, action) ? value[action] : DEFAULT_SHORTCUTS[action];
    if (!Object.hasOwn(DEFAULT_SHORTCUTS, action) || !validShortcut(code) || code && used.has(code)) throw Error('invalid');
    result[action] = code;
    if (code) used.add(code);
  }
  return result;
}
export function shortcutName(code) {
  return ({Space:'Space',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'})[code] || code.replace(/^(Key|Digit)/, '') || '—';
}
export const SECONDARY_ACTIONS = new Set([
  'miniStop','resetCalls','generateCards','printCards','resultCSV','transferScores',
  'sExportCSV','suitePrint','suitePNG','suiteZIP','diceReset','sClear',
  'boardAdd','boardDelete','boardSelected','restartClock'
]);
export const ACTION_KEYS = {
  primary:['draw','makeGroups','randomCall','diceRoll','diceDraw','miniSubmit','partyStart','partyBuzz','partyDrawSubmit'],
  pause:['miniPause','miniResume','timerPause','timerResume','timerStart','timerAgain'],
  next:['miniNext','nextQuestion','timerNext','boardNext'],
  previous:['previousQuestion','boardPrev'],
  undo:['undoShort','undo','callUndo','undoAward','sUndo'],
  redo:['sRedo'], hint:[], reveal:['quizRevealAction','partyReveal','miniShowCard','miniHideCard']
};
