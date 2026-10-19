(function(){
  var STATUS=['待开始','进行中','已完成'];
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
    var board=el('div','project-kanban');board.setAttribute('role','region');board.setAttribute('aria-label','项目看板');
    var cols={};STATUS.forEach(function(s){var c=el('div','project-column');c.setAttribute('data-project-status',s);var h=el('h3','project-col-title');h.appendChild(el('span','project-col-name',s));var cnt=el('span','project-col-count','0');h.appendChild(cnt);c.appendChild(h);var body=el('div','project-col-body');c.appendChild(body);cols[s]={col:c,body:body,cnt:cnt};board.appendChild(c);});
    projects.forEach(function(p){
      if(p.archived)return;
      var rows=tasks.filter(function(t){return !t.archived&&!t.deletedAt&&api.projectId(t)===p.id;});
      var st=stats(rows,api.today);
      var s=norm(p.status);
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
      cols[s].body.appendChild(card);
      cols[s].cnt.textContent=String(parseInt(cols[s].cnt.textContent,10)+1);
    });
    sec.appendChild(el('p','project-board-hint','左右滑动查看各状态'));sec.appendChild(board);
  }
  function detail(sec,api,p,tasks){
    var head=el('div','project-head');
    head.appendChild(btn('project-back','返回项目','返回项目',function(){api.onSelect&&api.onSelect(null);}));
    head.appendChild(el('h2','project-title',p.name+' 任务'));
    var acts=el('div','project-actions');
    acts.appendChild(btn('project-edit','编辑项目：'+p.name,'编辑项目',function(){api.onEdit&&api.onEdit(p);}));
    acts.appendChild(btn('project-add-task','新增项目任务','新增任务',function(){api.onAddTask&&api.onAddTask(p.id);}));
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
    var board=el('div','project-kanban');board.setAttribute('role','region');board.setAttribute('aria-label','项目任务看板');
    var cols={};
    STATUS.forEach(function(s){var c=el('div','project-column');c.setAttribute('data-task-status',s);var h=el('h3','project-col-title');h.appendChild(el('span','project-col-name',s));var cnt=el('span','project-col-count','0');h.appendChild(cnt);c.appendChild(h);var body=el('div','project-col-body');c.appendChild(body);cols[s]={body:body,cnt:cnt};board.appendChild(c);});
    rows.forEach(function(t){var s=tstat(t.status);var r=api.taskRow?api.taskRow(t):null;if(r)cols[s].body.appendChild(r);cols[s].cnt.textContent=String(parseInt(cols[s].cnt.textContent,10)+1);});
    STATUS.forEach(function(s){if(cols[s].body.children.length===0)cols[s].body.appendChild(el('div','project-empty','暂无任务'));});
    sec.appendChild(el('p','project-board-hint','左右滑动查看各状态'));sec.appendChild(board);
  }
  window.MobileProjectBoard={render:render};
})();