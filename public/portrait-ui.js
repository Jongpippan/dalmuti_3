(()=>{
let current=localStorage.getItem('dalmuti-portrait')||'custom:0.0.0.0.0';
if(!String(current).startsWith('custom:'))current='custom:0.0.0.0.0';
let config=window.dalmutiPortraitParse?.(current)||{skin:0,hair:0,accessory:0,face:0,bg:0};
window.getDalmutiPortrait=()=>current;
const labels={skin:'피부',hair:'머리',accessory:'액세서리',face:'표정',bg:'배경'};
function save(){current=window.dalmutiPortraitCode?.(config)||'custom:0.0.0.0.0';localStorage.setItem('dalmuti-portrait',current)}
function swatch(value,selected,kind,index,label){const style=(kind==='skin'||kind==='hair'||kind==='bg')?` style="--swatch:${value}"`:'';return `<button type="button" class="portraitPart ${selected?'selected':''}" data-kind="${kind}" data-index="${index}"${style} aria-label="${label||`${labels[kind]} ${index+1}`}" title="${label||`${labels[kind]} ${index+1}`}">${kind==='skin'||kind==='hair'||kind==='bg'?'<span class="colorDot"></span>':`<span class="partMini">${window.dalmutiPortraitSvg?.(window.dalmutiPortraitCode?.({...config,[kind]:index}))||''}</span>`}</button>`}
function renderPicker(){const box=document.querySelector('#portraitPicker');if(!box)return;const o=window.DALMUTI_PORTRAIT_OPTIONS;if(!o)return;box.innerHTML=`<div class="portraitCustomizer"><div class="portraitPreview">${window.dalmutiPortraitSvg?.(current)||''}</div><div class="portraitOptions">${[
 ['skin',o.skins],['hair',o.hairs],['accessory',o.accessories],['face',o.faces],['bg',o.backgrounds]
].map(([kind,items])=>`<div class="portraitOptionRow"><span>${labels[kind]}</span><div class="portraitOptionChoices">${items.map((v,i)=>swatch(v,config[kind]===i,kind,i,typeof v==='string'&&!v.startsWith('#')?v:null)).join('')}</div></div>`).join('')}</div></div>`;
 box.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{config={...config,[b.dataset.kind]:Number(b.dataset.index)};save();renderPicker()})
}
async function portraitJoin(code){const name=document.querySelector('#name').value.trim();if(!name){toast('닉네임을 입력해 주세요.');document.querySelector('#name').focus();return}session=null;document.querySelector('#roomCode').value=code;if(await act('join-room',{name,roomCode:code,portrait:current}))connect()}
function bind(){save();renderPicker();const create=document.querySelector('#create'),join=document.querySelector('#join');if(create)create.onclick=async()=>{session=null;if(await act('create-room',{name:document.querySelector('#name').value,portrait:current}))connect()};try{joinCode=portraitJoin}catch{}if(join)join.onclick=()=>portraitJoin(document.querySelector('#roomCode').value)}
document.addEventListener('DOMContentLoaded',bind);bind();
})();