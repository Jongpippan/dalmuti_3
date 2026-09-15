(()=>{
const DIFFICULTY_LABELS={easy:'쉬움',normal:'보통',hard:'어려움'};
const DIFFICULTY_HELP={easy:'답 후보가 많은 초성 위주',normal:'답 후보가 중간 정도인 초성',hard:'답 후보가 적은 초성 위주'};
const qs=s=>document.querySelector(s);
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function currentState(){try{return state}catch{return null}}

function difficultyPanelHtml(s,where='lobby'){
 const host=s.viewerId===s.room.hostId,current=s.room.wordDifficulty||'normal';
 return `<div class="wordDifficultyPanel ${where==='game'?'compact':''}"><div><strong>초성 난이도</strong><small>${DIFFICULTY_HELP[current]||''}${where==='game'?' · 변경 시 다음 게임부터 적용':''}</small></div><select class="wordDifficultySelect" ${host?'':'disabled'}><option value="easy" ${current==='easy'?'selected':''}>쉬움</option><option value="normal" ${current==='normal'?'selected':''}>보통</option><option value="hard" ${current==='hard'?'selected':''}>어려움</option></select></div>`;
}
function bindDifficulty(root){
 const select=root?.querySelector('.wordDifficultySelect');if(!select||select.disabled)return;
 select.onchange=async()=>{await act('set-word-difficulty',{difficulty:select.value})};
}
function applyDifficultyControls(s){
 let lobby=qs('#wordDifficultyLobby');
 if(!s.room.started&&s.room.selectedGame==='choseong'){
  if(!lobby){lobby=document.createElement('div');lobby.id='wordDifficultyLobby';qs('#gameRequirement')?.insertAdjacentElement('afterend',lobby)}
  lobby.innerHTML=difficultyPanelHtml(s,'lobby');bindDifficulty(lobby);
 }else lobby?.remove();

 let game=qs('#wordDifficultyGame');
 if(s.room.started&&s.room.gameType==='choseong'){
  if(!game){game=document.createElement('div');game.id='wordDifficultyGame';game.className='wordDifficultyHead';qs('.headActions')?.insertBefore(game,qs('#restartWordGame'))}
  game.innerHTML=difficultyPanelHtml(s,'game');bindDifficulty(game);
 }else game?.remove();
}

function applyWordHints(s){
 const g=s.wordGame;if(!g)return;
 const revealing=!!g.reveal&&Date.now()<Number(g.reveal.until||0);
 if(s.room.gameType==='choseong'&&!revealing){
  const label=DIFFICULTY_LABELS[g.difficulty||s.room.wordDifficulty||'normal'];
  const promptLabel=qs('#wordPromptLabel');if(promptLabel)promptLabel.textContent=`이번 초성 · ${g.roundNumber||1}라운드 · ${label}`;
 }
 if(s.room.gameType==='wordchain'&&!revealing&&g.lastWord){
  const starts=Array.isArray(g.requiredStarts)?g.requiredStarts:[];
  if(starts.length){
   const last=[...g.lastWord].at(-1),guide=starts.map(x=>`'${x}'`).join(' 또는 '),helper=qs('#wordLastWord');
   if(helper)helper.textContent=starts.length>1?`끝 글자 '${last}' · 두음법칙 적용: ${guide}(으)로 시작하세요.`:`끝 글자 '${last}' · ${guide}(으)로 시작하세요.`;
   const inp=qs('#wordInput');if(inp&&!inp.disabled)inp.placeholder=`${starts.join('/')}로 시작하는 단어`;
  }
 }
}

function applyHistoryVisibility(){
 document.querySelectorAll('.wordHistoryItem').forEach(row=>{
  const name=row.querySelector('strong'),result=row.querySelector('span');if(!name||!result)return;
  const color=getComputedStyle(result).color;
  name.style.setProperty('color',color,'important');
  name.style.setProperty('font-weight','800','important');
 });
}

function applyWordPlayerAccent(){
 document.querySelectorAll('#players .wordPlayer[data-player-id]').forEach(card=>{
  const id=card.dataset.playerId,color=window.dalmutiPlayerColor?.(id);if(!color)return;
  card.style.setProperty('--player-accent',color.accent);card.style.setProperty('--player-bg',color.bg);
 });
}

function updateAutoRestartText(s=currentState()){
 if(!s?.wordGame||s.wordGame.status!=='finished'||!s.room.wordAutoRestartAt)return;
 const left=Math.max(0,Number(s.room.wordAutoRestartAt)-Date.now()),sec=Math.ceil(left/1000),el=qs('#wordTurnStatus');
 if(el)el.textContent=`${sec}초 후 같은 게임이 자동으로 다시 시작됩니다.${s.viewerId===s.room.hostId?' · 새로 시작 버튼으로 즉시 시작 가능':''}`;
}

async function enhancedLoadRooms(){
 try{
  const r=await fetch('/api/rooms',{cache:'no-store'}),j=await r.json();if(!j.ok)throw Error();const box=qs('#roomList');if(!box)return;
  if(!j.rooms.length){box.innerHTML='<div class="emptyRooms">현재 열린 방이 없습니다.</div>';return}
  box.innerHTML=j.rooms.map(x=>{
   const names=(x.humanNames||[]).map(escapeHtml).join(', ')||'사람 없음';
   const bots=Number(x.botCount||0),members=`${names}${bots?` · 봇 ${bots}명`:''}`;
   return `<div class="roomItem"><div><strong>${escapeHtml(x.code)}</strong><span>${x.count} / ${x.maxPlayers}명 · ${escapeHtml(x.gameName||'게임')} · ${x.started?'게임 중':'대기 중'}</span><small class="roomParticipants">${members}</small></div><button class="tiny" data-room="${escapeHtml(x.code)}" ${x.joinable?'':'disabled'}>${x.joinable?'참가':'가득 참'}</button></div>`
  }).join('');
  box.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>joinCode(b.dataset.room));
 }catch{const box=qs('#roomList');if(box)box.innerHTML='<div class="emptyRooms">방 목록을 불러오지 못했습니다.</div>'}
}

function apply(s){applyDifficultyControls(s);applyWordHints(s);applyHistoryVisibility();applyWordPlayerAccent();updateAutoRestartText(s)}
const baseRender=window.render;
if(typeof baseRender==='function')window.render=function(s){baseRender(s);requestAnimationFrame(()=>apply(s))};
window.loadRooms=enhancedLoadRooms;try{loadRooms=enhancedLoadRooms}catch{}
const refresh=qs('#refreshRooms');if(refresh)refresh.onclick=enhancedLoadRooms;
setInterval(()=>updateAutoRestartText(),250);
if(!qs('#home')?.classList.contains('hidden'))enhancedLoadRooms();
})();
