(()=>{
let sortMode=localStorage.getItem('dalmuti-hand-sort')||'rank',raf=0,lastSignature='';
const $=s=>document.querySelector(s);
function rankOf(card){const t=card.querySelector('.num')?.textContent?.trim();return t==='★'?13:Number(t)||99}
function cards(){return [...document.querySelectorAll('#hand .card[data-id]')].filter(c=>c.dataset.id)}
function setSortButtons(){const a=$('#sortRank'),b=$('#sortCount');if(a)a.classList.toggle('active',sortMode==='rank');if(b)b.classList.toggle('active',sortMode==='count')}
function signature(cs=cards()){return cs.map(c=>c.dataset.id).sort().join('|')}
function selectedIds(){try{return new Set(selected)}catch{return new Set()}}
function layout(){
 raf=0;
 const hand=$('#hand');if(!hand)return;
 let cs=cards();
 if(!cs.length){lastSignature='';document.documentElement.style.setProperty('--hand-rows','1');setSortButtons();return}
 const sig=signature(cs),sameHand=!!lastSignature&&sig===lastSignature;
 if(sameHand)hand.classList.add('noFanTransition');
 const freq={};for(const c of cs){const r=rankOf(c);freq[r]=(freq[r]||0)+1}
 cs.sort((a,b)=>{const ra=rankOf(a),rb=rankOf(b);return sortMode==='count'?(freq[rb]-freq[ra]||ra-rb):(ra-rb)});
 const current=cards();if(cs.some((c,i)=>current[i]!==c))for(const c of cs)hand.appendChild(c);
 const compact=window.innerWidth<=540,cardW=compact?48:58,cardH=compact?68:82,sameStep=compact?16:18,groupGap=compact?10:14,rowGap=compact?8:10;
 const maxW=Math.max(cardW,hand.clientWidth-(compact?16:24));
 const groups=[];
 for(const c of cs){const r=rankOf(c),last=groups.at(-1);if(last&&last.rank===r)last.cards.push(c);else groups.push({rank:r,cards:[c]})}
 const rows=[];let row=[],rowW=0;
 for(const g of groups){
  const width=cardW+(g.cards.length-1)*sameStep;
  const nextW=row.length?rowW+groupGap+width:width;
  if(row.length&&nextW>maxW){rows.push({groups:row,width:rowW});row=[];rowW=0}
  if(row.length)rowW+=groupGap;
  row.push({...g,width});rowW+=width
 }
 if(row.length)rows.push({groups:row,width:rowW});
 rows.forEach((r,rowIndex)=>{
  let cursor=-r.width/2;
  for(const g of r.groups){
   g.cards.forEach((c,i)=>{
    const x=cursor+cardW/2+i*sameStep,y=rowIndex*(cardH+rowGap);
    c.style.setProperty('--card-x',`${x}px`);c.style.setProperty('--card-y',`${y}px`);c.style.zIndex=String(2+i)
   });
   cursor+=g.width+groupGap
  }
 });
 document.documentElement.style.setProperty('--hand-rows',String(Math.max(1,rows.length)));
 const play=$('#actions [data-a="play"]');if(play)play.textContent='제출';
 lastSignature=sig;setSortButtons();
 if(sameHand)requestAnimationFrame(()=>hand.classList.remove('noFanTransition'))
}
function schedule(){if(!raf)raf=requestAnimationFrame(layout)}
function setSelected(ids){try{selected.clear();ids.forEach(id=>selected.add(id))}catch{}const set=new Set(ids);cards().forEach(c=>c.classList.toggle('selected',set.has(c.dataset.id)))}
function toggleOne(id){const set=selectedIds();if(set.has(id))set.delete(id);else set.add(id);setSelected([...set])}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function autoGroupIds(card){const all=cards(),rank=rankOf(card);let pile=null;try{pile=state?.game?.pile||null}catch{}if(!pile){if(rank===13)return[card.dataset.id];return all.filter(c=>rankOf(c)===rank).map(c=>c.dataset.id)}const need=pile.count||1;if(need===1)return[card.dataset.id];if(rank===13)return[];const same=all.filter(c=>rankOf(c)===rank),jokers=all.filter(c=>rankOf(c)===13),ordered=[card,...same.filter(c=>c!==card)],ids=ordered.slice(0,need).map(c=>c.dataset.id);if(ids.length<need)ids.push(...jokers.slice(0,need-ids.length).map(c=>c.dataset.id));return ids.length===need?ids:[]}
function selectedRanks(set){const byId=new Map(cards().map(c=>[c.dataset.id,c]));return[...new Set([...set].map(id=>rankOf(byId.get(id))).filter(r=>r&&r!==13))]}
function handleOpeningClick(card){
 const all=cards(),rank=rankOf(card),current=selectedIds(),ranks=selectedRanks(current);
 if(!current.size){setSelected(autoGroupIds(card));return}
 if(rank===13){toggleOne(card.dataset.id);return}
 if(ranks.length===1&&ranks[0]===rank){toggleOne(card.dataset.id);return}
 setSelected(all.filter(c=>rankOf(c)===rank).map(c=>c.dataset.id))
}
function handleCardClick(card){let s=null;try{s=state}catch{}const g=s?.game,me=g?.players?.find(p=>p.id===s.viewerId);if(!g||!me||me.finished)return;if(g.phase==='tax'&&g.tax?.pending){toggleOne(card.dataset.id);return}if(g.phase!=='play')return;if(!g.pile){handleOpeningClick(card);return}const ids=autoGroupIds(card);if(!ids.length){const need=g.pile?.count||1;toast(`${need}장 묶음을 만들 카드가 부족합니다.`);return}const current=selectedIds(),same=current.size===ids.length&&ids.every(id=>current.has(id));setSelected(same?[]:ids)}
function bindStatic(){const rank=$('#sortRank'),count=$('#sortCount');if(rank&&!rank.dataset.bound){rank.dataset.bound='1';rank.onclick=()=>{sortMode='rank';localStorage.setItem('dalmuti-hand-sort',sortMode);lastSignature='';layout()}}if(count&&!count.dataset.bound){count.dataset.bound='1';count.onclick=()=>{sortMode='count';localStorage.setItem('dalmuti-hand-sort',sortMode);lastSignature='';layout()}}}
document.addEventListener('click',e=>{const card=e.target.closest?.('#hand button.card[data-id]');if(!card)return;e.preventDefault();handleCardClick(card)});
const observer=new MutationObserver(()=>{bindStatic();schedule()});observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('resize',()=>{lastSignature='';schedule()});document.addEventListener('DOMContentLoaded',()=>{bindStatic();layout()});bindStatic();schedule();
})();