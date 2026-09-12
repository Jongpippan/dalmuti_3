(()=>{
let q=false,lastDalmutiKey='',lastHandIds=new Set(),lastTaxHand=0;
function playerName(g,id){return g.players?.find(p=>p.id===id)?.name||''}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function taxText(g,s,cur){
 const p=g.tax?.pending,count=p?.count||1,upper=playerName(g,p?.upperId),lower=playerName(g,p?.lowerId);
 if(g.currentPlayerId===s.viewerId)return `세금 교환 · ${lower||'하위 플레이어'}의 광대를 제외한 최고 카드 ${count}장은 자동으로 정해졌습니다. 내 패에서 교환할 카드 ${count}장을 선택하세요.`;
 return `세금 교환 · ${lower||'하위 플레이어'}의 최고 카드 ${count}장은 자동 선택되었습니다. ${cur?.name||upper||'상위 플레이어'}이(가) 교환할 카드 ${count}장을 고르는 중입니다.`
}
function renderWaitingPlayers(s){
 const players=document.querySelector('#players');if(!players)return;
 players.querySelectorAll('.player.waiting').forEach(el=>el.remove());
 let panel=document.querySelector('#waitingPlayersPanel');
 const waiting=(s.room?.players||[]).filter(p=>p.waiting);
 if(!waiting.length){panel?.remove();return}
 if(!panel){panel=document.createElement('aside');panel.id='waitingPlayersPanel';panel.className='waitingPlayersPanel';players.insertAdjacentElement('afterend',panel)}
 panel.innerHTML=`<div class="waitingPlayersHead"><strong>다음 판 참가</strong><span>${waiting.length}명</span></div><div class="waitingPlayersList">${waiting.map(p=>`<div class="waitingPlayer ${p.id===s.viewerId?'me':''}"><span class="waitingDot"></span><span class="waitingName">${esc(p.name)}${p.id===s.viewerId?' · 나':''}</span><small>관전 중</small></div>`).join('')}</div>`
}
function flashReceivedCards(g,s){
 const me=g.players?.find(p=>p.id===s.viewerId),ids=new Set((me?.hand||[]).map(c=>c.id));
 if(g.handNumber!==lastTaxHand){lastTaxHand=g.handNumber;lastHandIds=ids;return}
 const added=[...ids].filter(id=>!lastHandIds.has(id));lastHandIds=ids;
 if(!added.length)return;
 requestAnimationFrame(()=>{for(const id of added){const card=document.querySelector(`#hand .card[data-id="${CSS.escape(id)}"]`);if(card){card.classList.add('taxReceived');setTimeout(()=>card.classList.remove('taxReceived'),5000)}}})
}
function flashDalmuti(g,game){
 const line=g.logs?.at(-1)||'';
 if(!line.includes('달무티 카드는 자동으로 선을 먹습니다.'))return;
 const key=`${g.handNumber}:${g.logs.length}:${line}`;if(key===lastDalmutiKey)return;lastDalmutiKey=key;
 const playLine=g.logs?.at(-2)||'',m=playLine.match(/^(.*?)이\(가\) 달무티 \d+장을 냈습니다\.$/),name=m?.[1]||'플레이어';
 game.style.setProperty('--dalmuti-label',`"${String(name).replace(/["\\]/g,'')}가 달무티 제출!"`);
 game.classList.remove('dalmutiFlash');void game.offsetWidth;game.classList.add('dalmutiFlash');setTimeout(()=>game.classList.remove('dalmutiFlash'),1100)
}
function renderStateUi(){
 let s=null;try{s=state}catch{}
 const game=document.querySelector('#game'),pile=document.querySelector('#pile'),owner=document.querySelector('#pileOwner'),status=document.querySelector('#status');
 if(!game||!pile||!owner||!s?.game)return;
 if(owner.previousElementSibling!==pile)pile.insertAdjacentElement('afterend',owner);
 const g=s.game,cur=g.players?.find(p=>p.id===g.currentPlayerId),myTurn=g.phase==='play'&&g.currentPlayerId===s.viewerId,myTax=g.phase==='tax'&&g.currentPlayerId===s.viewerId;
 game.classList.toggle('myTurn',!!myTurn);game.classList.toggle('taxPhase',g.phase==='tax');game.classList.toggle('myTaxTurn',!!myTax);
 status?.classList.toggle('myTurnStatus',!!myTurn);status?.classList.toggle('taxActionStatus',!!myTax);status?.classList.toggle('taxWaitingStatus',g.phase==='tax'&&!myTax);
 if(g.phase==='tax'&&status){const text=taxText(g,s,cur);if(status.textContent!==text)status.textContent=text}
 if(g.pile){owner.textContent=`${g.pile.playerName} 제출`;owner.className='pileOwner pileOwnerSubmitted'}
 else if(g.phase==='play'&&cur){owner.textContent=`${cur.name} 선`;owner.className='pileOwner pileOwnerLead'}
 else{owner.textContent='';owner.className='pileOwner'}
 renderWaitingPlayers(s);flashReceivedCards(g,s);flashDalmuti(g,game)
}
function schedule(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;renderStateUi()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
document.addEventListener('DOMContentLoaded',renderStateUi);renderStateUi();
})();