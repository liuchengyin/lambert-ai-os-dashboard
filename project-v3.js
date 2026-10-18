// Personal project board v3: 仪表盘 + 看板优先 + 可收起添加 + 任务搜索/就地新建
(function(){
  const projectStatuses=["待开始","进行中","已完成"];
  let projectEditIndex=-1;
  const expandedMap=new Map(), previousStatuses=new Map();
  function isExpanded(p){return expandedMap.has(p.id)?expandedMap.get(p.id):p.status!=="已完成"}
  function setExpanded(p,val){expandedMap.set(p.id,val)}
  let showArchived=false;
  let createSelected=new Set();
  let editSelected=new Set();

  function makeProjectId(){return `project_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
  function makeInlineTaskId(){return `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
  function normalizeProject(p){
    return {
      ...p,
      id:p.id||makeProjectId(),
      name:p.name||"未命名项目",
      status:projectStatuses.includes(p.status)?p.status:"待开始",
      due:p.due||"",
      standard:p.standard||p.extra||"",
      createdAt:p.createdAt||new Date().toISOString()
    }
  }

  state.projects=state.projects.map(normalizeProject);
  set("projects",state.projects);

  function projectTasks(project){return state.tasks.filter(t=>TaskCenterModel.resolveProject(t,state.projects)===project.id)}
  function projectProgress(project){
    const rows=projectTasks(project),done=rows.filter(t=>t.status==="已完成").length;
    return {done,total:rows.length,pct:rows.length?Math.round(done/rows.length*100):0}
  }
  function statusClass(status){return status==="待开始"?"todo":status==="进行中"?"doing":"done"}
  const projectCategories=["健康","工作","个人","习惯","金融"];
  const categoryClassMap={"健康":"health","工作":"work","个人":"personal","习惯":"habit","金融":"finance"};
  function categoryClass(cat){return categoryClassMap[cat]||"custom"}
  function categoryOptions(selected){
    const list=[...projectCategories];
    if(selected&&!list.includes(selected))list.push(selected);
    return `<option value="">未分类</option>`+list.map(c=>`<option value="${escapeHtml(c)}"${c===selected?" selected":""}>${escapeHtml(c)}</option>`).join("")
  }
  function isOverdue(project){return project.due&&project.status!=="已完成"&&project.due<dateKey()}
  function actionButton(label,cls,onClick){
    const b=document.createElement("button");b.className=`project-card-action ${cls||""}`;b.textContent=label;
    b.onclick=e=>{e.stopPropagation();onClick()};return b
  }

  function persistProjects(){
    set("projects",state.projects);set("tasks",state.tasks);
    renderProjectDashboard();renderProjectBoard();renderHome();renderTaskBoard();populateProjectOptions();renderCreateTaskPicker();
  }
  // An additive creator can refresh the private dashboard/picker without duplicating data.
  document.addEventListener('lambert:plan-created',()=>{renderProjectDashboard();renderCreateTaskPicker()});

  function taskMatches(t,q){
    if(!q)return true;
    const s=q.trim().toLowerCase();
    return [t.title,t.project,t.status,t.priority,t.note].some(v=>String(v||"").toLowerCase().includes(s))
  }
  function buildTaskOptions(container,selectedSet,query="",onToggle){
    container.innerHTML="";
    const rows=sortTasks(state.tasks).filter(t=>taskMatches(t,query));
    if(!rows.length){container.innerHTML=`<div class="meta project-task-empty">${state.tasks.length?"没有匹配任务":"还没有任务，可直接在上方新建。"}</div>`;return}
    rows.forEach(t=>{
      const row=document.createElement("label");row.className="project-task-option";
      const cb=document.createElement("input");cb.type="checkbox";cb.value=t.id;cb.checked=selectedSet.has(t.id);
      cb.onchange=()=>onToggle(t.id,cb.checked);
      const text=document.createElement("span");
      text.innerHTML=`<strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.status)} · ${escapeHtml(t.priority)}${t.due?" · "+escapeHtml(t.due):""}${t.project?" · "+escapeHtml(t.project):""}</small>`;
      row.append(cb,text);container.appendChild(row)
    })
  }
  function updateCreateSummary(){
    $("projectTaskSummary").textContent=createSelected.size?`已选 ${createSelected.size} 个任务`:`选择关联任务`
  }
  function renderCreateTaskPicker(){
    buildTaskOptions($("projectTaskOptions"),createSelected,$("projectTaskSearch")?.value||"",(id,checked)=>{
      checked?createSelected.add(id):createSelected.delete(id);updateCreateSummary()
    });
    updateCreateSummary()
  }
  function renderEditTaskPicker(){
    if(projectEditIndex<0)return;
    buildTaskOptions($("projectEditTaskOptions"),editSelected,$("projectEditTaskSearch")?.value||"",(id,checked)=>{
      checked?editSelected.add(id):editSelected.delete(id)
    })
  }

  // The popup selects the task in model state even when the picker filter hides it.
  document.addEventListener('lambert:project-task-created',e=>{
    const {taskId,mode}=e.detail||{};
    if(!state.tasks.some(t=>t.id===taskId))return;
    if(mode==='create'){createSelected.add(taskId);renderCreateTaskPicker()}
    else if(mode==='edit'&&projectEditIndex>=0){editSelected.add(taskId);renderEditTaskPicker()}
  });

  function createInlineTask(title,projectName=""){
    const clean=title.trim();if(!clean)return null;
    const task={id:makeInlineTaskId(),title:clean,status:"待开始",project:projectName,priority:"P2",due:"",note:"",createdAt:new Date().toISOString()};
    state.tasks.unshift(task);set("tasks",state.tasks);return task
  }

  $("projectTaskSearch").addEventListener("input",renderCreateTaskPicker);
  $("projectEditTaskSearch").addEventListener("input",renderEditTaskPicker);

  $("projectCreateTaskBtn").onclick=()=>{
    const input=$("projectNewTaskTitle"),task=createInlineTask(input.value,"");if(!task){input.focus();return}
    input.value="";createSelected.add(task.id);renderCreateTaskPicker();renderTaskBoard();renderHome();input.focus()
  };
  $("projectNewTaskTitle").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("projectCreateTaskBtn").click()}});

  $("projectEditCreateTaskBtn").onclick=()=>{
    if(projectEditIndex<0)return;
    const p=state.projects[projectEditIndex],input=$("projectEditNewTaskTitle"),task=createInlineTask(input.value,p.name);if(!task){input.focus();return}
    input.value="";editSelected.add(task.id);renderEditTaskPicker();renderTaskBoard();renderHome();renderProjectBoard();renderProjectDashboard();input.focus()
  };
  $("projectEditNewTaskTitle").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("projectEditCreateTaskBtn").click()}});

  function assignTasksToProject(projectName,selectedTaskIds,oldProjectName=""){
    const selected=new Set(selectedTaskIds);
    state.tasks.forEach(t=>{
      if(selected.has(t.id)){t.project=projectName;t.projectId=state.projects.find(p=>p.name===projectName)?.id||'';}
      else if(oldProjectName&&t.project===oldProjectName){t.project="";t.projectId="";}
    })
  }

  function renderCategoryPicker(id){
    const sel=$(id);if(!sel)return;
    const wrapId=id+"Picker";let wrap=$(wrapId);
    if(!wrap){wrap=document.createElement('div');wrap.id=wrapId;wrap.className='project-category-picker';wrap.setAttribute('role','group');wrap.setAttribute('aria-label','项目分类');sel.insertAdjacentElement('afterend',wrap)}
    const cats=[...projectCategories];
    if(sel.value&&!cats.includes(sel.value))cats.push(sel.value);
    Array.from(sel.options).forEach(o=>{if(o.value&&!cats.includes(o.value))cats.push(o.value)});
    cats.forEach(c=>{if(!Array.from(sel.options).some(o=>o.value===c)){const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)}});
    wrap.textContent='';
    const mk=(val,label,cls)=>{const b=document.createElement('button');b.type='button';b.className='project-category-chip '+cls;b.textContent=label;b.setAttribute('aria-pressed',String(sel.value===val));b.onclick=()=>{sel.value=val;renderCategoryPicker(id);wrap.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true})};wrap.appendChild(b)};
    mk('','未分类','cat-custom');
    cats.forEach(c=>mk(c,c,'cat-'+categoryClass(c)));
  }
  function clearProjectForm(){
    $("projectStartInput").value="";$("projectCategoryInput").value="";$("projectNameInput").value="";$("projectStatusInput").value="待开始";$("projectDueInput").value="";$("projectStandardInput").value="";
    $("projectTaskSearch").value="";$("projectNewTaskTitle").value="";$("projectTaskPicker").open=false;createSelected=new Set();renderCreateTaskPicker();renderCategoryPicker('projectCategoryInput')
  }
  function addProjectFromForm(){
    const name=$("projectNameInput").value.trim();if(!name){$("projectNameInput").focus();return}
    if(state.projects.some(p=>p.name===name)){alert("已经有同名项目，请换一个项目名称。");return}
    if($("projectStartInput").value&&$("projectDueInput").value&&$("projectStartInput").value>$("projectDueInput").value){alert("开始日期不能晚于截止日期");return}
    const p={id:makeProjectId(),name,start:$("projectStartInput").value,category:$("projectCategoryInput").value,status:$("projectStatusInput").value,due:$("projectDueInput").value,standard:$("projectStandardInput").value.trim(),createdAt:new Date().toISOString()};
    state.projects.unshift(p);assignTasksToProject(name,[...createSelected]);clearProjectForm();$("projectComposeDetails").open=false;persistProjects()
  }

  function renderProjectDashboard(){
    const el=$("projectDashboard");if(!el)return;
    const total=state.projects.length,doing=state.projects.filter(p=>p.status==="进行中").length,done=state.projects.filter(p=>p.status==="已完成").length,overdue=state.projects.filter(isOverdue).length;
    const totalTaskCount=state.projects.reduce((n,p)=>n+projectProgress(p).total,0),doneTaskCount=state.projects.reduce((n,p)=>n+projectProgress(p).done,0);
    const taskPct=totalTaskCount?Math.round(doneTaskCount/totalTaskCount*100):0,projectPct=total?Math.round(done/total*100):0;
    el.innerHTML=`
      <div class="project-metric project-metric-total"><span>项目总数</span><strong>${total}</strong><small>阶段目标</small></div>
      <div class="project-metric project-metric-doing"><span>进行中</span><strong>${doing}</strong><small>当前推进</small></div>
      <div class="project-metric project-metric-done"><span>已完成</span><strong>${done}</strong><small>完成率 ${projectPct}%</small></div>
      <div class="project-metric project-metric-progress"><span>关联任务完成</span><strong>${taskPct}%</strong><div class="project-dashboard-progress"><i style="width:${taskPct}%"></i></div><small>${doneTaskCount}/${totalTaskCount} 个任务</small></div>
      <div class="project-metric project-metric-overdue"><span>已逾期</span><strong>${overdue}</strong><small>${overdue?"需要处理":"暂无逾期"}</small></div>`
  }

  function renderProjectCard(project,index){
    const progress=projectProgress(project),tasks=projectTasks(project),sClass=statusClass(project.status);
    const card=document.createElement("article");card.className=`project-card project-card-${sClass}${isOverdue(project)?" project-card-overdue":""}`;card.onclick=()=>window.TaskCenter?TaskCenter.openProject(project.id):openProjectEditor(index);card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","打开项目 "+project.name);card.onkeydown=e=>{if(e.target===card&&(e.key==="Enter"||e.key===" ")){e.preventDefault();card.click()}};
    const top=document.createElement("div");top.className="project-card-top";
    top.innerHTML=`<span class="project-status status-${sClass}">${escapeHtml(project.status)}</span>${project.due?`<span class="project-due${isOverdue(project)?" overdue":""}">${isOverdue(project)?"已逾期 · ":"截止 "}${escapeHtml(project.due)}</span>`:""}`;card.appendChild(top);
    const title=document.createElement("h4");title.textContent=project.name;card.appendChild(title);
    if(project.standard){const standard=document.createElement("div");standard.className="project-standard";standard.innerHTML=`<span>完成交付标准</span><p>${escapeHtml(project.standard)}</p>`;card.appendChild(standard)}
    const progressWrap=document.createElement("div");progressWrap.className="project-progress-wrap";
    progressWrap.innerHTML=`<div class="project-progress-meta"><span>关联任务 ${progress.done}/${progress.total}</span><strong>${progress.pct}%</strong></div><div class="project-progress status-progress-${sClass}"><i style="width:${progress.pct}%"></i></div>`;card.appendChild(progressWrap);
    if(tasks.length){
      const list=document.createElement("div");list.className="project-linked-tasks";
      tasks.slice(0,3).forEach(t=>{const r=document.createElement("div");r.innerHTML=`<span class="project-task-dot ${t.status==="已完成"?"done":""}"></span><span>${escapeHtml(t.title)}</span>`;list.appendChild(r)});
      if(tasks.length>3){const more=document.createElement("small");more.textContent=`还有 ${tasks.length-3} 个任务`;list.appendChild(more)}card.appendChild(list)
    }
    const actions=document.createElement("div");actions.className="project-card-actions";
    if(project.status==="待开始")actions.appendChild(actionButton("开始","primary",()=>changeProjectStatus(index,"进行中")));
    if(project.status==="进行中"){
      actions.appendChild(actionButton("完成项目","primary",()=>completeProject(index)));
      actions.appendChild(actionButton("退回","",()=>changeProjectStatus(index,"待开始")))
    }
    if(project.status==="已完成")actions.appendChild(actionButton("重新打开","",()=>changeProjectStatus(index,"进行中")));
    actions.appendChild(actionButton("编辑","",()=>openProjectEditor(index)));
    actions.appendChild(actionButton(project.archived?"取消归档":"归档","",()=>{project.archived=!project.archived;persistProjects()}));
    card.appendChild(actions);
    card.onclick=null;card.onkeydown=null;card.removeAttribute('role');card.removeAttribute('tabindex');card.removeAttribute('aria-label');
    const detail=document.createElement('details');detail.className='project-collapse-item';detail.open=isExpanded(project);
    const summary=document.createElement('summary');summary.className='project-collapse-summary';
    summary.addEventListener('click',e=>{e.preventDefault();if(!e.target.closest('button')){window.TaskCenter?TaskCenter.openProject(project.id):openProjectEditor(index)}});
    const isDone=project.status==="已完成";
    const head=document.createElement('span');head.className='project-collapse-head';
    if(isDone){head.innerHTML=`<span class="tc-done-check" aria-hidden="true">✓</span>`}
    const titleBtn=document.createElement('button');titleBtn.type='button';titleBtn.className='project-collapse-title';titleBtn.textContent=project.name;titleBtn.setAttribute('aria-label','打开项目 '+project.name);
    titleBtn.onclick=e=>{e.stopPropagation();window.TaskCenter?TaskCenter.openProject(project.id):openProjectEditor(index)};
    titleBtn.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();titleBtn.click()}};
    head.appendChild(titleBtn);
    const catTag=document.createElement('span');catTag.className=`project-category-tag cat-${categoryClass(project.category)}`;catTag.textContent=project.category||'';if(!project.category)catTag.hidden=true;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='project-collapse-toggle';toggle.setAttribute('aria-expanded',String(detail.open));toggle.setAttribute('aria-label',(detail.open?'折叠':'展开')+'项目 '+project.name);toggle.innerHTML='<span class="project-collapse-arrow" aria-hidden="true">▾</span>';
    toggle.onclick=e=>{e.stopPropagation();detail.open=!detail.open;toggle.setAttribute('aria-expanded',String(detail.open));toggle.setAttribute('aria-label',(detail.open?'折叠':'展开')+'项目 '+project.name);setExpanded(project,detail.open)};
    summary.append(head,catTag,toggle);
    title.remove();
    const body=document.createElement('div');body.className='project-collapse-body';
    while(card.firstChild)body.append(card.firstChild);
    body.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea,label'))return;window.TaskCenter?TaskCenter.openProject(project.id):openProjectEditor(index)});
    detail.append(summary,body);card.append(detail);
    actions.prepend(actionButton("查看任务","",()=>window.TaskCenter?.openProject(project.id)));
    return card
  }

  renderProjectBoard=function(){
    const board=$("projectBoard");board.innerHTML="";
    state.projects.forEach(item=>{if(previousStatuses.get(item.id)!==item.status){expandedMap.delete(item.id)}previousStatuses.set(item.id,item.status);});
    if(!$("projectArchiveToggle")){const b=document.createElement('button');b.id='projectArchiveToggle';b.type='button';board.after(b);b.onclick=()=>{showArchived=!showArchived;renderProjectBoard()}}
    board.after($("projectArchiveToggle"));$("projectArchiveToggle").textContent=showArchived?'返回未归档项目':'查看归档项目';$("projectArchiveToggle").setAttribute('aria-pressed',String(showArchived));
    projectStatuses.forEach(status=>{
      const sClass=statusClass(status),col=document.createElement("section");col.className=`project-col project-col-${sClass}`;
      const rows=state.projects.filter(p=>p.status===status&&!!p.archived===showArchived).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
      col.innerHTML=`<div class="project-col-head"><h3><span class="project-col-dot dot-${sClass}"></span>${status}</h3><span>${rows.length}</span></div><div class="project-col-body"></div>`;
      if(status==="已完成"){
        const controls=document.createElement('div');controls.className='project-col-controls';controls.innerHTML='<button type="button" data-project-expand>全部展开</button><button type="button" data-project-collapse>全部折叠</button>';
        controls.querySelector('[data-project-expand]').onclick=()=>{rows.forEach(p=>setExpanded(p,true));renderProjectBoard()};
        controls.querySelector('[data-project-collapse]').onclick=()=>{rows.forEach(p=>setExpanded(p,false));renderProjectBoard()};col.querySelector('.project-col-head').after(controls);
      }
      const body=col.querySelector(".project-col-body");if(!rows.length)body.innerHTML=empty("暂无项目");
      rows.forEach(p=>body.appendChild(renderProjectCard(p,state.projects.indexOf(p))));board.appendChild(col)
    });
    $("projectSummary").textContent=projectStatuses.map(s=>`${s} ${state.projects.filter(p=>p.status===s).length}`).join(" · ")
  };

  function changeProjectStatus(index,status){expandedMap.delete(state.projects[index].id);state.projects[index].status=status;if(status!=="已完成")state.projects[index].archived=false;persistProjects()}
  function completeProject(index){
    const p=state.projects[index],unfinished=projectTasks(p).filter(t=>t.status!=="已完成");
    if(unfinished.length&&!confirm(`还有 ${unfinished.length} 个关联任务未完成，仍要把项目标记为已完成吗？`))return;
    changeProjectStatus(index,"已完成")
  }

  function openProjectEditor(index){
    projectEditIndex=index;const p=state.projects[index];
    $("projectEditCategory").innerHTML=categoryOptions(p.category);
    $("projectEditStart").value=p.start?(p.start.length===10?p.start+"T00:00":p.start):"";$("projectEditCategory").value=p.category||"";$("projectEditName").value=p.name;$("projectEditStatus").value=p.status;$("projectEditDue").value=p.due?(p.due.length===10?p.due+"T23:59":p.due):"";$("projectEditStandard").value=p.standard||"";$("projectEditTaskSearch").value="";$("projectEditNewTaskTitle").value="";
    editSelected=new Set(projectTasks(p).map(t=>t.id));renderEditTaskPicker();renderCategoryPicker('projectEditCategory');$("projectEditDlg").showModal()
  }
  // Close means cancel: keep the original project and all linked tasks unchanged.
  $("projectEditClose")?.addEventListener("click",()=>{
    $("projectEditDlg").close();
    projectEditIndex=-1;
    editSelected=new Set();
  });
  $("projectEditDlg")?.addEventListener("close",()=>{projectEditIndex=-1;editSelected=new Set()});
  $("projectEditSave").onclick=e=>{
    e.preventDefault();if(projectEditIndex<0)return;
    const old=state.projects[projectEditIndex],oldName=old.name,newName=$("projectEditName").value.trim();if(!newName)return;
    if(state.projects.some((p,i)=>i!==projectEditIndex&&p.name===newName)){alert("已经有同名项目，请换一个项目名称。");return}
    if($("projectEditStart").value&&$("projectEditDue").value&&$("projectEditStart").value>$("projectEditDue").value){alert("开始日期不能晚于截止日期");return}
    state.projects[projectEditIndex]={...old,start:$("projectEditStart").value,category:$("projectEditCategory").value,name:newName,status:$("projectEditStatus").value,due:$("projectEditDue").value,standard:$("projectEditStandard").value.trim()};
    assignTasksToProject(newName,[...editSelected],oldName);$("projectEditDlg").close();persistProjects()
  };
  $("projectDeleteBtn").onclick=()=>{
    if(projectEditIndex<0)return;const p=state.projects[projectEditIndex],linked=projectTasks(p).length;
    if(!confirm(`确认删除项目“${p.name}”吗？${linked?`\n${linked} 个关联任务不会删除，只会解除项目关联。`:""}`))return;
    state.tasks.forEach(t=>{if(t.projectId===p.id||(!t.projectId&&t.project===p.name)){t.project="";t.projectId=""}});state.projects.splice(projectEditIndex,1);$("projectEditDlg").close();persistProjects()
  };

  $("addProject").onclick=addProjectFromForm;
  $("projectNameInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addProjectFromForm()}});
  $("homeManageProjects").onclick=()=>{openView("projects");$("projectComposeDetails").open=true;setTimeout(()=>$("projectNameInput").focus(),0)};

  const originalPersistTasks=persistTasks;
  persistTasks=function(){originalPersistTasks();renderProjectDashboard();renderProjectBoard();renderCreateTaskPicker()};

  const originalRenderHome=renderHome;
  renderHome=function(){
    originalRenderHome();
    const p=$("homeProjects");p.innerHTML="";
    if(!state.projects.length){p.innerHTML=empty("暂无阶段目标，点击“维护项目”开始。");return}
    state.projects.slice(0,4).forEach(x=>{const pg=projectProgress(x);p.insertAdjacentHTML("beforeend",`<div class="item"><b>${escapeHtml(x.name)}</b><div class="meta">${escapeHtml(x.status)}${x.due?" · 截止 "+escapeHtml(x.due):""} · 任务 ${pg.done}/${pg.total}</div></div>`)})
  };
  renderMainline=function(){
    const e=$("currentMainline"),current=state.projects.find(x=>x.status==="进行中")||state.projects.find(x=>x.status==="待开始");
    if(!current){e.innerHTML=empty("还没有阶段目标。去项目看板添加后，这里自动展示。");return}
    const pg=projectProgress(current);e.innerHTML=`<b class="big">${escapeHtml(current.name)}</b><p>${escapeHtml(current.standard||"暂未填写交付标准")}</p><div class="meta">${escapeHtml(current.status)} · 关联任务 ${pg.done}/${pg.total}${current.due?" · 截止 "+escapeHtml(current.due):""}</div>`
  };

  $("projectComposeDetails").open=false;
  $("projectCategoryInput").hidden=true;$("projectEditCategory").hidden=true;
  clearProjectForm();renderCategoryPicker('projectCategoryInput');renderCategoryPicker('projectEditCategory');renderProjectDashboard();renderProjectBoard();renderHome();
})();
