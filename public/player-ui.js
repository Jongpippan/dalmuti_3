(()=>{
const TITLES=['달무티','총리대신','시종장','남작부인','수녀원장','기사','재봉사','석공','요리사','양치기','광부','농노','광대'];
const CHAT_COLORS=[
 {accent:'#60a5fa',bg:'rgba(37,99,235,.12)'},{accent:'#f472b6',bg:'rgba(219,39,119,.12)'},{accent:'#34d399',bg:'rgba(5,150,105,.12)'},{accent:'#fbbf24',bg:'rgba(217,119,6,.12)'},{accent:'#a78bfa',bg:'rgba(124,58,237,.12)'},{accent:'#22d3ee',bg:'rgba(8,145,178,.12)'},{accent:'#fb7185',bg:'rgba(225,29,72,.12)'},{accent:'#4ade80',bg:'rgba(22,163,74,.12)'},{accent:'#f97316',bg:'rgba(234,88,12,.12)'},{accent:'#c084fc',bg:'rgba(147,51,234,.12)'}
];
const $all=s=>[...document.querySelectorAll(s)];
function rankFromCard(card){const t=card.querySelector('.num')?.textContent?.trim();return t==='★'?13:Number(t)||0}
function miniHand(count){if(!count)return'';const cards=Array.from({length:count},(_,i)=>`<i style="--i:${i}"></i>`).join('');return `<span class="miniCards" aria-label="남은 카드 ${count}장" style="--count:${count}">${cards}</span>`}
function roomByName(){const m=new Map();try{for(const p of state?.room?.players||[])m.set(p.name,p)}catch{}return m}
function roomById(){const m=new Map();try{for(const p of state?.room?.players||[])m.set(p.id,p)}catch{}return m}
function colorIndex(id){let h=0;for(const ch of String(id||''))h=(h*31+ch.charCodeAt(0))>>>0;return h%CHAT_COLORS.length}
function colorForId(id){return CHAT_COLORS[colorIndex(id)]}
function playerInfo(){
 const map=new Map(),room=roomById(),game=state?.game?.players||[];
 for(const gp of game){const rp=room.get(gp.id),rank=(gp.roleIndex??0)+1;map.set(gp.id,{title:gp.role||TITLES[rank-1]||`${rank}위`,rank,portrait:rp?.portrait||gp.portrait||'royal',resting:!!rp?.resting,aiPlaying:!!rp?.aiPlaying,color:colorForId(gp.id)})}
 return map
}
function avatarHtml(id,extra=''){return `<span class="avatar ${extra}" aria-hidden="true">${window.dalmutiPortraitSvg?.(id)||window.dalmutiPortraitSvg?.('royal')||''}</span>`}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ensurePlayerInner(p,rp){
 let inner=p.querySelector(':scope > .playerInner');
 if(!inner){inner=document.createElement('div');inner.className='playerInner';while(p.firstChild)inner.appendChild(p.firstChild);p.appendChild(inner)}
 const avatar=inner.querySelector('.playerAvatar');
 if(rp&&!avatar)inner.insertAdjacentHTML('afterbegin',avatarHtml(rp.portrait,'playerAvatar'));
 else if(rp&&avatar&&avatar.dataset.portrait!==rp.portrait){avatar.innerHTML=window.dalmutiPortraitSvg?.(rp.portrait)||'';avatar.dataset.portrait=rp.portrait}
 const currentAvatar=inner.querySelector('.playerAvatar');if(currentAvatar&&rp)currentAvatar.dataset.portrait=rp.portrait;
 if(rp)p.classList.add('hasAvatar');
 return inner
}
function applyChat(){
 const info=playerInfo(),items=state?.room?.chat||[],byId=new Map(items.map(x=>[x.id,x]));
 $all('.chatlog').forEach(log=>{
  [...log.querySelectorAll('.chatmsg')].forEach(msg=>{
   const item=byId.get(msg.dataset.chatId);
   if(!item)return;
   if(item.name==='시스템'&&String(item.text||'').includes('이번 라운드를 쉽니다.')){msg.classList.add('hidden');return}
   if(msg.dataset.chatDecorated==='1')return;
   const p=info.get(item.playerId);if(!p)return;
   msg.dataset.chatDecorated='1';msg.classList.add('playerChat');
   msg.style.setProperty('--chat-accent',p.color.accent);msg.style.setProperty('--chat-bg',p.color.bg);
   const transformed=!!item.masked;
   msg.innerHTML=`${avatarHtml(p.portrait)}<span class="chatText"><b>${escapeHtml(item.name)}</b><span class="chatRank">${escapeHtml(p.title)} · ${p.rank}위</span><span class="chatBody ${transformed?'transformedChat':''}">${escapeHtml(item.text)}</span></span>`
  })
 })
}
function decorateDeparture(p,meta){
 const text=meta?.textContent||'',departed=text.includes('나감');p.classList.toggle('departed',departed);if(!meta)return;
 const plain=text.replace(/\s*·\s*나감\s*/g,' · 나감').trim(),match=plain.match(/(?:^|·\s*)(\d+)위(?:\s*·\s*나감)?$/);meta.querySelector('.finishPlaceBadge')?.remove();
 if(departed&&match){const badge=document.createElement('span');badge.className='finishPlaceBadge';badge.textContent=`${match[1]}위`;meta.appendChild(badge)}
}
function applyPlayers(){const room=roomByName(),gameByName=new Map((state?.game?.players||[]).map(p=>[p.name,p])),active=$all('#players .player:not(.waiting)');active.forEach((p,i)=>{const name=(p.querySelector('.pname')?.textContent||'').replace(/\s*\(나\)\s*$/,'').trim(),rp=room.get(name),gp=gameByName.get(name),portraitOwner=rp||gp,inner=ensurePlayerInner(p,portraitOwner),role=inner.querySelector('.role'),pname=inner.querySelector('.pname');if(role)role.textContent=TITLES[i]||`${i+1}위`;if(pname&&gp)pname.style.color=colorForId(gp.id).accent;const meta=inner.querySelector('.pmeta');if(meta&&!meta.querySelector('.miniCards')){const m=meta.textContent.match(/^(\d+)장/),count=m?Number(m[1]):0;if(m&&count>0)meta.insertAdjacentHTML('afterbegin',miniHand(count))}decorateDeparture(p,meta);inner.querySelector('.playerRest')?.remove();const labels=[];if(rp?.resting)labels.push('잠자기');if(rp?.aiPlaying)labels.push('AI 플레이 중');if(labels.length){const s=document.createElement('span');s.className='playerRest';s.textContent=' · '+labels.join(' · ');meta?.appendChild(s)}});$all('#players .player.waiting').forEach(p=>{const name=(p.querySelector('.pname')?.textContent||'').replace(/\s*\(나\)\s*$/,'').trim(),rp=room.get(name),inner=ensurePlayerInner(p,rp),pname=inner.querySelector('.pname');if(pname&&rp)pname.style.color=colorForId(rp.id).accent})}
function apply(){applyPlayers();$all('.card').forEach(card=>{const rank=rankFromCard(card),name=card.querySelector('.name');if(name&&TITLES[rank-1])name.textContent=TITLES[rank-1]});applyChat()}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});document.addEventListener('DOMContentLoaded',apply);apply();
})();