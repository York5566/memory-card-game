// Choose the workspace by the task, rather than giving every tool a stage.
export const EDITOR_TOOLS = new Set(['qr','image','badges','certificates','seating']);
const GAMES = new Set(['memory','pk','puzzle','reveal','sequence','reaction','differences','charades','drawing']);
const DISPLAY = new Set(['picker','groups','scoreboard','timer','bingo','quiz','tournament','dice','party']);
export function workflowProfile(kind) {
  const editor = EDITOR_TOOLS.has(kind);
  return {
    editor,
    fullscreen: GAMES.has(kind) || DISPLAY.has(kind) || kind==='whiteboard',
    fullscreenLabel: kind==='whiteboard'?'workDrawFull':GAMES.has(kind)?'workPlayFull':'workDisplayFull',
    keys: !['qr','image','badges','certificates'].includes(kind),
    settingsOpen: ['picker','groups','tournament','quiz','bingo','dice'].includes(kind),
    settingsLabel: ({picker:'workRoster',groups:'workGroupsSetup',scoreboard:'workTeams',timer:'workSchedule',bingo:'workBingoSetup',quiz:'workQuizSetup',tournament:'workPlayers',dice:'workDiceSetup',whiteboard:'workCanvas'})[kind] || 'focusSettings',
    resultLabel: ({qr:'workQROutput',image:'workImageOutput',badges:'workPaperOutput',certificates:'workPaperOutput',seating:'workSeatOutput'})[kind]
  };
}
