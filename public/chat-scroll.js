(()=>{
function scrollBottom(el){if(!el)return;requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight})}
function watch(el){if(!el||el.dataset.chatScrollBound==='1')return;el.dataset.chatScrollBound='1';new MutationObserver(mutations=>{const added=mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.chatmsg')||n.querySelector?.('.chatmsg'))));if(added)scrollBottom(el)}).observe(el,{childList:true})}
function bind(){document.querySelectorAll('.chatlog').forEach(watch)}
new MutationObserver(bind).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',bind);bind();
})();