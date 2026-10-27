const $=id=>document.getElementById(id);
const get=(k,d)=>{try{return (window.LambertData?window.LambertData.read(k,null):JSON.parse(localStorage.getItem(k)))??d}catch{return d}},set=(k,v)=>{if(k!=="tasks")return window.LambertData?window.LambertData.write(k,v):localStorage.setItem(k,JSON.stringify(v));
  // All web task writes share the same durable boundary, including project editors.
  let previous;try{previous=window.LambertData?window.LambertData.read(k,[]):JSON.parse(localStorage.getItem(k)||'[]');}catch(error){throw error;}
  try{return window.LambertData?window.LambertData.write(k,v):localStorage.setItem(k,JSON.stringify(v));}
  catch(error){try{state.tasks=previous;}catch{/* State is not initialized during bootstrap. */}throw error;}
};

const demoTop3=new Set(["把个人看板上线","补齐项目/任务/复盘框架","把 Notion/飞书链接挂进去"]);

// Names are user data: a real entry can have the same title as an old demo item.
let savedProjects=get("projects",[]);
let rawTasks=get("tasks",[]);
let savedTop3=get("top3",[]).filter(x=>!demoTop3.has(x));

function makeTaskId(){return `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function normalizeTask(x){
  return {
    ...x,
    id:x.id||makeTaskId(),
    title:x.title||x.name||"未命名任务",
    status:["待开始","进行中","已完成"].includes(x.status)?x.status:"待开始",
    project:x.project||"",
    priority:["P1","P2","P3"].includes(x.priority)?x.priority:"P2",
    due:x.due||"",
    note:x.note||x.extra||"",
    createdAt:x.createdAt||new Date().toISOString()
  }
}
let savedTasks=rawTasks.map(normalizeTask);
set("projects",savedProjects);set("tasks",savedTasks);set("top3",savedTop3);

const state={
  top3:savedTop3,
  projects:savedProjects,
  tasks:savedTasks,
  reviews:get("daily_reviews_v1",{}),
  settings:get("settings",{notionHome:"https://www.notion.so/",feishuHome:"https://www.feishu.cn/",projectUrl:"",taskUrl:"",reviewUrl:""})
};

$("today").textContent=new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"short"});

document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>openView(b.dataset.v));
function openView(id){
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.v===id));
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("activeView",x.id===id));
  if(id==="review") loadReview(reviewSelectedDate);
  if(id==="tasks") renderTaskBoard();
}

function empty(text){return `<div class="meta" style="padding:14px 0">${text}</div>`}
function escapeHtml(v=""){return String(v).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]))}

function renderTop3(){
  const e=$("top3");e.innerHTML="";
  if(!state.top3.length){e.innerHTML=empty("还没有维护今日 Top 3");return}
  state.top3.forEach(t=>{const d=document.createElement("div");d.className="item";d.textContent=t;e.appendChild(d)})
}
$("editTop3").onclick=()=>{
  const v=prompt("每行一个任务，最多 3 条",state.top3.join("\n"));
  if(v!==null){state.top3=v.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,3);set("top3",state.top3);renderTop3()}
};

function renderMainline(){
  const e=$("currentMainline");
  const current=state.projects.find(x=>x.status==="进行中") || state.projects.find(x=>x.status==="待开始");
  if(!current){e.innerHTML=empty("还没有项目。去项目看板维护后，这里自动展示。");return}
  e.innerHTML=`<b class="big">${escapeHtml(current.name)}</b><p>${escapeHtml(current.extra||"暂无补充说明")}</p><div class="meta">${escapeHtml(current.status)}</div>`;
}

function renderHome(){
  const p=$("homeProjects");p.innerHTML="";
  if(!state.projects.length)p.innerHTML=empty("暂无项目，点击“维护项目”开始。")
  else state.projects.slice(0,4).forEach(x=>p.insertAdjacentHTML("beforeend",`<div class="item"><b>${escapeHtml(x.name)}</b><div class="meta">${escapeHtml(x.status)}${x.extra?" · "+escapeHtml(x.extra):""}</div></div>`));

  const t=$("homeTasks");t.innerHTML="";
  const visibleTasks=sortTasks(state.tasks.filter(x=>x.status!=="已完成")).slice(0,5);
  if(!visibleTasks.length)t.innerHTML=empty("暂无待推进任务，点击“维护任务”开始。")
  else visibleTasks.forEach(x=>t.insertAdjacentHTML("beforeend",`<div class="item"><b>${escapeHtml(x.title)}</b><div class="meta">${escapeHtml(x.status)} · ${escapeHtml(x.priority)}${x.due?" · "+escapeHtml(x.due):""}</div></div>`));
  renderMainline();
}

const cols=["待开始","进行中","已完成"];
function renderProjectBoard(){
  const b=$("projectBoard");b.innerHTML="";
  cols.forEach(s=>{
    const c=document.createElement("div");c.className="col";c.innerHTML=`<h3>${s}</h3>`;
    const rows=state.projects.filter(x=>x.status===s);
    if(!rows.length)c.insertAdjacentHTML("beforeend",empty("暂无内容"));
    rows.forEach(x=>{
      const idx=state.projects.indexOf(x);
      const card=document.createElement("div");card.className="tile";card.style.cursor="pointer";
      card.innerHTML=`<b>${escapeHtml(x.name)}</b><div class="meta">${escapeHtml(x.extra||"点击编辑")}</div>`;
      card.onclick=()=>openProjectDlg(idx);c.appendChild(card)
    });
    b.appendChild(c)
  })
}

let projectEditIndex=-1;
function openProjectDlg(index=-1){
  projectEditIndex=index;
  const editing=index>=0,item=editing?state.projects[index]:null;
  $("dlgTitle").textContent=editing?"编辑项目":"新增项目";
  $("dlgName").value=item?.name||"";$("dlgExtra").value=item?.extra||"";$("dlgStatus").value=item?.status||"进行中";
  $("dlgDelete").style.display=editing?"inline-block":"none";$("dlg").showModal()
}
$("addProject").onclick=()=>openProjectDlg();
$("homeManageProjects").onclick=()=>{openView("projects");setTimeout(()=>openProjectDlg(),0)};
$("homeManageTasks").onclick=()=>{openView("tasks");setTimeout(()=>$("taskTitleInput").focus(),0)};
$("dlgSave").onclick=e=>{
  e.preventDefault();const name=$("dlgName").value.trim();if(!name)return;
  const item={name,status:$("dlgStatus").value,extra:$("dlgExtra").value.trim()};
  if(projectEditIndex>=0)state.projects[projectEditIndex]=item;else state.projects.push(item);
  set("projects",state.projects);$("dlg").close();refreshAll()
};
$("dlgDelete").onclick=()=>{
  if(projectEditIndex<0)return;const item=state.projects[projectEditIndex];
  if(!confirm(`确认删除“${item.name}”吗？`))return;
  state.projects.splice(projectEditIndex,1);set("projects",state.projects);$("dlg").close();refreshAll()
};

// 任务看板：经典 Todo 流程
let taskFilter="all",taskEditIndex=-1;
const priorityRank={P1:1,P2:2,P3:3};
function sortTasks(rows){
  return [...rows].sort((a,b)=>{
    if(priorityRank[a.priority]!==priorityRank[b.priority])return priorityRank[a.priority]-priorityRank[b.priority];
    if(a.due&&b.due&&a.due!==b.due)return a.due.localeCompare(b.due);
    if(a.due&&!b.due)return -1;if(!a.due&&b.due)return 1;
    return String(a.createdAt).localeCompare(String(b.createdAt))
  })
}
function persistTasks(){
  set("tasks",state.tasks);renderTaskBoard();renderHome();
  if(typeof renderProjectBoard==='function')renderProjectBoard();
  if(typeof renderProjectDashboard==='function')renderProjectDashboard();
  document.dispatchEvent(new Event('lambert:tasks-committed'));
}
function populateProjectOptions(){
  const selects=[...document.querySelectorAll("#taskProjectInput,#taskEditProject,#tv5Project,#ev5Project")];
  selects.forEach(sel=>{
    const keep=sel.value;sel.innerHTML='<option value="">无项目</option>';
    state.projects.forEach(p=>{const o=document.createElement("option");o.value=p.name;o.textContent=p.name;sel.appendChild(o)});
    if([...sel.options].some(o=>o.value===keep))sel.value=keep
  })
}
function filterTasks(rows){
  if(taskFilter==="today")return rows.filter(x=>x.due===dateKey());
  if(taskFilter==="p1")return rows.filter(x=>x.priority==="P1");
  return rows
}
function taskActionButton(label,cls,onClick){
  const b=document.createElement("button");b.className=`task-card-action ${cls||""}`;b.textContent=label;b.onclick=e=>{e.stopPropagation();onClick()};return b
}
function renderTaskCard(task,index){
  const card=document.createElement("article");card.className=`task-card priority-${task.priority.toLowerCase()}`;
  const title=document.createElement("div");title.className="task-card-title";title.textContent=task.title;card.appendChild(title);
  const meta=document.createElement("div");meta.className="task-card-meta";
  if(task.project)meta.insertAdjacentHTML("beforeend",`<span>${escapeHtml(task.project)}</span>`);
  meta.insertAdjacentHTML("beforeend",`<span class="priority-tag">${task.priority}</span>`);
  if(task.due)meta.insertAdjacentHTML("beforeend",`<span>截止 ${escapeHtml(task.due)}</span>`);
  card.appendChild(meta);
  if(task.note){const note=document.createElement("div");note.className="task-card-note";note.textContent=task.note;card.appendChild(note)}
  const actions=document.createElement("div");actions.className="task-card-actions";
  if(task.status==="待开始")actions.appendChild(taskActionButton("开始","primary",()=>changeTaskStatus(index,"进行中")));
  if(task.status==="进行中"){
    actions.appendChild(taskActionButton("完成","primary",()=>changeTaskStatus(index,"已完成")));
    actions.appendChild(taskActionButton("退回","",()=>changeTaskStatus(index,"待开始")))
  }
  if(task.status==="已完成")actions.appendChild(taskActionButton("重新打开","",()=>changeTaskStatus(index,"待开始")));
  actions.appendChild(taskActionButton("编辑","",()=>openTaskEdit(index)));card.appendChild(actions);
  return card
}
function renderTaskBoard(){
  populateProjectOptions();
  const board=$("taskBoard");board.innerHTML="";const visible=filterTasks(state.tasks);
  cols.forEach(status=>{
    const col=document.createElement("section");col.className=`task-col task-col-${status==="待开始"?"todo":status==="进行中"?"doing":"done"}`;
    const rows=sortTasks(visible.filter(x=>x.status===status));
    col.innerHTML=`<div class="task-col-head"><h3>${status}</h3><span>${rows.length}</span></div><div class="task-col-body"></div>`;
    const body=col.querySelector(".task-col-body");
    if(!rows.length)body.innerHTML=empty(taskFilter==="all"?"暂无任务":"当前筛选下暂无任务");
    rows.forEach(task=>body.appendChild(renderTaskCard(task,state.tasks.indexOf(task))));board.appendChild(col)
  });
  const counts={todo:state.tasks.filter(x=>x.status==="待开始").length,doing:state.tasks.filter(x=>x.status==="进行中").length,done:state.tasks.filter(x=>x.status==="已完成").length};
  $("taskSummary").textContent=`待开始 ${counts.todo} · 进行中 ${counts.doing} · 已完成 ${counts.done}`;
}
function addQuickTask(){
  const title=$("taskTitleInput").value.trim();if(!title){$("taskTitleInput").focus();return}
  state.tasks.unshift({id:makeTaskId(),title,status:"待开始",project:$("taskProjectInput").value,priority:$("taskPriorityInput").value,due:$("taskDueInput").value,note:$("taskNoteInput").value.trim(),createdAt:new Date().toISOString()});
  $("taskTitleInput").value="";$("taskNoteInput").value="";persistTasks();$("taskTitleInput").focus()
}
$("quickAddTask").onclick=addQuickTask;
$("taskTitleInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addQuickTask()}});
document.querySelectorAll(".task-filter").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".task-filter").forEach(x=>x.classList.toggle("active",x===btn));taskFilter=btn.dataset.filter;renderTaskBoard()
});
function changeTaskStatus(index,status){state.tasks[index].status=status;persistTasks()}
function openTaskEdit(index){
  taskEditIndex=index;populateProjectOptions();const t=state.tasks[index];
  $("taskEditTitle").value=t.title;$("taskEditProject").value=t.project||"";$("taskEditPriority").value=t.priority;$("taskEditDue").value=t.due||"";$("taskEditNote").value=t.note||"";$("taskEditDlg").showModal()
}
$("taskEditSave").onclick=e=>{
  e.preventDefault();if(taskEditIndex<0)return;const title=$("taskEditTitle").value.trim();if(!title)return;
  const old=state.tasks[taskEditIndex];state.tasks[taskEditIndex]={...old,title,project:$("taskEditProject").value,priority:$("taskEditPriority").value,due:$("taskEditDue").value,note:$("taskEditNote").value.trim()};
  $("taskEditDlg").close();persistTasks()
};
$("taskDeleteBtn").onclick=()=>{
  if(taskEditIndex<0)return;const t=state.tasks[taskEditIndex];if(!confirm(`确认删除任务“${t.title}”吗？`))return;
  state.tasks.splice(taskEditIndex,1);$("taskEditDlg").close();persistTasks()
};

// 每日复盘：按日期保存、查看、归档
function dateKey(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`
}
function shiftDate(key,delta){const [y,m,d]=key.split("-").map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+delta);return dateKey(dt)}
function formatReviewDate(key){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("zh-CN",{month:"long",day:"numeric",weekday:"short"})}
let reviewSelectedDate=dateKey();$("reviewDate").value=reviewSelectedDate;
function collectReview(){return {goal:$("rv_goal").value.trim(),standard:$("rv_standard").value.trim(),deadline:$("rv_deadline").value,completion:$("rv_completion").value,gap:$("rv_gap").value.trim(),restart:$("rv_restart").value.trim(),archived:state.reviews[reviewSelectedDate]?.archived||false,updatedAt:new Date().toISOString()}}
function saveReviews(){set("daily_reviews_v1",state.reviews)}
function hasReviewContent(r){return r&&[r.goal,r.standard,r.deadline,r.completion,r.gap,r.restart].some(Boolean)}
function loadReview(key){
  reviewSelectedDate=key;$("reviewDate").value=key;const r=state.reviews[key]||{};
  $("rv_goal").value=r.goal||"";$("rv_standard").value=r.standard||"";$("rv_deadline").value=r.deadline||"";$("rv_completion").value=r.completion||"";$("rv_gap").value=r.gap||"";$("rv_restart").value=r.restart||"";
  $("archiveDailyReview").textContent=r.archived?"已归档":"归档当天";$("archiveDailyReview").disabled=!!r.archived;renderReviewSnapshot();renderReviewArchive()
}
function snapshotRow(label,value){return `<div class="snapshot-row"><div class="snapshot-label">${label}</div><div class="snapshot-value">${value?escapeHtml(value):'<span class="meta">未填写</span>'}</div></div>`}
function renderReviewSnapshot(){
  const r=state.reviews[reviewSelectedDate];$("reviewArchiveBadge").textContent=r?.archived?"已归档":"";
  if(!hasReviewContent(r)){$("reviewSnapshot").innerHTML=empty("这一天还没有保存内容。");return}
  $("reviewSnapshot").innerHTML=`<div class="snapshot-date">${formatReviewDate(reviewSelectedDate)}</div>${snapshotRow("目标",r.goal)}${snapshotRow("完成标准",r.standard)}${snapshotRow("截止时间",r.deadline)}${snapshotRow("完成度",r.completion?`${r.completion}%`:"")}${snapshotRow("差距",r.gap)}${snapshotRow("重来如何",r.restart)}`
}
function renderReviewArchive(){
  const el=$("reviewArchiveList");el.innerHTML="";const rows=Object.entries(state.reviews).filter(([,r])=>r.archived).sort((a,b)=>b[0].localeCompare(a[0]));
  if(!rows.length){el.innerHTML=empty("还没有归档记录。");return}
  rows.forEach(([key,r])=>{const btn=document.createElement("button");btn.className="archive-item";btn.innerHTML=`<strong>${formatReviewDate(key)}</strong><span>${r.goal?escapeHtml(r.goal).slice(0,38):"未填写目标"}</span><em>${r.completion?escapeHtml(r.completion)+"%":"-"}</em>`;btn.onclick=()=>loadReview(key);el.appendChild(btn)})
}
$("saveDailyReview").onclick=()=>{state.reviews[reviewSelectedDate]=collectReview();saveReviews();renderReviewSnapshot();renderReviewArchive();$("dailyReviewNote").textContent="已保存";setTimeout(()=>$("dailyReviewNote").textContent="",1400)};
$("archiveDailyReview").onclick=()=>{const next=collectReview();if(!hasReviewContent(next)){alert("这一天还没有内容，先填写并保存。");return}next.archived=true;state.reviews[reviewSelectedDate]=next;saveReviews();loadReview(reviewSelectedDate)};
$("reviewDate").onchange=e=>{if(e.target.value)loadReview(e.target.value)};$("reviewPrev").onclick=()=>loadReview(shiftDate(reviewSelectedDate,-1));$("reviewNext").onclick=()=>loadReview(shiftDate(reviewSelectedDate,1));$("reviewToday").onclick=()=>loadReview(dateKey());

function links(){
  const q=$("quickLinks");q.innerHTML="";[{n:"Notion",u:state.settings.notionHome},{n:"飞书",u:state.settings.feishuHome},{n:"ChatGPT",u:"https://chatgpt.com/"},{n:"GitHub",u:"https://github.com/liuchengyin/lambert-ai-os-dashboard"}].forEach(x=>q.insertAdjacentHTML("beforeend",`<a href="${x.u||"#"}" target="_blank">${x.n}</a>`));
  const k=$("knowledgeLinks");k.innerHTML="";[{n:"Notion 知识库",u:state.settings.notionHome},{n:"飞书知识库",u:state.settings.feishuHome}].forEach(x=>k.insertAdjacentHTML("beforeend",`<a href="${x.u||"#"}" target="_blank">${x.n}</a>`))
}
function embed(prefix,url){const f=$(prefix+"Frame"),e=$(prefix+"Empty"),a=$(prefix+"Open");a.href=url||"#";if(url){f.src=url;f.style.display="block";e.style.display="none";a.style.display="inline"}else{f.removeAttribute("src");f.style.display="none";e.style.display="block";a.style.display="none"}}
function loadTaskStorageLink(){
  const url=state.settings.taskUrl||"";const open=$("taskOpen"),emptyState=$("taskEmpty");
  open.href=url||"#";open.style.display=url?"inline-block":"none";emptyState.style.display=url?"none":"block";
  $("taskStorageState").textContent=url?"任务库入口已配置 · 当前写入仍保存在浏览器":"当前保存：浏览器本机"
}
function loadSettings(){
  notionHome.value=state.settings.notionHome||"";feishuHome.value=state.settings.feishuHome||"";projectUrl.value=state.settings.projectUrl||"";taskUrl.value=state.settings.taskUrl||"";reviewUrl.value=state.settings.reviewUrl||"";
  embed("project",state.settings.projectUrl);embed("review",state.settings.reviewUrl);loadTaskStorageLink()
}
$("saveSettings").onclick=()=>{
  state.settings={notionHome:notionHome.value.trim(),feishuHome:feishuHome.value.trim(),projectUrl:projectUrl.value.trim(),taskUrl:taskUrl.value.trim(),reviewUrl:reviewUrl.value.trim()};
  set("settings",state.settings);links();loadSettings();$("settingsNote").textContent=" 已保存"
};

function refreshAll(){renderTop3();renderHome();renderProjectBoard();renderTaskBoard();populateProjectOptions()}
refreshAll();links();loadSettings();loadReview(reviewSelectedDate);

window.addEventListener('lambert-workspace-refresh',event=>{
  if(event.detail.owner!==window.LambertData?.active)return;
  state.tasks=get('tasks',state.tasks);state.projects=get('projects',state.projects);
  renderTaskBoard();renderHome();renderProjectBoard();
  if(typeof renderProjectDashboard==='function')renderProjectDashboard();
});
