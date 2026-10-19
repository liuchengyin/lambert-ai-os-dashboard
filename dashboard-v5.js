// Dashboard V5: overview + Eisenhower tasks + combined filters + minute due time
(function(){
  const $=id=>document.getElementById(id);
  const setLS=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const getLS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
  const QUADS={q1:{name:'重要且紧急',short:'重要·紧急',rank:1},q2:{name:'重要不紧急',short:'重要·不紧急',rank:2},q3:{name:'紧急不重要',short:'紧急·不重要',rank:3},q4:{name:'不重要不紧急',short:'不重要·不紧急',rank:4}};
  const PRIORITY={P1:1,P2:2,P3:3};
  let filter={q:'',priority:'all',date:'all',matrix:'all',sort:'smart'};
  let editTaskIndex=-1;

  function normalizeDue(v){if(!v)return '';return /^\d{4}-\d{2}-\d{2}$/.test(v)?`${v}T23:59`:v}
  state.tasks=(state.tasks||[]).map(t=>({...t,due:normalizeDue(t.due),matrix:QUADS[t.matrix]?t.matrix:'q2'}));
  setLS('tasks',state.tasks);

  function localDateKey(d=new Date()){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`
  }
  function dueDate(t){return (t.due||'').slice(0,10)}
  function dueLabel(v){if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return v.replace('T',' ');return d.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}
  function isOverdue(t){return t.status!=='已完成'&&t.due&&new Date(t.due).getTime()<Date.now()}
  function tomorrowKey(){const d=new Date();d.setDate(d.getDate()+1);return localDateKey(d)}
  function inNext7(t){if(!t.due)return false;const x=new Date(t.due).getTime(),now=new Date();const end=new Date(now);end.setDate(end.getDate()+7);return x>=now.getTime()&&x<=end.getTime()}
  function smartRank(t){return [QUADS[t.matrix]?.rank||9,PRIORITY[t.priority]||9,t.due?new Date(t.due).getTime():Number.MAX_SAFE_INTEGER,t.createdAt||'']}
  function cmpTuple(a,b){for(let i=0;i<a.length;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1}return 0}
  function sortRows(rows){return [...rows].sort((a,b)=>{
    if(filter.sort==='due')return (a.due||'9999').localeCompare(b.due||'9999');
    if(filter.sort==='priority')return (PRIORITY[a.priority]||9)-(PRIORITY[b.priority]||9)||smartRank(a)[0]-smartRank(b)[0];
    if(filter.sort==='created')return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
    return cmpTuple(smartRank(a),smartRank(b));
  })}
  function filterRows(rows){
    const q=filter.q.trim().toLowerCase();
    return rows.filter(t=>{
      if(q&&!String([t.title,t.project,t.note].join(' ')).toLowerCase().includes(q))return false;
      if(filter.priority!=='all'&&t.priority!==filter.priority)return false;
      if(filter.matrix!=='all'&&t.matrix!==filter.matrix)return false;
      if(filter.date==='today'&&dueDate(t)!==localDateKey())return false;
      if(filter.date==='tomorrow'&&dueDate(t)!==tomorrowKey())return false;
      if(filter.date==='week'&&!inNext7(t))return false;
      if(filter.date==='overdue'&&!isOverdue(t))return false;
      if(filter.date==='nodate'&&t.due)return false;
      return true;
    })
  }
  function persistAll(){
    setLS('tasks',state.tasks);
    renderTaskBoard();renderHome();
    if(typeof renderProjectBoard==='function')renderProjectBoard();
    const dash=$('projectDashboard');if(dash&&typeof renderProjectDashboard==='function')renderProjectDashboard();
  }
  window.persistTasks=persistAll;

  function jumpToTask(id){
    if(window.TaskCenter){TaskCenter.openTask(id);return}
    openView('tasks');setTimeout(()=>{const el=document.querySelector(`[data-task-id="${CSS.escape(id)}"]`);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('highlight-jump');setTimeout(()=>el.classList.remove('highlight-jump'),1400)}},80)
  }
  function jumpToProject(id){
    if(window.TaskCenter){TaskCenter.openProject(id);return}
    openView('projects');setTimeout(()=>{const p=(state.projects||[]).find(x=>x.id===id);if(!p)return;const card=[...document.querySelectorAll('.project-card')].find(x=>x.querySelector('.project-collapse-title,h4')?.textContent===p.name);if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.classList.add('highlight-jump');setTimeout(()=>card.classList.remove('highlight-jump'),1400)}},80)
  }

  // The project-focused task center owns task presentation and editing.
  function openTaskEditor(index){if(window.TaskCenter&&state.tasks[index])TaskCenter.editTask(state.tasks[index].id)}
  renderTaskBoard=function(){if(window.TaskCenter)TaskCenter.render()};

  // Overview
  const MAINLINE='mainline_project_id_v1',TOP3='top3_task_ids_v1';
  function activeMainlineId(){let id=getLS(MAINLINE,'');if(!state.projects.some(p=>p.id===id)){id=(state.projects.find(p=>p.status==='进行中')||state.projects.find(p=>p.status==='待开始')||state.projects[0])?.id||'';setLS(MAINLINE,id)}return id}
  function todayTasks(){const today=localDateKey();return sortRows(state.tasks.filter(t=>t.status!=='已完成'&&(dueDate(t)===today||isOverdue(t))))}
  function homeTaskRow(t){return `<div class="home-task-row" data-home-task="${esc(t.id)}"><div class="home-task-row-title">${esc(t.title)}</div><div class="home-task-row-meta"><span>${esc(({q1:'P0',q2:'P1',q3:'P2',q4:'P3'}[t.matrix]||'P1'))}</span>${t.due?`<span>${isOverdue(t)?'逾期 · ':''}${esc(dueLabel(t.due))}</span>`:''}${t.project?`<span>${esc(t.project)}</span>`:''}</div></div>`}
  function recentProjectsHtml(){if(!state.projects.length)return '<div class="meta">暂无项目</div>';return state.projects.slice(0,5).map(p=>`<div class="item" data-home-project="${esc(p.id)}" style="cursor:pointer"><b>${esc(p.name)}</b><div class="meta">${esc(p.status)}${p.due?' · 截止 '+esc(p.due):''}</div></div>`).join('')}


  // Sprint 1: daily action hub. Read existing stores; do not duplicate task/project data.
  renderHome=function(){
    const home=$('home');if(!home)return;
    const today=localDateKey(),open=state.tasks.filter(t=>t.status!=='已完成');
    const overdue=sortRows(open.filter(isOverdue));
    const todayDue=open.filter(t=>dueDate(t)===today);
    const chosen=getLS(TOP3,[]).filter(id=>open.some(t=>t.id===id)).slice(0,3);
    const top=chosen.length?chosen.map(id=>open.find(t=>t.id===id)).filter(Boolean):sortRows(open).slice(0,3);
    const mainId=activeMainlineId();
    const active=state.projects.filter(p=>p.status==='进行中');
    const projects=(active.length?active:state.projects.filter(p=>p.status!=='已完成')).slice(0,3);
    const reviews=getLS('daily_reviews_v2',{});
    const record=reviews&&typeof reviews==='object'?reviews[today]:null;
    const reviewDone=!!(record&&['goal','delivery','gap','restart','deliverable'].some(k=>String(record[k]||'').trim()));
    const taskRow=t=>'<div class="s1-task" data-s1-task="'+esc(t.id)+'"><button class="s1-check" type="button" data-s1-done="'+esc(t.id)+'" title="标记完成" aria-label="完成任务">✓</button><div class="s1-task-info"><strong>'+esc(t.title)+'</strong><div class="s1-sub">'+(t.project?'<span>'+esc(t.project)+'</span>':'')+'<span>'+esc(({q1:'P0',q2:'P1',q3:'P2',q4:'P3'}[t.matrix]||'P1'))+'</span>'+(t.due?'<span>'+esc(dueLabel(t.due))+'</span>':'')+'</div></div><span class="s1-chevron">›</span></div>';
    const projectRow=p=>{
      const related=state.tasks.filter(t=>t.project===p.name||t.project===p.id);
      const completed=related.filter(t=>t.status==='已完成').length;
      return '<div class="s1-project" data-s1-project="'+esc(p.id)+'"><span class="s1-project-icon">◈</span><div><strong>'+esc(p.name)+'</strong><small>'+esc(p.status)+(p.due?' · 截止 '+esc(p.due):'')+(related.length?' · '+completed+'/'+related.length+' 任务完成':'')+'</small></div><span class="s1-chevron">›</span></div>';
    };
    home.innerHTML=[
      '<div class="s1-head"><div><div class="s1-eyebrow">YOUR DAY · '+esc(today)+'</div><h2>今天，先完成最重要的事</h2><p>聚焦三件事，减少切换，持续推进。</p></div><button id="s1AddTask" class="s1-primary">＋ 新建任务</button></div>',
      '<div class="s1-metrics"><div class="s1-metric"><span>待办任务</span><strong>'+open.length+'</strong><small>尚未完成</small></div><div class="s1-metric '+(overdue.length?'s1-alert':'')+'"><span>已逾期</span><strong>'+overdue.length+'</strong><small>'+(overdue.length?'需要优先处理':'当前无逾期')+'</small></div><div class="s1-metric"><span>进行中项目</span><strong>'+active.length+'</strong><small>阶段目标</small></div><div class="s1-metric"><span>今日复盘</span><strong class="s1-review-stat">'+(reviewDone?'已记录':'待填写')+'</strong><small>每天留一点思考</small></div></div>',
      '<div class="s1-main"><div class="s1-left">',
      '<section class="s1-panel s1-focus"><div class="s1-panel-title"><div><span class="s1-kicker">01 · TODAY’S FOCUS</span><h3>今日 Top 3</h3><p>'+(chosen.length?'你手动指定的今日重点':'按优先级推荐，点击「设定」可以调整')+'</p></div><button id="defineTop3" class="s1-link">设定 Top 3 →</button></div><div class="s1-tasks">'+(top.length?top.map(taskRow).join(''):'<div class="s1-empty">暂无待办任务，先添加今天要做的第一件事。</div>')+'</div></section>',
      '<section class="s1-panel"><div class="s1-panel-title"><div><span class="s1-kicker">02 · NEEDS ATTENTION</span><h3>待处理提醒</h3></div><button id="s1AllTasks" class="s1-link">查看任务 →</button></div>',
      (overdue.length?'<div class="s1-notice s1-notice-alert">有 <b>'+overdue.length+'</b> 项任务已逾期，建议先处理。</div>'+overdue.slice(0,3).map(t=>'<div class="s1-alert-row" data-s1-task="'+esc(t.id)+'"><span class="s1-alert-dot"></span><span>'+esc(t.title)+'</span><small>'+esc(dueLabel(t.due))+'</small></div>').join(''):'<div class="s1-notice">目前没有逾期任务。'+(todayDue.length?'今天另有 '+todayDue.length+' 项任务到期。':'保持当前节奏。')+'</div>'),
      '</section></div><div class="s1-right">',
      '<section class="s1-panel"><div class="s1-panel-title"><div><span class="s1-kicker">03 · PROJECTS</span><h3>正在推进</h3></div><button id="s1Projects" class="s1-link">项目看板 →</button></div><div class="s1-projects">'+(projects.length?projects.map(projectRow).join(''):'<div class="s1-empty">尚无进行中的项目</div>')+'</div><div class="s1-mainline"><label for="homeMainlineSelect">当前主线</label><select id="homeMainlineSelect" class="home-inline-select"><option value="">未选择</option>'+state.projects.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===mainId?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div></section>',
      '<section class="s1-panel s1-review"><div class="s1-panel-title"><div><span class="s1-kicker">04 · REFLECTION</span><h3>每日复盘</h3><p>目标 → 实际 → 调整</p></div><span class="s1-review-pill">'+(reviewDone?'已记录':'未填写')+'</span></div><button id="s1Review" class="s1-review-button">'+(reviewDone?'查看今日复盘':'开始今日复盘')+' <span>→</span></button></section>',
      '<section class="s1-panel s1-shortcuts"><span class="s1-kicker">QUICK ACCESS</span><div class="s1-shortcut-row"><button data-s1-view="knowledge">↗ 常用链接</button><button data-s1-view="reading">▤ 每日阅读</button><button data-s1-view="english">◉ 英语学习</button></div></section>',
      '</div></div>'
    ].join('');
    $('homeMainlineSelect').onchange=e=>{setLS(MAINLINE,e.target.value);renderHome()};
    $('defineTop3').onclick=openTop3;
    $('s1AddTask').onclick=()=>{if(window.TaskCenter){TaskCenter.newTask();return}openView('tasks');const d=$('taskAddDetails');if(d)d.open=true;$('tv5Title')?.focus()};
    $('s1AllTasks').onclick=()=>{openView('tasks');const d=$('tv5Date');if(d){d.value=overdue.length?'overdue':'all';d.dispatchEvent(new Event('change'))}};
    $('s1Projects').onclick=()=>openView('projects');
    $('s1Review').onclick=()=>openView('review');
    home.querySelectorAll('[data-s1-view]').forEach(b=>b.onclick=()=>{const nav=document.querySelector('nav button[data-v="'+b.dataset.s1View+'"]');if(nav)nav.click()});
    home.querySelectorAll('[data-s1-task]').forEach(el=>el.onclick=()=>jumpToTask(el.dataset.s1Task));
    home.querySelectorAll('[data-s1-project]').forEach(el=>el.onclick=()=>jumpToProject(el.dataset.s1Project));
    home.querySelectorAll('[data-s1-done]').forEach(b=>b.onclick=e=>{e.stopPropagation();const t=state.tasks.find(t=>t.id===b.dataset.s1Done);if(!t||t.status==='已完成')return;t.status='已完成';persistAll()});
  };

  const topDlg=document.createElement('dialog');topDlg.id='top3Dlg';topDlg.innerHTML=`<form method="dialog" class="task-v5-dialog"><h3>定义今日 Top 3</h3><div class="meta">从未完成任务中最多选择 3 个。首页点击后可直接跳到对应任务。</div><input id="top3Search" placeholder="搜索任务"><div id="top3Picker" class="top3-picker"></div><div class="dlgActions"><button value="cancel">取消</button><button id="top3Save" type="button" class="task-primary-btn">保存</button></div></form>`;document.body.appendChild(topDlg);
  function renderTopPicker(){const q=$('top3Search').value.trim().toLowerCase(),selected=new Set(getLS(TOP3,[]));const rows=sortRows(state.tasks.filter(t=>t.status!=='已完成'&&(!q||String([t.title,t.project].join(' ')).toLowerCase().includes(q))));$('top3Picker').innerHTML=rows.map(t=>`<label class="top3-option"><input type="checkbox" value="${esc(t.id)}" ${selected.has(t.id)?'checked':''}><span>${esc(t.title)}<small>${QUADS[t.matrix].short} · ${esc(({q1:'P0',q2:'P1',q3:'P2',q4:'P3'}[t.matrix]||'P1'))}${t.due?' · '+esc(dueLabel(t.due)):''}</small></span></label>`).join('')||'<div class="meta" style="padding:10px">暂无任务</div>';$('top3Picker').querySelectorAll('input').forEach(cb=>cb.onchange=()=>{const checked=[...$('top3Picker').querySelectorAll('input:checked')];if(checked.length>3){cb.checked=false;alert('Top 3 最多选择 3 个任务。')}})}
  function openTop3(){$('top3Search').value='';renderTopPicker();topDlg.showModal()}
  $('top3Search').oninput=renderTopPicker;$('top3Save').onclick=()=>{const ids=[...$('top3Picker').querySelectorAll('input:checked')].map(x=>x.value).slice(0,3);setLS(TOP3,ids);topDlg.close();renderHome()};

  // Main navigation: ensure new task renderer is called after switching view.
  document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.v==='tasks')setTimeout(renderTaskBoard,0);if(b.dataset.v==='home')setTimeout(renderHome,0)}));

  renderHome();
  const module=document.createElement('script');module.src='task-center.js?v=20261019-focus1';module.async=false;document.body.appendChild(module);
})();
