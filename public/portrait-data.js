(()=>{
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=(skin,bg,hair,extra='')=>`<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${bg}"/><ellipse cx="32" cy="35" rx="18" ry="20" fill="${skin}"/><path d="M14 30C15 16 22 8 32 8c11 0 18 8 19 22-5-5-11-8-19-8s-14 3-18 8z" fill="${hair}"/>${extra}</svg>`;
const eyes=`<circle cx="25" cy="34" r="1.7" fill="#261914"/><circle cx="39" cy="34" r="1.7" fill="#261914"/>`;
const smile=`<path d="M26 43c4 3 8 3 12 0" fill="none" stroke="#8b4b46" stroke-width="1.8" stroke-linecap="round"/>`;
const grin=`<path d="M25 42c4 5 10 5 14 0" fill="#fff" stroke="#8b4b46" stroke-width="1.3" stroke-linejoin="round"/>`;
const calm=`<path d="M27 43h10" fill="none" stroke="#8b4b46" stroke-width="1.6" stroke-linecap="round"/>`;
const glasses=`<g fill="none" stroke="#302620" stroke-width="1.8"><circle cx="24" cy="34" r="5"/><circle cx="40" cy="34" r="5"/><path d="M29 34h6M19 33l-5-2M45 33l5-2"/></g>`;
const freckles=`<g fill="#ad6b55"><circle cx="21" cy="39" r=".7"/><circle cx="24" cy="40" r=".7"/><circle cx="40" cy="40" r=".7"/><circle cx="43" cy="39" r=".7"/></g>`;
const earring=`<circle cx="49" cy="43" r="2" fill="#f0c85b"/>`;
const headband=`<path d="M17 24c7-7 23-7 30 0" fill="none" stroke="#d84e67" stroke-width="3" stroke-linecap="round"/>`;
const mole=`<circle cx="42" cy="40" r="1" fill="#74483a"/>`;
const blush=`<g fill="#d98a84" opacity=".45"><ellipse cx="22" cy="40" rx="3" ry="1.4"/><ellipse cx="42" cy="40" rx="3" ry="1.4"/></g>`;
const curl=`<path d="M14 31c-2-8 1-17 8-21 4-2 8-2 10 1 4-4 10-3 14 1 5 5 6 12 3 20-5-7-11-10-18-10-8 0-13 4-17 9z" fill="#211512"/>`;
const buzz=`<path d="M16 27C18 14 24 8 33 8c9 0 15 7 17 19-9-5-25-5-34 0z" fill="#151515"/>`;
const silver=`<path d="M14 30C15 16 22 8 32 8c12 0 19 9 19 23-6-6-12-9-19-9s-14 3-18 8z" fill="#d7d3cf"/><path d="M22 15c5-4 13-5 20-2" fill="none" stroke="#f3f0eb" stroke-width="3" stroke-linecap="round"/>`;
const PORTRAITS={
 royal:{label:'밝은 미소',svg:base('#f1c7a7','#6c4c72','#2b1c17',eyes+smile+blush)},
 mage:{label:'둥근 안경',svg:base('#c88e67','#46607a','#171717',glasses+smile)},
 knight:{label:'짧은 머리',svg:`<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#6a593e"/><ellipse cx="32" cy="35" rx="18" ry="20" fill="#744934"/>${buzz}${eyes}${grin}</svg>`},
 princess:{label:'주근깨와 귀걸이',svg:base('#f0d0bc','#74534a','#9a5038',eyes+smile+freckles+earring)},
 ninja:{label:'헤어밴드',svg:base('#d69a73','#385052','#2b211f',eyes+calm+headband)},
 bard:{label:'활짝 웃는 얼굴',svg:base('#5d3829','#70465d','#1e1512',eyes+grin+earring)},
 fox:{label:'곱슬머리',svg:`<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#4e6973"/><ellipse cx="32" cy="35" rx="18" ry="20" fill="#b86f50"/>${curl}${eyes}${smile}${freckles}</svg>`},
 owl:{label:'은발과 안경',svg:`<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#5f536c"/><ellipse cx="32" cy="35" rx="18" ry="20" fill="#e5b58e"/>${silver}${glasses}${calm}${mole}</svg>`}
};
window.DALMUTI_PORTRAITS=PORTRAITS;
window.dalmutiPortraitSvg=id=>(PORTRAITS[id]||PORTRAITS.royal).svg;
window.dalmutiPortraitLabel=id=>(PORTRAITS[id]||PORTRAITS.royal).label;
window.dalmutiPortraitIds=()=>Object.keys(PORTRAITS);
window.dalmutiEsc=esc;
})();
