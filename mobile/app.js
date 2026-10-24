(function(){
'use strict';
var S=window.MobileStore;
var app=document.getElementById('app');
var tabsEl=document.getElementById('tabs');
var syncEl=document.getElementById('syncStatus');
var accountButton=document.getElementById('accountButton');
var tab='tasks';
var filterScope='today';
var reviewDate=null;
var reviewDrafts={},goalProjectFilters={},goalPickerOpen={},archiveBusy=false;
var filterProject=null;
var foldDone=true;
var TABS=[['tasks','任务','check'],['projects','项目','board'],['review','复盘','review']];

function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function today(){return S.date();}
function tasks(){return S.read('tasks',[]).filter(function(t){return !t.archived&&!t.deletedAt;});}
function pid(t){return t.projectId||((projects().find(function(p){return p.name===t.project||p.id===t.project;})||{}).id)||'';}
function assign(t,id){var p=projects().find(function(p){return p.id===id;});t.projectId=id;t.project=p?p.name:'';}
function projects(){return S.read('projects',[]);}
function reviews(){return S.read('daily_reviews_v2',{});}
function projName(id){var p=projects().filter(function(x){return x.id===id;})[0];return p?p.name:'未分类';}
function saveTasks(v){var original=S.read('tasks',[]);var ids=new Set(v.map(function(t){return t.id;}));S.write('tasks',v.concat(original.filter(function(t){return !ids.has(t.id);})));}
function saveProjects(v){S.write('projects',v);}
function saveReviews(v){S.write('daily_reviews_v2',v);}
function uid(){return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function statusText(){var p=S.pending();var base='本地已保存 · 云同步待接入';if(!navigator.onLine)base='离线 · 本地已保存';if(p&&p.length)base+=' · 待同步'+p.length;return base;}
function refreshStatus(){syncEl.textContent=statusText();}

function renderTabs(){
  tabsEl.textContent='';
  TABS.forEach(function(t){
    var b=el('button',tab===t[0]?'on':'');b.setAttribute('aria-label',t[1]);
    var ic=el('span','ic');ic.setAttribute('aria-hidden','true');ic.appendChild(window.MobileCompose.icon(t[2]));b.appendChild(ic);
    b.appendChild(el('span',null,t[1]));
    b.onclick=function(){captureReviewDraft();tab=t[0];filterProject=null;if(tab==='projects')window.MobileProjectBoard.reset();render();};
    tabsEl.appendChild(b);
  });
  if(accountButton){accountButton.hidden=true;document.body.appendChild(accountButton);}
}

function captureReviewDraft(){if(tab!=='review'||!reviewDate)return;var fields=app.querySelectorAll('[data-k]');if(!fields.length)return;var value={};fields.forEach(function(n){value[n.dataset.k]=n.value;});reviewDrafts[reviewDate]=value;}
function render(){
  captureReviewDraft();
  renderTabs();
  app.textContent='';app.className=tab==='review'?'review-page':'';
  if(tab==='tasks')renderTasks();
  else if(tab==='projects')renderProjects();
  else renderReview();
  refreshStatus();
}

function taskRow(t,opts){
  opts=opts||{};
  var d=el('div','task'+(t.status==='已完成'?' done':''));d.dataset.taskId=t.id;
  var chk=el('button','chk',t.status==='已完成'?'✓':'');chk.type='button';chk.setAttribute('aria-label',(t.status==='已完成'?'重开：':'完成：')+t.title);
  chk.onclick=function(){
    try{S.write('tasks',window.MobileTaskModel.toggle(S.read('tasks',[]),t.id,today()));render();}catch(e){alert('保存失败：'+e.message);}
  };
  d.appendChild(chk);
  var body=el('button','body task-edit');body.type='button';body.setAttribute('aria-label','编辑：'+t.title);body.onclick=function(){openTaskDialog(t);};
  body.appendChild(el('div','tt',t.title));
  var meta=el('div','meta');
  if(pid(t))meta.appendChild(el('span','tag meta-project',projName(pid(t))));
  var shownDate=t.status==='已完成'?t.completedAt:t.due;var dateMeta=null;if(shownDate){var day=t.status==='已完成'?S.date(new Date(shownDate)):shownDate.slice(0,10);var over=day<today()&&t.status!=='已完成';dateMeta=el('span','tag meta-date'+(over?' over':''),day.slice(5,10).replace('-','/'));dateMeta.setAttribute('aria-label',(t.status==='已完成'?'实际完成日期：':over?'已逾期，截止日期：':'截止日期：')+day);}
  if(t.matrix&&t.matrix!=='q2')meta.appendChild(el('span','tag',({q1:'P0',q3:'P2',q4:'P3'}[t.matrix]||t.priority||'')));
  (t.labels||[]).slice(0,2).forEach(function(label){meta.appendChild(el('span','tag',label));});
  if(t.steps&&t.steps.length)meta.appendChild(el('span','task-step-count',t.steps.filter(function(s){return s.done;}).length+'/'+t.steps.length+' 步骤'));
  if(dateMeta)meta.appendChild(dateMeta);if(meta.childNodes.length)body.appendChild(meta);
  d.appendChild(body);
  if((tab==='tasks'||tab==='projects')&&window.MobileTaskSwipe)return window.MobileTaskSwipe.wrap(d,t.title,function(){softDeleteTask(t.id);},t.status==='已完成'?null:function(){var rows=S.read('tasks',[]),current=rows.find(function(x){return x.id===t.id;});if(!current||current.deletedAt||current.archived)throw Error('任务不存在');if(current.status==='已完成')return;S.write('tasks',window.MobileTaskModel.toggle(rows,t.id,today()));setTimeout(render,200);},t.status==='已完成'?function(){var rows=S.read('tasks',[]),current=rows.find(function(x){return x.id===t.id;});if(!current||current.deletedAt||current.archived||current.status!=='已完成')throw Error('任务状态已变化');current.archived=true;current.archivedAt=new Date().toISOString();current.updatedAt=current.archivedAt;S.write('tasks',rows);setTimeout(render,200);}:null);
  return d;
}

var undoTimer=null,undoBar=null;
function softDeleteTask(id){
 var all=S.read('tasks',[]),t=all.find(function(t){return t.id===id;});if(!t||t.deletedAt||t.archived)throw Error('任务不存在或已删除');
 var stamp=new Date().toISOString();t.deletedAt=stamp;t.updatedAt=stamp;S.write('tasks',all);render();
 if(undoTimer)clearTimeout(undoTimer);if(undoBar)undoBar.remove();
 var bar=el('div','task-undo'),msg=el('span',null,'任务已删除'),undo=el('button',null,'撤销');undo.type='button';bar.setAttribute('role','status');undo.setAttribute('aria-label','撤销删除');bar.append(msg,undo);document.body.appendChild(bar);undoBar=bar;
 undo.onclick=function(){try{var rows=S.read('tasks',[]),current=rows.find(function(t){return t.id===id;});if(!current||current.deletedAt!==stamp)throw Error('任务已变化，请重新查看');delete current.deletedAt;current.updatedAt=new Date().toISOString();S.write('tasks',rows);clearTimeout(undoTimer);bar.remove();undoBar=null;render();}catch(e){msg.textContent='撤销失败：'+e.message;}};
 undoTimer=setTimeout(function(){bar.remove();if(undoBar===bar)undoBar=null;},8000);
}

function renderTasks(){
  var targetIds=(reviews()[today()]||{}).taskIds||[];
  var all=tasks().filter(function(t){return (!filterProject||pid(t)===filterProject)&&(filterScope!=='today'||(t.due||'').slice(0,10)===today()||targetIds.includes(t.id));}).sort(window.MobileCompose.compareTasks);
  var c=el('div','task-list');
  var scopes=el('div','task-scopes');scopes.setAttribute('role','group');scopes.setAttribute('aria-label','任务日期筛选');[['today','今日'],['all','全部']].forEach(function(item){var btn=el('button',filterScope===item[0]?'on':'',item[1]);btn.type='button';btn.setAttribute('aria-pressed',String(filterScope===item[0]));btn.onclick=function(){filterScope=item[0];render();};scopes.appendChild(btn);});c.appendChild(scopes);
  var panel=el('div','filter-panel');c.appendChild(panel);
  var picker=el('button','task-project-picker',filterProject?projName(filterProject):'全部项目');picker.type='button';picker.setAttribute('aria-label','任务项目筛选');picker.setAttribute('aria-haspopup','dialog');picker.appendChild(el('span',null,'⌄'));picker.onclick=function(){window.MobilePolish.openProjectPicker({projects:projects(),currentId:filterProject||'',onSelect:function(id){filterProject=id;render();}});};panel.appendChild(picker);
  var add=el('button','task-fab','＋');add.type='button';add.setAttribute('aria-label','新增任务');
  add.onclick=function(){openTaskDialog(null);};
  app.appendChild(add);
  var open=all.filter(function(t){return t.status!=='已完成';});
  var done=all.filter(function(t){return t.status==='已完成';}).sort(window.MobileTaskModel.compareCompleted);
  if(!open.length)panel.appendChild(el('div','empty','无未完成任务'));
  open.forEach(function(t){panel.appendChild(taskRow(t));});
  var f=el('button','fold');f.type='button';f.setAttribute('aria-expanded',String(!foldDone));
  f.appendChild(el('span',null,'已完成 '+done.length));
  f.appendChild(el('span',null,foldDone?'展开 ▾':'收起 ▸'));
  f.onclick=function(){foldDone=!foldDone;render();};
  panel.appendChild(f);
  if(!foldDone)done.forEach(function(t){panel.appendChild(taskRow(t));});
  app.appendChild(c);
}

function projectAPI(){return {projects:projects(),tasks:tasks(),projectId:pid,selectedId:filterProject,today:today(),onSelect:function(id){filterProject=id;render();},onEdit:openProjectDialog,onAddProject:function(){openProjectDialog(null);},onAddTask:function(id){filterProject=id;openTaskDialog(null);},taskRow:taskRow,compareTasks:window.MobileCompose.compareTasks};}
function renderProjects(){
 var board=window.MobileProjectBoard.render(projectAPI());app.appendChild(board);var add=board.querySelector('.project-fab');if(add)app.appendChild(add);
}

function goalCard(date){
 var c=el('section','card goal-card'),heading=el('h2',null,'今日目标');
 var rv=reviews()[date]||{},ids=rv.taskIds||[],all=tasks(),done=ids.filter(function(id){return all.some(function(t){return t.id===id&&t.status==='已完成';});}).length;
 heading.appendChild(el('span','goal-progress','完成 '+done+' / '+ids.length));c.appendChild(heading);
 ids.forEach(function(id){var t=all.find(function(t){return t.id===id;});if(t)c.appendChild(taskRow(t));else c.appendChild(el('p','mut','任务已归档或不存在'));});
 var d=el('details','goal-picker'),sum=el('summary',null,'选择目标任务');d.open=!!goalPickerOpen[date];d.ontoggle=function(){goalPickerOpen[date]=d.open;};d.appendChild(sum);
 var filter=el('div','goal-projects');filter.setAttribute('role','group');filter.setAttribute('aria-label','目标项目筛选');d.appendChild(filter);var list=el('div');d.appendChild(list);
 function choices(){
  var selected=goalProjectFilters[date]||[];filter.replaceChildren();
  [{id:'',name:'全部项目'}].concat(projects().filter(function(p){return !p.archived&&!p.deletedAt;})).forEach(function(p){var b=el('button','goal-project-chip',p.name);b.type='button';b.setAttribute('aria-label','目标项目：'+p.name);b.setAttribute('aria-pressed',String(p.id?selected.includes(p.id):!selected.length));b.onclick=function(){var current=goalProjectFilters[date]||[];goalProjectFilters[date]=p.id?(current.includes(p.id)?current.filter(function(id){return id!==p.id;}):current.concat(p.id)):[];choices();};filter.appendChild(b);});
  list.textContent='';all.filter(function(t){return t.status!=='已完成'&&(!selected.length||selected.includes(pid(t)));}).sort(function(a,b){var ad=(a.due||'').slice(0,10),bd=(b.due||'').slice(0,10);return (ad===date?0:1)-(bd===date?0:1)||window.MobileCompose.compareTasks(a,b);}).forEach(function(t){
   var lab=el('label','goal-choice'),cb=el('input');cb.type='checkbox';cb.checked=ids.includes(t.id);cb.setAttribute('aria-label','目标：'+t.title);
   cb.onchange=function(){var r=reviews(),cur=r[date]||{},set=new Set(cur.taskIds||[]);cb.checked?set.add(t.id):set.delete(t.id);cur.taskIds=Array.from(set);cur.updatedAt=new Date().toISOString();r[date]=cur;try{saveReviews(r);goalPickerOpen[date]=true;c.replaceWith(goalCard(date));}catch(e){cb.checked=!cb.checked;alert('保存失败：'+e.message);}};
   lab.append(cb,el('span',null,t.title+' · '+((t.due||'').slice(5,10).replace('-','/')||'未排期')));list.appendChild(lab);
  });if(!list.children.length)list.appendChild(el('p','mut','没有未完成任务'));
 }
 choices();c.appendChild(d);return c;
}
function offsetDate(date,amount){var d=new Date(date+'T12:00:00');d.setDate(d.getDate()+amount);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function saveReview(date){
 if(date===reviewDate)captureReviewDraft();var r=reviews(),cur=Object.assign({},r[date]||{taskIds:[]},reviewDrafts[date]||{});cur.updatedAt=new Date().toISOString();r[date]=cur;saveReviews(r);delete reviewDrafts[date];return cur;
}
function resizeReviewFields(root){root.querySelectorAll('textarea').forEach(function(ta){ta.style.height='0px';ta.style.height=Math.max(64,ta.scrollHeight+2)+'px';});}
function renderReview(){renderReviewFor(reviewDate||today());}
function renderReviewFor(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
 reviewDate=date;var rv=Object.assign({},reviews()[date]||{},reviewDrafts[date]||{});app.textContent='';
 var nav=el('div','review-datebar'),group=el('div','task-scopes review-day-scopes');group.setAttribute('role','group');group.setAttribute('aria-label','复盘日期切换');group.addEventListener('filter-swipe',function(e){e.preventDefault();changeDate(offsetDate(date,e.detail.direction));});
 function changeDate(value){try{captureReviewDraft();if(reviews()[date]||Object.values(reviewDrafts[date]||{}).some(function(v){return String(v).trim();}))saveReview(date);renderReviewFor(value);}catch(e){alert('保存失败：'+e.message);}}
 [[-1,'昨天'],[0,'今天'],[1,'明天']].forEach(function(pair){var value=offsetDate(today(),pair[0]),b=el('button',date===value?'on':'',pair[1]);b.type='button';b.setAttribute('aria-pressed',String(date===value));b.onclick=function(){changeDate(value);};group.appendChild(b);});nav.appendChild(group);
 var calendar=el('button','review-calendar');calendar.type='button';calendar.setAttribute('aria-label','选择复盘日期');calendar.appendChild(window.MobilePickers.icon('date'));calendar.onclick=function(){window.MobilePickers.date({label:'复盘日期',value:date,dateOnly:true,onSelect:function(value){if(value)changeDate(value.slice(0,10));}});};nav.appendChild(calendar);if(accountButton){var account=app===document.getElementById('app')?accountButton:accountButton.cloneNode(true);if(account!==accountButton)account.removeAttribute('id');account.hidden=false;nav.appendChild(account);}app.appendChild(nav);
 var panel=el('div','filter-panel');app.appendChild(panel);
 if(![-1,0,1].some(function(n){return offsetDate(today(),n)===date;}))app.appendChild(el('p','review-selected-date',date.replaceAll('-','/')));
 panel.appendChild(goalCard(date));var fc=el('section','card review-fields');
 [['goal','目标'],['gap','差距'],['reason','原因'],['restart','重启计划']].forEach(function(f){var label=el('label',null,f[1]),ta=el('textarea');ta.rows=2;ta.value=rv[f[0]]||'';ta.dataset.k=f[0];ta.setAttribute('aria-label','复盘'+f[1]);ta.oninput=function(){resizeReviewFields(fc);captureReviewDraft();};label.appendChild(ta);fc.appendChild(label);});
 var message=el('p','review-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 var actions=el('div','review-actions'),sv=el('button','btn pri','保存复盘');sv.type='button';sv.onclick=function(){try{saveReview(date);renderReviewFor(date);app.querySelector('.review-message').textContent='已保存';refreshStatus();}catch(e){message.textContent='保存失败：'+e.message;}};actions.appendChild(sv);
 var archive=el('button','btn review-archive','归档到飞书');archive.type='button';archive.hidden=!reviews()[date]?.updatedAt;archive.disabled=archiveBusy;archive.onclick=async function(){
  if(archiveBusy)return;archiveBusy=true;archive.disabled=true;sv.disabled=true;var archivedUrl='',savedSnapshot='',owner=window.LambertData?.active;
  try{
   var saved=saveReview(date);savedSnapshot=JSON.stringify(saved);if(!(saved.taskIds||[]).length&&!['goal','gap','reason','restart','standard','deliverable','delivery'].some(function(key){return String(saved[key]||'').trim();}))throw Error('请先填写复盘或选择目标任务');
   if(!window.LambertAccount?.prepareCloudAction)throw Error('账号服务尚未加载，请稍后重试');
   message.textContent='先同步到云端，再归档飞书…';var auth=await window.LambertAccount.prepareCloudAction();
   var native=location.hostname==='appassets.androidplatform.net',endpoint=native?'https://lambert-ai-os-dashboard.vercel.app/api/feishu-review':'/api/feishu-review';
   var response=await fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.accessToken},body:JSON.stringify({date:date}),signal:AbortSignal.timeout(55000)});
   var data=await response.json().catch(function(){return {};});if(!response.ok||!data.ok)throw Error(data.message||'飞书归档未完成，请检查目录');
   var url=new URL(data.url);if(url.protocol!=='https:'||!/(^|\.)feishu\.cn$/.test(url.hostname)||url.username||url.password)throw Error('归档链接无效');archivedUrl=url.href;
   // Merge the receipt into fresh data; never overwrite edits made during the request.
   if(window.LambertData?.active!==owner)throw Error('账号已变化，请在原账号查看归档');var r=reviews(),current=r[date]||{};r[date]=Object.assign({},current,{feishuUrl:archivedUrl,feishuArchivedAt:data.archivedAt,feishuReviewVersion:data.reviewVersion,feishuSnapshotUpdatedAt:saved.updatedAt});saveReviews(r);
   if(tab==='review'&&reviewDate===date){captureReviewDraft();renderReviewFor(date);document.getElementById('lambertCloudRefresh')?.remove();app.querySelector('.review-message').textContent='已归档飞书'+(JSON.stringify(current)!==savedSnapshot?' · 新修改可再次保存归档':'')+(data.locationName?' · '+data.locationName:'');}
  }catch(e){if(message.isConnected)message.textContent=archivedUrl?'飞书已归档，链接未保存：'+archivedUrl:'归档未完成：'+e.message;}
  finally{archiveBusy=false;archive.disabled=false;sv.disabled=false;var live=app.querySelector('.review-archive');if(live)live.disabled=false;}
 };
 actions.appendChild(archive);fc.append(actions,message);
 if(rv.feishuUrl){try{var u=new URL(rv.feishuUrl);if(u.protocol==='https:'&&/(^|\.)feishu\.cn$/.test(u.hostname)&&!u.username&&!u.password){var link=el('a','review-feishu-link','已归档 · 打开飞书复盘');link.href=u.href;link.rel='noopener';if(location.hostname!=='appassets.androidplatform.net')link.target='_blank';fc.appendChild(link);}}catch(e){}}
 panel.appendChild(fc);if(fc.isConnected)resizeReviewFields(fc);refreshStatus();
}

function openTaskDialog(t){
 if(t){window.MobileTaskDetails.open(t.id,{readTasks:function(){return S.read('tasks',[]);},writeTasks:function(arr){S.write('tasks',arr);},projects:projects,projectId:pid,render:render,newId:uid,today:today});return;}
 window.MobileCompose.task({tasks:function(){return S.read('tasks',[]);},writeTasks:function(rows){S.write('tasks',rows);},projects:projects,projectId:filterProject||'',defaultDue:tab==='tasks'&&filterScope==='today'?today():'',newId:uid,render:render});
}
function openProjectDialog(p){
 window.MobileCompose.project({item:p,projects:projects,tasks:function(){return S.read('tasks',[]);},projectId:pid,newId:function(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);},writeMany:function(values){window.LambertData.writeMany(values);window.dispatchEvent(new CustomEvent('mobile-change'));},render:render});
}

// Build a read-only neighbor without changing the visible page or saving data.
window.MobileFilterPages={preview:function(direction){
 var live=app,scope=filterScope,date=reviewDate,preview=document.createElement('main');preview.className=live.className;
 try{
  app=preview;
  if(tab==='tasks'){
   var next=['today','all'][['today','all'].indexOf(scope)+direction];if(!next)return null;
   filterScope=next;renderTasks();
  }else if(tab==='projects'){
   var board=window.MobileProjectBoard.preview(projectAPI(),direction);if(!board)return null;preview.appendChild(board);
  }else renderReviewFor(offsetDate(date||today(),direction));
  return preview;
 }finally{app=live;filterScope=scope;reviewDate=date;}
}};

document.getElementById('accountButton').onclick=function(){if(window.LambertAccount){window.LambertAccount.open();return;}window.MobilePolish.openAccount({pendingCount:(S.pending()||[]).length,counts:{tasks:tasks().length,projects:projects().filter(function(p){return !p.archived&&!p.deletedAt;}).length,reviews:Object.keys(reviews()).length}});};
window.addEventListener('mobile-change',function(){refreshStatus();});
window.addEventListener('storage',function(e){if(['tasks','projects','daily_reviews_v2'].includes(e.key))render();});
window.addEventListener('resize',function(){if(tab==='review')resizeReviewFields(app);});
window.addEventListener('online',refreshStatus);
window.addEventListener('offline',refreshStatus);
render();
window.MobileBootReady=true;
})();
