(()=>{
const TITLES=['달무티','총리대신','시종장','남작부인','수녀원장','기사','재봉사','석공','요리사','양치기','광부','농노','광대'];
const CHAT_COLORS=[
 {accent:'#44546a',bg:'rgba(68,84,106,.065)'},
 {accent:'#7a6d4e',bg:'rgba(122,109,78,.065)'},
 {accent:'#7b5b62',bg:'rgba(123,91,98,.065)'},
 {accent:'#4f6d6a',bg:'rgba(79,109,106,.065)'},
 {accent:'#806b55',bg:'rgba(128,107,85,.065)'},
 {accent:'#665c73',bg:'rgba(102,92,115,.065)'},
 {accent:'#687151',bg:'rgba(104,113,81,.065)'},
 {accent:'#805f5a',bg:'rgba(128,95,90,.065)'},
 {accent:'#5f6f7a',bg:'rgba(95,111,122,.065)'},
 {accent:'#75616e',bg:'rgba(117,97,110,.065)'}
];
const $all=s=>[...document.querySelectorAll(s)];
const colorSlotsByRoom=new Map();
function rankFromCard(card){const t=card.querySelector('.num')?.textContent?.trim();return t==='★'?13:Number(t)||0}
function miniHand(count){if(!count)return'';const cards=Array.from({length:count},(_,i)=>`<i style="--i:${i}"></i>`).join('');return `<span class="miniCards" aria-label="남은 카드 ${count}장" style="--count:${count}">${cards}</span>`}
function roomByName(){const m=new Map();try{for(const p of state?.room?.players||[])m.set(p.name,p)}catch{}return m}
function roomById(){const m=new Map();try{for(const p of state?.room?.players||[])m.set(p.id,p)}catch{}return m}
function roomColorSlots(){
 const code=state?.room?.code||'room',players=state?.room?.players||[];
 let slots=colorSlotsByRoom.get(code);if(!slots){slots=new Map();colorSlotsByRoom.set(code,slots)}
 const present=new Set(players.map(p=>p.id));for(const id of [...slots.keys()])if(!present.has(id))slots.delete(id);
 const used=new Set(slots.values());
 for(const p of players){if(slots.has(p.id))continue;let slot=0;while(used.has(slot)&&slot<CHAT_COLORS.length)slot++;slot%=CHAT_COLORS.length;slots.set(p.id,slot);used.add(slot)}
 return slots
}
function colorForId(id){const slots=roomColorSlots(),slot=slots.get(id);return CHAT_COLORS[(slot??0)%CHAT_COLORS.length]}
window.dalmutiPlayerColor=id=>colorForId(id);
function playerInfo(){
 const map=new Map(),room=roomById(),dalmuti=state?.game?.players||[],word=state?.wordGame?.players||[];
 for(const rp of room.values())map.set(rp.id,{id:rp.id,title:rp.bot?'봇':'참가자',rank:null,portrait:rp.portrait||'royal',resting:!!rp.resting,aiPlaying:!!rp.aiPlaying,color:colorForId(rp.id)});
 if(word.length){
  const gameName=state?.room?.gameType==='choseong'?'초성':'끝말잇기';
  for(const gp of word){const rp=room.get(gp.id);map.set(gp.id,{id:gp.id,title:`${gameName} · ${gp.score||0}점`,rank:null,portrait:rp?.portrait||gp.portrait||'royal',resting:false,aiPlaying:false,color:colorForId(gp.id)})}
  return map
 }
 for(const gp of dalmuti){const rp=room.get(gp.id),rank=(gp.roleIndex??0)+1;map.set(gp.id,{id:gp.id,title:gp.role||TITLES[rank-1]||`${rank}위`,rank,portrait:rp?.portrait||gp.portrait||'royal',resting:!!rp?.resting,aiPlaying:!!rp?.aiPlaying,color:colorForId(gp.id)})}
 return map
}
function avatarHtml(id,extra='',accent){return `<span class="avatar ${extra}" aria-hidden="true">${window.dalmutiPortraitSvg?.(id,accent)||window.dalmutiPortraitSvg?.('royal',accent)||''}</span>`}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ensurePlayerInner(p,rp){
 let inner=p.querySelector(':scope > .playerInner');
 if(!inner){inner=document.createElement('div');inner.className='playerInner';while(p.firstChild)inner.appendChild(p.firstChild);p.appendChild(inner)}
 const accent=rp?.id?colorForId(rp.id).accent:null,avatar=inner.querySelector('.playerAvatar'),signature=`${rp?.portrait||''}|${accent||''}`;
 if(rp&&!avatar)inner.insertAdjacentHTML('afterbegin',avatarHtml(rp.portrait,'playerAvatar',accent));
 else if(rp&&avatar&&avatar.dataset.portraitSignature!==signature)avatar.innerHTML=window.dalmutiPortraitSvg?.(rp.portrait,accent)||'';
 const currentAvatar=inner.querySelector('.playerAvatar');if(currentAvatar&&rp)currentAvatar.dataset.portraitSignature=signature;
 if(rp)p.classList.add('hasAvatar');
 return inner
}
function applyLobby(){
 const players=state?.room?.players||[],rows=$all('#lobbyPlayers .person');
 rows.forEach((row,i)=>{const rp=players[i],first=row.querySelector('span');if(!rp||!first)return;const color=colorForId(rp.id);row.style.setProperty('--player-accent',color.accent);row.style.setProperty('--player-bg',color.bg);if(!first.classList.contains('lobbyIdentity'))first.classList.add('lobbyIdentity');let av=first.querySelector('.lobbyAvatar');const signature=`${rp.portrait}|${color.accent}`;if(!av){first.insertAdjacentHTML('afterbegin',avatarHtml(rp.portrait,'lobbyAvatar',color.accent));av=first.querySelector('.lobbyAvatar')}else if(av.dataset.portraitSignature!==signature)av.innerHTML=window.dalmutiPortraitSvg?.(rp.portrait,color.accent)||'';if(av)av.dataset.portraitSignature=signature;first.style.color=color.accent})
}
function applyChat(){
 const info=playerInfo(),items=state?.room?.chat||[],byId=new Map(items.map(x=>[x.id,x]));
 $all('.chatlog').forEach(log=>{
  [...log.querySelectorAll('.chatmsg')].forEach(msg=>{
   const item=byId.get(msg.dataset.chatId);if(!item)return;
   if(item.name==='시스템'&&String(item.text||'').includes('이번 라운드를 쉽니다.')){msg.classList.add('hidden');return}
   const p=info.get(item.playerId);if(!p)return;
   const transformed=!!item.masked,badge=p.rank?`${escapeHtml(p.title)} · ${p.rank}위`:escapeHtml(p.title);
   const signature=[p.title,p.rank??'',p.portrait,p.color.accent,p.color.bg,item.name,item.text,transformed?'1':'0'].join('|');
   if(msg.dataset.chatSignature===signature)return;
   msg.dataset.chatSignature=signature;msg.dataset.chatDecorated='1';msg.classList.add('playerChat');
   msg.style.setProperty('--chat-accent',p.color.accent);msg.style.setProperty('--chat-bg',p.color.bg);
   msg.innerHTML=`${avatarHtml(p.portrait,'',p.color.accent)}<span class="chatText"><b>${escapeHtml(item.name)}</b><span class="chatRank">${badge}</span><span class="chatBody ${transformed?'transformedChat':''}">${escapeHtml(item.text)}</span></span>`
  })
 })
}
function rawMetaText(meta){return [...(meta?.childNodes||[])].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent||'').join(' ')}
function decorateInactive(p,meta,gp){
 if(!meta)return;
 const raw=rawMetaText(meta),inactive=raw.includes('나감')||!!gp?.finished||!!gp?.finishPlace;
 p.classList.toggle('departed',inactive);
 let place=gp?.finishPlace||null;
 if(!place){const m=raw.match(/(?:^|·\s*)(\d+)위/);if(m)place=Number(m[1])}
 let badge=meta.querySelector('.finishPlaceBadge');
 if(inactive&&place){const text=`${place}위`;if(!badge){badge=document.createElement('span');badge.className='finishPlaceBadge';badge.textContent=text;meta.appendChild(badge)}else if(badge.textContent!==text)badge.textContent=text}
 else if(badge)badge.remove()
}
function syncPlayerRest(inner,meta,rp){
 const labels=[];if(rp?.resting)labels.push('잠자기');if(rp?.aiPlaying)labels.push('AI 플레이 중');
 const text=labels.length?' · '+labels.join(' · '):'',existing=inner.querySelector('.playerRest');
 if(!text){existing?.remove();return}
 if(existing){if(existing.textContent!==text)existing.textContent=text;return}
 const s=document.createElement('span');s.className='playerRest';s.textContent=text;meta?.appendChild(s)
}
function applyWordPlayers(){
 const room=roomById(),byName=roomByName(),game=new Map((state?.wordGame?.players||[]).map(p=>[p.id,p]));
 $all('#players .player[data-player-id]').forEach(p=>{
  const id=p.dataset.playerId,rp=room.get(id),gp=game.get(id),owner=rp||gp;if(!owner)return;
  const inner=ensurePlayerInner(p,owner),color=colorForId(id),pname=inner.querySelector('.pname'),role=inner.querySelector('.wordRole,.role');
  p.style.setProperty('--player-accent',color.accent);p.style.setProperty('--player-bg',color.bg);
  if(pname)pname.style.color=color.accent;if(role)role.style.color=color.accent;
 });
 $all('#players .player.waiting').forEach(p=>{const name=(p.querySelector('.pname')?.textContent||'').replace(/\s*\(나\)\s*$/,'').replace(/\s*·\s*봇\s*$/,'').trim(),rp=byName.get(name);if(!rp)return;const inner=ensurePlayerInner(p,rp),color=colorForId(rp.id),pname=inner.querySelector('.pname');p.style.setProperty('--player-accent',color.accent);p.style.setProperty('--player-bg',color.bg);if(pname)pname.style.color=color.accent});
}
function applyDalmutiPlayers(){const room=roomByName(),gameByName=new Map((state?.game?.players||[]).map(p=>[p.name,p])),active=$all('#players .player:not(.waiting)');active.forEach((p,i)=>{const name=(p.querySelector('.pname')?.textContent||'').replace(/\s*\(나\)\s*$/,'').trim(),rp=room.get(name),gp=gameByName.get(name),portraitOwner=rp||gp,inner=ensurePlayerInner(p,portraitOwner),role=inner.querySelector('.role'),pname=inner.querySelector('.pname'),color=gp?colorForId(gp.id):null,roleText=TITLES[i]||`${i+1}위`;if(role){if(role.textContent!==roleText)role.textContent=roleText;if(color&&role.style.color!==color.accent)role.style.color=color.accent}if(pname&&color&&pname.style.color!==color.accent)pname.style.color=color.accent;const meta=inner.querySelector('.pmeta');if(meta&&!meta.querySelector('.miniCards')){const m=rawMetaText(meta).match(/^(\d+)장/),count=m?Number(m[1]):0;if(m&&count>0)meta.insertAdjacentHTML('afterbegin',miniHand(count))}decorateInactive(p,meta,gp);syncPlayerRest(inner,meta,rp)});$all('#players .player.waiting').forEach(p=>{const name=(p.querySelector('.pname')?.textContent||'').replace(/\s*\(나\)\s*$/,'').trim(),rp=room.get(name),inner=ensurePlayerInner(p,rp),pname=inner.querySelector('.pname');if(pname&&rp){const accent=colorForId(rp.id).accent;if(pname.style.color!==accent)pname.style.color=accent}})}
function applyPlayers(){if(state?.wordGame)applyWordPlayers();else applyDalmutiPlayers()}
function apply(){applyLobby();applyPlayers();$all('.card').forEach(card=>{const rank=rankFromCard(card),name=card.querySelector('.name'),text=TITLES[rank-1];if(name&&text&&name.textContent!==text)name.textContent=text});applyChat()}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});document.addEventListener('DOMContentLoaded',apply);apply();
})();
