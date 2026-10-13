// Task Board V6: simplify cards, keep existing task workflow, add countdown display
(function(){
  const QUAD_LABEL={q1:'重要且紧急',q2:'重要不紧急',q3:'紧急不重要',q4:'不重要不紧急'};

  function countdownText(task){
    if(task.status==='已完成')return '';
    if(!task.due)return '未设截止';
    const due=new Date(task.due).getTime();
    if(Number.isNaN(due))return '';
    const diff=due-Date.now();
    const abs=Math.abs(diff);
    const day=Math.floor(abs/86400000);
    const hour=Math.floor((abs%86400000)/3600000);
    const minute=Math.floor((abs%3600000)/60000);
    let span='';
    if(day>0)span=`${day}天${hour}小时`;
    else if(hour>0)span=`${hour}小时${minute}分`;
    else span=`${Math.max(1,minute)}分钟`;
    return diff<0?`已逾期 ${span}`:`倒计时 ${span}`;
  }

  function findTask(card){
    const id=card.dataset.taskId;
    return (window.state?.tasks||[]).find(t=>t.id===id);
  }

  function enhanceCard(card){
    const task=findTask(card);if(!task)return;
    const title=card.querySelector('.task-v5-title');
    const meta=card.querySelector('.task-v5-meta');
    if(!title||!meta)return;

    // P1/P2/P3 no longer shown on cards; data and filters stay unchanged.
    [...meta.querySelectorAll('.task-v5-chip')].forEach(chip=>{
      if(/^P[123]$/.test(chip.textContent.trim()))chip.remove();
    });

    // Replace raw deadline chip with a compact countdown in the top-right.
    [...meta.querySelectorAll('.task-v5-chip')].forEach(chip=>{
      const text=chip.textContent.trim();
      if(/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/.test(text)||text.startsWith('已逾期 ·'))chip.remove();
    });

    let top=card.querySelector('.task-v6-top');
    if(!top){
      top=document.createElement('div');top.className='task-v6-top';
      title.parentNode.insertBefore(top,title);top.appendChild(title);
      const countdown=document.createElement('div');countdown.className='task-v6-countdown';top.appendChild(countdown);
    }
    const countdown=top.querySelector('.task-v6-countdown');
    const text=countdownText(task);countdown.textContent=text;countdown.style.display=text?'':'none';
    countdown.classList.toggle('overdue',text.startsWith('已逾期'));

    const matrix=[...meta.querySelectorAll('.task-v5-chip')].find(x=>x.classList.contains(task.matrix));
    if(matrix){matrix.textContent=QUAD_LABEL[task.matrix]||matrix.textContent;matrix.classList.add('task-v6-matrix')}
    card.classList.add('task-v6-card');
  }

  function enhanceBoard(){
    document.querySelectorAll('.task-v5-card').forEach(enhanceCard);
    const preview=document.querySelector('.matrix-preview');if(preview)preview.remove();
  }

  function wrapRenderer(){
    if(typeof window.renderTaskBoard!=='function'||window.renderTaskBoard.__v6Wrapped)return;
    const original=window.renderTaskBoard;
    const wrapped=function(){const out=original.apply(this,arguments);setTimeout(enhanceBoard,0);return out};
    wrapped.__v6Wrapped=true;window.renderTaskBoard=wrapped;
  }

  wrapRenderer();
  enhanceBoard();
  setInterval(()=>{
    wrapRenderer();
    document.querySelectorAll('.task-v5-card').forEach(card=>{
      const task=findTask(card);const el=card.querySelector('.task-v6-countdown');
      if(task&&el){const text=countdownText(task);el.textContent=text;el.style.display=text?'':'none';el.classList.toggle('overdue',text.startsWith('已逾期'))}
    });
  },60000);

  const observer=new MutationObserver(()=>setTimeout(enhanceBoard,0));
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();