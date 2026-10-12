const $=id=>document.getElementById(id);
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const state={
top3:get("top3",["把个人看板上线","补齐项目/任务/复盘框架","把 Notion/飞书链接挂进去"]),
projects:get("projects",[{name:"Lambert AI OS",status:"进行中",extra:"先做看板，再接数据"},{name:"职业能力 / 求职",status:"进行中",extra:"履约 + SLA + 数据"},{name:"知识系统",status:"待开始",extra:"Notion / 飞书整理"}]),
tasks:get("tasks",[{name:"看板 V2 上线",status:"进行中",extra:"本周"},{name:"填写真实项目",status:"待开始",extra:"今天"},{name:"设置 Notion / 飞书入口",status:"待开始",extra:"今天"}]),
settings:get("settings",{notionHome:"https://www.notion.so/",feishuHome:"https://www.feishu.cn/",projectUrl:"",taskUrl:"",reviewUrl:""})
};
$("today").textContent=new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"short"});
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".view").forEach(x=>x.classList.remove("activeView"));b.classList.add("active");$(b.dataset.v).classList.add("activeView")});
function renderTop3(){const e=$("top3");e.innerHTML="";state.top3.forEach(t=>{const d=document.createElement("div");d.className="item";d.textContent=t;e.appendChild(d)})}
$("editTop3").onclick=()=>{const v=prompt("每行一个任务",state.top3.join("\n"));if(v!==null){state.top3=v.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,3);set("top3",state.top3);renderTop3()}};
function renderHome(){const p=$("homeProjects");p.innerHTML="";state.projects.slice(0,4).forEach(x=>p.insertAdjacentHTML("beforeend",`<div class="item"><b>${x.name}</b><div class="meta">${x.status} · ${x.extra||""}</div></div>`));const t=$("homeTasks");t.innerHTML="";state.tasks.slice(0,5).forEach(x=>t.insertAdjacentHTML("beforeend",`<div class="item"><b>${x.name}</b><div class="meta">${x.status} · ${x.extra||""}</div></div>`))}
const cols=["待开始","进行中","已完成"];
function renderBoard(kind,id){const b=$(id);b.innerHTML="";cols.forEach(s=>{const c=document.createElement("div");c.className="col";c.innerHTML=`<h3>${s}</h3>`;state[kind].filter(x=>x.status===s).forEach(x=>c.insertAdjacentHTML("beforeend",`<div class="tile"><b>${x.name}</b><div class="meta">${x.extra||""}</div></div>`));b.appendChild(c)})}
let mode="";
function openDlg(m){mode=m;$("dlgTitle").textContent=m==="projects"?"新建项目":"新建任务";$("dlgName").value="";$("dlgExtra").value="";$("dlgStatus").value="进行中";$("dlg").showModal()}
$("addProject").onclick=()=>openDlg("projects");$("addTask").onclick=()=>openDlg("tasks");
$("dlgSave").onclick=e=>{e.preventDefault();const name=$("dlgName").value.trim();if(!name)return;state[mode].push({name,status:$("dlgStatus").value,extra:$("dlgExtra").value.trim()});set(mode,state[mode]);$("dlg").close();renderBoard("projects","projectBoard");renderBoard("tasks","taskBoard");renderHome()};
["goal","actual","gap","reason","next"].forEach(k=>{$("r_"+k).value=localStorage.getItem("r_"+k)||""});
$("saveReview").onclick=()=>{["goal","actual","gap","reason","next"].forEach(k=>localStorage.setItem("r_"+k,$("r_"+k).value));$("reviewNote").textContent=" 已保存"};
function links(){const q=$("quickLinks");q.innerHTML="";[{n:"Notion",u:state.settings.notionHome},{n:"飞书",u:state.settings.feishuHome},{n:"ChatGPT",u:"https://chatgpt.com/"},{n:"GitHub",u:"https://github.com/"}].forEach(x=>q.insertAdjacentHTML("beforeend",`<a href="${x.u||"#"}" target="_blank">${x.n}</a>`));const k=$("knowledgeLinks");k.innerHTML="";[{n:"Notion 知识库",u:state.settings.notionHome},{n:"飞书知识库",u:state.settings.feishuHome}].forEach(x=>k.insertAdjacentHTML("beforeend",`<a href="${x.u||"#"}" target="_blank">${x.n}</a>`))}
function embed(prefix,url){const f=$(prefix+"Frame"),e=$(prefix+"Empty"),a=$(prefix+"Open");a.href=url||"#";if(url){f.src=url;f.style.display="block";e.style.display="none";a.style.display="inline"}else{f.style.display="none";e.style.display="block";a.style.display="none"}}
function loadSettings(){notionHome.value=state.settings.notionHome||"";feishuHome.value=state.settings.feishuHome||"";projectUrl.value=state.settings.projectUrl||"";taskUrl.value=state.settings.taskUrl||"";reviewUrl.value=state.settings.reviewUrl||"";embed("project",state.settings.projectUrl);embed("task",state.settings.taskUrl);embed("review",state.settings.reviewUrl)}
$("saveSettings").onclick=()=>{state.settings={notionHome:notionHome.value.trim(),feishuHome:feishuHome.value.trim(),projectUrl:projectUrl.value.trim(),taskUrl:taskUrl.value.trim(),reviewUrl:reviewUrl.value.trim()};set("settings",state.settings);links();loadSettings();$("settingsNote").textContent=" 已保存"};
renderTop3();renderHome();renderBoard("projects","projectBoard");renderBoard("tasks","taskBoard");links();loadSettings();