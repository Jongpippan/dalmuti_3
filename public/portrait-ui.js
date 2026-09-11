(()=>{
let current=localStorage.getItem('dalmuti-portrait')||'royal';
function ids(){return window.dalmutiPortraitIds?.()||['royal','mage','knight','princess','ninja','bard','fox','owl']}
if(!ids().includes(current))current='royal';
window.getDalmutiPortrait=()=>current;
function renderPicker(){const box=document.querySelector('#portraitPicker');if(!box)return;box.innerHTML=ids().map(id=>`<button type="button" class="portraitChoice ${id===current?'selected':''}" data-portrait="${id}" title="${window.dalmutiPortraitLabel?.(id)||id}" aria-label="${window.dalmutiPortraitLabel?.(id)||id}"><span class="portraitFace">${window.dalmutiPortraitSvg?.(id)||''}</span></button>`).join('');box.querySelectorAll('[data-portrait]').forEach(b=>b.onclick=()=>{current=b.dataset.portrait;localStorage.setItem('dalmuti-portrait',current);renderPicker()})}
async function portraitJoin(code){const name=document.querySelector('#name').value.trim();if(!name){toast('닉네임을 입력해 주세요.');document.querySelector('#name').focus();return}session=null;document.querySelector('#roomCode').value=code;if(await act('join-room',{name,roomCode:code,portrait:current}))connect()}
function bind(){renderPicker();const create=document.querySelector('#create'),join=document.querySelector('#join');if(create)create.onclick=async()=>{session=null;if(await act('create-room',{name:document.querySelector('#name').value,portrait:current}))connect()};try{joinCode=portraitJoin}catch{}if(join)join.onclick=()=>portraitJoin(document.querySelector('#roomCode').value)}
document.addEventListener('DOMContentLoaded',bind);bind();
})();