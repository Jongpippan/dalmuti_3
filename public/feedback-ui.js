(()=>{
function showToast(message,focusEl){try{toast(message)}catch{const t=document.querySelector('#toast');if(t){t.textContent=message;t.classList.add('show')}}if(focusEl){focusEl.classList.add('inputError');focusEl.focus({preventScroll:true});focusEl.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>focusEl.classList.remove('inputError'),1800)}}
function nameInput(){return document.querySelector('#name')}
function roomInput(){return document.querySelector('#roomCode')}
function validateName(){const el=nameInput();if(el?.value.trim())return true;showToast('닉네임을 입력해 주세요.',el);return false}
function validateRoom(){const el=roomInput();if(el?.value.trim())return true;showToast('방 코드를 입력해 주세요.',el);return false}
function bind(){
 const create=document.querySelector('#create'),join=document.querySelector('#join');
 if(create&&!create.dataset.feedbackBound){create.dataset.feedbackBound='1';create.onclick=async()=>{if(!validateName())return;session=null;if(await act('create-room',{name:nameInput().value}))connect()}}
 if(join&&!join.dataset.feedbackBound){join.dataset.feedbackBound='1';join.onclick=()=>{if(!validateName()||!validateRoom())return;joinCode(roomInput().value)}}
 [nameInput(),roomInput()].filter(Boolean).forEach(el=>el.addEventListener('input',()=>el.classList.remove('inputError')))
}
document.addEventListener('DOMContentLoaded',bind);bind();
})();