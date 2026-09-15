(()=>{
function showToast(message,focusEl){
 try{toast(message)}catch{const t=document.querySelector('#toast');if(t){t.textContent=message;t.classList.add('show')}}
 if(focusEl){focusEl.classList.add('inputError');focusEl.focus({preventScroll:true});focusEl.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>focusEl.classList.remove('inputError'),1800)}
}
function nameInput(){return document.querySelector('#name')}
function roomInput(){return document.querySelector('#roomCode')}
function fail(message,el,e){e.preventDefault();e.stopImmediatePropagation();showToast(message,el)}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('#create,#join');if(!target)return;
 const name=nameInput();if(!name?.value.trim()){fail('닉네임을 입력해 주세요.',name,e);return}
 if(target.id==='join'){const room=roomInput();if(!room?.value.trim()){fail('방 코드를 입력해 주세요.',room,e);return}}
},true);
document.addEventListener('input',e=>{if(e.target.matches?.('#name,#roomCode'))e.target.classList.remove('inputError')},true);
function loadThemeToggle(){
 if(!document.querySelector('link[href="theme-toggle.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='theme-toggle.css';document.head.appendChild(l)}
 if(!document.querySelector('script[src="theme-toggle.js"]')){const s=document.createElement('script');s.src='theme-toggle.js';document.body.appendChild(s)}
}
loadThemeToggle();
})();