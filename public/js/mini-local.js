import {T,el,button,input,pictureURL,MiniError} from './mini-ui.js';
import {puzzleStart,puzzleMove,puzzleSolved,growSequence,hitSpot,reactionBoard,answersMatch,charadeDeck,makeRun,pauseRun,resumeRun,runRemaining,miniSettingsPlan} from './mini-core.js';
import {readable} from './tool-ui.js';
import {randomInt,shuffle} from './tools-core.js';
export function mountLocal(shell){
 let config,run,content,board,bar,clock,points,turn,result,pauseLayer,state,selected=-1,timer,generation=0,paused=false,audio,observing=false,cue,hintButton,undoButton,rotateButton,cancelSelectionButton;
 function sound(good=true){if(!config.sound)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.frequency.setValueAtTime(good?620:190,t);g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.14);o.onended=()=>{o.disconnect();g.disconnect();};}catch{}}
 function cancel(){generation++;clearInterval(timer);}
 shell.onCleanup(cancel);
 const item=()=>config.items[run.round%config.items.length];
 const usable=()=>run&&!run.ended&&!paused;
 function stats(){points.textContent=T('miniScore',run.score);turn.textContent=T('miniRound',run.round+1,config.rounds);const remain=runRemaining(run);clock.textContent=remain===null?T('miniNoTime'):T('miniTime',Math.ceil(remain/1000));}
 function setCue(title,detail='',record=null){cue.hidden=!title;cue.replaceChildren();if(!title)return;const copy=el('div');copy.append(el('strong','',title));if(detail)copy.append(el('span','',detail));cue.append(copy);if(record){const target=el('div','mini-target-picture');picture(target,record);cue.append(target);}}
 function updateControls(){
  if(!bar||!run)return;const pause=bar.querySelector('[data-shortcut-action=pause]');
  if(pause){pause.textContent=T(paused?'miniResume':'miniPause');pause.disabled=run.ended||!result.hidden;}
  if(hintButton){hintButton.textContent=T('miniHint',Math.max(0,config.hints-run.hints));hintButton.disabled=!usable()||observing||run.hints>=config.hints;}
  if(undoButton)undoButton.disabled=!usable()||!state.undo?.length;
  if(rotateButton)rotateButton.disabled=!usable()||selected<0;
  if(cancelSelectionButton)cancelSelectionButton.hidden=selected<0;
  const stop=bar.querySelector('[data-mini-stop]');if(stop)stop.disabled=run.ended;
 }
 function appearance(){shell.root.querySelector('.mini-stage-header strong').textContent=config.title||T(config.kind);shell.stage.style.setProperty('--mini-accent',config.accent);shell.stage.style.background=config.background;shell.stage.style.color=readable(config.background);}
 function reference(){
  const d=el('dialog','mini-dialog mini-reference-dialog'),title=el('h2','',T('miniReference')),img=el('img');title.id='mini-reference-title';d.setAttribute('aria-labelledby',title.id);img.src=pictureURL(item().image);img.alt=T('miniReference');const opener=document.activeElement;
  if(usable())togglePause();d.append(title,img,button(T('close'),()=>d.close()));shell.root.querySelector('#mini-stage').append(d);d.addEventListener('close',()=>{d.remove();opener?.focus({preventScroll:true});},{once:true});d.showModal();
 }
 function rememberPuzzle(){state.undo.push(structuredClone(state.puzzle));if(state.undo.length>50)state.undo.shift();}
 function puzzleControls(){
  const extra=[];undoButton=button(T('sUndo'),()=>{if(!usable()||!state.undo.length)return;state.puzzle=state.undo.pop();selected=-1;renderPuzzle();});undoButton.dataset.shortcutAction='undo';extra.push(undoButton);
  cancelSelectionButton=button(T('uxPuzzleUnselect'),()=>{selected=-1;renderPuzzle();});extra.push(cancelSelectionButton);
  rotateButton=null;if(config.rotate){rotateButton=button(T('miniTurn'),()=>{if(!usable()||selected<0)return;rememberPuzzle();state.puzzle=puzzleMove(state.puzzle,selected,selected,true);renderPuzzle();if(puzzleSolved(state.puzzle)){run.score++;complete();}});rotateButton.dataset.miniRotate='';extra.push(rotateButton);}
  if(config.reference)extra.push(button(T('miniReference'),reference));controls(extra);
 }
 function end(won=false,reason=''){
  if(!run||run.ended)return;pauseLayer.hidden=true;run.ended=true;cancel();setCue('');board.inert=true;board.setAttribute('aria-disabled','true');
  result.replaceChildren(el('h2','',T(won?'miniWon':reason==='time'?'uxMiniTimeUp':reason==='lives'?'uxMiniNoLives':'miniOver')),el('p','',T('miniScore',run.score)));
  if(state.teams)result.append(el('p','',state.teams.map((n,i)=>n+': '+state.scores[i]).join(' · ')));
  result.append(button(T('miniAgain'),()=>shell.start({restart:true}),'button primary'));result.hidden=false;result.className='mini-result '+(won?'mini-win':'');result.tabIndex=-1;result.focus();stats();updateControls();
 }
 function next(){if(!run||run.ended)return;pauseLayer.hidden=true;generation++;shell.note('');if(run.round+1>=config.rounds){end(true);return;}run.round++;run.hints=0;run.paused=0;paused=false;run.deadline=config.seconds?Date.now()+config.seconds*1000:0;result.hidden=true;renderRound();stats();updateControls();}
 function complete(){sound();if(run.round+1>=config.rounds){end(true);return;}pauseRun(run);paused=true;setCue('');result.replaceChildren(el('h2','',T('miniCorrect')),button(T('miniNext'),next,'button primary'));result.hidden=false;result.tabIndex=-1;result.focus();stats();updateControls();}
 const hint=()=>{if(!usable()||observing||run.hints>=config.hints)return;run.hints++;sound();if(config.kind==='puzzle'){state.undo=[];selected=state.puzzle.tiles.findIndex((n,i)=>n!==i||state.puzzle.angles[i]!==0);if(selected>=0){const wanted=state.puzzle.tiles.indexOf(selected);state.puzzle=puzzleMove(state.puzzle,selected,wanted);state.puzzle.angles[selected]=0;selected=-1;renderPuzzle();if(puzzleSolved(state.puzzle)){run.score++;complete();}}}
 else if(config.kind==='differences'){const i=state.spots.findIndex((_,j)=>!state.found.includes(j));if(i>=0){state.found.push(i);renderDifferences();if(state.found.length===state.spots.length){run.score++;complete();}}}
 else if(config.kind==='sequence'){showSequence();}
 else if(config.kind==='reveal')shell.note(item().hint||item().answer.slice(0,1));
 stats();updateControls();};
 function picture(node,record){if(record.image){const img=el('img');img.src=pictureURL(record.image);img.alt=record.label;node.append(img);}else node.append(el('span','',record.label));}
 function togglePause(){if(!run||run.ended||!result.hidden)return;if(paused){paused=false;board.inert=false;if(config.kind==='sequence')showSequence();else resumeRun(run);}else{pauseRun(run);paused=true;generation++;board.inert=true;board.querySelectorAll('.is-lit').forEach(n=>n.classList.remove('is-lit'));}pauseLayer.hidden=!paused;const b=bar.querySelector('[data-shortcut-action=pause]');if(b)b.textContent=T(paused?'miniResume':'miniPause');stats();updateControls();}
 shell.root.querySelector('#mini-stage').addEventListener('focus-menu-opening',()=>{if(usable())togglePause();});
 function controls(extra=[]){
  bar.replaceChildren();const pause=button(T(paused?'miniResume':'miniPause'),togglePause);pause.dataset.shortcutAction='pause';bar.append(pause);hintButton=null;
  if(['puzzle','differences','sequence','reveal'].includes(config.kind)){hintButton=button(T('miniHint',Math.max(0,config.hints-run.hints)),hint);hintButton.dataset.shortcutAction='hint';bar.append(hintButton);}
  const stop=button(T('miniStop'),()=>end());stop.dataset.miniStop='';bar.append(...extra,stop);updateControls();
 }
 function renderPuzzle(){
  const focus=board.querySelector(':focus')?.dataset.piece;board.replaceChildren();board.className='mini-board mini-puzzle';board.style.setProperty('--mini-cols',config.cols);board.style.aspectRatio='4 / 3';const p=state.puzzle;
  p.tiles.forEach((v,i)=>{const b=button('',()=>swap(i),'mini-piece'+(selected===i?' is-selected':'')),face=el('span');b.ariaLabel=T('uxPuzzlePiece',i+1);b.dataset.piece=i;b.setAttribute('aria-pressed',String(selected===i));b.draggable=true;face.style.backgroundImage='url("'+pictureURL(item().image)+'")';face.style.backgroundSize=(config.cols*100)+'% '+(config.rows*100)+'%';face.style.backgroundPosition=(v%config.cols)/(config.cols-1)*100+'% '+Math.floor(v/config.cols)/(config.rows-1)*100+'%';face.style.transform='rotate('+p.angles[i]*90+'deg)';b.append(face);
   b.ondragstart=e=>{if(!usable()){e.preventDefault();return;}selected=i;e.dataTransfer.setData('text/plain',String(i));};b.ondragend=()=>{if(usable())renderPuzzle();};b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const value=e.dataTransfer.getData('text/plain'),from=Number(value);if(usable()&&value!==''&&Number.isInteger(from)&&from>=0&&from<p.tiles.length){selected=from;swap(i);}};board.append(b);
  });
  setCue(T(selected<0?'uxPuzzleChoose':'uxPuzzleSelected',selected+1),T('miniMoves',p.moves)+' · '+T(selected<0?'miniPieces':'uxPuzzleSelectedHelp'));shell.note('');updateControls();if(focus!==undefined)board.querySelector('[data-piece="'+focus+'"]')?.focus({preventScroll:true});
 }
 function swap(i){if(!usable())return;if(selected<0){selected=i;renderPuzzle();board.querySelector('[data-piece="'+i+'"]')?.focus({preventScroll:true});return;}if(selected===i){selected=-1;renderPuzzle();return;}rememberPuzzle();state.puzzle=puzzleMove(state.puzzle,selected,i);selected=-1;sound();renderPuzzle();board.querySelector('[data-piece="'+i+'"]')?.focus({preventScroll:true});if(puzzleSolved(state.puzzle)){run.score++;complete();}}
 function renderReveal(){board.className='mini-board mini-reveal';const frame=el('div','mini-reveal-picture'),img=el('img');img.src=pictureURL(item().image);img.alt=T('reveal');frame.append(img);board.append(frame);state.revealImage=img;state.cover=el('div','mini-cover');state.cover.style.setProperty('--mini-cols',6);if(config.revealStyle==='tiles'){for(let i=0;i<36;i++)state.cover.append(el('span'));frame.append(state.cover);state.order=shuffle(Array.from({length:36},(_,i)=>i));}else img.style.filter='blur(30px)';state.revealed=0;state.lastReveal=Date.now();const f=el('form','mini-guess'),answer=input('text','',{maxlength:300,autocomplete:'off'}),submit=el('button','button primary',T('miniSubmit'));submit.type='submit';f.append(labelled(T('miniAnswer'),answer),submit);f.onsubmit=e=>{e.preventDefault();if(!usable())return;if(answersMatch(answer.value,item().answer)){run.score++;complete();}else{sound(false);shell.note(T('miniWrong'));}};board.append(f);
  controls([button(T('miniAccept'),()=>{if(usable()){run.score++;complete();}}),button(T('miniRevealAnswer'),()=>{if(usable()){pauseRun(run);paused=true;result.replaceChildren(el('h2','',item().answer),button(T('miniNext'),next,'button primary'));result.hidden=false;}})]);
 }
 function labelled(t,f){const l=el('label','tool-field');l.append(el('span','',t),f);return l;}
 function tickReveal(){if(config.kind!=='reveal'||Date.now()-state.lastReveal<config.speed*1000)return;state.lastReveal=Date.now();if(config.revealStyle==='tiles'){const cell=state.cover.children[state.order[state.revealed++]];if(cell)cell.style.visibility='hidden';}else{state.revealed++;state.revealImage.style.filter='blur('+Math.max(0,30-state.revealed*3)+'px)';}}
 function renderSequence(){
  board.className='mini-board mini-pattern';board.style.setProperty('--mini-cols',Math.min(4,state.choices.length));board.replaceChildren();
  state.choices.forEach((record,i)=>{const b=button('',()=>{
   if(!usable()||observing)return;
   if(i!==state.sequence[state.input]){state.lives--;sound(false);if(state.lives<=0)end(false,'lives');else showSequence();return;}
   state.input++;sound();b.animate([{opacity:.35},{opacity:1}],{duration:180});
   if(state.input===state.sequence.length){run.score++;state.sequence=growSequence(state.sequence,state.choices.length);complete();}
   else setCue(T('miniRepeat'),T('uxSequenceProgress',state.input,state.sequence.length)+' · '+T('miniLives',state.lives));
  },'mini-choice');picture(b,record);b.ariaLabel=record.label;board.append(b);});void showSequence();
 }
 async function showSequence(){
  const gen=++generation;observing=true;state.input=0;pauseRun(run);updateControls();stats();setCue(T('miniObserve'),T('uxSequenceWatching',state.sequence.length)+' · '+T('miniLives',state.lives));shell.note('');
  for(const b of board.children){b.disabled=true;b.classList.remove('is-lit');}
  const delay=ms=>new Promise(r=>setTimeout(r,ms));await delay(350);
  for(const n of state.sequence){
   if(gen!==generation||!usable())return;const b=board.children[n];b.classList.add('is-lit');sound();await delay(config.speed*700);
   if(gen!==generation||!usable())return;b.classList.remove('is-lit');await delay(config.speed*300);
  }
  if(gen!==generation||!usable())return;observing=false;resumeRun(run);for(const b of board.children)b.disabled=false;
  setCue(T('miniRepeat'),T('uxSequenceProgress',0,state.sequence.length)+' · '+T('miniLives',state.lives));updateControls();stats();
 }
 function renderReaction(){board.className='mini-board mini-pattern';board.style.setProperty('--mini-cols',config.grid);board.replaceChildren();state.reaction=reactionBoard(config.grid,config.reactionMode);if(config.reactionMode==='target'){state.reaction.values=state.reaction.values.map(()=>randomInt(config.items.length));state.reaction.target=state.reaction.values[randomInt(state.reaction.values.length)];}
  const r=state.reaction;const update=()=>{setCue(T('miniFind',config.reactionMode==='numbers'?r.target:config.items[r.target].label),T(config.reactionMode==='numbers'?'uxReactionNumbers':'uxReactionTarget'),config.reactionMode==='target'?config.items[r.target]:null);shell.note('');};update();r.values.forEach((v,i)=>{const b=button('',()=>{if(!usable())return;if(v===r.target){sound();run.score++;if(config.reactionMode==='target')complete();else{b.disabled=true;b.classList.add('is-done');r.target++;if(r.target>r.values.length)complete();else update();}}else{run.score-=config.penalty;sound(false);b.animate([{background:'#f9b3a2'},{background:'white'}],{duration:350});}stats();},'mini-choice');if(config.reactionMode==='numbers'){b.textContent=v;b.ariaLabel=String(v);}else{picture(b,config.items[v]);b.ariaLabel=config.items[v].label;}board.append(b);});
 }
 function renderDifferences(){board.className='mini-board mini-differences';board.replaceChildren();for(const key of ['image','image2']){const frame=el('div','mini-spot-editor'),img=el('img');img.src=pictureURL(item()[key]);img.alt=T('differences');frame.append(img);img.onclick=e=>{if(!usable())return;const b=img.getBoundingClientRect(),i=hitSpot(state.spots,100*(e.clientX-b.left)/b.width,100*(e.clientY-b.top)/b.height,state.found);if(i<0){sound(false);run.score-=config.penalty;stats();return;}state.found.push(i);run.score++;sound();renderDifferences();if(state.found.length===state.spots.length)complete();};for(const i of state.found){const p=state.spots[i],mark=el('span','mini-spot',String(i+1));mark.style.left=p.x+'%';mark.style.top=p.y+'%';mark.style.width=p.r*2+'%';mark.style.height=p.r*2+'%';frame.append(mark);}board.append(frame);}shell.note(T('miniSpots',state.found.length,state.spots.length));}
 function renderCharades(){board.className='mini-board mini-charades';board.replaceChildren();const team=run.round%state.teams.length;const record=config.items[state.deck[state.card]];if(!record){shell.note(T('miniDeckEnd'));end(true);return;}board.append(el('h2','',T('miniTeamTurn',state.teams[team])));const prompt=el('div','mini-prompt'),show=button(T('miniShowCard'),()=>{prompt.hidden=!prompt.hidden;show.textContent=T(prompt.hidden?'miniShowCard':'miniHideCard');});prompt.hidden=true;prompt.append(el('h3','',record.answer||record.label));if(record.taboo)prompt.append(el('p','',T('miniTaboo',record.taboo)));if(record.image)picture(prompt,record);board.append(show,prompt);
  const success=button(T('miniAccept'),()=>{if(!usable())return;run.score+=config.points;state.scores[team]+=config.points;state.card++;sound();renderCharades();stats();},'button primary');const skip=button(T('miniSkip',config.skips-state.skips),()=>{if(!usable()||state.skips>=config.skips)return;state.skips++;state.card++;renderCharades();});skip.disabled=state.skips>=config.skips;board.append(success,skip);controls([button(T('miniNext'),next)]);shell.note(state.teams.map((n,i)=>n+': '+state.scores[i]).join(' · '));
 }
 function renderDrawing(){board.className='mini-board mini-practice-drawing';board.replaceChildren();const record=item(),prompt=el('p','mini-prompt',record.answer||record.label);prompt.hidden=true;const show=button(T('miniShowCard'),()=>{prompt.hidden=!prompt.hidden;show.textContent=T(prompt.hidden?'miniShowCard':'miniHideCard');show.setAttribute('aria-expanded',String(!prompt.hidden));});show.setAttribute('aria-expanded','false');show.classList.add('mini-drawing-prompt-toggle');board.append(show,prompt);const canvas=el('canvas','mini-canvas');canvas.width=800;canvas.height=500;const ctx=canvas.getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#294a3b';ctx.lineWidth=5;const tools=el('div','tool-row mini-drawing-tools'),color=input('color','#294a3b'),size=input('range',5,{min:1,max:30});color.oninput=()=>ctx.strokeStyle=color.value;size.oninput=()=>ctx.lineWidth=Number(size.value);tools.append(labelled(T('miniPen'),color),labelled(T('miniBrush'),size),button(T('miniClear'),()=>{if(usable())ctx.clearRect(0,0,800,500);}));board.append(tools,canvas);let drawing=false;const point=e=>{const r=canvas.getBoundingClientRect();return[(e.clientX-r.left)*800/r.width,(e.clientY-r.top)*500/r.height];};canvas.onpointerdown=e=>{if(!usable())return;e.preventDefault();drawing=true;canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));};canvas.onpointermove=e=>{if(drawing&&usable()){ctx.lineTo(...point(e));ctx.stroke();}};canvas.onpointerup=canvas.onpointercancel=()=>drawing=false;const answer=input('text','',{maxlength:300}),guess=el('form','mini-guess mini-drawing-answer'),submit=button(T('miniSubmit'),()=>{guess.requestSubmit();});guess.append(labelled(T('miniAnswer'),answer),submit);board.append(guess);guess.onsubmit=e=>{e.preventDefault();if(!usable())return;if(answersMatch(answer.value,record.answer||record.label)){run.score+=config.points;complete();}else{sound(false);shell.note(T('miniWrong'));}};controls([button(T('miniAccept'),()=>{if(usable()){run.score+=config.points;complete();}})]);
 }
 function renderRound(){setCue('');board.replaceChildren();board.inert=false;selected=-1;controls();if(config.kind==='puzzle'){state.undo=[];state.puzzle=puzzleStart(config.rows,config.cols,config.rotate);renderPuzzle();puzzleControls();}
  else if(config.kind==='reveal')renderReveal();
  else if(config.kind==='sequence')renderSequence();
  else if(config.kind==='reaction')renderReaction();
  else if(config.kind==='differences'){state.spots=item().spots;state.found=[];renderDifferences();}
  else if(config.kind==='charades'){state.skips=0;renderCharades();}
  else renderDrawing();
 }
 shell.onStart(async(c,{restart=false}={})=>{
  const plan=miniSettingsPlan(config,c),valid=plan.config.items;
  if(run&&!restart&&!plan.restart){
   config=plan.config;appearance();if(config.kind==='puzzle')puzzleControls();updateControls();shell.note(T(paused?'uxMiniAppliedPaused':'uxMiniApplied'));return;
  }
  if(run&&!run.ended&&!confirm(T(plan.restart?'uxMiniRulesRestart':'miniRestartAsk')))return false;
  cancel();shell.note('');config=plan.config;run=makeRun(config);paused=false;observing=false;state={};undoButton=null;rotateButton=null;cancelSelectionButton=null;
  if(c.kind==='sequence'){state.choices=valid.slice(0,16);state.sequence=[];for(let i=0;i<c.startLength;i++)state.sequence=growSequence(state.sequence,state.choices.length);state.lives=c.lives;}
  if(c.kind==='charades'){state.teams=c.teams.split('\n').map(s=>s.trim()).filter(Boolean);if(!state.teams.length)state.teams=['A','B'];state.scores=state.teams.map(()=>0);state.deck=charadeDeck(valid);state.card=0;state.skips=0;}
  shell.stage.replaceChildren();appearance();const summary=el('div','mini-summary');points=el('strong');turn=el('span');clock=el('span');summary.append(points,turn,clock);cue=el('div','mini-task-cue');cue.setAttribute('role','status');cue.setAttribute('aria-live','polite');cue.hidden=true;
  content=el('div','mini-play-area');board=el('div');result=el('div','mini-result');result.hidden=true;pauseLayer=el('div','mini-pause-layer');pauseLayer.hidden=true;pauseLayer.append(el('h2','',T('focusPaused')),el('p','',T('focusPausedHint')),button(T('miniResume'),togglePause,'button primary'));content.append(board,result,pauseLayer);bar=el('div','tool-row mini-controls');shell.root.classList.add('is-mini-playing');shell.stage.append(summary,cue,content,bar);renderRound();stats();
  timer=setInterval(()=>{if(!usable())return;stats();if(runRemaining(run)===0){if(config.kind==='charades')next();else end(false,'time');}else tickReveal();},150);shell.root.querySelector('#mini-stage').scrollIntoView({behavior:'smooth',block:'start'});
 });

}
