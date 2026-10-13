// Project board polish: remove redundant copy, make metrics navigable, keep header date live.
(function(){
  const $=id=>document.getElementById(id);

  // Remove the two pieces of explanatory copy marked as unnecessary.
  const projectHead=document.querySelector('.project-page-head');
  const projectHeadDesc=projectHead?.querySelector('p');
  if(projectHeadDesc) projectHeadDesc.remove();
  const boardToolbar=document.querySelector('.project-board-toolbar');
  boardToolbar?.querySelector('.meta')?.remove();

  // Header date always follows the actual local date, including midnight / returning to the tab.
  function refreshToday(){
    const el=$('today');
    if(!el)return;
    el.textContent=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  }
  refreshToday();
  setInterval(refreshToday,60*1000);
  window.addEventListener('focus',refreshToday);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});

  function scrollToEl(el){
    if(!el)return;
    el.scrollIntoView({behavior:'smooth',block:'start'});
    el.classList.add('project-jump-focus');
    setTimeout(()=>el.classList.remove('project-jump-focus'),1200);
  }

  function targetForMetric(metric){
    if(metric.classList.contains('project-metric-doing')) return document.querySelector('.project-col-doing');
    if(metric.classList.contains('project-metric-done')) return document.querySelector('.project-col-done');
    if(metric.classList.contains('project-metric-overdue')) {
      return document.querySelector('.project-card-overdue') || document.querySelector('.project-col-todo') || $('projectBoard');
    }
    if(metric.classList.contains('project-metric-progress')) {
      if(typeof openView==='function') openView('tasks');
      setTimeout(()=>scrollToEl($('taskBoard')),60);
      return null;
    }
    return $('projectBoard');
  }

  function bindMetrics(){
    const dash=$('projectDashboard');
    if(!dash)return;
    dash.querySelectorAll('.project-metric').forEach(metric=>{
      metric.classList.add('project-metric-clickable');
      metric.setAttribute('role','button');
      metric.tabIndex=0;
      metric.onclick=()=>{const target=targetForMetric(metric);if(target)scrollToEl(target)};
      metric.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();metric.click()}};
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    .project-page-head p{display:none!important}
    .project-board-toolbar .meta{display:none!important}
    .project-metric-clickable{cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease}
    .project-metric-clickable:hover{transform:translateY(-3px);border-color:#d3d6dd}
    .project-metric-clickable:active{transform:translateY(-1px) scale(.99)}
    .project-jump-focus{outline:2px solid rgba(94,92,230,.22);outline-offset:5px}
  `;
  document.head.appendChild(style);

  bindMetrics();
  const dash=$('projectDashboard');
  if(dash){
    const observer=new MutationObserver(()=>bindMetrics());
    observer.observe(dash,{childList:true,subtree:true});
  }
})();