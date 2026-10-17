// Personal project board v2: 阶段目标 + 任务联动
(function(){
  const projectStatuses=["待开始","进行中","已完成"];
  let projectEditIndex=-1;

  function makeProjectId(){return `project_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
  function normalizeProject(p){
    return {
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

  function projectTasks(project){
    return state.tasks.filter(t=>t.project===project.name)
  }
  function projectProgress(project){
    const rows=projectTasks(project);
    const done=rows.filter(t=>t.status==="已完成").length;
    return {done,total:rows.length,pct:rows.length?Math.round(done/rows.length*100):0}
  }
  function projectStatusClass(status){return status==="待开始"?"todo":status==="进行中"?"doing":"done"}
  function projectActionButton(label,cls,onClick){
    const b=document.createElement("button");b.className=`project-card-action ${cls||""}`;b.textContent=label;
    b.onclick=e=>{e.stopPropagation();onClick()};return b
  }
  function persistProjects(){
    set("projects",state.projects);set("tasks",state.tasks);
    renderProjectBoard();renderHome();renderTaskBoard();populateProjectOptions();renderCreateTaskPicker()
  }

  function selectedCreateTaskIds(){
    return [...document.querySelectorAll('#projectTaskOptions input[type="checkbox"]:checked')].map(x=>x.value)
  }
  function buildTaskOptions(container,selectedIds=[]){
    container.innerHTML="";
    if(!state.tasks.length){container.innerHTML='<div class="meta" style="padding:8px">还没有任务，可先创建项目，之后再关联。</div>';return}
    const selected=new Set(selectedIds);
    sortTasks(state.tasks).forEach(t=>{
      const row=document.createElement("label");row.className="project-task-option";
      const cb=document.createElement("input");cb.type="checkbox";cb.value=t.id;cb.checked=selected.has(t.id);
      const text=document.createElement("span");text.innerHTML=`<strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.status)} · ${escapeHtml(t.priority)}${t.due?" · "+escapeHtml(t.due):""}</small>`;
      row.append(cb,text);container.appendChild(row)
    })
  }
  function updateCreateTaskSummary(){
    const ids=selectedCreateTaskIds();
    $("projectTaskSummary").textContent=ids.length?`已选 ${ids.length} 个任务`:`选择关联任务`;
  }
  function renderCreateTaskPicker(){
    const keep=selectedCreateTaskIds();buildTaskOptions($("projectTaskOptions"),keep);updateCreateTaskSummary();
    $("projectTaskOptions").querySelectorAll('input[type="checkbox"]').forEach(x=>x.onchange=updateCreateTaskSummary)
  }

  function assignTasksToProject(projectName,selectedIds,oldProjectName=""){
    const selected=new Set(selectedIds);
    state.tasks.forEach(t=>{
      if(selected.has(t.id)) t.project=projectName;
      else if(oldProjectName && t.project===oldProjectName) t.project="";
    })
  }

  function clearProjectForm(){
    $("projectNameInput").value="";$("projectStatusInput").value="待开始";$("projectDueInput").value="";$("projectStandardInput").value="";
    $("projectTaskPicker").open=false;renderCreateTaskPicker()
  }
  function addProjectFromForm(){
    const name=$("projectNameInput").value.trim();if(!name){$("projectNameInput").focus();return}
    if(state.projects.some(p=>p.name===name)){alert("已经有同名项目，请换一个项目名称。");return}
    const p={id:makeProjectId(),name,status:$("projectStatusInput").value,due:$("projectDueInput").value,standard:$("projectStandardInput").value.trim(),createdAt:new Date().toISOString()};
    const ids=selectedCreateTaskIds();state.projects.unshift(p);assignTasksToProject(name,ids);clearProjectForm();persistProjects()
  }

  function renderProjectCard(project,index){
    const progress=projectProgress(project),tasks=projectTasks(project);
    const card=document.createElement("article");card.className="project-card";card.onclick=()=>openProjectEditor(index);
    const top=document.createElement("div");top.className="project-card-top";
    top.innerHTML=`<span class="project-status status-${projectStatusClass(project.status)}">${escapeHtml(project.status)}</span>${project.due?`<span class="project-due">截止 ${escapeHtml(project.due)}</span>`:""}`;
    card.appendChild(top);
    const title=document.createElement("h4");title.textContent=project.name;card.appendChild(title);
    if(project.standard){const standard=document.createElement("div");standard.className="project-standard";standard.innerHTML=`<span>交付标准</span><p>${escapeHtml(project.standard)}</p>`;card.appendChild(standard)}
    const progressWrap=document.createElement("div");progressWrap.className="project-progress-wrap";
    progressWrap.innerHTML=`<div class="project-progress-meta"><span>关联任务 ${progress.done}/${progress.total}</span><strong>${progress.pct}%</strong></div><div class="project-progress"><i style="width:${progress.pct}%"></i></div>`;
    card.appendChild(progressWrap);
    if(tasks.length){
      const list=document.createElement("div");list.className="project-linked-tasks";
      tasks.slice(0,3).forEach(t=>{const r=document.createElement("div");r.innerHTML=`<span class="project-task-dot ${t.status==="已完成"?"done":""}"></span><span>${escapeHtml(t.title)}</span>`;list.appendChild(r)});
      if(tasks.length>3){const more=document.createElement("small");more.textContent=`还有 ${tasks.length-3} 个任务`;list.appendChild(more)}
      card.appendChild(list)
    }
    const actions=document.createElement("div");actions.className="project-card-actions";
    if(project.status==="待开始") actions.appendChild(projectActionButton("开始","primary",()=>changeProjectStatus(index,"进行中")));
    if(project.status==="进行中"){
      actions.appendChild(projectActionButton("完成项目","primary",()=>completeProject(index)));
      actions.appendChild(projectActionButton("退回","",()=>changeProjectStatus(index,"待开始")))
    }
    if(project.status==="已完成") actions.appendChild(projectActionButton("重新打开","",()=>changeProjectStatus(index,"进行中")));
    actions.appendChild(projectActionButton("编辑","",()=>openProjectEditor(index)));card.appendChild(actions);
    return card
  }

  renderProjectBoard=function(){
    const board=$("projectBoard");board.innerHTML="";
    projectStatuses.forEach(status=>{
      const col=document.createElement("section");col.className=`project-col project-col-${projectStatusClass(status)}`;
      const rows=state.projects.filter(p=>p.status===status);
      col.innerHTML=`<div class="project-col-head"><h3>${status}</h3><span>${rows.length}</span></div><div class="project-col-body"></div>`;
      const body=col.querySelector(".project-col-body");
      if(!rows.length)body.innerHTML=empty("暂无项目");
      rows.forEach(p=>body.appendChild(renderProjectCard(p,state.projects.indexOf(p))));board.appendChild(col)
    });
    const counts=projectStatuses.map(s=>`${s} ${state.projects.filter(p=>p.status===s).length}`).join(" · ");$("projectSummary").textContent=counts
  };

  function changeProjectStatus(index,status){state.projects[index].status=status;persistProjects()}
  function completeProject(index){
    const p=state.projects[index],unfinished=projectTasks(p).filter(t=>t.status!=="已完成");
    if(unfinished.length&&!confirm(`还有 ${unfinished.length} 个关联任务未完成，仍要把项目标记为已完成吗？`))return;
    changeProjectStatus(index,"已完成")
  }

  function openProjectEditor(index){
    projectEditIndex=index;const p=state.projects[index];
    $("projectEditName").value=p.name;$("projectEditStatus").value=p.status;$("projectEditDue").value=p.due||"";$("projectEditStandard").value=p.standard||"";
    buildTaskOptions($("projectEditTaskOptions"),projectTasks(p).map(t=>t.id));$("projectEditDlg").showModal()
  }
  $("projectEditSave").onclick=e=>{
    e.preventDefault();if(projectEditIndex<0)return;
    const old=state.projects[projectEditIndex],oldName=old.name,newName=$("projectEditName").value.trim();if(!newName)return;
    if(state.projects.some((p,i)=>i!==projectEditIndex&&p.name===newName)){alert("已经有同名项目，请换一个项目名称。");return}
    const ids=[...$("projectEditTaskOptions").querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
    state.projects[projectEditIndex]={...old,name:newName,status:$("projectEditStatus").value,due:$("projectEditDue").value,standard:$("projectEditStandard").value.trim()};
    assignTasksToProject(newName,ids,oldName);$("projectEditDlg").close();persistProjects()
  };
  $("projectDeleteBtn").onclick=()=>{
    if(projectEditIndex<0)return;const p=state.projects[projectEditIndex],linked=projectTasks(p).length;
    if(!confirm(`确认删除项目“${p.name}”吗？${linked?`\n${linked} 个关联任务不会删除，只会解除项目关联。`:""}`))return;
    state.tasks.forEach(t=>{if(t.project===p.name)t.project=""});state.projects.splice(projectEditIndex,1);$("projectEditDlg").close();persistProjects()
  };

  // 接管旧按钮与首页项目维护入口
  $("addProject").onclick=addProjectFromForm;
  $("projectNameInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addProjectFromForm()}});
  $("homeManageProjects").onclick=()=>{openView("projects");setTimeout(()=>$("projectNameInput").focus(),0)};

  // 任务发生变化时，项目进度与关联任务同步刷新
  const originalPersistTasks=persistTasks;
  persistTasks=function(){originalPersistTasks();renderProjectBoard();renderCreateTaskPicker()};

  // 首页项目信息改为阶段目标摘要
  const originalRenderHome=renderHome;
  renderHome=function(){
    originalRenderHome();
    const p=$("homeProjects");p.innerHTML="";
    if(!state.projects.length){p.innerHTML=empty("暂无阶段目标，点击“维护项目”开始。");return}
    state.projects.slice(0,4).forEach(x=>{
      const pg=projectProgress(x);p.insertAdjacentHTML("beforeend",`<div class="item"><b>${escapeHtml(x.name)}</b><div class="meta">${escapeHtml(x.status)}${x.due?" · 截止 "+escapeHtml(x.due):""} · 任务 ${pg.done}/${pg.total}</div></div>`)
    })
  };

  // 当前主线使用阶段目标的交付标准
  renderMainline=function(){
    const e=$("currentMainline"),current=state.projects.find(x=>x.status==="进行中")||state.projects.find(x=>x.status==="待开始");
    if(!current){e.innerHTML=empty("还没有阶段目标。去项目看板添加后，这里自动展示。");return}
    const pg=projectProgress(current);e.innerHTML=`<b class="big">${escapeHtml(current.name)}</b><p>${escapeHtml(current.standard||"暂未填写交付标准")}</p><div class="meta">${escapeHtml(current.status)} · 关联任务 ${pg.done}/${pg.total}${current.due?" · 截止 "+escapeHtml(current.due):""}</div>`
  };

  clearProjectForm();renderProjectBoard();renderHome();
})();