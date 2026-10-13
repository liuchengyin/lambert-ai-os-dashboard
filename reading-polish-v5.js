// Reading workspace fullscreen enhancement for Stable V4. Fixed architecture stays unchanged.
(function(){
  const $=id=>document.getElementById(id);

  function ensurePdfSidebarCollapsed(){
    const frame=$('rv2Frame');
    if(!frame)return false;

    const collapse=()=>{
      const mode=document.querySelector('#reading .reading-source-tabs button.active')?.dataset.mode;
      if(mode!=='pdf')return;
      const src=frame.getAttribute('src')||'';
      if(!src||src==='about:blank'||src.includes('navpanes=0'))return;
      const join=src.includes('#')?'&':'#';
      frame.src=`${src}${join}navpanes=0`;
    };

    if(!frame.dataset.pdfSidebarBound){
      frame.dataset.pdfSidebarBound='1';
      $('rv2Load')?.addEventListener('click',()=>setTimeout(collapse,60));
      $('rv2PdfInput')?.addEventListener('change',()=>setTimeout(collapse,120));
      $('rv2PdfMode')?.addEventListener('click',()=>setTimeout(collapse,60));
      frame.addEventListener('load',()=>{
        const src=frame.getAttribute('src')||'';
        if(src&&src!=='about:blank'&&!src.includes('navpanes=0'))setTimeout(collapse,30);
      });
    }

    setTimeout(collapse,80);
    return true;
  }

  function ensureFullscreenControl(){
    const reader=document.querySelector('#reading .reading-stable-reader');
    const toolbar=document.querySelector('#reading .reading-reader-toolbar');
    if(!reader||!toolbar)return false;

    let btn=$('rv2ReaderFullscreen');
    if(!btn){
      btn=document.createElement('button');
      btn.id='rv2ReaderFullscreen';
      btn.type='button';
      btn.className='reading-secondary reading-fullscreen-btn';
      btn.innerHTML='<span class="reading-fullscreen-icon">⛶</span><span class="reading-fullscreen-label">全屏阅读</span>';
      toolbar.appendChild(btn);
    }

    if(!btn.dataset.bound){
      btn.dataset.bound='1';
      btn.onclick=async()=>{
        const active=document.fullscreenElement===reader||reader.classList.contains('is-reader-maximized');
        if(active){
          if(document.fullscreenElement) await document.exitFullscreen?.().catch(()=>{});
          reader.classList.remove('is-reader-maximized');
          syncState();
          return;
        }

        try{
          if(reader.requestFullscreen){
            await reader.requestFullscreen();
          }else{
            reader.classList.add('is-reader-maximized');
          }
        }catch{
          reader.classList.add('is-reader-maximized');
        }
        syncState();
      };
    }

    function syncState(){
      const active=document.fullscreenElement===reader||reader.classList.contains('is-reader-maximized');
      btn.classList.toggle('active',active);
      btn.querySelector('.reading-fullscreen-label').textContent=active?'退出全屏':'全屏阅读';
      document.body.classList.toggle('reading-fullscreen-open',active);
    }

    if(!reader.dataset.fullscreenBound){
      reader.dataset.fullscreenBound='1';
      document.addEventListener('fullscreenchange',()=>{
        if(document.fullscreenElement!==reader)reader.classList.remove('is-reader-maximized');
        syncState();
      });
      document.addEventListener('keydown',e=>{
        if(e.key==='Escape'&&reader.classList.contains('is-reader-maximized')){
          reader.classList.remove('is-reader-maximized');
          syncState();
        }
      });
    }

    syncState();
    return true;
  }

  function apply(){
    const fullscreenReady=ensureFullscreenControl();
    ensurePdfSidebarCollapsed();
    return fullscreenReady;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(apply()||tries>80)clearInterval(timer);
  },80);

  document.addEventListener('click',e=>{
    if(e.target.closest?.('nav button[data-v="reading"]'))setTimeout(apply,30);
  });
})();
