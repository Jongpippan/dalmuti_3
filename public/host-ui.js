(()=>{
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function kickHtml(s){if(!s||s.viewerId!==s.room.hostId)return'';const humans=s.room.players.filter(p=>!p.bot&&p.id!==s.viewerId);if(!humans.length)return '<div class="hostControlBlock"><div class="hostControlTitle">참가자 관리</div><small>강퇴할 다른 참가자가 없습니다.</small></div>';return `<div class="hostControlBlock"><div class="hostControlTitle">참가자 관리</div><div class="hostKickList">${humans.map(p=>`<div class="hostKickRow"><span>${esc(p.name)}${p.waiting?' · 다음 판 합류':''}</span><button type="button" class="tiny danger" data-host-kick="${p.id}">강퇴</button></div>`).join('')}</div></div>`}
function render(){
 let s=null;try{s=state}catch{};
 const host=!!s&&s.viewerId===s.room?.hostId;
 const dalmuti=!!s?.game&&s.viewerId===s.room?.dalmutiId;
 const lobbyRules=document.querySelector('#lobbyRules');if(lobbyRules)lobbyRules.classList.toggle('hidden',!host);
 const remainder=document.querySelector('#gameRemainderPanel');if(remainder)remainder.classList.toggle('hidden',!dalmuti);
 for(const [panelId,kickId] of [['#lobbyHostPanel','#lobbyKickControls'],['#gameHostPanel','#gameKickControls']]){
  const panel=document.querySelector(panelId),kick=document.querySelector(kickId);if(!panel)continue;
  panel.classList.toggle('hidden',!host);
  if(kick){const sig=host?JSON.stringify((s.room.players||[]).map(p=>[p.id,p.name,!!p.bot,!!p.waiting])):'';if(kick.dataset.sig!==sig){kick.dataset.sig=sig;kick.innerHTML=host?kickHtml(s):''}}
 }
}
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-host-kick]');if(!b)return;e.preventDefault();e.stopPropagation();const p=state?.room?.players.find(x=>x.id===b.dataset.hostKick);if(!p)return;const gp=state?.game?.players.find(x=>x.id===p.id);let msg=`${p.name}님을 방에서 강퇴할까요?`;if(gp&&!gp.finished&&gp.handCount>0)msg=`${p.name}님은 카드가 ${gp.handCount}장 남아 있습니다.\n\n강퇴하면 현재 판이 취소되고 새 판이 시작될 수 있습니다. 정말 강퇴할까요?`;else if(gp?.finished||gp?.handCount===0)msg=`${p.name}님은 이미 패를 모두 냈습니다. 현재 판은 유지되고 다음 판부터 제외됩니다. 강퇴할까요?`;if(confirm(msg))await act('kick-player',{targetPlayerId:p.id})},true);
let q=false;function schedule(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;render()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});document.addEventListener('DOMContentLoaded',render);render();
})();