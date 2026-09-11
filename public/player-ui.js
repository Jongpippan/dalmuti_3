(()=>{
const TITLES=['달무티','총리대신','시종장','남작부인','수녀원장','기사','재봉사','석공','요리사','양치기','광부','농노','광대'];
const $all=s=>[...document.querySelectorAll(s)];
function rankFromCard(card){const t=card.querySelector('.num')?.textContent?.trim();return t==='★'?13:Number(t)||0}
function miniHand(count){if(!count)return'';const cards=Array.from({length:count},(_,i)=>`<i style="--i:${i}"></i>`).join('');return `<span class="miniCards" aria-label="남은 카드 ${count}장" style="--count:${count}">${cards}</span>`}
function playerInfo(){
 const map=new Map(),active=$all('#players .player:not(.waiting)');
 active.forEach((p,i)=>{
  const name=(p.querySelector('.pname')?.textContent||'').replace(/\s*\(나\)\s*$/,'').trim();
  if(name)map.set(name,{title:TITLES[i]||`${i+1}위`,rank:i+1,lowest:i===active.length-1});
 });
 return map
}
function applyChat(){
 const info=playerInfo();
 $all('.chatmsg').forEach(msg=>{
  const b=msg.querySelector('b');if(!b)return;
  const name=b.textContent.trim(),p=info.get(name);
  msg.classList.remove('lowestChat');
  msg.querySelector('.chatRank')?.remove();
  if(!p)return;
  const badge=document.createElement('span');badge.className='chatRank';badge.textContent=`${p.title} · ${p.rank}위`;
  b.insertAdjacentElement('afterend',badge);
  if(p.lowest){
   msg.classList.add('lowestChat');
   [...msg.childNodes].forEach(n=>{if(n!==b&&n!==badge)n.remove()});
   msg.appendChild(document.createTextNode('피카!'));
  }
 })
}
function apply(){
 const active=$all('#players .player:not(.waiting)');
 active.forEach((p,i)=>{
  const role=p.querySelector('.role');
  if(role)role.textContent=TITLES[i]||`${i+1}위`;
  const meta=p.querySelector('.pmeta');
  if(meta&&!meta.querySelector('.miniCards')){
   const m=meta.textContent.match(/^(\d+)장/),count=m?Number(m[1]):0;
   if(m&&count>0)meta.insertAdjacentHTML('afterbegin',miniHand(count));
  }
 });
 $all('.card').forEach(card=>{const rank=rankFromCard(card),name=card.querySelector('.name');if(name&&TITLES[rank-1])name.textContent=TITLES[rank-1]});
 applyChat();
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
document.addEventListener('DOMContentLoaded',apply);apply();
})();
