(()=>{
const original=window.renderChat;
if(typeof original!=='function')return;
function isWordGameEvent(m){
 const text=String(m?.text||'');
 if(m?.playerId!=='system'&&(text.startsWith('시도 · ')||text.startsWith('오답 · ')))return true;
 if(m?.name==='시스템'&&(/: .* ✓$/.test(text)||text.includes('시간 초과')))return true;
 return false;
}
window.renderChat=function(items){
 const filtered=(items||[]).filter(m=>!(m?.name==='시스템'&&String(m?.text||'').includes('게임에 복귀했습니다.'))&&!isWordGameEvent(m));
 return original(filtered)
}
})();
