(()=>{
let q=false,lastDalmutiKey='',lastHandIds=new Set(),lastTaxHand=0;
function playerName(g,id){return g.players?.find(p=>p.id===id)?.name||''}
function playerColor(id){return window.dalmutiPlayerColor?.(id)?.accent||'#60a5fa'}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function taxText(g,s){
 const p=g.tax?.pending;
 if(p){const lower=playerName(g,p.lowerId);return `세금 교환 · ${lower||'하위 플레이어'}의 광대를 제외한 최고 카드 ${p.count}장은 자동 선택되었습니다. 내 패에서 교환할 카드 ${p.count}장을 선택하세요.`}
 const waiting=(g.tax?.exchanges||[]).filter(x=>!x.done).map(x=>playerName(g,x.upperId)).filter(Boolean);
 return waiting.length?`세금 교환 · ${waiting.join(', ')}의 선택을 기다리는 중입니다.`:'세금 교환을 마무리하는 중입니다.'
}
function ensurePileOverlay(pile){
 let overlay=pile.querySelector(':scope > .pileOverlay');
 if(!overlay){overlay=document.createElement('span');overlay.className='pileOverlay';overlay.innerHTML='<span>현재 묶음</span><strong id="pileOwner"></strong>';pile.prepend(overlay)}
 return overlay.querySelector('#pileOwner')
}
function renderWaitingPlayers(s){
 const players=document.querySelector('#players');if(!players)return;
 players.querySelectorAll('.player.waiting').forEach(el=>el.remove());
 let panel=document.querySelector('#waitingPlayersPanel');
 const waiting=(s.room?.players||[]).filter(p=>p.waiting);
 if(!waiting.length){panel?.remove();return}
 if(!panel){panel=document.createElement('aside');panel.id='waitingPlayersPanel';panel.className='waitingPlayersPanel';players.insertAdjacentElement('afterend',panel)}
 const html=`<div class="waitingPlayersHead"><strong>다음 판 참가</strong><span>${waiting.length}명</span></div><div class="waitingPlayersList">${waiting.map(p=>`<div class="waitingPlayer ${p.id===s.viewerId?'me':''}"><span class="waitingDot"></span><span class="waitingName">${esc(p.name)}${p.id===s.viewerId?' · 나':''}</span><small>관전 중</small></div>`).join('')}</div>`;
 if(panel.innerHTML!==html)panel.innerHTML=html
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
 const re=/^(.*?)이\(가\) 달무티 \d+장을 냈습니다\.$/,playLine=[...(g.logs||[])].reverse().find(x=>re.test(x))||'',m=playLine.match(re),name=m?.[1]||'플레이어',player=g.players?.find(p=>p.name===name),accent=playerColor(player?.id);
 game.style.setProperty('--dalmuti-label',`"${String(name).replace(/["\\]/g,'')}가 달무티 제출!"`);
 game.style.setProperty('--dalmuti-accent',accent);
 game.classList.remove('dalmutiFlash');void game.offsetWidth;game.classList.add('dalmutiFlash');setTimeout(()=>game.classList.remove('dalmutiFlash'),1100)
}
function renderStateUi(){
 let s=null;try{s=state}catch{}
 const game=document.querySelector('#game'),pile=document.querySelector('#pile'),status=document.querySelector('#status'),handStatus=document.querySelector('#handStatus');
 if(!game||!pile||!s?.game)return;
 const owner=ensurePileOverlay(pile),g=s.game,cur=g.players?.find(p=>p.id===g.currentPlayerId),myTurn=g.phase==='play'&&g.currentPlayerId===s.viewerId,myTax=g.phase==='tax'&&!!g.tax?.pending;
 game.classList.toggle('myTurn',!!myTurn);game.classList.toggle('taxPhase',g.phase==='tax');game.classList.toggle('myTaxTurn',!!myTax);
 if(status){status.classList.toggle('hidden',g.phase==='play');status.classList.remove('myTurnStatus');status.classList.toggle('taxActionStatus',!!myTax);status.classList.toggle('taxWaitingStatus',g.phase==='tax'&&!myTax);if(g.phase==='tax')setText(status,taxText(g,s))}
 if(handStatus){setText(handStatus,myTurn?'내 차례입니다.':'');handStatus.classList.toggle('hidden',!myTurn)}
 let ownerText='',ownerClass='pileOwner',ownerColor='';
 if(g.pile){ownerText=`${g.pile.playerName} 제출`;ownerClass='pileOwner pileOwnerSubmitted';ownerColor=playerColor(g.pile.playerId)}
 else if(g.phase==='play'&&cur){ownerText=`${cur.name} 선`;ownerClass='pileOwner pileOwnerLead';ownerColor=playerColor(cur.id)}
 setText(owner,ownerText);if(owner.className!==ownerClass)owner.className=ownerClass;
 if(ownerColor){if(owner.style.getPropertyValue('--pile-owner-color')!==ownerColor)owner.style.setProperty('--pile-owner-color',ownerColor)}else if(owner.style.getPropertyValue('--pile-owner-color'))owner.style.removeProperty('--pile-owner-color');
 renderWaitingPlayers(s);flashReceivedCards(g,s);flashDalmuti(g,game)
}
function schedule(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;renderStateUi()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
document.addEventListener('DOMContentLoaded',renderStateUi);renderStateUi();
})();