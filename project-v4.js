// Project v4 enhancement: project-side task creation uses a full popup form
(function(){
  const createBtn=document.getElementById('projectCreateTaskBtn');
  const editBtn=document.getElementById('projectEditCreateTaskBtn');
  if(!createBtn||!editBtn)return;

  const createOld=document.getElementById('projectNewTaskTitle');
  const editOld=document.getElementById('projectEditNewTaskTitle');
  if(createOld) createOld.style.display='none';
  if(editOld) editOld.style.display='none';
  createBtn.textContent='+ 新建任务';
  editBtn.textContent='+ 新建任务';

  const dlg=document.createElement('dialog');
  dlg.id='projectTaskCreateDlg';
  dlg.innerHTML=`<form method="dialog" class="project-task-create-form">
    <div class="dialog-head"><div><h3>新建任务</h3><p>在项目里直接建任务，保存后自动关联。</p></div><button value="cancel" class="dialog-x" aria-label="关闭">×</button></div>
    <label>任务名称<input id="ptcTitle" placeholder="例如：完成物流版简历第 1 版" autocomplete="off"></label>
    <div class="dialog-two-col">
      <label>优先级<select id="ptcPriority"><option value="P1">P1 · 高</option><option value="P2" selected>P2 · 中</option><option value="P3">P3 · 低</option></select></label>
      <label>重要 / 紧急<select id="ptcMatrix"><option value="q1">重要且紧急</option><option value="q2" selected>重要不紧急</option><option value="q3">紧急不重要</option><option value="q4">不重要不紧急</option></select></label>
    </div>
    <label>截止时间<input id="ptcDue" type="datetime-local"></label>
    <label>完成标准 / 备注<textarea id="ptcNote" placeholder="做到什么程度算完成？"></textarea></label>
    <div class="dialog-context" id="ptcContext"></div>
    <div class="dlgActions"><button value="cancel">取消</button><button id="ptcSave" type="button" class="task-primary-btn">创建并关联</button></div>
  </form>`;
  document.body.appendChild(dlg);

  let mode='create';
  const $=id=>document.getElementById(id);
  function makeId(){return `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
  function projectNameForMode(){return mode==='edit'?($('projectEditName')?.value.trim()||''):($('projectNameInput')?.value.trim()||'')}
  function open(modeName){
    mode=modeName;
    $('ptcTitle').value='';$('ptcPriority').value='P2';$('ptcMatrix').value='q2';$('ptcDue').value='';$('ptcNote').value='';
    const pn=projectNameForMode();$('ptcContext').textContent=pn?`将关联到：${pn}`:'项目尚未命名，任务会在项目保存后完成关联';
    dlg.showModal();setTimeout(()=>$('ptcTitle').focus(),30)
  }
  createBtn.onclick=e=>{e.preventDefault();open('create')};
  editBtn.onclick=e=>{e.preventDefault();open('edit')};

  function refreshPicker(taskId){
    const search=mode==='edit'?$('projectEditTaskSearch'):$('projectTaskSearch');if(search)search.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(()=>{const root=mode==='edit'?$('projectEditTaskOptions'):$('projectTaskOptions');const cb=root?.querySelector(`input[value="${CSS.escape(taskId)}"]`);if(cb){cb.checked=true;cb.dispatchEvent(new Event('change',{bubbles:true}))}},0)
  }
  function refreshDashboard(){
    const el=$('projectDashboard');if(!el||!window.state)return;
    const projects=state.projects||[],tasks=state.tasks||[],today=new Date().toISOString().slice(0,10);
    const total=projects.length,doing=projects.filter(p=>p.status==='进行中').length,done=projects.filter(p=>p.status==='已完成').length;
    const overdue=projects.filter(p=>p.due&&p.status!=='已完成'&&p.due<today).length;
    const linked=tasks.filter(t=>t.project&&projects.some(p=>p.name===t.project)),linkedDone=linked.filter(t=>t.status==='已完成').length;
    const taskPct=linked.length?Math.round(linkedDone/linked.length*100):0,projectPct=total?Math.round(done/total*100):0;
    el.innerHTML=`<div class="project-metric project-metric-total"><span>项目总数</span><strong>${total}</strong><small>阶段目标</small></div><div class="project-metric project-metric-doing"><span>进行中</span><strong>${doing}</strong><small>当前推进</small></div><div class="project-metric project-metric-done"><span>已完成</span><strong>${done}</strong><small>完成率 ${projectPct}%</small></div><div class="project-metric project-metric-progress"><span>关联任务完成</span><strong>${taskPct}%</strong><div class="project-dashboard-progress"><i style="width:${taskPct}%"></i></div><small>${linkedDone}/${linked.length} 个任务</small></div><div class="project-metric project-metric-overdue"><span>已逾期</span><strong>${overdue}</strong><small>${overdue?'需要处理':'暂无逾期'}</small></div>`
  }

  $('ptcSave').onclick=()=>{
    const title=$('ptcTitle').value.trim();if(!title){$('ptcTitle').focus();return}
    const project=projectNameForMode();
    const task={id:makeId(),title,status:'待开始',project:mode==='edit'?project:'',priority:$('ptcPriority').value,matrix:$('ptcMatrix').value,due:$('ptcDue').value,note:$('ptcNote').value.trim(),createdAt:new Date().toISOString()};
    state.tasks.unshift(task);set('tasks',state.tasks);dlg.close();
    if(typeof renderTaskBoard==='function')renderTaskBoard();if(typeof renderHome==='function')renderHome();if(typeof renderProjectBoard==='function')renderProjectBoard();refreshPicker(task.id);refreshDashboard()
  };
  $('ptcTitle').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('ptcSave').click()}})
})();

// Load Daily Review V6 without changing the legacy HTML scaffold.
(function(){
  if(!document.querySelector('link[href="review-v6.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='review-v6.css';document.head.appendChild(l)
  }
  if(!document.querySelector('script[src="review-v6.js"]')){
    const s=document.createElement('script');s.src='review-v6.js';document.body.appendChild(s)
  }
  if(!document.querySelector('link[href="theme-linear.css"]')){
    const t=document.createElement('link');t.rel='stylesheet';t.href='theme-linear.css';document.head.appendChild(t)
  }
  if(!document.querySelector('link[href="daily-modules.css"]')){
    const d=document.createElement('link');d.rel='stylesheet';d.href='daily-modules.css';document.head.appendChild(d)
  }
  if(!document.querySelector('script[src="daily-modules.js"]')){
    const s=document.createElement('script');s.src='daily-modules.js';document.body.appendChild(s)
  }
})();
