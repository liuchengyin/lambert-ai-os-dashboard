const $=id=>document.getElementById(id);
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

const demoProjectNames=new Set(["Lambert AI OS","职业能力 / 求职","知识系统"]);
const demoTaskNames=new Set(["看板 V2 上线","填写真实项目","设置 Notion / 飞书入口"]);
const demoTop3=new Set(["把个人看板上线","补齐项目/任务/复盘框架","把 Notion/飞书链接挂进去"]);

let savedProjects=get("projects",[]).filter(x=>!demoProjectNames.has(x.name));
let savedTasks=get("tasks",[]).filter(x=>!demoTaskNames.has(x.name));
let savedTop3=get("top3",[]).filter(x=>!demoTop3.has(x));
set("projects",savedProjects);set("tasks",savedTasks);set("top3",savedTop3);

const state={
  top3:savedTop3,
  projects:savedProjects,
  tasks:savedTasks,
  settings:get("settings",{notionHome:"https://www.notion.so/",feishuHome:"https://www.feishu.cn/",projectUrl:"",taskUrl:"",reviewUrl:""})
};

$("today").textContent=new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"short"});

document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>openView(b.dataset.v));
function openView(id){
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.v===id));
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("activeView",x.id===id));
}

function empty(text){return `<div class="meta" style="padding:14px 0">${text}</div>`}

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
  e.innerHTML=`<b class="big">${current.name}</b><p>${current.extra||"暂无补充说明"}</p><div class="meta">${current.status}</div>`;
}

function renderHome(){
  const p=$("homeProjects");p.innerHTML="";
  if(!state.projects.length)p.innerHTML=empty("暂无项目，点击“维护项目”开始。")
  else state.projects.slice(0,4).forEach(x=>p.insertAdjacentHTML("beforeend",`<div class="item"><b>${x.name}</b><div class="meta">${x.status}${x.extra?" · "+x.extra:""}</div></div>`));

  const t=$("homeTasks");t.innerHTML="";
  const visibleTasks=state.tasks.filter(x=>x.status!=="已完成").slice(0,5);
  if(!visibleTasks.length)t.innerHTML=empty("暂无待推进任务，点击“维护任务”开始。")
  else visibleTasks.forEach(x=>t.insertAdjacentHTML("beforeend",`<div class="item"><b>${x.name}</b><div class="meta">${x.status}${x.extra?" · "+x.extra:""}</div></div>`));
  renderMainline();
}

const cols=["待开始","进行中","已完成"];
function renderBoard(kind,id){
  const b=$(id);b.innerHTML="";
  cols.forEach(s=>{
    const c=document.createElement("div");c.className="col";c.innerHTML=`<h3>${s}</h3>`;
    const rows=state[kind].filter(x=>x.status===s);
    if(!rows.length)c.insertAdjacentHTML("beforeend",empty("暂无内容"));
    rows.forEach(x=>{
      const idx=state[kind].indexOf(x);
      const card=document.createElement("div");card.className="tile";card.style.cursor="pointer";
      card.innerHTML=`<b>${x.name}</b><div class="meta">${x.extra||"点击编辑"}</div>`;
      card.onclick=()=>openDlg(kind,idx);
      c.appendChild(card);
    });
    b.appendChild(c)
  })
}

let mode="",editIndex=-1;
function openDlg(m,index=-1){
  mode=m;editIndex=index;
  const editing=index>=0;
  const item=editing?state[m][index]:null;
  $("dlgTitle").textContent=editing?(m==="projects"?"编辑项目":"编辑任务"):(m==="projects"?"新增项目":"新增任务");
  $("dlgName").value=item?.name||"";
  $("dlgExtra").value=item?.extra||"";
  $("dlgStatus").value=item?.status||"进行中";
  $("dlgDelete").style.display=editing?"inline-block":"none";
  $("dlg").showModal()
}

$("addProject").onclick=()=>openDlg("projects");
$("addTask").onclick=()=>openDlg("tasks");
$("homeManageProjects").onclick=()=>{openView("projects");setTimeout(()=>openDlg("projects"),0)};
$("homeManageTasks").onclick=()=>{openView("tasks");setTimeout(()=>openDlg("tasks"),0)};

$("dlgSave").onclick=e=>{
  e.preventDefault();
  const name=$("dlgName").value.trim();if(!name)return;
  const item={name,status:$("dlgStatus").value,extra:$("dlgExtra").value.trim()};
  if(editIndex>=0)state[mode][editIndex]=item;else state[mode].push(item);
  set(mode,state[mode]);$("dlg").close();refreshAll();
};

$("dlgDelete").onclick=()=>{
  if(editIndex<0)return;
  const item=state[mode][editIndex];
  if(!confirm(`确认删除“${item.name}”吗？`))return;
  state[mode].splice(editIndex,1);set(mode,state[mode]);$("dlg").close();refreshAll();
};

["goal","actual","gap","reason","next"].forEach(k=>{$("r_"+k).value=localStorage.getItem("r_"+k)||""});
$("saveReview").onclick=()=>{["goal","actual","gap","reason","next"].forEach(k=>localStorage.setItem("r_"+k,$("r_"+k).value));$("reviewNote").textContent=" 已保存"};

function links(){
  const q=$("quickLinks");q.innerHTML="";
  [{n:"Notion",u:state.settings.notionHome},{n:"飞书",u:state.settings.feishuHome},{n:"ChatGPT",u:"https://chatgpt.com/"},{n:"GitHub",u:"https://github.com/liuchengyin/lambert-ai-os-dashboard"}]
    .forEach(x=>q.insertAdjacentHTML("beforeend",`<a href="${x.u||"#"}" target="_blank">${x.n}</a>`));
  const k=$("knowledgeLinks");k.innerHTML="";
  [{n:"Notion 知识库",u:state.settings.notionHome},{n:"飞书知识库",u:state.settings.feishuHome}]
    .forEach(x=>k.insertAdjacentHTML("beforeend",`<a href="${x.u||"#"}" target="_blank">${x.n}</a>`))
}

function embed(prefix,url){
  const f=$(prefix+"Frame"),e=$(prefix+"Empty"),a=$(prefix+"Open");a.href=url||"#";
  if(url){f.src=url;f.style.display="block";e.style.display="none";a.style.display="inline"}
  else{f.removeAttribute("src");f.style.display="none";e.style.display="block";a.style.display="none"}
}
function loadSettings(){
  notionHome.value=state.settings.notionHome||"";feishuHome.value=state.settings.feishuHome||"";projectUrl.value=state.settings.projectUrl||"";taskUrl.value=state.settings.taskUrl||"";reviewUrl.value=state.settings.reviewUrl||"";
  embed("project",state.settings.projectUrl);embed("task",state.settings.taskUrl);embed("review",state.settings.reviewUrl)
}
$("saveSettings").onclick=()=>{
  state.settings={notionHome:notionHome.value.trim(),feishuHome:feishuHome.value.trim(),projectUrl:projectUrl.value.trim(),taskUrl:taskUrl.value.trim(),reviewUrl:reviewUrl.value.trim()};
  set("settings",state.settings);links();loadSettings();$("settingsNote").textContent=" 已保存"
};

function refreshAll(){renderTop3();renderHome();renderBoard("projects","projectBoard");renderBoard("tasks","taskBoard")}
refreshAll();links();loadSettings();