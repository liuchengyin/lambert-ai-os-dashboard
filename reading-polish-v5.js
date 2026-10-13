// Reading workspace V5 polish: remove WeRead UI from the workspace, keep PDF/Web, align controls, move prompts down.
(function(){
  const $=id=>document.getElementById(id);

  function apply(){
    const page=document.querySelector('#reading .reading-v2-page');
    if(!page)return false;

    // Remove explanatory copy.
    document.querySelector('#reading .reading-v2-head p')?.remove();

    // Replace the old source dropdown with two clear choices: PDF / 网页.
    const mode=$('rv2Mode');
    const readerbar=document.querySelector('#reading .reading-v2-readerbar');
    if(mode&&readerbar&&!readerbar.querySelector('.reading-source-segments')){
      mode.value='web';
      mode.dispatchEvent(new Event('change',{bubbles:true}));
      const seg=document.createElement('div');
      seg.className='reading-source-segments';
      seg.innerHTML='<button type="button" data-reading-source="pdf" class="active">PDF</button><button type="button" data-reading-source="web">网页</button>';
      readerbar.appendChild(seg);
      seg.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
        seg.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));
        const isPdf=btn.dataset.readingSource==='pdf';
        const url=$('rv2Url');
        if(url)url.placeholder=isPdf?'PDF 链接，或使用下方“选择本地 PDF”':'网页链接';
        const placeholder=$('rv2ReaderPlaceholder');
        if(placeholder){
          const strong=placeholder.querySelector('strong');
          const span=placeholder.querySelector('span');
          if(strong)strong.textContent=isPdf?'PDF 阅读区':'网页阅读区';
          if(span)span.textContent=isPdf?'粘贴 PDF 链接，或选择本地 PDF。':'粘贴网页链接后点击“加载阅读”。';
        }
      });
      const url=$('rv2Url');if(url)url.placeholder='PDF 链接，或使用下方“选择本地 PDF”';
    }

    // WeRead is handled by the Chrome side panel now, so retire the duplicate in-workbench panel/actions.
    $('rv2WereadPanel')?.remove();
    $('rv2Weread')?.remove();
    $('rv2OpenWeread')?.remove();
    $('rv2SplitWeread')?.remove();

    // Keep the load bar visible for PDF/Web.
    const loadbar=$('rv2Loadbar');if(loadbar)loadbar.style.display='grid';
    const placeholder=$('rv2ReaderPlaceholder');if(placeholder)placeholder.classList.remove('is-hidden');

    // Put template / history / new in one visual row through CSS, and move template prompts to the bottom of note content.
    const prompts=$('rv2Prompts');
    const sourceBlock=document.querySelector('#reading .reading-v2-source-block');
    if(prompts&&sourceBlock&&prompts.previousElementSibling!==sourceBlock){
      sourceBlock.insertAdjacentElement('afterend',prompts);
    }

    return true;
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
