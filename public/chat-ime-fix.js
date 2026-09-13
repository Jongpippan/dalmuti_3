(()=>{
function blockComposingEnter(e){
 if(e.key!=='Enter')return;
 if(e.isComposing||e.keyCode===229){
  e.preventDefault();
  e.stopImmediatePropagation();
 }
}
document.addEventListener('keydown',blockComposingEnter,true);
})();
