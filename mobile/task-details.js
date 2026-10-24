(function(){
'use strict';
var M=window.MobileTaskModel;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
function clone(o){return JSON.parse(JSON.stringify(o));}
function isDead(t){return !t||t.archived||t.deletedAt;}
function findTask(a,id){for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null;}
function open(taskId,api){
  var tasks=api.readTasks();
  var orig=findTask(tasks,taskId);
  if(isDead(orig))throw new Error('任务不存在或已归档/删除');
  var draft=clone(orig);
  if(!Array.isArray(draft.steps))draft.steps=[];
  if(!draft.repeat)draft.repeat='none';
  var pendingTasks=[];
  var dirty=false;
  var saved=false,closing=false,saveTimer=null,fieldComposing=false;
  var owner=window.LambertData&&window.LambertData.active;
  var dlg=document.createElement('dialog');dlg.setAttribute('aria-label','编辑任务');
  dlg.className='mtd-dialog';
  var root=el('div','mtd-root');
  dlg.appendChild(root);
  var head=el('div','mtd-head');
  var back=el('button','mtd-back','←');back.type='button';back.setAttribute('aria-label','返回');
  var titleIn=el('input','mtd-title');titleIn.type='text';titleIn.maxLength=300;titleIn.value=draft.title||'';titleIn.setAttribute('aria-label','任务标题');titleIn.addEventListener('input',function(){dirty=true;});
  var doneBtn=el('button','mtd-done'+(draft.status==='已完成'?' on':''),draft.status==='已完成'?'✓':'○');doneBtn.type='button';doneBtn.setAttribute('aria-label',draft.status==='已完成'?'重开任务':'完成任务');
  head.appendChild(back);head.appendChild(titleIn);head.appendChild(doneBtn);
  root.appendChild(head);
  var body=el('div','mtd-body');root.appendChild(body);
  var stepsCard=el('div','mtd-card');body.appendChild(stepsCard);
  var stepsBox=el('div','mtd-steps');stepsCard.appendChild(stepsBox);
  function renderSteps(){
    stepsBox.textContent='';
    draft.steps.forEach(function(s){
      var row=el('div','mtd-step');
      var chk=el('button','mtd-check'+(s.done?' on':''));chk.type='button';chk.setAttribute('aria-label','步骤完成：'+(s.title||''));
      chk.addEventListener('click',function(){s.done=!s.done;dirty=true;renderSteps();scheduleSave();});
      var txt=el('input','mtd-steptext');txt.type='text';txt.value=s.title||'';txt.setAttribute('aria-label','步骤文字');
      txt.addEventListener('input',function(){s.title=txt.value;dirty=true;});
      var det=document.createElement('details');det.className='mtd-menu';
      var sum=el('summary','mtd-sum','⋯');sum.setAttribute('aria-label','步骤菜单');
      det.appendChild(sum);
      var menu=el('div','mtd-menu-list');
      var pr=el('button','mtd-mi','提升为任务');pr.type='button';pr.setAttribute('aria-label','提升为任务：'+(s.title||''));
      pr.addEventListener('click',function(){
        try{readFields();var out=M.promote([draft],taskId,s.id,api.newId());draft=out[0];pendingTasks.push(out[1]);dirty=true;renderSteps();doSave();}catch(e){showError(e);return;}
        var tip=el('div','mtd-tip','已提升为任务');stepsCard.appendChild(tip);
      });
      var rm=el('button','mtd-mi','删除步骤');rm.type='button';rm.setAttribute('aria-label','删除步骤：'+(s.title||''));
      rm.addEventListener('click',function(){draft=M.removeStep([draft],taskId,s.id)[0];dirty=true;renderSteps();scheduleSave();});
      menu.appendChild(pr);menu.appendChild(rm);det.appendChild(menu);
      row.appendChild(chk);row.appendChild(txt);row.appendChild(det);
      stepsBox.appendChild(row);
    });
  }
  renderSteps();
  var addRow=el('div','mtd-add');
  var newStep=el('input','mtd-newstep');newStep.type='text';newStep.placeholder='新步骤';newStep.setAttribute('aria-label','新步骤');
  newStep.placeholder='添加步骤';newStep.enterKeyHint='next';newStep.maxLength=300;
  var stepPlus=el('button','mtd-step-plus','＋');stepPlus.type='button';stepPlus.setAttribute('aria-label','添加步骤');
  function stepMode(active){addRow.classList.toggle('editing',active);stepPlus.textContent=active?'':'＋';newStep.placeholder=active?'添加步骤':'下一步';}
  stepPlus.addEventListener('click',function(){newStep.focus();stepMode(true);});
  newStep.addEventListener('focus',function(){stepMode(true);});
  var stepComposing=false,commitAfterComposition=false;
  newStep.addEventListener('compositionstart',function(){stepComposing=true;});
  newStep.addEventListener('compositionend',function(){stepComposing=false;if(commitAfterComposition){commitAfterComposition=false;commitStep();}});
  function commitStep(){if(stepComposing)return false;var v=newStep.value.trim();if(!v)return;draft.steps.push({id:api.newId(),title:v,done:false});newStep.value='';dirty=true;renderSteps();scheduleSave();return true;}
  newStep.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.isComposing&&!stepComposing&&e.keyCode!==229){e.preventDefault();commitStep();newStep.focus();stepMode(true);}});
  newStep.addEventListener('input',function(){dirty=true;});newStep.addEventListener('blur',function(){if(stepComposing)commitAfterComposition=true;else commitStep();stepMode(false);});
  addRow.append(stepPlus,newStep);stepsCard.appendChild(addRow);
  var metaCard=el('div','mtd-card');body.appendChild(metaCard);
  function field(label,node){
    var w=el('div','mtd-field');var l=el('label','mtd-label',label);w.appendChild(l);w.appendChild(node);return w;
  }
  var dateIn=el('input','mtd-input');dateIn.type='date';dateIn.value=(draft.due||'').slice(0,10);dateIn.setAttribute('aria-label','任务日期');
  dateIn.addEventListener('input',function(){dirty=true;});
  metaCard.appendChild(field('截止日期',dateIn));
  var projSel=el('select','mtd-input');projSel.setAttribute('aria-label','关联项目');
  var op0=el('option',null,'未分类');op0.value='';projSel.appendChild(op0);
  var projects=api.projects()||[];
  projects.forEach(function(p){var o=el('option',null,p.name||p.title||'');o.value=p.id;projSel.appendChild(o);});
  var initialPid=api.projectId(draft)||'';if(initialPid&&!projects.some(function(p){return p.id===initialPid;})){var missing=el('option',null,draft.project||'原关联项目');missing.value=initialPid;projSel.appendChild(missing);}projSel.value=initialPid;
  projSel.addEventListener('change',function(){dirty=true;});
  metaCard.appendChild(field('关联项目',projSel));
  var repSel=el('select','mtd-input');repSel.setAttribute('aria-label','重复');
  [['none','无'],['daily','每天'],['weekdays','工作日'],['weekly','每周'],['monthly','每月'],['yearly','每年']].forEach(function(p){var o=el('option',null,p[1]);o.value=p[0];repSel.appendChild(o);});
  repSel.value=draft.repeat||'none';
  repSel.addEventListener('change',function(){dirty=true;});
  metaCard.appendChild(field('重复',repSel));
  var noteIn=el('textarea','mtd-input mtd-note');noteIn.value=draft.note||'';noteIn.setAttribute('aria-label','备注');
  noteIn.addEventListener('input',function(){dirty=true;});
  metaCard.appendChild(field('备注',noteIn));
  var foot=el('div','mtd-foot');
  var created=el('div','mtd-created','创建时间：'+String(draft.createdAt||draft.updatedAt||'').slice(0,10));
  var delBtn=el('button','mtd-del');delBtn.appendChild(window.MobileCompose.icon('trash'));delBtn.type='button';delBtn.setAttribute('aria-label','删除任务');
  delBtn.addEventListener('click',function(){
    if(!confirm('确定删除任务？'))return;
    try{var all=clone(api.readTasks());var t=findTask(all,taskId);if(isDead(t))throw new Error('任务不存在或已归档/删除');t.deletedAt=new Date().toISOString();t.updatedAt=t.deletedAt;api.writeTasks(all);saved=true;close();}catch(e){showError(e);}
  });
  foot.appendChild(created);foot.appendChild(delBtn);
  metaCard.appendChild(foot);
  var saveStatus=el('p','mtd-save-status','已保存');saveStatus.setAttribute('role','status');saveStatus.setAttribute('aria-live','polite');
  var error=el('p','mtd-error');error.setAttribute('role','alert');body.appendChild(error);function showError(e){error.textContent=e.message||'保存失败，请重试';error.scrollIntoView({block:'nearest'});}
  body.appendChild(saveStatus);
  function close(){
    if(closing)return;closing=true;clearTimeout(saveTimer);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',backgroundSave);
    dlg.classList.add('mtd-closing');var delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:160;
    setTimeout(function(){try{dlg.close();}catch(e){}dlg.remove();api.render();},delay);
  }
  function tryClose(){
    try{if(fieldComposing||stepComposing)throw Error('请先完成当前输入');if(dirty||newStep.value.trim())doSave();close();}catch(e){showError(e);}
  }
  function scheduleSave(){
    if(closing)return;dirty=true;if(saveStatus)saveStatus.textContent='正在保存…';clearTimeout(saveTimer);saveTimer=setTimeout(flush,500);
  }
  function flush(){if(closing||!dirty||fieldComposing||stepComposing)return;try{doSave();}catch(e){showError(e);saveStatus.textContent='尚未保存';}}
  function backgroundSave(){if(document.visibilityState==='hidden')flush();}
  dlg.addEventListener('input',scheduleSave);dlg.addEventListener('change',scheduleSave);
  dlg.addEventListener('compositionstart',function(){fieldComposing=true;clearTimeout(saveTimer);});
  dlg.addEventListener('compositionend',function(){fieldComposing=false;scheduleSave();});
  dlg.addEventListener('focusout',function(){if(dirty)scheduleSave();});
  dlg.addEventListener('click',function(e){if(e.target===dlg||e.target===root||e.target===body)tryClose();});
  window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',backgroundSave);
  back.addEventListener('click',tryClose);
  dlg.addEventListener('cancel',function(e){e.preventDefault();tryClose();});
  function readFields(){
    if(stepComposing)throw Error('请先完成步骤输入，再保存');
    if(document.activeElement!==newStep)commitStep();
    if(!titleIn.value.trim())throw new Error('请输入任务标题');draft.title=titleIn.value.trim();
    if(dateIn.value!==(draft.due||'').slice(0,10)){draft.due=dateIn.value||'';delete draft.repeatAnchor;}
    if(projSel.value!==(api.projectId(draft)||'')){draft.projectId=projSel.value||'';var p=projects.find(function(p){return p.id===projSel.value;});draft.project=p?p.name:'';}
    if(repSel.value!==draft.repeat){delete draft.repeatAnchor;draft.repeat=repSel.value;}
    draft.note=noteIn.value;
    if(draft.steps.some(function(s){return !s.title.trim();}))throw new Error('步骤内容不能为空');
  }
  function doSave(toggle){
    if(window.LambertData&&window.LambertData.active!==owner)throw Error('账号已变化，请返回原账号编辑');
    readFields();var all=clone(api.readTasks()),cur=findTask(all,taskId);if(isDead(cur))throw new Error('任务不存在或已归档/删除');
    if(cur.updatedAt!==orig.updatedAt)throw new Error('任务已在其他页面修改，请返回重新打开');
    var merged=Object.assign({},cur,draft,{updatedAt:new Date().toISOString()});
    var out=all.map(function(t){return t.id===taskId?merged:t;}).concat(pendingTasks);
    if(toggle)out=M.toggle(out,taskId,api.today());
    api.writeTasks(out);orig=clone(findTask(out,taskId));draft.updatedAt=orig.updatedAt;pendingTasks=[];saved=true;dirty=false;clearTimeout(saveTimer);error.textContent='';saveStatus.textContent='已保存';
  }
  doneBtn.addEventListener('click',function(){
    try{
      doSave(true);
      saved=true;close();
    }catch(err){showError(err);}
  });
  document.body.appendChild(dlg);
  if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
}
window.MobileTaskDetails={open:open};
})();