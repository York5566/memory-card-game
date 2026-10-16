// Pure presentation rules; zoom never changes room configuration or card order.
export function resultOutcome(view) {
  if (!view.startedAt) return 'cancelled';
  return view.winner === null ? 'draw' : view.winner === view.seat ? 'win' : 'loss';
}
export function fitPKBoard({width,height,count,ratio=0.8,gap=12,zoom=1,columns=0}) {
  width=Math.max(80,width); height=Math.max(80,height); ratio=Math.max(.1,Math.min(10,ratio));
  let best={size:0,columns:2,rows:Math.ceil(count/2)};
  const choices=columns ? [Math.max(2,Math.min(count,columns))] : Array.from({length:Math.max(2,Math.min(8,count,Math.floor((width+gap)/(58+gap))))-1},(_,i)=>i+2);
  for(const cols of choices) {
    const rows=Math.ceil(count/cols), size=Math.min((width-(cols-1)*gap)/cols, (height-(rows-1)*gap)*ratio/rows);
    if(size>best.size)best={size,columns:cols,rows};
  }
  const scale=Math.max(.6,Math.min(2,zoom)), cardWidth=Math.max(58,Math.min(280,best.size))*scale;
  // Round down so fractional pixels cannot create a scrollbar at exact-fit sizes.
  const roundedWidth=Math.floor(cardWidth*10)/10, cardHeight=Math.max(64,Math.floor(roundedWidth/ratio*10)/10);
  return {columns:best.columns,cardWidth:roundedWidth,cardHeight,width:best.columns*roundedWidth+(best.columns-1)*gap,height:best.rows*cardHeight+(best.rows-1)*gap};
}
export function matchedOwner(view,index) {
  const owner=view.cardOwners?.[index];
  return view.matched.includes(index) && (owner===0 || owner===1) ? owner : null;
}
export function waitingCopy(phase,intent) {
  if(phase==='queue'||phase==='handoff') return ['正在尋找你的對手','配對成功會有提示音，請保持頁面開啟。','取消配對'];
  if(intent==='create') return ['正在建立邀請房間','房間建立後，將顯示可分享給朋友的連結。','返回準備畫面'];
  if(intent==='join') return ['正在加入朋友的房間','連線完成後，先確認規則，再按準備。','返回準備畫面'];
  return ['正在連線','請稍候，正在確認連線狀態。','返回準備畫面'];
}
export function roomEvents(previous,next) {
  const events=[],peer=1-next.seat,sameRound=previous?.round===next.round;
  if(next.players[peer]&&!previous?.players[peer])events.push('found');
  if(['preview','playing'].includes(next.state)&&previous&&(previous.state==='lobby'||!sameRound))events.push('start');
  if(next.state==='playing'&&!next.settleAt&&(!previous||!sameRound||previous.state!=='playing'||previous.turn!==next.turn))events.push(next.turn===next.seat?'your-turn':'their-turn');
  if(next.rematchClosed&&!next.connected[peer]&&!previous?.rematchClosed)events.push('left');
  else if(previous?.connected[peer]&&!next.connected[peer]&&next.players[peer])events.push('offline');
  if(next.state==='ended'&&sameRound&&next.rematch?.[peer]&&!previous?.rematch?.[peer])events.push('rematch');
  return events;
}
