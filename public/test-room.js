(()=>{
  const btn=document.querySelector('#testRoom');
  if(!btn)return;
  btn.addEventListener('click',async()=>{
    const input=document.querySelector('#name');
    const name=(input?.value||'').trim()||'테스터';
    if(input&&!input.value.trim())input.value=name;
    session=null;
    if(await act('create-test-room',{name}))connect();
  });
})();
