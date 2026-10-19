(function(){
'use strict';
var S=window.MobileStore;
var app=document.getElementById('app');
var tabsEl=document.getElementById('tabs');
var syncEl=document.getElementById('syncStatus');
var tab='tasks';
var filterScope='today';
var reviewDate=null;
var filterProject=null;
var foldDone=true;
var TABS=[['tasks','任务','✓'],['projects','项目','▦'],['review','复盘','✎']];

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
    var b=el('button',tab===t[0]?'on':'');
    b.appendChild(el('span','ic',t[2]));
    b.appendChild(el('span',null,t[1]));
    b.onclick=function(){tab=t[0];filterProject=null;if(tab==='projects')window.MobileProjectBoard.reset();render();};
    tabsEl.appendChild(b);
  });
}

function render(){
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
  if(pid(t))meta.appendChild(el('span','tag',projName(pid(t))));
  if(t.due){var over=t.due<today()&&t.status!=='已完成';meta.appendChild(el('span','tag'+(over?' over':''),t.due.slice(5,10).replace('-','/')));}
  if(t.steps&&t.steps.length)meta.appendChild(el('span','task-step-count',t.steps.filter(function(s){return s.done;}).length+'/'+t.steps.length+' 步骤'));
  if(meta.childNodes.length)body.appendChild(meta);
  d.appendChild(body);
  if(tab==='tasks'&&window.MobileTaskSwipe)return window.MobileTaskSwipe.wrap(d,t.title,function(){softDeleteTask(t.id);},t.status==='已完成'?null:function(){var rows=S.read('tasks',[]),current=rows.find(function(x){return x.id===t.id;});if(!current||current.deletedAt||current.archived)throw Error('任务不存在');if(current.status==='已完成')return;S.write('tasks',window.MobileTaskModel.toggle(rows,t.id,today()));setTimeout(render,200);});
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
  var all=tasks().filter(function(t){return (!filterProject||pid(t)===filterProject)&&(filterScope!=='today'||(t.due||'').slice(0,10)===today()||targetIds.includes(t.id));});
  var c=el('div','task-list');
  var scopes=el('div','task-scopes');scopes.setAttribute('role','group');scopes.setAttribute('aria-label','任务日期筛选');[['today','今日'],['all','全部']].forEach(function(item){var btn=el('button',filterScope===item[0]?'on':'',item[1]);btn.type='button';btn.setAttribute('aria-pressed',String(filterScope===item[0]));btn.onclick=function(){filterScope=item[0];render();};scopes.appendChild(btn);});c.appendChild(scopes);
  var picker=el('button','task-project-picker',filterProject?projName(filterProject):'全部项目');picker.type='button';picker.setAttribute('aria-label','任务项目筛选');picker.setAttribute('aria-haspopup','dialog');picker.appendChild(el('span',null,'⌄'));picker.onclick=function(){window.MobilePolish.openProjectPicker({projects:projects(),currentId:filterProject||'',onSelect:function(id){filterProject=id;render();}});};c.appendChild(picker);
  var h=el('h2');h.appendChild(el('span',null,'任务'));
  var add=el('button','task-fab','＋');add.type='button';add.setAttribute('aria-label','新增任务');
  add.onclick=function(){openTaskDialog(null);};
  app.appendChild(add);
  c.appendChild(h);
  var open=all.filter(function(t){return t.status!=='已完成';});
  var done=all.filter(function(t){return t.status==='已完成';});
  c.appendChild(el('div','grp','未完成 '+open.length));
  if(!open.length)c.appendChild(el('div','empty','无未完成任务'));
  open.forEach(function(t){c.appendChild(taskRow(t));});
  var f=el('button','fold');f.type='button';f.setAttribute('aria-expanded',String(!foldDone));
  f.appendChild(el('span',null,'已完成 '+done.length));
  f.appendChild(el('span',null,foldDone?'展开 ▾':'收起 ▸'));
  f.onclick=function(){foldDone=!foldDone;render();};
  c.appendChild(f);
  if(!foldDone)done.forEach(function(t){c.appendChild(taskRow(t));});
  app.appendChild(c);
}

function renderProjects(){
 app.appendChild(window.MobileProjectBoard.render({projects:projects(),tasks:tasks(),projectId:pid,selectedId:filterProject,today:today(),onSelect:function(id){filterProject=id;render();},onEdit:openProjectDialog,onAddProject:function(){openProjectDialog(null);},onAddTask:function(id){filterProject=id;openTaskDialog(null);},taskRow:taskRow}));
}

function goalCard(date){
 var c=el('section','card');c.appendChild(el('h2',null,'今日目标'));
 var rv=reviews()[date]||{},ids=rv.taskIds||[],all=tasks(),done=ids.filter(function(id){return all.some(function(t){return t.id===id&&t.status==='已完成';});}).length;
 c.appendChild(el('p','goal-progress','完成 '+done+' / '+ids.length));
 ids.forEach(function(id){var t=all.find(function(t){return t.id===id;});if(t)c.appendChild(taskRow(t));else c.appendChild(el('p','mut','任务已归档或不存在'));});
 var d=el('details'),sum=el('summary',null,'选择目标任务');d.appendChild(sum);
 var filter=el('select');filter.setAttribute('aria-label','目标项目筛选');var opt=el('option',null,'全部项目');opt.value='';filter.appendChild(opt);projects().forEach(function(p){var o=el('option',null,p.name);o.value=p.id;filter.appendChild(o);});d.appendChild(filter);var list=el('div');d.appendChild(list);
 function choices(){list.textContent='';all.filter(function(t){return t.status!=='已完成'&&(!filter.value||pid(t)===filter.value);}).sort(function(a,b){var ad=(a.due||'').slice(0,10),bd=(b.due||'').slice(0,10);return (ad===date?0:1)-(bd===date?0:1)||ad.localeCompare(bd);}).forEach(function(t){var lab=el('label','goal-choice');var cb=el('input');cb.type='checkbox';cb.checked=ids.includes(t.id);cb.setAttribute('aria-label','目标：'+t.title);cb.onchange=function(){var r=reviews(),cur=r[date]||{},set=new Set(cur.taskIds||[]);cb.checked?set.add(t.id):set.delete(t.id);cur.taskIds=Array.from(set);cur.updatedAt=new Date().toISOString();r[date]=cur;try{saveReviews(r);if(tab==='review'){c.replaceWith(goalCard(date));}else render();}catch(e){cb.checked=!cb.checked;alert('保存失败：'+e.message);}};lab.append(cb,el('span',null,t.title+' · '+((t.due||'').slice(0,10)||'未排期')));list.appendChild(lab);});}filter.onchange=choices;choices();c.appendChild(d);return c;
}

function renderReview(){renderReviewFor(reviewDate||today());}

function renderReviewFor(date){
  reviewDate=date;
  var rv=reviews()[date]||{taskIds:[],goal:'',gap:'',reason:'',restart:'',updatedAt:0};
  var all=tasks();
  app.textContent='';
  var c=el('div','card');
  var h=el('h2');h.appendChild(el('span',null,'复盘'));
  var inp=el('input');inp.type='date';inp.value=date;inp.style.maxWidth='150px';
  inp.onchange=function(){renderReviewFor(inp.value);};
  h.appendChild(inp);c.appendChild(h);app.appendChild(c);
  var sel=rv.taskIds||[];
  app.appendChild(goalCard(date));
  var fc=el('div','card');fc.appendChild(el('h2',null,'复盘记录'));
  [['goal','目标'],['gap','差距'],['reason','原因'],['restart','重启计划']].forEach(function(f){
    fc.appendChild(el('label',null,f[1]));
    var ta=el('textarea');ta.value=rv[f[0]]||'';ta.dataset.k=f[0];fc.appendChild(ta);
  });
  var sv=el('button','btn pri','保存复盘');sv.style.width='100%';sv.style.marginTop='10px';
  sv.onclick=function(){
    var r=reviews();var cur=r[date]||{taskIds:sel.slice(),goal:'',gap:'',reason:'',restart:'',updatedAt:0};
    fc.querySelectorAll('textarea').forEach(function(ta){cur[ta.dataset.k]=ta.value;});
    cur.updatedAt=Date.now();r[date]=cur;
    try{saveReviews(r);refreshStatus();}catch(e){alert('保存失败：'+e.message);}
  };
  fc.appendChild(sv);app.appendChild(fc);
  refreshStatus();
}

function openTaskDialog(t){
 if(t&&window.MobileTaskDetails){window.MobileTaskDetails.open(t.id,{readTasks:function(){return S.read('tasks',[]);},writeTasks:function(arr){S.write('tasks',arr);},projects:projects,projectId:pid,render:render,newId:uid,today:today});return;}

 var dlg=el('dialog',t?'task-editor':'task-composer');dlg.setAttribute('aria-label',t?'编辑任务':'新增任务');
 var form=el('form');form.method='dialog';var head=el('div','task-dialog-head');
 var cancel=el('button','btn',t?'返回':'取消');cancel.type='button';cancel.onclick=function(){dlg.close();};head.appendChild(cancel);head.appendChild(el('h3',null,t?'编辑任务':'添加任务'));form.appendChild(head);
 var titleLabel=el('label',null,'任务标题');titleLabel.htmlFor='mobileTaskTitle';form.appendChild(titleLabel);
 var title=el('input');title.id='mobileTaskTitle';title.setAttribute('aria-label','任务标题');title.placeholder='添加任务';title.required=true;title.maxLength=300;title.value=t?t.title:'';form.appendChild(title);
 var fields=el('div','task-optional');var dateLabel=el('label',null,'日期');var date=el('input');date.type='date';date.setAttribute('aria-label','任务日期');date.value=t&&t.due?t.due.slice(0,10):(tab==='tasks'&&filterScope==='today'?today():'');dateLabel.appendChild(date);fields.appendChild(dateLabel);
 var projectLabel=el('label',null,'关联项目');var project=el('select');project.setAttribute('aria-label','关联项目');var blank=el('option',null,'不关联项目');blank.value='';project.appendChild(blank);
 var ps=projects().filter(function(p){return !p.archived||(t&&p.id===pid(t));});ps.forEach(function(p){var o=el('option',null,p.name);o.value=p.id;project.appendChild(o);});project.value=t?pid(t):(filterProject||'');projectLabel.appendChild(project);fields.appendChild(projectLabel);form.appendChild(fields);
 var error=el('p','task-error');error.setAttribute('role','alert');form.appendChild(error);
 var save=el('button','btn pri',t?'保存修改':'创建任务');save.type='submit';form.appendChild(save);dlg.appendChild(form);document.body.appendChild(dlg);
 form.onsubmit=function(e){e.preventDefault();if(!title.value.trim()){error.textContent='请输入任务标题';title.focus();return;}var arr=tasks();var item=t?arr.find(function(x){return x.id===t.id;}):{id:uid(),status:'待开始',priority:'P1',matrix:'q2',createdAt:new Date().toISOString()};if(!item){error.textContent='任务不存在，请重新打开';return;}item.title=title.value.trim();if((item.due||'').slice(0,10)!==date.value)item.due=date.value;assign(item,project.value);item.updatedAt=new Date().toISOString();if(!t)arr.push(item);try{saveTasks(arr);dlg.close();render();}catch(err){error.textContent='保存失败，请重试：'+err.message;}};
 dlg.addEventListener('close',function(){dlg.remove();},{once:true});dlg.showModal();title.focus();
 if(window.visualViewport){var viewport=window.visualViewport;var resize=function(){if(!t){dlg.style.bottom=Math.max(0,innerHeight-viewport.height-viewport.offsetTop)+'px';dlg.style.maxHeight=Math.max(120,viewport.height-12)+'px';requestAnimationFrame(function(){if(document.activeElement&&dlg.contains(document.activeElement))document.activeElement.scrollIntoView({block:'nearest'});});}};viewport.addEventListener('resize',resize);resize();dlg.addEventListener('close',function(){viewport.removeEventListener('resize',resize);},{once:true});}
}

function openProjectDialog(p){
  var dlg=document.createElement('dialog');
  var form=document.createElement('form');form.method='dialog';
  form.appendChild(el('h3',null,p?'编辑项目':'新增项目'));
  form.appendChild(el('label',null,'名称'));
  var ni=el('input');ni.value=p?p.name:'';ni.required=true;form.appendChild(ni);
  form.appendChild(el('label',null,'状态'));
  var sel=el('select');
  ['待开始','进行中','已完成'].forEach(function(s){var o=el('option',null,s);o.value=s;if(p&&p.status===s)o.selected=true;sel.appendChild(o);});
  form.appendChild(sel);
  var acts=el('div','dlg-actions');
  var cancel=el('button','btn','取消');cancel.type='button';cancel.onclick=function(){dlg.close();};
  var ok=el('button','btn pri','保存');ok.type='submit';
  acts.appendChild(cancel);acts.appendChild(ok);form.appendChild(acts);
  dlg.appendChild(form);document.body.appendChild(dlg);
  form.onsubmit=function(e){
    e.preventDefault();
    if(!ni.value.trim())return;
    var arr=projects();
    if(p){arr.forEach(function(x){if(x.id===p.id){x.name=ni.value.trim();x.status=sel.value;}});}
    else{arr.push({id:'p'+Date.now().toString(36),name:ni.value.trim(),status:sel.value});}
    try{saveProjects(arr);dlg.close();render();}catch(err){alert('保存失败：'+err.message);}
  };
  dlg.addEventListener('close',function(){dlg.remove();},{once:true});
  dlg.showModal();
}

document.getElementById('accountButton').onclick=function(){window.MobilePolish.openAccount({pendingCount:(S.pending()||[]).length,counts:{tasks:tasks().length,projects:projects().filter(function(p){return !p.archived&&!p.deletedAt;}).length,reviews:Object.keys(reviews()).length}});};
window.addEventListener('mobile-change',function(){refreshStatus();});
window.addEventListener('storage',function(e){if(['tasks','projects','daily_reviews_v2'].includes(e.key))render();});
window.addEventListener('online',refreshStatus);
window.addEventListener('offline',refreshStatus);
render();
})();
