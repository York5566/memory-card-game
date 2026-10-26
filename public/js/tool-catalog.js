// One catalog powers navigation, discovery and search metadata.
export const CATEGORIES = ['all','create','organize','play','present'];
export const TOOL_CATALOG = [
 ['memory','games/memory/','play'],['picker','tools/random-picker/','organize'],['groups','tools/random-groups/','organize'],
 ['scoreboard','tools/scoreboard/','present'],['timer','tools/timer/','present'],['bingo','tools/bingo/','play'],
 ['tournament','tools/tournament/','organize'],['quiz','tools/quiz/','play'],
 ['seating','tools/seating/','organize'],['dice','tools/dice/','play'],['qr','tools/qr/','create'],
 ['badges','tools/badges/','create'],['image','tools/image/','create'],['whiteboard','tools/whiteboard/','present'],['certificates','tools/certificates/','create'],
 ['puzzle','tools/puzzle/','play'],['reveal','tools/reveal/','play'],['sequence','tools/sequence/','play'],['reaction','tools/reaction/','play'],
 ['differences','tools/differences/','play'],['charades','tools/charades/','play'],['drawing','tools/drawing/','play'],['materials','tools/materials/','create'],
].map(([id,path,category])=>({id,path,category}));
export const SUITE_KINDS = ['seating','dice','qr','badges','image','whiteboard','certificates'];
