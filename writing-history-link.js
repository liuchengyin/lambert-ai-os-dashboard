// Make archived Daily Writing history titles link directly to their Feishu documents.
(function(){
  const STORE='daily_writing_v2';
  const getStore=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{return {}}};

  let observedRoot=null;
  const observer=new MutationObserver(()=>setTimeout(enhance,0));
  function enhance(){
    const root=document.getElementById('dwHistory');
    if(!root)return false;
    if(observedRoot!==root){observer.disconnect();observer.observe(root,{subtree:true,childList:true});observedRoot=root}
    const store=getStore();
    root.querySelectorAll('.daily-history-item').forEach(item=>{
      if(item.dataset.feishuLinked==='1')return;
      const meta=item.querySelector('span')?.textContent||'';
      const match=meta.match(/\d{4}-\d{2}-\d{2}/);
      const date=match?.[0];
      const row=date?store[date]:null;
      if(!row?.feishuUrl)return;
      const strong=item.querySelector('strong');
      if(!strong)return;
      const a=document.createElement('a');
      a.className='writing-history-feishu-link';
      a.href=row.feishuUrl;
      a.target='_blank';
      a.rel='noopener';
      a.innerHTML=`${strong.innerHTML} <span class="writing-history-external">↗</span>`;
      a.addEventListener('click',e=>e.stopPropagation());
      strong.replaceWith(a);
      item.dataset.feishuLinked='1';
    });
    return true;
  }

  let tries=0;
  const boot=setInterval(()=>{tries++;if(enhance()||tries>80)clearInterval(boot)},250);
  window.addEventListener('focus',()=>setTimeout(enhance,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(enhance,0)});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-v="writing"],#writing'))setTimeout(enhance,40)});
  window.addEventListener('storage',e=>{if(e.key===STORE)setTimeout(enhance,0)});

})();
