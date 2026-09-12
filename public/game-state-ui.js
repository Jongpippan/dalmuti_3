(()=>{
let q=false,lastTaxKey='',lastDalmutiKey='';
function taxText(g,s,cur){
 const count=g.tax?.stage==='greater-return'?2:1;
 if(g.currentPlayerId===s.viewerId){
  const p=g.tax?.pending,from=g.players?.find(x=>x.id===p?.fromId);
  return `세금 단계 · ${from?.name||'하위 계급'}에게서 ${p?.count||count}장을 받았습니다. 돌려줄 카드 ${p?.count||count}장을 선택하세요.`
 }
 return `세금 단계 · ${cur?.name||'현재 플레이어'}(${cur?.role||''})이 받은 카드 중 ${count}장을 돌려줄 카드를 고르는 중입니다.`
}
function flashTaxCards(g,s){
 const ids=g.phase==='tax'&&g.currentPlayerId===s.viewerId?g.tax?.pending?.given||[]:[];
 if(!ids.length)return;
 const key=`${g.handNumber}:${g.tax?.stage}:${ids.join(',')}`;
 if(key===lastTaxKey)return;lastTaxKey=key;
 requestAnimationFrame(()=>{
  for(const id of ids){const card=document.querySelector(`#hand .card[data-id="${CSS.escape(id)}"]`);if(card){card.classList.add('taxReceived');setTimeout(()=>card.classList.remove('taxReceived'),1800)}}
 })
}
function flashDalmuti(g,game){
 const line=g.logs?.at(-1)||'';
 if(!line.includes('대 달무티는 자동으로 선을 먹습니다.'))return;
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
 flashTaxCards(g,s);flashDalmuti(g,game)
}
function schedule(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;renderStateUi()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
document.addEventListener('DOMContentLoaded',renderStateUi);renderStateUi();
})();