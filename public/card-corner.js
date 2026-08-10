(()=>{
  function addCorners(root=document){
    root.querySelectorAll('.card').forEach(card=>{
      if(card.querySelector('.cornerRank'))return;
      const num=card.querySelector('.num');
      if(!num)return;
      const corner=document.createElement('span');
      corner.className='cornerRank';
      corner.textContent=num.textContent.trim();
      card.appendChild(corner);
    });
  }
  addCorners();
  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches?.('.card'))addCorners(node.parentElement||document);
        else if(node.querySelector?.('.card'))addCorners(node);
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
