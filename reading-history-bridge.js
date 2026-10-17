// Merge extension-created reading cards into the legacy Daily Reading history panel.
(function(){
  const WORKSPACE_STORE='reading_workspace_v2';
  const LEGACY_STORE='daily_reading_v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};

  function combinedRows(){
    const rows=[];
    const workspace=get(WORKSPACE_STORE,{notes:[]});
    const notes=Array.isArray(workspace?.notes)?workspace.notes:[];
    for(const n of notes){
      if(!n||!(n.title||n.thought||n.excerpt||n.sourceTitle))continue;
      rows.push({
        kind:'card',
        id:n.id||'',
        date:n.date||String(n.savedAt||'').slice(0,10)||'',
        sort:n.savedAt||n.date||'',
        title:`${n.type||'读书卡'}：${n.title||n.sourceTitle||'未命名'}`,
        progress:n.progress||'',
        feishuUrl:n.feishuUrl||''
      });
    }

    const legacy=get(LEGACY_STORE,{});
    for(const [date,r] of Object.entries(legacy||{})){
      if(!r||!(r.source||r.insight||r.excerpt))continue;
      rows.push({kind:'legacy',date,sort:r.savedAt||date,title:r.source||'未命名阅读',progress:r.progress||'',feishuUrl:''});
    }
    rows.sort((a,b)=>String(b.sort||'').localeCompare(String(a.sort||'')));
    return rows.slice(0,40);
  }

  function signature(rows){return JSON.stringify(rows.map(r=>[r.kind,r.id,r.date,r.title,r.progress,r.feishuUrl]));}

  function render(){
    const root=document.getElementById('drHistory');
    if(!root)return false;
    const rows=combinedRows();
    const sig=signature(rows);
    if(root.dataset.lambertHistorySig===sig)return true;
    root.dataset.lambertHistorySig=sig;
    root.innerHTML='';

    if(!rows.length){
      root.innerHTML='<div class="daily-placeholder">还没有阅读记录</div>';
      return true;
    }

    rows.forEach(r=>{
      if(r.kind==='card'){
        const item=document.createElement('div');
        item.className='daily-history-item lambert-reading-card-history';
        const meta=`${esc(r.date)}${r.progress?' · '+esc(r.progress):''}${r.feishuUrl?' · 已归档飞书':''}`;
        if(r.feishuUrl){
          item.innerHTML=`<a class="lambert-reading-history-link" href="${esc(r.feishuUrl)}" target="_blank" rel="noopener"><strong>${esc(r.title)} <span class="lambert-external">↗</span></strong><span>${meta}</span></a>`;
        }else{
          item.innerHTML=`<strong>${esc(r.title)}</strong><span>${meta}</span>`;
        }
        root.appendChild(item);
        return;
      }

      const b=document.createElement('button');
      b.className='daily-history-item';
      b.innerHTML=`<strong>${esc(r.title)}</strong><span>${esc(r.date)}${r.progress?' · '+esc(r.progress):''}</span>`;
      b.onclick=()=>{
        const input=document.getElementById('drDate');
        if(!input)return;
        input.value=r.date;
        input.dispatchEvent(new Event('change',{bubbles:true}));
        setTimeout(render,0);
      };
      root.appendChild(b);
    });
    return true;
  }

  let attempts=0;
  const boot=setInterval(()=>{
    attempts++;
    if(render()||attempts>80)clearInterval(boot);
  },250);

  window.addEventListener('lambert-reading-synced',()=>setTimeout(render,0));
  window.addEventListener('focus',()=>setTimeout(render,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(render,0)});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-v="reading"],#reading'))setTimeout(render,40)});
  window.addEventListener('storage',e=>{if(e.key===WORKSPACE_STORE||e.key===LEGACY_STORE)setTimeout(render,0)});

  // The legacy reading module can repaint its own history. Restore the merged view when that happens.
  const observer=new MutationObserver(()=>{
    const root=document.getElementById('drHistory');
    if(!root)return;
    if(!root.dataset.lambertHistorySig)setTimeout(render,0);
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();

// Compact task cards are rendered directly by V5; load their styles only.
(function(){
  if(!document.querySelector('link[href="task-board-v6.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='task-board-v6.css';document.head.appendChild(l);
  }

})();
