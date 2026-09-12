(()=>{
let q=false;
function renderStateUi(){
 let s=null;try{s=state}catch{}
 const game=document.querySelector('#game'),pile=document.querySelector('#pile'),owner=document.querySelector('#pileOwner'),status=document.querySelector('#status');
 if(!game||!pile||!owner||!s?.game)return;
 if(owner.previousElementSibling!==pile) pile.insertAdjacentElement('afterend',owner);
 const g=s.game,cur=g.players?.find(p=>p.id===g.currentPlayerId),myTurn=g.phase==='play'&&g.currentPlayerId===s.viewerId;
 game.classList.toggle('myTurn',!!myTurn);
 status?.classList.toggle('myTurnStatus',!!myTurn);
 if(g.pile){owner.textContent=`${g.pile.playerName} 제출`;owner.className='pileOwner pileOwnerSubmitted';}
 else if(g.phase==='play'&&cur){owner.textContent=`${cur.name} 선`;owner.className='pileOwner pileOwnerLead';}
 else{owner.textContent='';owner.className='pileOwner';}
}
function schedule(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;renderStateUi()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
document.addEventListener('DOMContentLoaded',renderStateUi);renderStateUi();
})();