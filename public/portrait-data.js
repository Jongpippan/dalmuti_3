(()=>{
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SKINS=['#f3d2bc','#e7b48e','#c98763','#9a6048','#654033'];
const BGS=['#6c4c72','#46607a','#6a593e','#385052','#70465d','#4e6973'];
const HAIRS=['#2b1c17','#171717','#9a5038','#211512','#d7d3cf','#5a3528'];
const eyes=`<circle cx="25" cy="35" r="1.7" fill="#261914"/><circle cx="39" cy="35" r="1.7" fill="#261914"/>`;
const faces=[`<path d="M26 43c4 3 8 3 12 0" fill="none" stroke="#8b4b46" stroke-width="1.8" stroke-linecap="round"/>`,`<path d="M25 42c4 5 10 5 14 0" fill="#fff" stroke="#8b4b46" stroke-width="1.3"/>`,`<path d="M27 43h10" fill="none" stroke="#8b4b46" stroke-width="1.6" stroke-linecap="round"/>`];
const hairShapes=[
 c=>`<path d="M14 30C15 16 22 8 32 8c11 0 18 8 19 22-5-5-11-8-19-8s-14 3-18 8z" fill="${c}"/>`,
 c=>`<path d="M13 31C14 15 22 7 32 7s19 9 20 25c-4-5-7-7-10-9v24H21V23c-3 2-6 4-8 8z" fill="${c}"/>`,
 c=>`<path d="M14 31c-2-8 1-17 8-21 4-2 8-2 10 1 4-4 10-3 14 1 5 5 6 12 3 20-5-7-11-10-18-10-8 0-13 4-17 9z" fill="${c}"/>`,
 c=>`<path d="M16 27C18 14 24 8 33 8c9 0 15 7 17 19-9-5-25-5-34 0z" fill="${c}"/>`,
 c=>`<path d="M14 30C15 16 22 8 32 8c12 0 19 9 19 23-6-6-12-9-19-9s-14 3-18 8z" fill="${c}"/><path d="M22 15c5-4 13-5 20-2" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>`,
 c=>`<circle cx="32" cy="10" r="7" fill="${c}"/><path d="M14 30C15 17 22 10 32 10s17 7 19 20c-5-5-11-8-19-8s-14 3-18 8z" fill="${c}"/>`
];
const accessories=[
 '',
 `<g fill="none" stroke="#302620" stroke-width="1.8"><circle cx="24" cy="35" r="5"/><circle cx="40" cy="35" r="5"/><path d="M29 35h6M19 34l-5-2M45 34l5-2"/></g>`,
 `<path d="M17 24c7-7 23-7 30 0" fill="none" stroke="#d84e67" stroke-width="3" stroke-linecap="round"/>`,
 `<path d="M20 17l5 5 7-8 7 8 5-5 2 11H18z" fill="#f0c85b" stroke="#a97819" stroke-width="1"/>`,
 `<circle cx="49" cy="43" r="2.3" fill="#f0c85b"/>`,
 `<path d="M18 28c2-12 8-18 14-18s12 6 14 18" fill="none" stroke="#a78bfa" stroke-width="4" stroke-linecap="round"/>`
];
const clamp=(n,max)=>Math.max(0,Math.min(max-1,Number(n)||0));
function customCode(v){if(typeof v==='string'&&v.startsWith('custom:'))return v;return'custom:0.0.0.0.0'}
function parseCustom(v){const a=customCode(v).slice(7).split('.');return{skin:clamp(a[0],SKINS.length),hair:clamp(a[1],HAIRS.length),accessory:clamp(a[2],accessories.length),face:clamp(a[3],faces.length),bg:clamp(a[4],BGS.length)}}
function makeCustom(v){const p=parseCustom(v),skin=SKINS[p.skin],hair=HAIRS[p.hair],bg=BGS[p.bg];return`<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${bg}"/><ellipse cx="32" cy="35" rx="18" ry="20" fill="${skin}"/>${hairShapes[p.hair](hair)}${eyes}${faces[p.face]}${accessories[p.accessory]}</svg>`}
const base=(skin,bg,hair,extra='')=>`<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${bg}"/><ellipse cx="32" cy="35" rx="18" ry="20" fill="${skin}"/>${hairShapes[0](hair)}${extra}</svg>`;
const PORTRAITS={royal:{label:'기본',svg:base('#f1c7a7','#6c4c72','#2b1c17',eyes+faces[0])},mage:{label:'안경',svg:base('#c88e67','#46607a','#171717',eyes+faces[0]+accessories[1])},knight:{label:'짧은 머리',svg:makeCustom('custom:3.3.0.1.2')},princess:{label:'귀걸이',svg:makeCustom('custom:0.2.4.0.3')},ninja:{label:'헤어밴드',svg:makeCustom('custom:1.0.2.2.3')},bard:{label:'활짝 웃는 얼굴',svg:makeCustom('custom:4.0.4.1.4')},fox:{label:'곱슬머리',svg:makeCustom('custom:2.3.0.0.5')},owl:{label:'은발과 안경',svg:makeCustom('custom:1.4.1.2.0')}};
window.DALMUTI_PORTRAITS=PORTRAITS;
window.DALMUTI_PORTRAIT_OPTIONS={skins:SKINS,hairs:HAIRS,accessories:['없음','안경','헤어밴드','왕관','귀걸이','헤드셋'],faces:['미소','활짝 웃음','무표정'],backgrounds:BGS};
window.dalmutiPortraitParse=parseCustom;
window.dalmutiPortraitCode=p=>`custom:${clamp(p.skin,SKINS.length)}.${clamp(p.hair,HAIRS.length)}.${clamp(p.accessory,accessories.length)}.${clamp(p.face,faces.length)}.${clamp(p.bg,BGS.length)}`;
window.dalmutiPortraitSvg=id=>String(id||'').startsWith('custom:')?makeCustom(id):(PORTRAITS[id]||PORTRAITS.royal).svg;
window.dalmutiPortraitLabel=id=>String(id||'').startsWith('custom:')?'커스텀 캐릭터':(PORTRAITS[id]||PORTRAITS.royal).label;
window.dalmutiPortraitIds=()=>Object.keys(PORTRAITS);
window.dalmutiEsc=esc;
})();