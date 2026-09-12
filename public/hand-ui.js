(()=>{
let sortMode=localStorage.getItem('dalmuti-hand-sort')||'rank',raf=0,lastSignature='';
const $=s=>document.querySelector(s);
function rankOf(card){const t=card.querySelector('.num')?.textContent?.trim();return t==='★'?13:Number(t)||99}
function cards(){return [...document.querySelectorAll('#hand .card[data-id]')].filter(c=>c.dataset.id)}
function setSortButtons(){const a=$('#sortRank'),b=$('#sortCount');if(a)a.classList.toggle('active',sortMode==='rank');if(b)b.classList.toggle('active',sortMode==='count')}
function signature(cs=cards()){return cs.map(c=>c.dataset.id).sort().join('|')}
function layout(){
 raf=0;
 const hand=$('#hand');if(!hand)return;
 let cs=cards();
 if(!cs.length){lastSignature='';setSortButtons();return}
 const sig=signature(cs),sameHand=!!lastSignature&&sig===lastSignature;
 if(sameHand)hand.classList.add('noFanTransition');
 const freq={};for(const c of cs){const r=rankOf(c);freq[r]=(freq[r]||0)+1}
 cs.sort((a,b)=>{const ra=rankOf(a),rb=rankOf(b);return sortMode==='count'?(freq[rb]-freq[ra]||ra-rb):(ra-rb)});
 const current=cards();if(cs.some((c,i)=>current[i]!==c))for(const c of cs)hand.appendChild(c);
 const compact=window.innerWidth<=540,cardW=compact?48:58,sameStep=compact?16:18,groupGap=compact?12:16;
 const xs=[];let x=0,prev=null;
 cs.forEach((c,i)=>{const r=rankOf(c);if(i>0)x+=r===prev?sameStep:cardW+groupGap;xs.push(x);prev=r});
 const total=(xs.at(-1)||0)+cardW,offset=total/2-cardW/2;
 cs.forEach((c,i)=>{c.style.setProperty('--fan-x',`${xs[i]-offset}px`);c.style.setProperty('--fan-y','0px');c.style.setProperty('--fan-r','0deg');c.style.zIndex=String(i+2)});
 const play=$('#actions [data-a="play"]');if(play)play.textContent='제출';
 lastSignature=sig;setSortButtons();
 if(sameHand)requestAnimationFrame(()=>hand.classList.remove('noFanTransition'))
}
function schedule(){if(!raf)raf=requestAnimationFrame(layout)}
function setSelected(ids){
 try{selected.clear();ids.forEach(id=>selected.add(id))}catch{}
 const set=new Set(ids);cards().forEach(c=>c.classList.toggle('selected',set.has(c.dataset.id)))
}
function toggleOne(id){
 try{if(selected.has(id))selected.delete(id);else selected.add(id)}catch{}
 const set=(()=>{try{return new Set(selected)}catch{return new Set()}})();
 cards().forEach(c=>c.classList.toggle('selected',set.has(c.dataset.id)))
}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function autoGroupIds(card){
 const all=cards(),rank=rankOf(card);
 let pile=null;try{pile=state?.game?.pile||null}catch{}
 if(!pile)return all.filter(c=>rankOf(c)===rank).map(c=>c.dataset.id);
 const need=pile.count||1;
 if(need===1)return[card.dataset.id];
 if(rank===13)return[];
 const same=all.filter(c=>rankOf(c)===rank),jokers=all.filter(c=>rankOf(c)===13),ordered=[card,...same.filter(c=>c!==card)],ids=ordered.slice(0,need).map(c=>c.dataset.id);
 if(ids.length<need)ids.push(...jokers.slice(0,need-ids.length).map(c=>c.dataset.id));
 return ids.length===need?ids:[]
}
function handleCardClick(card){
 let s=null;try{s=state}catch{}
 const g=s?.game,me=g?.players?.find(p=>p.id===s.viewerId);
 if(!g||!me||me.finished)return;
 if(g.phase==='tax'&&g.currentPlayerId===s.viewerId){toggleOne(card.dataset.id);return}
 if(g.phase!=='play'||g.currentPlayerId!==s.viewerId)return;
 const ids=autoGroupIds(card);
 if(!ids.length){const need=g.pile?.count||1;toast(`${need}장 묶음을 만들 카드가 부족합니다.`);return}
 setSelected(ids)
}
function bindStatic(){
 const rank=$('#sortRank'),count=$('#sortCount');
 if(rank&&!rank.dataset.bound){rank.dataset.bound='1';rank.onclick=()=>{sortMode='rank';localStorage.setItem('dalmuti-hand-sort',sortMode);lastSignature='';layout()}}
 if(count&&!count.dataset.bound){count.dataset.bound='1';count.onclick=()=>{sortMode='count';localStorage.setItem('dalmuti-hand-sort',sortMode);lastSignature='';layout()}}
}
document.addEventListener('click',e=>{
 const card=e.target.closest?.('#hand .card[data-id]');if(!card)return;
 e.preventDefault();e.stopImmediatePropagation();handleCardClick(card)
},{capture:true});
const observer=new MutationObserver(()=>{bindStatic();schedule()});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('resize',()=>{lastSignature='';schedule()});document.addEventListener('DOMContentLoaded',()=>{bindStatic();layout()});bindStatic();schedule();
})();