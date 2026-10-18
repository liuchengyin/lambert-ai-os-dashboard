(function(){
'use strict';
var S=window.MobileStore;
var app=document.getElementById('app');
var tabsEl=document.getElementById('tabs');
var syncEl=document.getElementById('syncStatus');
var tab='today';
var filterProject=null;
var foldDone=true,foldOpen=false;
var TABS=[['today','今日','☀'],['tasks','任务','✓'],['projects','项目','▦'],['review','复盘','✎']];

function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function today(){return S.date();}
function tasks(){return S.read('tasks',[]).filter(function(t){return !t.archived;});}
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
    b.onclick=function(){tab=t[0];filterProject=null;render();};
    tabsEl.appendChild(b);
  });
}

function render(){
  renderTabs();
  app.textContent='';
  if(tab==='today')renderToday();
  else if(tab==='tasks')renderTasks();
  else if(tab==='projects')renderProjects();
  else renderReview();
  refreshStatus();
}

function taskRow(t,opts){
  opts=opts||{};
  var d=el('div','task'+(t.status==='已完成'?' done':''));
  var chk=el('button','chk',t.status==='已完成'?'✓':'');chk.type='button';chk.setAttribute('aria-label',(t.status==='已完成'?'重开：':'完成：')+t.title);
  chk.onclick=function(){
    var arr=tasks();
    arr.forEach(function(x){if(x.id===t.id){x.status=x.status==='已完成'?'进行中':'已完成';x.updatedAt=new Date().toISOString();}});
    try{saveTasks(arr);render();}catch(e){alert('保存失败：'+e.message);}
  };
  d.appendChild(chk);
  var body=el('div','body');
  body.appendChild(el('div','tt',t.title));
  var meta=el('div','meta');
  if(t.priority)meta.appendChild(el('span','tag p1',t.priority));
  meta.appendChild(el('span','tag',projName(pid(t))));
  if(t.due){var over=t.due<today()&&t.status!=='已完成';meta.appendChild(el('span','tag'+(over?' over':''),t.due));}
  body.appendChild(meta);
  if(t.note)body.appendChild(el('div','mut',t.note));
  d.appendChild(body);
  var ed=el('button','btn sm','✎');
  ed.onclick=function(){openTaskDialog(t);};
  d.appendChild(ed);
  return d;
}

function renderToday(){
 app.appendChild(goalCard(today()));
  var c=el('div','card');
  var h=el('h2');h.appendChild(el('span',null,'今日任务'));h.appendChild(el('span','mut',today()));
  c.appendChild(h);
  var all=tasks();
  var list=all.filter(function(t){return t.status!=='已完成'&&(!t.due||t.due.slice(0,10)<=today());});
  list.sort(function(a,b){var ad=(a.due||'').slice(0,10)===today()?0:1,bd=(b.due||'').slice(0,10)===today()?0:1;return ad-bd;});
  if(!list.length)c.appendChild(el('div','empty','今日无待办任务'));
  list.forEach(function(t){c.appendChild(taskRow(t));});
  app.appendChild(c);


}

function renderTasks(){
  var all=tasks().filter(function(t){return !filterProject||pid(t)===filterProject;});
  var c=el('div','card');
  var picker=el('select');picker.setAttribute('aria-label','任务项目筛选');var any=el('option',null,'全部项目');any.value='';picker.appendChild(any);projects().forEach(function(p){var o=el('option',null,p.name);o.value=p.id;picker.appendChild(o);});picker.value=filterProject||'';picker.onchange=function(){filterProject=picker.value;render();};c.appendChild(picker);
  var h=el('h2');h.appendChild(el('span',null,'任务'));
  var add=el('button','btn sm pri','+ 新增');
  add.onclick=function(){openTaskDialog(null);};
  h.appendChild(add);
  c.appendChild(h);
  var open=all.filter(function(t){return t.status!=='已完成';});
  var done=all.filter(function(t){return t.status==='已完成';});
  c.appendChild(el('div','grp','未完成 '+open.length));
  if(!open.length)c.appendChild(el('div','empty','无未完成任务'));
  open.forEach(function(t){c.appendChild(taskRow(t));});
  var f=el('button','fold');f.type='button';
  f.appendChild(el('span',null,'已完成 '+done.length));
  f.appendChild(el('span',null,foldDone?'展开 ▾':'收起 ▸'));
  f.onclick=function(){foldDone=!foldDone;render();};
  c.appendChild(f);
  if(!foldDone)done.forEach(function(t){c.appendChild(taskRow(t));});
  app.appendChild(c);
}

function renderProjects(){
  var ps=projects().filter(function(p){return !p.archived;});
  var c=el('div','card');
  var h=el('h2');h.appendChild(el('span',null,'项目'));
  var add=el('button','btn sm pri','+ 新增');
  add.onclick=function(){openProjectDialog(null);};
  h.appendChild(add);
  c.appendChild(h);
  if(!ps.length)c.appendChild(el('div','empty','暂无项目'));
  var groups={};
  ps.forEach(function(p){var s=p.status||'进行中';(groups[s]=groups[s]||[]).push(p);});
  Object.keys(groups).forEach(function(s){
    c.appendChild(el('div','grp',s));
    groups[s].forEach(function(p){
      var row=el('div','proj'+(filterProject===p.id?' on':''));
      var nm=el('div','nm',p.name);
      row.appendChild(nm);
      var cnt=tasks().filter(function(t){return pid(t)===p.id&&t.status!=='已完成';}).length;
      row.appendChild(el('span','mut',cnt+' 待办'));
      row.onclick=function(){filterProject=filterProject===p.id?null:p.id;render();};
      var ed=el('button','btn sm','✎');
      ed.onclick=function(e){e.stopPropagation();openProjectDialog(p);};
      row.appendChild(ed);
      c.appendChild(row);
    });
  });
  app.appendChild(c);
  if(filterProject){
    var tc=el('div','card');
    var th=el('h2');th.appendChild(el('span',null,projName(filterProject)+' 任务'));
    var clr=el('button','btn sm','清除');
    clr.onclick=function(){filterProject=null;render();};
    th.appendChild(clr);
    tc.appendChild(th);
    var list=tasks().filter(function(t){return pid(t)===filterProject;});
    if(!list.length)tc.appendChild(el('div','empty','该项目暂无任务'));
    list.forEach(function(t){tc.appendChild(taskRow(t));});
    app.appendChild(tc);
  }
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

function renderReview(){renderReviewFor(today());}

function renderReviewFor(date){
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
  var dlg=document.createElement('dialog');
  var form=document.createElement('form');form.method='dialog';
  form.appendChild(el('h3',null,t?'编辑任务':'新增任务'));
  form.appendChild(el('label',null,'标题'));
  var ti=el('input');ti.value=t?t.title:'';ti.required=true;form.appendChild(ti);
  form.appendChild(el('label',null,'项目'));
  var ps=projects().filter(function(p){return !p.archived;});
  var sel=el('select');
  var o0=el('option',null,'未分类');o0.value='';sel.appendChild(o0);
  ps.forEach(function(p){var o=el('option',null,p.name);o.value=p.id;if(t&&pid(t)===p.id)o.selected=true;sel.appendChild(o);});
  form.appendChild(sel);
  form.appendChild(el('label',null,'截止日期'));
  var di=el('input');di.type='date';di.value=t&&t.due?t.due.slice(0,10):'';form.appendChild(di);
  form.appendChild(el('label',null,'备注'));
  var ni=el('textarea');ni.value=t&&t.note?t.note:'';form.appendChild(ni);
  var acts=el('div','dlg-actions');
  var cancel=el('button','btn','取消');cancel.type='button';cancel.onclick=function(){dlg.close();};
  var ok=el('button','btn pri','保存');ok.type='submit';
  acts.appendChild(cancel);acts.appendChild(ok);form.appendChild(acts);
  dlg.appendChild(form);document.body.appendChild(dlg);
  form.onsubmit=function(e){
    e.preventDefault();
    if(!ti.value.trim())return;
    var arr=tasks();
    if(t){
      arr.forEach(function(x){if(x.id===t.id){x.title=ti.value.trim();assign(x,sel.value);if((x.due||'').slice(0,10)!==di.value)x.due=di.value;x.note=ni.value.trim();}});
    }else{
      var item={id:uid(),title:ti.value.trim(),status:'待开始',priority:'P1',matrix:'q2',due:di.value,note:ni.value.trim(),createdAt:new Date().toISOString()};assign(item,sel.value);arr.push(item);
    }
    try{saveTasks(arr);dlg.close();render();}catch(err){alert('保存失败：'+err.message);}
  };
  dlg.addEventListener('close',function(){dlg.remove();},{once:true});
  dlg.showModal();
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

window.addEventListener('mobile-change',function(){refreshStatus();});
window.addEventListener('storage',function(e){if(['tasks','projects','daily_reviews_v2'].includes(e.key))render();});
window.addEventListener('online',refreshStatus);
window.addEventListener('offline',refreshStatus);
render();
})();
