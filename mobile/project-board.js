(function(){
  var STATUS=['待开始','进行中','已完成'];
  var projectFilter='进行中',taskFilter='进行中',lastSelected=null;
  function filters(label,value,rows,statusOf,change,choices){var group=el('div','task-scopes project-status-filter');group.setAttribute('role','group');group.setAttribute('aria-label',label);(choices||STATUS).forEach(function(status){var b=btn(value===status?'on':'',status,status, function(){change(status);});b.setAttribute('aria-pressed',String(value===status));var count=el('span','project-filter-count',String(rows.filter(function(r){return statusOf(r.status)===status;}).length));count.setAttribute('aria-hidden','true');b.appendChild(count);group.appendChild(b);});return group;}
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function btn(cls,label,text,fn){var b=el('button',cls,text);b.type='button';if(label)b.setAttribute('aria-label',label);if(fn)b.addEventListener('click',fn);return b;}
  function norm(s){return STATUS.indexOf(s)>=0?s:'进行中';}
  function tstat(s){return STATUS.indexOf(s)>=0?s:'待开始';}
  function stats(rows,today){return window.MobileProjectStats.stats(rows,today);}
  function progress(name,st){
    var w=el('div','project-progress');
    var bar=el('div','project-bar');bar.setAttribute('role','progressbar');
    bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
    bar.setAttribute('aria-valuenow',String(st.percent));bar.setAttribute('aria-label',name+'完成进度');
    var fill=el('div','project-bar-fill');fill.style.width=st.percent+'%';bar.appendChild(fill);
    w.appendChild(bar);return w;
  }
  function render(api){
    var sec=el('section','project-page');
    var projects=(api.projects||[]).filter(function(p){return p&&!p.archived&&!p.deletedAt;}),tasks=(api.tasks||[]).filter(function(t){return t&&!t.archived&&!t.deletedAt;});
    var sel=api.selectedId;
    if(sel!==lastSelected){taskFilter='进行中';lastSelected=sel;}
    var cur=null;
    if(sel!=null){for(var i=0;i<projects.length;i++){if(String(projects[i].id)===String(sel)){cur=projects[i];break;}}}
    if(!cur){overview(sec,api,projects,tasks);}else{detail(sec,api,cur,tasks);}
    return sec;
  }
  function overview(sec,api,projects,tasks){
    var head=el('div','project-head');
    head.appendChild(el('h2','project-title','项目'));
    head.appendChild(btn('project-add','新增项目','新增项目',function(){api.onAddProject&&api.onAddProject();}));
    sec.appendChild(head);
    sec.appendChild(filters('项目状态筛选',projectFilter,projects,norm,function(status){projectFilter=status;api.onSelect(null);},['进行中','待开始']));
    var board=el('div','project-items');board.setAttribute('role','region');board.setAttribute('aria-label','项目列表');
    projects.forEach(function(p){
      if(norm(p.status)!==projectFilter)return;
      var rows=tasks.filter(function(t){return !t.archived&&!t.deletedAt&&api.projectId(t)===p.id;});
      var st=stats(rows,api.today);
      var card=el('section','project-tile');
      var view=btn('project-view','查看项目：'+p.name,p.name,function(){api.onSelect&&api.onSelect(p.id);});
      card.appendChild(view);
      var edit=btn('project-edit','编辑项目：'+p.name,'编辑',function(){api.onEdit&&api.onEdit(p);});
      card.appendChild(edit);
      var meta=el('div','project-meta');
      meta.appendChild(el('span','project-done','已完成 '+st.done+'/'+st.total));
      meta.appendChild(el('span','project-percent',st.percent+'%'));
      card.appendChild(meta);
      card.appendChild(progress(p.name,st));
      var nums=el('div','project-nums');
      nums.appendChild(el('span','project-num','待开始 '+st.todo));
      nums.appendChild(el('span','project-num','进行中 '+st.doing));
      nums.appendChild(el('span','project-num','逾期 '+st.overdue));
      card.appendChild(nums);
      if(st.total===0)card.appendChild(el('div','project-empty','暂无任务'));
      board.appendChild(card);
    });
    if(!board.children.length)board.appendChild(el('p','empty','暂无'+projectFilter+'项目'));
    sec.appendChild(board);
  }
  function detail(sec,api,p,tasks){
    var head=el('div','project-head');
    head.appendChild(btn('project-back','返回项目','‹',function(){api.onSelect&&api.onSelect(null);},['进行中','待开始']));
    head.appendChild(el('h2','project-title',p.name+' 任务'));
    var acts=el('div','project-actions');
    acts.appendChild(btn('project-edit','编辑项目：'+p.name,'编辑',function(){api.onEdit&&api.onEdit(p);}));
    acts.appendChild(btn('project-add-task','新增项目任务','新增',function(){api.onAddTask&&api.onAddTask(p.id);}));
    head.appendChild(acts);
    sec.appendChild(head);
    var rows=tasks.filter(function(t){return !t.archived&&!t.deletedAt&&api.projectId(t)===p.id;});
    var st=stats(rows,api.today);
    var grid=el('div','project-stats');
    [['总任务',st.total],['已完成',st.done],['进行中',st.doing],['逾期',st.overdue]].forEach(function(x){var c=el('div','project-stat');c.appendChild(el('span','project-stat-num',String(x[1])));c.appendChild(el('span','project-stat-label',x[0]));grid.appendChild(c);});
    sec.appendChild(grid);
    var sum=el('div','project-summary');
    sum.appendChild(el('span','project-done','已完成 '+st.done+'/'+st.total));
    sum.appendChild(el('span','project-percent',st.percent+'%'));
    sec.appendChild(sum);
    sec.appendChild(progress(p.name,st));
    sec.appendChild(filters('项目任务状态筛选',taskFilter,rows,tstat,function(status){taskFilter=status;api.onSelect(p.id);}));
    var board=el('div','project-task-items');board.setAttribute('role','region');board.setAttribute('aria-label','项目任务列表');board.setAttribute('data-task-status',taskFilter);
    rows.filter(function(t){return tstat(t.status)===taskFilter;}).forEach(function(t){board.appendChild(api.taskRow(t));});
    if(!board.children.length)board.appendChild(el('p','empty','暂无'+taskFilter+'任务'));
    sec.appendChild(board);
  }
  window.MobileProjectBoard={render:render,reset:function(){projectFilter='进行中';taskFilter='进行中';lastSelected=null;}};
})();