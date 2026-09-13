(()=>{
const original=window.renderChat;
if(typeof original!=='function')return;
window.renderChat=function(items){
 const filtered=(items||[]).filter(m=>!(m?.name==='시스템'&&String(m?.text||'').includes('게임에 복귀했습니다.')));
 return original(filtered)
}
})();