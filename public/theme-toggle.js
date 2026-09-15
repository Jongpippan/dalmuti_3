(()=>{
const KEY='dalmuti-excel-theme';
const THEME_HREFS=['excel-theme.css','excel-state.css','card-contrast.css'];
function enabled(){return localStorage.getItem(KEY)!=='off'}
function ensureButtons(){
 const home=document.querySelector('#home');
 if(home&&!home.querySelector('[data-theme-toggle]')){
  const row=document.createElement('div');row.className='heroThemeRow';row.innerHTML='<button type="button" class="tiny" data-theme-toggle></button>';
  home.querySelector('.hero')?.insertAdjacentElement('afterend',row)
 }
 const lobby=document.querySelector('#lobby>header');
 if(lobby&&!lobby.querySelector('[data-theme-toggle]')){
  const b=document.createElement('button');b.type='button';b.className='tiny';b.dataset.themeToggle='';lobby.appendChild(b)
 }
 const game=document.querySelector('#game .gameHead .headActions');
 if(game&&!game.querySelector('[data-theme-toggle]')){
  const b=document.createElement('button');b.type='button';b.className='tiny';b.dataset.themeToggle='';game.insertBefore(b,game.firstChild)
 }
}
function themeLinks(){return [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link=>THEME_HREFS.some(h=>link.getAttribute('href')===h||link.href.endsWith('/'+h)))}
function apply(on,{save=false}={}){
 ensureButtons();
 document.documentElement.dataset.excelTheme=on?'on':'off';
 for(const link of themeLinks())link.disabled=!on;
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
 const btn=e.target.closest?.('[data-theme-toggle]');if(!btn)return;
 apply(!enabled(),{save:true})
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply(enabled()));
else apply(enabled());
})();