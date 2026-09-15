(()=>{
const META={
 dalmuti:{name:'대 달무티',icon:'♛',desc:'계급이 뒤집히는 4–8인 카드게임',min:4,max:8},
 choseong:{name:'초성게임',icon:'ㄱ',desc:'한 초성으로 돌아가며 겹치지 않는 단어를 내는 생존전',min:2,max:20},
 wordchain:{name:'끝말잇기',icon:'끝',desc:'앞 단어의 마지막 글자로 이어가는 생존전',min:2,max:20}
};
const originalGame=game;
const originalLoadRooms=loadRooms;
const originalLeaveConfirmMessage=leaveConfirmMessage;
const originalKickPlayer=kickPlayer;

function gameCard(type,selectedType,disabled=false){const m=META[type];return `<button type="button" class="gameChoice ${selectedType===type?'selected':''}" data-game-type="${type}" ${disabled?'disabled':''}><span class="gameChoiceIcon">${m.icon}</span><span><strong>${m.name}</strong><small>${m.desc}</small><em>${m.min}–${m.max}명 · 봇 포함</em></span></button>`}
function closeDialog(){const d=$('#gameSwitchDialog');if(!d)return;if(d.open)d.close();else d.classList.add('hidden')}
function bindPicker(root,s,mode='select'){
 if(!root)return;const host=s.viewerId===s.room.hostId,selectedType=mode==='switch'?s.room.gameType:s.room.selectedGame,count=s.room.players.length;
 root.innerHTML=Object.keys(META).map(type=>gameCard(type,selectedType,!host||count>META[type].max)).join('');
 if(!host)return;
 root.querySelectorAll('[data-game-type]').forEach(b=>b.onclick=async()=>{
  const type=b.dataset.gameType;
  if(mode==='switch'){
   const same=type===s.room.gameType;
   if(same&&s.wordGame?.status!=='finished'){closeDialog();return}
   const message=same?`${META[type].name}을(를) 새 게임으로 다시 시작할까요?`:`진행 중인 게임을 종료하고 ${META[type].name}(으)로 바로 바꿀까요?`;
   if(!confirm(message))return;
   if(await act('switch-game',{gameType:type}))closeDialog();
  }else await act('select-game',{gameType:type});
 });
}
function setMode(type){
 document.querySelectorAll('.dalmutiOnly').forEach(el=>el.classList.toggle('hidden',type!=='dalmuti'));
 $('#wordGameArea')?.classList.toggle('hidden',type==='dalmuti');
 if($('#currentGameBadge'))$('#currentGameBadge').textContent=META[type]?.name||'게임';
 const change=$('#changeGame');if(change)change.classList.toggle('hidden',state?.viewerId!==state?.room?.hostId);
 if(type!=='dalmuti'){
  const root=$('#game');root?.classList.remove('myTurn','taxPhase','myTaxTurn','dalmutiFlash');
  $('#waitingPlayersPanel')?.remove();$('#turnTimer')?.classList.add('hidden');
 }
}
function multiLobby(s){
 show('lobby');const host=s.viewerId===s.room.hostId,type=s.room.selectedGame||'dalmuti',meta=META[type],count=s.room.players.length;
 $('#code').textContent=s.room.code;$('#count').textContent=`${count}명 / 최대 ${s.room.maxPlayers}명`;
 $('#lobbyPlayers').innerHTML=s.room.players.map((p,i)=>`<div class="person"><span>${i+1}. ${esc(p.name)}${p.id===s.room.hostId?' 👑':''}${p.bot?' · 봇':''}</span><span>${p.connected?'접속':'끊김'}${host&&!p.bot&&p.id!==s.viewerId?` <button class="tiny" data-kick="${p.id}" data-name="${esc(p.name)}">강퇴</button>`:''}</span></div>`).join('');
 bindPicker($('#lobbyGamePicker'),s,'select');
 $('#selectedGameName').textContent=meta.name;
 const eligible=count>=meta.min&&count<=meta.max;
 $('#gameRequirement').textContent=type==='dalmuti'?`달무티는 4–8명이 필요합니다. 현재 ${count}명입니다.`:`단어 게임은 사람/봇 합계 2–20명이 필요합니다. 현재 ${count}명입니다.`;
 $('#lobbyRules').innerHTML=rulePanel(s,'lobby');$('#lobbyRules').classList.toggle('gameTypeHidden',type!=='dalmuti');bindRulePanel($('#lobbyRules'));
 $('#start').classList.toggle('hidden',!host);$('#start').disabled=!eligible;$('#start').textContent=`${meta.name} 시작`;bindKickButtons();
}
function wordGame(s){
 show('game');setMode(s.room.gameType);
 const g=s.wordGame,host=s.viewerId===s.room.hostId,meta=META[s.room.gameType],cur=g.players.find(p=>p.id===g.currentPlayerId),myTurn=g.status==='playing'&&g.currentPlayerId===s.viewerId;
 $('#handNo').textContent=s.room.gameType==='choseong'?`${g.roundNumber||1}라운드 · ${g.turnNumber}턴`:`${g.turnNumber}턴`;
 $('#phase').textContent=g.status==='finished'?'게임 종료':meta.name;$('#roomBadge').textContent=s.room.code;
 const winner=g.players.find(p=>p.id===g.winnerId);
 $('#players').innerHTML=g.players.map(p=>`<div class="player wordPlayer ${p.id===g.currentPlayerId?'turn':''} ${p.id===s.viewerId?'me':''} ${p.eliminated?'eliminated':''}" data-player-id="${p.id}"><div class="wordRole">${p.eliminated?'탈락':`점수 ${p.score}`}</div><div class="pname">${esc(p.name)}${p.id===s.viewerId?' (나)':''}${p.bot?' · 봇':''}</div><div class="pmeta"><span class="lives">${'♥'.repeat(p.lives)}${'♡'.repeat(Math.max(0,(p.maxLives||3)-p.lives))}</span>${p.connected?'':' · 연결 끊김'}</div>${host&&!p.bot&&p.id!==s.viewerId&&s.room.players.some(x=>x.id===p.id)?`<button class="tiny" data-kick="${p.id}" data-name="${esc(p.name)}">강퇴</button>`:''}</div>`).join('')+s.room.players.filter(p=>p.waiting).map(p=>`<div class="player waiting"><div class="role">다음 게임 참가</div><div class="pname">${esc(p.name)}${p.bot?' · 봇':''}</div></div>`).join('');
 bindKickButtons();

 const isChoseong=s.room.gameType==='choseong';
 const required=g.lastWord?[...g.lastWord].at(-1):null;
 const promptLabel=isChoseong?`이번 초성 · ${g.roundNumber||1}라운드`:'직전 단어';
 const promptValue=isChoseong?g.prompt:(g.lastWord||'자유 시작');
 $('#wordPromptLabel').textContent=promptLabel;$('#wordPrompt').textContent=promptValue;
 $('#wordLastWord').textContent=isChoseong
  ? `같은 초성으로 겹치지 않게 이어갑니다 · 남은 단어 ${Number(g.roundRemainingWords||0).toLocaleString()}개`
  : (g.lastWord?`끝 글자 '${required}'(으)로 시작하는 단어를 입력하세요.`:'첫 단어는 자유롭게 시작하세요.');
 $('#wordTurnStatus').textContent=g.status==='finished'?`${winner?.name||'플레이어'} 승리!${host?' · 게임 바꾸기에서 같은 게임을 눌러 재시작할 수 있습니다.':''}`:myTurn?'내 차례입니다. 단어를 입력하세요.':`${cur?.name||''}님의 차례입니다.`;
 const inp=$('#wordInput'),submit=$('#wordSubmit');inp.disabled=!myTurn;submit.disabled=!myTurn;
 inp.placeholder=myTurn?(isChoseong?`${g.prompt} 단어 입력`:(required?`${required}(으)로 시작하는 단어`:'첫 단어 입력')):'내 차례를 기다리는 중';
 if(myTurn&&document.activeElement!==inp)setTimeout(()=>inp.focus(),0);

 $('#wordHistory').innerHTML=[...g.history].reverse().map(h=>{
  if(h.type==='word')return `<div class="wordHistoryItem"><strong>${esc(h.playerName)}</strong><span>${esc(h.word)}</span></div>`;
  if(h.type==='timeout')return `<div class="wordHistoryItem timeout"><strong>${esc(h.playerName)}</strong><span>시간 초과 · 목숨 ${h.lives}</span></div>`;
  if(h.type==='round')return `<div class="wordHistoryItem"><strong>${h.roundNumber}라운드</strong><span>${esc(h.prompt)} · ${h.reason==='exhausted'?'남은 단어 없음':'전원 연속 실패'}</span></div>`;
  return `<div class="wordHistoryItem timeout"><strong>${esc(h.playerName||'플레이어')}</strong><span>게임에서 나감</span></div>`;
 }).join('')||'<div class="wordHistoryEmpty">아직 제출된 단어가 없습니다.</div>';
 updateTimer();
}
function updateTimer(){
 const el=$('#wordTimer'),bar=$('#wordTimerBar');if(!el)return;
 if(!state?.wordGame||state.room.gameType==='dalmuti'){el.textContent='';return}
 const g=state.wordGame;if(g.status!=='playing'||!g.turnDeadline){el.textContent='종료';if(bar)bar.style.width='0%';return}
 const left=Math.max(0,g.turnDeadline-Date.now()),sec=Math.ceil(left/1000),pct=Math.max(0,Math.min(100,left/g.turnLimitMs*100));
 el.textContent=`${sec}초`;el.classList.toggle('urgent',sec<=5);if(bar)bar.style.width=`${pct}%`;
}
async function submitWord(){const inp=$('#wordInput'),word=inp?.value.trim();if(!word)return;if(await act('submit-word',{word}))inp.value=''}
async function multiLoadRooms(){
 try{
  const r=await fetch('/api/rooms',{cache:'no-store'}),j=await r.json();if(!j.ok)throw Error();const box=$('#roomList');if(!box)return;
  if(!j.rooms.length){box.innerHTML='<div class="emptyRooms">현재 열린 방이 없습니다.</div>';return}
  box.innerHTML=j.rooms.map(x=>`<div class="roomItem"><div><strong>${esc(x.code)}</strong><span>${x.count} / ${x.maxPlayers}명 · ${esc(x.gameName||META[x.gameType]?.name||'게임')} · ${x.started?'게임 중':'대기 중'}</span></div><button class="tiny" data-room="${x.code}" ${x.joinable?'':'disabled'}>${x.joinable?'참가':'가득 참'}</button></div>`).join('');
  box.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>joinCode(b.dataset.room));
 }catch{originalLoadRooms()}
}
render=function(s){
 playLogSounds(state,s);state=s;
 if(!s.room.started)multiLobby(s);
 else if(s.room.gameType==='dalmuti'){setMode('dalmuti');originalGame(s);setMode('dalmuti')}
 else wordGame(s);
 renderChat(s.room.chat||[]);
};
loadRooms=multiLoadRooms;
leaveConfirmMessage=function(){
 if(state?.room?.gameType!=='dalmuti')return state?.room?.started?'진행 중인 게임에서 나가면 이번 게임에서는 탈락 처리됩니다. 방에서 나갈까요?':'방에서 나갈까요?';
 return originalLeaveConfirmMessage();
};
kickPlayer=async function(id,name){
 if(state?.room?.gameType==='dalmuti')return originalKickPlayer(id,name);
 const msg=state?.room?.started?`${name}님을 강퇴하면 현재 단어 게임에서는 즉시 탈락 처리됩니다. 강퇴할까요?`:`${name}님을 방에서 강퇴할까요?`;
 if(confirm(msg))await act('kick-player',{targetPlayerId:id});
};
$('#wordForm')?.addEventListener('submit',e=>{e.preventDefault();submitWord()});
$('#changeGame')?.addEventListener('click',()=>{if(!state||state.viewerId!==state.room.hostId)return;bindPicker($('#switchGamePicker'),state,'switch');const d=$('#gameSwitchDialog');if(typeof d.showModal==='function')d.showModal();else d.classList.remove('hidden')});
$('#closeGameSwitch')?.addEventListener('click',closeDialog);
setInterval(updateTimer,100);
if(!session&&!$('#home').classList.contains('hidden'))multiLoadRooms();
})();
