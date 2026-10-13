// Import notes captured by the Lambert Chrome side panel into the Reading Workspace.
(function(){
  // Shared UI polish loader. This file already loads on every dashboard visit.
  if(!document.querySelector('script[src="project-board-polish.js"]')){
    const s=document.createElement('script');s.src='project-board-polish.js';document.body.appendChild(s)
  }

  const params=new URLSearchParams(location.search);
  const shouldOpen=params.get('view')==='reading';
  const shouldImport=params.get('import')==='1';
  if(!shouldOpen&&!shouldImport)return;

  const pick=id=>document.getElementById(id);
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const navBtn=document.querySelector('nav button[data-v="reading"]');
    const newBtn=pick('rv2New');
    if(navBtn) navBtn.click();

    if(newBtn){
      clearInterval(timer);
      if(!shouldImport)return;

      newBtn.click();
      const type=params.get('type')||'观念卡';
      const typeEl=pick('rv2Type');
      if(typeEl){typeEl.value=['观念卡','案例卡','方法卡'].includes(type)?type:'观念卡';typeEl.dispatchEvent(new Event('change',{bubbles:true}))}

      const values={
        rv2CardTitle:params.get('title')||'',
        rv2Thought:params.get('thought')||'',
        rv2Excerpt:params.get('excerpt')||'',
        rv2Progress:params.get('progress')||'',
        rv2BookTitle:params.get('sourceTitle')||'',
        rv2Url:params.get('sourceUrl')||''
      };
      Object.entries(values).forEach(([id,value])=>{const el=pick(id);if(el)el.value=value});

      const sourceUrl=params.get('sourceUrl')||'';
      const mode=pick('rv2Mode');
      if(mode&&/weread\.qq\.com/i.test(sourceUrl)){mode.value='weread';mode.dispatchEvent(new Event('change',{bubbles:true}))}

      pick('rv2Save')?.click();
      if(pick('rv2Status'))pick('rv2Status').textContent='已从浏览器侧栏导入';

      const clean=new URL(location.href);
      ['import','type','title','thought','excerpt','progress','sourceTitle','sourceUrl'].forEach(k=>clean.searchParams.delete(k));
      clean.searchParams.set('view','reading');
      history.replaceState({},'',clean.pathname+clean.search+clean.hash);
    }else if(tries>80){clearInterval(timer)}
  },100);
})();