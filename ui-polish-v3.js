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

  function loadReadingPolish(){
    if(!document.querySelector('link[href="reading-polish-v5.css"]')){
      const l=document.createElement('link');l.rel='stylesheet';l.href='reading-polish-v5.css';document.head.appendChild(l)
    }
    if(!document.querySelector('script[src="reading-polish-v5.js"]')){
      const s=document.createElement('script');s.src='reading-polish-v5.js';document.body.appendChild(s)
    }
  }

  function loadEnglishLearning(){
    if(!document.querySelector('link[href="english-learning-v1.css"]')){
      const l=document.createElement('link');l.rel='stylesheet';l.href='english-learning-v1.css';document.head.appendChild(l)
    }
    if(!document.querySelector('script[src="english-learning.js"]')){
      const s=document.createElement('script');s.src='english-learning.js';document.body.appendChild(s)
    }
  }

  function polish(){
    removeProjectMaterialEntry();
    removeSettingsModule();
    moveMainlineSelectBelowCard();
    stripTaskSubtitle();
    stripWritingSubtitle();
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

})();
