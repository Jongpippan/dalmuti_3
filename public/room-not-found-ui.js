(()=>{
let redirecting=false;
const originalToast=toast;
toast=function(message){
 const text=String(message||'');
 if(text==='방을 찾을 수 없습니다.'&&!redirecting){
  redirecting=true;
  resetToHome();
  redirecting=false;
  originalToast('방을 찾을 수 없습니다. 메인 화면으로 돌아왔습니다.');
  return
 }
 originalToast(message)
};
})();