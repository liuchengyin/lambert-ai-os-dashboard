// UI polish V3 — apply screenshot-requested structural changes after dynamic renderers.
(function(){
  const $=id=>document.getElementById(id);

  function removeProjectMaterialEntry(){
    const card=document.querySelector('#projects .task-persistence-card');
    if(card)card.remove();
  }

  function removeSettingsModule(){
    const navBtn=document.querySelector('nav button[data-v="settings"]');
    if(navBtn)navBtn.remove();
    const section=$('settings');
    if(section)section.remove();
  }

  function moveMainlineSelectBelowCard(){
    const select=$('homeMainlineSelect');
    if(!select)return;
    const card=select.closest('.card');
    if(!card)return;
    let row=card.querySelector('.home-mainline-selector-row');
    if(!row){
      row=document.createElement('div');
      row.className='home-mainline-selector-row';
      const mainCard=card.querySelector('#homeMainlineCard,.home-mainline-card');
      if(mainCard)mainCard.insertAdjacentElement('afterend',row);
      else card.appendChild(row);
    }
    if(select.parentElement!==row)row.appendChild(select);
  }

  function stripTaskSubtitle(){
    const p=document.querySelector('.task-v5-head p');
    if(p)p.remove();
  }

  function stripWritingSubtitle(){
    const p=document.querySelector('.daily-writing-v2 .daily-head p');
    if(p)p.remove();
  }

  function countdownText(due,status){
    if(!due||status==='已完成')return '';
    const target=new Date(due).getTime();
    if(Number.isNaN(target))return '';
    let diff=target-Date.now();
    const overdue=diff<0;diff=Math.abs(diff);
    const days=Math.floor(diff/86400000);
    const hours=Math.floor((diff%86400000)/3600000);
    const mins=Math.floor((diff%3600000)/60000);
    let body='';
    if(days)body=`${days}天${hours}小时`;
    else if(hours)body=`${hours}小时${mins}分`;
    else body=`${Math.max(1,mins)}分钟`;
    return overdue?`已逾期 ${body}`:`倒计时 ${body}`;
  }

  function polishTaskCards(){
    document.querySelectorAll('.task-v5-card').forEach(card=>{
      const id=card.dataset.taskId;
      let task=null;
      try{task=state?.tasks?.find(t=>t.id===id)}catch{}
      if(!task)return;

      const title=card.querySelector('.task-v5-title');
      if(title&&!title.closest('.task-v5-title-row')){
        const row=document.createElement('div');row.className='task-v5-title-row';
        title.parentNode.insertBefore(row,title);row.appendChild(title);
        const cd=document.createElement('span');cd.className='task-v5-countdown';row.appendChild(cd);
      }
      const cd=card.querySelector('.task-v5-countdown');
      if(cd)cd.textContent=countdownText(task.due,task.status);

      const meta=card.querySelector('.task-v5-meta');
      if(meta){
        [...meta.querySelectorAll('.task-v5-chip')].forEach(chip=>{
          const txt=chip.textContent.trim();
          if(/^P[123]$/.test(txt))chip.remove();
          if(chip.classList.contains('q1')||chip.classList.contains('q2')||chip.classList.contains('q3')||chip.classList.contains('q4')){
            let corner=card.querySelector('.task-v5-matrix-corner');
            if(!corner){corner=document.createElement('div');corner.className=`task-v5-matrix-corner ${task.matrix||'q2'}`;card.appendChild(corner)}
            corner.textContent=txt;
            chip.remove();
          }
          if(task.due&&(txt.includes('/')||txt.includes('逾期')))chip.remove();
        });
        if(!meta.children.length)meta.remove();
      }
    });
  }

  function loadReadingPolish(){
    if(!document.querySelector('link[href="reading-polish-v5.css"]')){
      const l=document.createElement('link');l.rel='stylesheet';l.href='reading-polish-v5.css';document.head.appendChild(l)
    }
    if(!document.querySelector('script[src="reading-polish-v5.js"]')){
      const s=document.createElement('script');s.src='reading-polish-v5.js';document.body.appendChild(s)
    }
  }

  function loadEnglishLearning(){
    if(!document.querySelector('script[src="english-learning-bootstrap.js"]')){
      const s=document.createElement('script');s.src='english-learning-bootstrap.js';document.body.appendChild(s)
    }
  }

  function polish(){
    removeProjectMaterialEntry();
    removeSettingsModule();
    moveMainlineSelectBelowCard();
    stripTaskSubtitle();
    stripWritingSubtitle();
    polishTaskCards();
    loadReadingPolish();
    loadEnglishLearning();
  }

  polish();
  setTimeout(polish,100);
  setTimeout(polish,400);

  const watchTargets=[$('home'),$('tasks'),$('projects'),$('writing'),$('reading'),document.querySelector('nav')].filter(Boolean);
  watchTargets.forEach(target=>{
    const obs=new MutationObserver(()=>requestAnimationFrame(polish));
    obs.observe(target,{childList:true,subtree:true});
  });

  // Keep countdowns live without rebuilding the board.
  setInterval(polishTaskCards,60000);
})();
