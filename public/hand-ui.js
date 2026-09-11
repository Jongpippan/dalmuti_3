(()=>{
let sortMode=localStorage.getItem('dalmuti-hand-sort')||'rank',raf=0,drag=null,longPressTimer=null,suppressClick=false;
const $=s=>document.querySelector(s);
function rankOf(card){const t=card.querySelector('.num')?.textContent?.trim();return t==='★'?13:Number(t)||99}
function cards(){return [...document.querySelectorAll('#hand .card[data-id]')].filter(c=>c.dataset.id)}
function setSortButtons(){const a=$('#sortRank'),b=$('#sortCount');if(a)a.classList.toggle('active',sortMode==='rank');if(b)b.classList.toggle('active',sortMode==='count')}
function layout(){raf=0;const hand=$('#hand');if(!hand)return;let cs=cards();if(!cs.length){setSortButtons();return}const freq={};for(const c of cs){const r=rankOf(c);freq[r]=(freq[r]||0)+1}cs.sort((a,b)=>{const ra=rankOf(a),rb=rankOf(b);return sortMode==='count'?(freq[rb]-freq[ra]||ra-rb):(ra-rb)});for(const c of cs)hand.appendChild(c);const n=cs.length,viewport=Math.max(300,window.innerWidth),span=Math.min(470,viewport*.70),step=n>1?Math.min(44,span/(n-1)):0,maxAngle=Math.min(26,Math.max(8,n*2.1)),den=Math.max(1,(n-1)/2);cs.forEach((c,i)=>{const d=i-(n-1)/2,x=d*step,r=d/den*maxAngle,y=Math.abs(r)*.72;c.style.setProperty('--fan-x',`${x}px`);c.style.setProperty('--fan-y',`${y}px`);c.style.setProperty('--fan-r',`${r}deg`);c.style.zIndex=String(i+2)});setSortButtons()}
function schedule(){if(!raf)raf=requestAnimationFrame(layout)}
function selectedIds(){return cards().filter(c=>c.classList.contains('selected')).map(c=>c.dataset.id)}
function selectedCount(){return selectedIds().length}
function toggleSelected(id){try{if(selected.has(id))selected.delete(id);else selected.add(id);render(state)}catch{const c=document.querySelector(`#hand .card[data-id="${CSS.escape(id)}"]`);if(c)c.classList.toggle('selected')}}
function ensureSelected(id){try{if(!selected.has(id)){selected.add(id);render(state)}}catch{const c=document.querySelector(`#hand .card[data-id="${CSS.escape(id)}"]`);if(c)c.classList.add('selected')}}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function pointIn(el,x,y){if(!el)return false;const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom}
function showGhost(x,y){const g=$('#dragGhost');if(!g)return;const n=Math.max(1,selectedCount());g.textContent=`${n}장 제출`;g.classList.remove('hidden');g.style.left=`${x}px`;g.style.top=`${y}px`}
function cleanupDrag(){const g=$('#dragGhost'),z=$('#dropZone');if(g)g.classList.add('hidden');if(z)z.classList.remove('dragReady','dragOver');if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}drag=null}
async function quickSubmit(card){const play=$('#actions [data-a="play"]');if(!play){toast('내 차례에 카드를 클릭하면 바로 제출됩니다.');return}const ids=selectedIds();if(ids.length&&card.classList.contains('selected')){play.click();return}try{const ok=await act('play-cards',{cardIds:[card.dataset.id]});if(ok&&typeof selected!=='undefined')selected.clear()}catch{play.click()}}
function bindStatic(){
 const rank=$('#sortRank'),count=$('#sortCount');
 if(rank&&!rank.dataset.bound){rank.dataset.bound='1';rank.onclick=()=>{sortMode='rank';localStorage.setItem('dalmuti-hand-sort',sortMode);layout()}}
 if(count&&!count.dataset.bound){count.dataset.bound='1';count.onclick=()=>{sortMode='count';localStorage.setItem('dalmuti-hand-sort',sortMode);layout()}}
}
document.addEventListener('pointerdown',e=>{const card=e.target.closest?.('#hand .card[data-id]');if(!card||e.button>0)return;suppressClick=false;drag={id:card.dataset.id,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,active:false,longPressed:false,pointerId:e.pointerId};longPressTimer=setTimeout(()=>{if(!drag||drag.active)return;drag.longPressed=true;suppressClick=true;toggleSelected(drag.id);toast('묶음 선택 모드');},360)},true);
document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;drag.lastX=e.clientX;drag.lastY=e.clientY;const dist=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);if(!drag.active&&dist>10){if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}drag.active=true;suppressClick=true;ensureSelected(drag.id);const z=$('#dropZone');if(z)z.classList.add('dragReady')}if(!drag.active)return;e.preventDefault();showGhost(e.clientX,e.clientY);const z=$('#dropZone');if(z)z.classList.toggle('dragOver',pointIn(z,e.clientX,e.clientY))},{passive:false,capture:true});
document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointerId)return;if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}const wasActive=drag.active,wasLong=drag.longPressed,z=$('#dropZone'),inside=pointIn(z,e.clientX,e.clientY);if(wasActive){e.preventDefault();e.stopPropagation();suppressClick=true;if(inside){const play=$('#actions [data-a="play"]');if(play&&selectedCount())play.click();else toast('내 차례에 선택한 카드를 현재 묶음으로 드래그해 주세요.')}}else if(wasLong){e.preventDefault();e.stopPropagation();suppressClick=true}cleanupDrag()},{capture:true});
document.addEventListener('click',e=>{const card=e.target.closest?.('#hand .card[data-id]');if(!card)return;if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;return}const play=$('#actions [data-a="play"]');if(!play)return;e.preventDefault();e.stopImmediatePropagation();quickSubmit(card)},{capture:true});
document.addEventListener('pointercancel',cleanupDrag,{capture:true});
const observer=new MutationObserver(()=>{bindStatic();schedule()});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('resize',schedule);document.addEventListener('DOMContentLoaded',()=>{bindStatic();layout()});bindStatic();schedule();
})();
