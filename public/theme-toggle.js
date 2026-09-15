(()=>{
const KEY='dalmuti-excel-theme';
const LINKS=['excelThemeCss','excelStateCss','cardContrastCss'];
function enabled(){return localStorage.getItem(KEY)!=='off'}
function apply(on,{save=false}={}){
 document.documentElement.dataset.excelTheme=on?'on':'off';
 for(const id of LINKS){const link=document.getElementById(id);if(link)link.disabled=!on}
 document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
  btn.setAttribute('aria-pressed',String(on));
  btn.textContent=on?'Excel 테마 끄기':'Excel 테마 켜기';
 });
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=on?'#107c41':'#09090b';
 const scheme=document.querySelector('meta[name="color-scheme"]');if(scheme)scheme.content=on?'light':'dark';
 if(save)localStorage.setItem(KEY,on?'on':'off')
}
window.applyDalmutiTheme=apply;
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-theme-toggle]');if(!btn)return;
 apply(!enabled(),{save:true})
});
document.addEventListener('DOMContentLoaded',()=>apply(enabled()));
apply(enabled());
})();