(()=>{
let q=false,lastDalmutiKey='',lastHandIds=new Set(),lastTaxHand=0;
function playerName(g,id){return g.players?.find(p=>p.id===id)?.name||''}
function taxText(g,s,cur){
 const p=g.tax?.pending,count=p?.count||1,upper=playerName(g,p?.upperId),lower=playerName(g,p?.lowerId),side=p?.side;
 if(g.currentPlayerId===s.viewerId){
  const partner=side==='lower'?upper:lower;
  return `세금 교환 · ${partner||'상대'}와 교환할 카드 ${count}장을 내 패에서 선택하세요. 상대가 고른 카드는 아직 들어오지 않습니다.`
 }
 if(side==='lower')return `세금 교환 · ${lower||cur?.name||'하위 플레이어'}이(가) ${upper||'상위 플레이어'}와 교환할 카드 ${count}장을 고르는 중입니다.`;
 return `세금 교환 · ${lower||'하위 플레이어'}의 선택 완료. ${upper||cur?.name||'상위 플레이어'}이(가) 교환할 카드 ${count}장을 고르는 중입니다.`
}
function flashReceivedCards(g,s){
 const me=g.players?.find(p=>p.id===s.viewerId),ids=new Set((me?.hand||[]).map(c=>c.id));
 if(g.handNumber!==lastTaxHand){lastTaxHand=g.handNumber;lastHandIds=ids;return}
 const added=[...ids].filter(id=>!lastHandIds.has(id));lastHandIds=ids;
 if(!added.length)return;
 requestAnimationFrame(()=>{for(const id of added){const card=document.querySelector(`#hand .card[data-id="${CSS.escape(id)}"]`);if(card){card.classList.add('taxReceived');setTimeout(()=>card.classList.remove('taxReceived'),1800)}}})
}
function flashDalmuti(g,game){
 const line=g.logs?.at(-1)||'';
 if(!line.includes('달무티 카드는 자동으로 선을 먹습니다.'))return;
 const key=`${g.handNumber}:${g.logs.length}:${line}`;if(key===lastDalmutiKey)return;lastDalmutiKey=key;
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
 flashReceivedCards(g,s);flashDalmuti(g,game)
}
function schedule(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;renderStateUi()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
document.addEventListener('DOMContentLoaded',renderStateUi);renderStateUi();
})();