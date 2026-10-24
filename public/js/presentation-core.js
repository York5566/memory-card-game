import { bingoLines, tournamentMatches, standings, quizScores } from './play-core.js';
import { formatDuration, tickTimer } from './activity-core.js';
// Deliberately return audience data only; unrevealed answers and future questions never leave the host.
export function audienceView(c,s,T){
 const view={kind:c.kind,title:c.title||T(c.kind),background:c.background||'#f0f5ec',accent:c.accent||'#47715d',scale:c.scale||100,blocks:[]};
 const name=i=>c.teams[i].name||T('team',i+1),text=(value,large=false)=>view.blocks.push({type:'text',value,large});
 if(c.kind==='scoreboard'){view.blocks.push({type:'scores',rows:c.teams.map((t,i)=>({name:name(i),score:s.scores[i],color:t.color,members:c.showMembers?t.members:[]}))});}
 else if(c.kind==='timer'){const now=tickTimer(c,s,Date.now());text(c.phases[now.index].name||T('phase',now.index+1));text(formatDuration(now.remaining),true);text(T('cycleProgress',now.cycle+1,c.cycles));}
 else if(c.kind==='picker'){text((s.rounds.at(-1)||[]).map(x=>x.name).join(' · ')||T('readyPicker'),true);}
 else if(c.kind==='groups'){view.blocks.push({type:'scores',rows:s.teams.map((team,i)=>({name:c.teamNames.split(/\r?\n/)[i]?.trim()||T('team',i+1),score:'',members:team.map(x=>x.name),color:'#47715d'}))});}
 else if(c.kind==='bingo'&&s){const card=s.cards[s.selected],lines=bingoLines(c,card,s.called);text(T('cardNumber',s.selected+1));text(s.called.length?c.items[s.called.at(-1)].label:T('readyPlay'),true);view.blocks.push({type:'grid',size:c.size,cells:card.map(i=>({text:i<0?T('bingoFree'):c.items[i].label,image:i<0?'':c.items[i].image,marked:i<0||s.called.includes(i)}))});text(T('bingoStatus',s.called.length,lines.length,c.winLines));if(lines.length>=c.winLines)text(T('bingoWin'),true);}
 else if(c.kind==='tournament'&&s){const matches=tournamentMatches(c,s);view.blocks.push({type:'list',rows:matches.map(m=>T('roundLabel',m.round+1)+' · '+(m.a===null?T('pendingMatch'):name(m.a))+' / '+(m.b===null?(m.bye?T('bye'):T('pendingMatch')):name(m.b))+(m.result?' · '+m.result.sa+' : '+m.result.sb:''))});if(c.format==='knockout'&&matches.at(-1)?.result)text(T('champion',name(matches.at(-1).winner)),true);if(c.format==='roundRobin')view.blocks.push({type:'scores',rows:standings(c,s).map(r=>({name:name(r.id),score:r.points,color:c.teams[r.id].color,members:[]}))});}
 else if(c.kind==='quiz'&&s){const q=c.questions[s.index];text(T('question',s.index+1)+' / '+c.questions.length);text(q.prompt,true);if(q.image)view.blocks.push({type:'image',src:q.image});if(q.seconds)text(formatDuration(s.clock.remaining),true);text(s.revealed.includes(s.index)?T('answer')+': '+q.answer:T('hiddenAnswer'));view.blocks.push({type:'scores',rows:quizScores(c,s).map((score,i)=>({name:name(i),score,color:c.teams[i].color,members:[]}))});}
 else text(T('readyPlay'));
 return view;
}
