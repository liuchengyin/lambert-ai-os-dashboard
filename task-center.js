/* Project-focused task center. One shared task store; no timers or DOM observers. */
(() => {
  'use strict';
  if (window.TaskCenter) return;
  const M = window.TaskCenterModel, root = document.getElementById('tasks');
  if (!M || !root) return;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const presets = ['健康','工作','个人','习惯','金融'];
  const statuses = ['待开始','进行中','已完成'];
  const KEY = 'task_center_preferences_v1';
  const read = (key, fallback) => {try {return (window.LambertData?window.LambertData.read(key,fallback):JSON.parse(localStorage.getItem(key))) ?? fallback;} catch {return fallback;}};
  const initial = read(KEY, {});
  let selected = initial.projectId || 'inbox';
  let view = ['board','gantt','table'].includes(initial.view) ? initial.view : 'board';
  let filters = {q:'',status:'all',priority:'all',label:'all',date:'all',matrix:'all',sort:'priority'};
  let anchor = '', days = 28, editId = null, draggedId = null, creatingStatus = statuses[0];
  let renderCount = 0;
  const expandedMap=new Map(), previousStatuses=new Map();
  let showArchived=false,filtersExpanded=false;
  function refreshFilterDisclosure(){var panel=$('tcFilterPanel');if(!panel)return;var tb=$('tcFilterToolbar');if(!tb){tb=document.createElement('div');tb.className='tc-filter-toolbar';tb.id='tcFilterToolbar';var btn=document.createElement('button');btn.type='button';btn.id='tcFilterToggle';btn.setAttribute('aria-controls','tcFilterPanel');tb.appendChild(btn);panel.parentNode.insertBefore(tb,panel);}var toggle=$('tcFilterToggle');var arch=$('tcArchiveToggle');if(arch&&arch.parentNode!==tb)tb.appendChild(arch);panel.hidden=!filtersExpanded;var n=0;if(filters.q&&filters.q.trim())n++;if(filters.status!=='all')n++;if(filters.priority!=='all')n++;if(filters.label!=='all')n++;if(filters.date!=='all')n++;if(filters.matrix!=='all')n++;if(filters.sort!=='priority')n++;toggle.setAttribute('aria-expanded',filtersExpanded?'true':'false');toggle.textContent='筛选'+(n?' · '+n:'')+(filtersExpanded?' ▲':' ▼');toggle.onclick=function(){filtersExpanded=!filtersExpanded;refreshFilterDisclosure();};}
  function archiveTask(task){task.archived=!task.archived;save();}
  function remember() {try {localStorage.setItem(KEY, JSON.stringify({projectId:selected,view}));} catch {}}
  function today() {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function offsetDay(date,n) {return new Date((M.dayNumber(date)+n)*86400000).toISOString().slice(0,10);}
  function localInput(value, end=false) {return /^\d{4}-\d{2}-\d{2}$/.test(value||'') ? value+(end?'T23:59':'T00:00') : value||'';}
  const priorityCode = task => ({q1:'P0',q2:'P1',q3:'P2',q4:'P3'}[task?.matrix] || 'P1');
  const currentProject = () => state.projects.find(p=>String(p.id)===String(selected));
  const projectRows = () => state.tasks.filter(t=>String(M.resolveProject(t,state.projects))===String(selected));
  const allLabels = () => [...new Set([...presets,...state.tasks.flatMap(t=>Array.isArray(t.labels)?t.labels:[])])];
  function migrate() {
    const result=M.migrate(state.projects,state.tasks);
    if(result.changed){
      try {
        if(!localStorage.getItem('task_center_backup_v1'))localStorage.setItem('task_center_backup_v1',JSON.stringify({projects:state.projects,tasks:state.tasks,at:new Date().toISOString()}));
        set('projects',result.projects);set('tasks',result.tasks);
        state.projects=result.projects;state.tasks=result.tasks;
      } catch {notice('浏览器无法保存升级数据，请先导出或释放存储后重试。');}
    }
    if(selected!=='inbox'&&!currentProject()){selected='inbox';anchor='';remember();}
  }
  function notice(text) {const el=$('tcNotice');if(el)el.textContent=text;}
  function save() {
    try {persistTasks();notice(window.LambertData?.active?'本机已保存 · 云端状态见同步提示':'本机已保存 · 本地模式');return true;}
    catch (error) {
      // A rejected journal write must not leave unsaved mutations in state:
      // later saves submit the whole array, so one failed task can block others.
      state.tasks=read('tasks',state.tasks);
      render();
      const message=String(error?.message||'');
      const text=message.includes('冲突')?'这条任务有同步冲突，未流转。请打开「我的账户」对照并处理冲突后重试。':
        message.includes('账户')?'账户状态已变化，未保存。请刷新页面后重试。':
        error?.name==='QuotaExceededError'?'本机存储空间不足，未保存。请先导出备份并释放空间后重试。':
        '任务未保存，请稍后重试；原任务已保留。';
      notice(text);
      if($('tcEditor')?.open)$('tcEditorError').textContent=text;
      return false;
    }
  }
  function options(items, value, first='') {return (first?`<option value="">${esc(first)}</option>`:'')+items.map(x=>`<option value="${esc(x.value??x)}" ${String(x.value??x)===String(value)?'selected':''}>${esc(x.label??x)}</option>`).join('');}
  function projectOptions(value) {return options([{value:'inbox',label:'收件箱'},...state.projects.map(p=>({value:p.id,label:p.name}))],value);}
  function labelsHtml(labels) {return (Array.isArray(labels)?labels:[]).map(x=>`<span class="tc-tag tc-tag-${Math.max(0,presets.indexOf(x))}">${esc(x)}</span>`).join('');}
  // Presentation only: preserve stored project start/due values, including any time component.
  function projectDateLabel(value, fallback, includeYear=true) {
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!match)return fallback;
    return (includeYear?Number(match[1])+'年':'')+Number(match[2])+'月'+Number(match[3])+'日';
  }
  function projectDateRange(p) {
    const start=String(p.start||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    const due=String(p.due||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    const endYear=!start||!due||start[1]!==due[1];
    return projectDateLabel(p.start,'未设开始日期')+' → '+projectDateLabel(p.due,'未设截止日期',endYear);
  }
  function summary() {
    const rows=projectRows(), p=currentProject(), done=rows.filter(t=>t.status==='已完成').length;
    $('tcProjectSelect').innerHTML=projectOptions(selected);
    $('tcProjectTitle').textContent=p?.name||'收件箱';
    $('tcProjectCategory').textContent=p?.category|| (p?'未分类':'零散任务');
    $('tcProjectStandard').textContent=p?.standard|| (p?'尚未填写完成交付标准':'先收集下一步行动，需要时再移入项目。');
    const dates=$('tcProjectDates');
    dates.replaceChildren();
    if(p){
      const range=document.createElement('span');range.className='tc-project-date-range';range.textContent=projectDateRange(p);
      const status=document.createElement('span');status.className='tc-project-status';status.textContent=p.status;
      dates.append(range,status);
    }else dates.textContent='这里的任务暂未归属项目';
    $('tcProgressLabel').textContent=`任务完成 ${done}/${rows.length} · 进行中 ${rows.filter(t=>t.status==='进行中').length}`;
    $('tcProgress').value=rows.length?done/rows.length:0;
    const category=$('tcProjectCategory');category.className='tc-category tc-tag-'+Math.max(0,presets.indexOf(p?.category));
  }
  function visibleRows() {
    const q=filters.q.toLowerCase().trim(), current=today();
    const ranks=new Map(read('task_drag_order_v1',[]).map((id,index)=>[id,index]));
    return projectRows().filter(t=>{
      if(!!t.archived!==showArchived)return false;
      if(q&&![t.title,t.note,...(Array.isArray(t.labels)?t.labels:[])].join(' ').toLowerCase().includes(q))return false;
      if(!showArchived&&filters.status!=='all'&&t.status!==filters.status)return false;
      if(filters.priority!=='all'&&priorityCode(t)!==filters.priority)return false;
      if(filters.matrix!=='all'&&t.matrix!==filters.matrix)return false;
      if(filters.label!=='all'&&!(Array.isArray(t.labels)&&t.labels.includes(filters.label)))return false;
      const due=M.day(t.due);
      if(filters.date==='today'&&due!==current)return false;
      if(filters.date==='overdue'&&!(due&&t.status!=='已完成'&&new Date(localInput(t.due,true)).getTime()<Date.now()))return false;
      if(filters.date==='nodate'&&M.range(t))return false;
      return true;
    }).sort((a,b)=>filters.sort==='manual'?(ranks.get(a.id)??999999)-(ranks.get(b.id)??999999):filters.sort==='due'?(a.due||'9999').localeCompare(b.due||'9999'):filters.sort==='created'?String(b.createdAt||'').localeCompare(String(a.createdAt||'')):(Number(priorityCode(a).slice(1))-Number(priorityCode(b).slice(1)))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  }
  function taskDates(task) {return task.start||task.due?`${task.start?.replace('T',' ')||'待定'} → ${task.due?.replace('T',' ')||'待定'}`:'待排期';}
function compactTaskDates(task){function p(s){if(!s||typeof s!=='string')return null;var m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/);if(!m)return null;var mo=+m[2],d=+m[3];var y=+m[1],max=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][mo-1];if(y<1||mo<1||mo>12||d<1||d>max||(m[4]!=null&&(+m[4]>23||+m[5]>59)))return null;var r=mo+'月'+d+'日';if(m[4]!=null&&m[5]!=null)r+=' '+m[4]+':'+m[5];return r;}var a=p(task&&task.start),b=p(task&&task.due);if(!task||(!task.start&&!task.due))return '待排期';if(!a)a='待定';if(!b)b='待定';return a+'—'+b;}
function taskExpanded(t){return expandedMap.has(t.id)?expandedMap.get(t.id):t.status!=='已完成';}
function card(task){
  const el=document.createElement('article');
  el.className='tc-task'+(task.status==='已完成'?' tc-task-done':'');
  el.dataset.tcTask=task.id;
  el.draggable=true;
  const detail=document.createElement('details');
  detail.className='completed-item';
  detail.open=taskExpanded(task);
  const summary=document.createElement('summary');summary.onclick=e=>e.preventDefault();
  const fold=document.createElement('button');
  fold.type='button';
  fold.className='tc-fold';
  fold.setAttribute('aria-label','折叠/展开任务 '+task.title);
  fold.setAttribute('aria-expanded',String(detail.open));
  fold.innerHTML='<span aria-hidden="true">▸</span>';
  const title=document.createElement('button');
  title.type='button';
  title.className='tc-task-title';
  title.textContent=task.title;title.title=task.title;
  title.onclick=e=>{e.preventDefault();e.stopPropagation();editTask(task.id);};
  fold.onclick=e=>{e.preventDefault();e.stopPropagation();const next=!detail.open;detail.open=next;expandedMap.set(task.id,next);fold.setAttribute('aria-expanded',String(next));};
  summary.append(title,fold);
  if(task.status==='已完成'){const check=document.createElement('span');check.className='tc-done-check';check.setAttribute('aria-hidden','true');check.textContent='✓';summary.prepend(check);}
  const body=document.createElement('div');
  body.className='tc-task-body';
  const prio=document.createElement('span');
  prio.className='tc-priority tc-priority-'+(priorityCode(task)||'P2');
  prio.textContent=priorityCode(task)||'P2';
  const badges=document.createElement('div');badges.className='tc-card-badges';
  const labels=Array.isArray(task.labels)?task.labels:[];
  const labelGroup=document.createElement('span');labelGroup.className='tc-card-labels';labelGroup.innerHTML=labelsHtml(labels.slice(0,2));labelGroup.title=labels.join('、');
  if(labels.length>2){const more=document.createElement('span');more.className='tc-tag tc-label-more';more.textContent='+'+(labels.length-2);labelGroup.append(more)}
  if(labels.length)badges.append(labelGroup);badges.append(prio);summary.insertBefore(badges,fold);
  if(task.note){const note=document.createElement('p');note.className='tc-task-note';note.textContent=task.note;note.title=task.note;body.append(note)}
  const footer=document.createElement('div');footer.className='tc-task-footer';
  const dates=document.createElement('small');dates.className='tc-task-dates';dates.textContent=compactTaskDates(task);dates.title=taskDates(task);footer.append(dates);body.append(footer);
  const actions=document.createElement('div');
  actions.className='tc-task-actions';
  if(task.status!=='已完成'){
    const adv=document.createElement('button');
    adv.type='button';
    adv.className='tc-advance';
    adv.textContent='>';
    adv.setAttribute('aria-label','推进任务 '+task.title);
    adv.onclick=e=>{e.preventDefault();e.stopPropagation();const next=task.status==='待开始'?'进行中':'已完成';task.status=next;if(next==='已完成'){expandedMap.set(task.id,false);}else{expandedMap.set(task.id,true);}save();};
    footer.append(adv);
  }
  if(task.status==='已完成'){
    const reopen=document.createElement('button');
    reopen.type='button';
    reopen.textContent='重新打开';
    reopen.onclick=e=>{e.preventDefault();e.stopPropagation();task.status='进行中';task.archived=false;expandedMap.set(task.id,true);save();};
    actions.append(reopen);
    const archive=document.createElement('button');
    archive.type='button';
    archive.textContent=task.archived?'取消归档':'归档';
    archive.onclick=e=>{e.preventDefault();e.stopPropagation();task.archived=!task.archived;save();};
    actions.append(archive);
  }
  if(actions.childElementCount)body.append(actions);
  detail.append(summary,body);
  el.append(detail);
  detail.ontoggle=()=>{if(!detail.isConnected)return;expandedMap.set(task.id,detail.open);fold.setAttribute('aria-expanded',String(detail.open));};
  el.ondragstart=e=>{if(e.target.closest('button,select,input')){e.preventDefault();return;}draggedId=task.id;e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move';el.classList.add('tc-dragging');};
  el.ondragend=()=>{draggedId=null;el.classList.remove('tc-dragging');};
  return el;
}
function board(rows){
  const board=document.createElement('div');
  board.className='tc-board';
  statuses.forEach(status=>{
    const col=document.createElement('section');
    col.className='tc-column';
    col.dataset.tcStatus=status;
    const items=rows.filter(t=>t.status===status);
    const isDone=status==='已完成';
    col.innerHTML='<header><h3>'+(isDone?'<span class="tc-done-check" aria-hidden="true">✓</span> ':'')+status+'</h3><span>'+items.length+'</span></header>'+(isDone?'<div class="completed-controls"><button type="button" data-tc-expand>全部展开</button><button type="button" data-tc-collapse>全部折叠</button></div>':'')+'<div class="tc-cards"></div><button type="button" class="tc-column-add">＋ 添加任务</button>';
    if(isDone){
      const controls=col.querySelector('.completed-controls');
      controls.querySelector('[data-tc-expand]').onclick=()=>{items.forEach(t=>expandedMap.set(t.id,true));render();};
      controls.querySelector('[data-tc-collapse]').onclick=()=>{items.forEach(t=>expandedMap.set(t.id,false));render();};
    }
    const cards=col.querySelector('.tc-cards');
    items.forEach(t=>cards.append(card(t)));
    if(!items.length)cards.innerHTML='<p class="tc-empty">暂无任务</p>';
    col.querySelector('button.tc-column-add').onclick=()=>newTask(status);
    col.ondragover=e=>{if(draggedId){e.preventDefault();e.dataTransfer.dropEffect='move';}};
    col.ondrop=e=>{
      e.preventDefault();
      const task=projectRows().find(t=>t.id===draggedId);
      if(!task)return;
      const target=e.target.closest('[data-tc-task]')?.dataset.tcTask;
      draggedId=null;
      if(task.status!==status){expandedMap.set(task.id,status!=='已完成');}
      task.status=status;
      if(!save())return;
      const ids=state.tasks.map(t=>t.id),stored=read('task_drag_order_v1',ids),order=[...new Set([...stored,...ids])].filter(id=>id!==task.id);
      const index=target?order.indexOf(target):-1;
      order.splice(index<0?order.length:index,0,task.id);
      try{localStorage.setItem('task_drag_order_v1',JSON.stringify(order));}catch{}
      filters.sort='manual';
      const sortEl=document.getElementById('tcFilterSort');
      if(sortEl)sortEl.value='manual';
      render();
    };
    board.append(col);
  });
  return board;
}
  function validDates(start,due) {
    if(start&&!M.day(start)||due&&!M.day(due))return '日期格式无效，请重新选择';
    if(start&&due&&localInput(start)>localInput(due,true))return '开始时间不能晚于截止时间';
    return '';
  }
  function table(rows) {
    const wrap=document.createElement('div');wrap.className='tc-table-scroll';
    const table=document.createElement('table');table.className='tc-table';
    table.innerHTML='<caption class="tc-sr-only">当前项目任务，可编辑状态与排期</caption><thead><tr><th>任务</th><th>状态</th><th>标签</th><th>开始时间</th><th>截止时间</th><th>优先级</th><th>项目归属</th></tr></thead><tbody></tbody>';
    rows.forEach(task=>{
      const tr=document.createElement('tr');tr.dataset.tcRow=task.id;
      tr.innerHTML=`<td><button type="button" class="tc-table-title">${esc(task.title)}</button></td><td><select data-field="status" aria-label="状态 ${esc(task.title)}">${options(statuses,task.status)}</select></td><td><button type="button" class="tc-label-edit">${labelsHtml(task.labels)||'添加标签'}</button></td><td><input data-field="start" type="datetime-local" aria-label="开始时间 ${esc(task.title)}" value="${esc(localInput(task.start))}"></td><td><input data-field="due" type="datetime-local" aria-label="截止时间 ${esc(task.title)}" value="${esc(localInput(task.due,true))}"></td><td><select data-field="priority" aria-label="优先级 ${esc(task.title)}">${options(['P0','P1','P2','P3'],priorityCode(task))}</select></td><td><select data-field="projectId" aria-label="项目归属 ${esc(task.title)}">${projectOptions(M.resolveProject(task,state.projects))}</select></td>`;
      tr.querySelector('.tc-table-title').onclick=tr.querySelector('.tc-label-edit').onclick=()=>editTask(task.id);
      tr.querySelectorAll('[data-field]').forEach(input=>input.onchange=()=>{
        const field=input.dataset.field, value=input.value;
        const error=validDates(field==='start'?value:task.start,field==='due'?value:task.due);
        if(error){notice(error);input.value=localInput(task[field],field==='due');return;}
        if(field==='projectId')assign(task,value);else if(field==='priority'){task.matrix='q'+(Number(value.slice(1))+1);}else task[field]=value;
        save();
      });table.querySelector('tbody').append(tr);
    });
    if(!rows.length)table.querySelector('tbody').innerHTML='<tr><td colspan="7" class="tc-empty">当前项目没有匹配任务</td></tr>';
    wrap.append(table);return wrap;
  }
  function gantt(rows) {
    const fragment=document.createElement('div');
    if(!anchor){anchor=projectRows().map(t=>M.range(t)?.start).filter(Boolean).sort()[0]||today();}
    const controls=document.createElement('div');controls.className='tc-gantt-controls';
    controls.innerHTML=`<button type="button" data-prev aria-label="前一个时间窗口">←</button><label>窗口起点 <input id="tcGanttFrom" type="date" value="${esc(anchor)}"></label><label>显示 <select id="tcGanttDays">${options([{value:14,label:'14 天'},{value:28,label:'28 天'},{value:56,label:'56 天'}],days)}</select></label><button type="button" data-next aria-label="后一个时间窗口">→</button><button type="button" data-today>回到今天</button>`;
    controls.querySelector('[data-prev]').onclick=()=>{anchor=offsetDay(anchor,-days);render();};
    controls.querySelector('[data-next]').onclick=()=>{anchor=offsetDay(anchor,days);render();};
    controls.querySelector('[data-today]').onclick=()=>{anchor=today();render();};
    controls.querySelector('#tcGanttFrom').onchange=e=>{if(M.day(e.target.value)){anchor=e.target.value;render();}};
    controls.querySelector('#tcGanttDays').onchange=e=>{days=Number(e.target.value);render();};
    fragment.append(controls);
    const dated=rows.filter(t=>M.range(t)), unplanned=rows.filter(t=>!M.range(t));
    const scroll=document.createElement('div');scroll.className='tc-gantt-scroll';
    const chart=document.createElement('div');chart.className='tc-gantt';chart.style.setProperty('--tc-days',String(days));
    const head=document.createElement('div');head.className='tc-gantt-head';head.innerHTML='<strong class="tc-gantt-name">任务 / 日期</strong>';
    const dates=document.createElement('div');dates.className='tc-gantt-dates';
    for(let i=0;i<days;i++){const date=offsetDay(anchor,i),item=document.createElement('span');item.textContent=date.slice(5);if(date===today())item.className='tc-today';dates.append(item);}head.append(dates);chart.append(head);
    const bars=new Map(M.gantt(dated,anchor,days).map(x=>[x.taskId,x]));
    dated.forEach(task=>{
      const row=document.createElement('div');row.className='tc-gantt-row';row.dataset.tcGantt=task.id;
      const label=document.createElement('button');label.type='button';label.className='tc-gantt-name';label.textContent=task.title;label.onclick=()=>editTask(task.id);
      const track=document.createElement('div');track.className='tc-gantt-track';const bar=bars.get(task.id);
      if(bar){const b=document.createElement('button');b.type='button';b.className='tc-gantt-bar '+(task.status==='已完成'?'is-done':task.status==='进行中'?'is-doing':'');b.textContent=task.title;b.style.left=`calc(${bar.offset} * 42px)`;b.style.width=`calc(${bar.length} * 42px - 4px)`;b.title=`${task.title} · ${taskDates(task)}${bar.clippedStart||bar.clippedEnd?' · 已按窗口裁剪':''}`;b.onclick=()=>editTask(task.id);track.append(b);}else track.innerHTML='<small>排期在当前窗口外</small>';
      row.append(label,track);chart.append(row);
    });
    if(!dated.length){const empty=document.createElement('p');empty.className='tc-empty';empty.textContent='尚无完整排期。到表格填写开始和截止时间，即可生成时间条。';chart.append(empty);}
    scroll.append(chart);fragment.append(scroll);
    const pending=document.createElement('section');pending.className='tc-unplanned';pending.innerHTML=`<h3>待排期 · ${unplanned.length}</h3><p>缺少起止日期或日期需要校正的任务保留在这里，不自动编造计划。</p>`;
    unplanned.forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t.title;b.onclick=()=>editTask(t.id);pending.append(b);});fragment.append(pending);return fragment;
  }
  function archiveList(rows) {
    const wrap=document.createElement('div');wrap.className='tc-archive-list';
    const head=document.createElement('div');head.className='tc-archive-head';head.innerHTML=`<h3>归档任务 · ${rows.length}</h3><p>归档任务不参与看板与状态筛选，取消归档后恢复原状态。</p>`;wrap.append(head);
    if(!rows.length){const empty=document.createElement('p');empty.className='tc-empty';empty.textContent='暂无归档任务';wrap.append(empty);return wrap;}
    rows.forEach(task=>{
      const row=document.createElement('div');row.className='tc-archive-row';row.dataset.tcArchive=task.id;
      const title=document.createElement('button');title.type='button';title.className='tc-archive-title';title.textContent=task.title;title.onclick=()=>editTask(task.id);
      const meta=document.createElement('span');meta.className='tc-archive-meta';meta.textContent=`原状态：${task.status} · ${priorityCode(task)}`;
      const actions=document.createElement('div');actions.className='tc-archive-actions';
      const unarchive=document.createElement('button');unarchive.type='button';unarchive.textContent='取消归档';unarchive.onclick=()=>{task.archived=false;save();};
      const reopen=document.createElement('button');reopen.type='button';reopen.textContent='重新打开';reopen.onclick=()=>{task.archived=false;task.status='进行中';save();};
      actions.append(unarchive,reopen);row.append(title,meta,actions);wrap.append(row);
    });
    return wrap;
  }
  function render() {
    renderCount++;migrate();summary();
    state.tasks.forEach(item=>{if(previousStatuses.get(item.id)!==item.status)expandedMap.delete(item.id);previousStatuses.set(item.id,item.status);});
    if(!$('tcArchiveToggle')){const b=document.createElement('button');b.id='tcArchiveToggle';b.type='button';$('tcClear').after(b);b.onclick=()=>{showArchived=!showArchived;render();};}
    refreshFilterDisclosure();
    $('tcArchiveToggle').textContent=showArchived?'返回未归档任务':'查看归档任务';
    $('tcArchiveToggle').setAttribute('aria-pressed',String(showArchived));
    root.querySelectorAll('[data-tc-view]').forEach(b=>{const active=b.dataset.tcView===view;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    const rows=visibleRows();$('tcCount').textContent=`当前显示 ${rows.length} / ${projectRows().length} 项`;
    const newBtn=$('tcNewTask');if(newBtn)newBtn.hidden=showArchived;
    const tablist=root.querySelector('[role="tablist"]');if(tablist)tablist.hidden=showArchived;
    const label=$('tcFilterLabel'),keep=filters.label;label.innerHTML=options([{value:'all',label:'全部标签'},...allLabels()],keep);
    const content=$('tcContent');content.replaceChildren(showArchived?archiveList(rows):view==='board'?board(rows):view==='table'?table(rows):gantt(rows));
    remember();document.dispatchEvent(new Event('tasks-updated'));
    try{document.dispatchEvent(new CustomEvent('lambert:task-context',{detail:window.TaskCenter&&window.TaskCenter.getContext?window.TaskCenter.getContext():null}));}catch{}
  }
  function assign(task,id) {const p=state.projects.find(p=>String(p.id)===String(id));task.projectId=p?.id||'';task.project=p?.name||'';}
  function openProject(id) {selected=state.projects.some(p=>String(p.id)===String(id))?id:'inbox';anchor='';remember();openView('tasks');}
  function openTask(id) {const task=state.tasks.find(t=>t.id===id);if(!task)return;openProject(M.resolveProject(task,state.projects));editTask(id);}
  function labelChecks(selectedLabels=[]) {return [...new Set([...presets,...(Array.isArray(selectedLabels)?selectedLabels:[])])].map(label=>`<label class="tc-check-label"><input type="checkbox" name="tcLabel" value="${esc(label)}" ${(Array.isArray(selectedLabels)&&selectedLabels.includes(label))?'checked':''}>${esc(label)}</label>`).join('');}
  function openEditor(task=null) {
    editId=task?.id||null;$('tcDeleteTask').hidden=!task;
    $('tcEditorTitle').textContent=task?'编辑任务':'新建任务';
    $('tcTitle').value=task?.title||'';$('tcStatus').value=task?.status||creatingStatus;
    $('tcTaskProject').innerHTML=projectOptions(task?M.resolveProject(task,state.projects):selected);
    $('tcPriority').value=task?.priority||'P2';$('tcMatrix').value=task?.matrix||'q2';
    $('tcStart').value=localInput(task?.start);$('tcDue').value=localInput(task?.due,true);$('tcNote').value=task?.note||'';
    $('tcLabels').innerHTML=labelChecks(task?task.labels:[currentProject()?.category].filter(Boolean));$('tcEditorError').textContent='';
    $('tcEditor').showModal();$('tcTitle').focus();
  }
  function editTask(id) {const task=state.tasks.find(t=>t.id===id);if(task)openEditor(task);}
  function newTask(status='待开始') {creatingStatus=statuses.includes(status)?status:statuses[0];openView('tasks');openEditor();}
  function saveEditor(event) {
    event.preventDefault();const title=$('tcTitle').value.trim();if(!title){$('tcEditorError').textContent='请填写任务名称';return;}
    const start=$('tcStart').value,due=$('tcDue').value,error=validDates(start,due);if(error){$('tcEditorError').textContent=error;return;}
    const old=editId?state.tasks.find(t=>t.id===editId):null;if(editId&&!old){$('tcEditorError').textContent='这条任务已不存在，请关闭后重新选择';return;}
    const labels=[...$('tcLabels').querySelectorAll('input:checked')].map(cb=>cb.value);
    const task={...old,id:old?.id||`task_${crypto.randomUUID()}`,title,status:$('tcStatus').value,priority:old?.priority||'P2',matrix:$('tcMatrix').value,start,due,note:$('tcNote').value.trim(),labels,createdAt:old?.createdAt||new Date().toISOString()};
    assign(task,$('tcTaskProject').value);
    if(old)state.tasks[state.tasks.indexOf(old)]=task;else state.tasks.unshift(task);
    if(save())$('tcEditor').close();
  }
  root.innerHTML=`<div class="tc-page-head"><div><p class="tc-eyebrow">PROJECT WORKSPACE</p><h2>任务中心</h2><h3 id="tcProjectTitle" class="tc-current-project-title"></h3></div><button id="tcBackProjects" type="button">← 项目看板</button></div>
    <div class="tc-overview-row"><section class="tc-project-focus"><div class="tc-focus-top"><label>当前项目<span class="tc-project-select-wrap"><select id="tcProjectSelect" aria-label="当前项目"></select></span></label><span id="tcProjectCategory" class="tc-category"></span></div><p id="tcProjectStandard"></p><div id="tcProjectDates" class="tc-meta"></div><div class="tc-progress-row"><progress id="tcProgress" max="1" value="0"></progress><span id="tcProgressLabel"></span></div></section><aside class="project-ai-panel" aria-label="AI 项目分析"></aside></div>
    <div class="tc-viewbar"><div role="tablist" aria-label="任务浏览形式"><button role="tab" type="button" data-tc-view="board" aria-controls="tcContent">▦ 看板</button><button role="tab" type="button" data-tc-view="gantt" aria-controls="tcContent">▤ 甘特图</button><button role="tab" type="button" data-tc-view="table" aria-controls="tcContent">▥ 表格</button></div><button id="tcNewTask" type="button" class="tc-primary">＋ 新建任务</button></div>
    <div class="tc-filters" id="tcFilterPanel" hidden><label class="tc-search">搜索<input id="tcFilterQ" type="search" placeholder="当前项目内搜索"></label><label>状态<select id="tcFilterStatus">${options([{value:'all',label:'全部状态'},...statuses],'all')}</select></label><label>标签<select id="tcFilterLabel"></select></label><label>优先级<select id="tcFilterPriority">${options([{value:'all',label:'全部优先级'},'P0','P1','P2','P3'],'all')}</select></label><label>日期<select id="tv5Date">${options([{value:'all',label:'全部日期'},{value:'today',label:'今天到期'},{value:'overdue',label:'已逾期'},{value:'nodate',label:'待排期'}],'all')}</select></label><label>四象限<select id="tcFilterMatrix">${options([{value:'all',label:'全部象限'},{value:'q1',label:'重要且紧急'},{value:'q2',label:'重要不紧急'},{value:'q3',label:'紧急不重要'},{value:'q4',label:'不重要不紧急'}],'all')}</select></label><label>排序<select id="tcFilterSort">${options([{value:'manual',label:'手动顺序'},{value:'priority',label:'优先级'},{value:'due',label:'截止时间'},{value:'created',label:'最近创建'}],'priority')}</select></label><button id="tcClear" type="button">清空筛选</button></div>
    <div class="tc-statusline"><span id="tcCount"></span><span id="tcNotice" role="status" aria-live="polite"></span></div><div id="tcContent" role="tabpanel"></div>`;
  const dialog=document.createElement('dialog');dialog.id='tcEditor';dialog.className='tc-editor';
  dialog.innerHTML=`<form id="tcEditorForm"><div class="tc-dialog-head"><h3 id="tcEditorTitle"></h3><button id="tcCancel" type="button" aria-label="关闭任务编辑">×</button></div><label>任务名称<input id="tcTitle" autocomplete="off" required></label><div class="tc-editor-grid"><label>所属项目<select id="tcTaskProject"></select></label><label>状态<select id="tcStatus">${options(statuses,'待开始')}</select></label><label>开始时间<input id="tcStart" type="datetime-local"></label><label>截止时间<input id="tcDue" type="datetime-local"></label><label hidden>优先级<select id="tcPriority">${options(['P1','P2','P3'],'P2')}</select></label><label>重要／紧急<select id="tcMatrix">${options([{value:'q1',label:'重要且紧急（P0）'},{value:'q2',label:'重要不紧急（P1）'},{value:'q3',label:'紧急不重要（P2）'},{value:'q4',label:'不重要不紧急（P3）'}],'q2')}</select></label></div><fieldset><legend>标签（可多选）</legend><div id="tcLabels" class="tc-label-checks"></div></fieldset><label>完成标准／备注<textarea id="tcNote" rows="3"></textarea></label><p id="tcEditorError" role="alert"></p><div class="tc-editor-actions"><button id="tcDeleteTask" type="button">删除任务</button><button id="tcCancelBottom" type="button">取消</button><button type="submit" class="tc-primary">保存任务</button></div></form>`;
  document.body.append(dialog);
  $('tcDeleteTask').onclick=()=>{const task=state.tasks.find(t=>t.id===editId);if(task&&confirm('确认删除任务“'+task.title+'”吗？')){state.tasks.splice(state.tasks.indexOf(task),1);if(save())dialog.close();}};
  $('tcEditorForm').onsubmit=saveEditor;$('tcCancel').onclick=$('tcCancelBottom').onclick=()=>dialog.close();
  $('tcBackProjects').onclick=()=>openView('projects');$('tcNewTask').onclick=()=>newTask();
  $('tcProjectSelect').onchange=e=>{selected=e.target.value;anchor='';render();};
  root.querySelectorAll('[data-tc-view]').forEach((b,index,list)=>{b.onclick=()=>{view=b.dataset.tcView;render();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;list[next].click();list[next].focus();}};});
  const bindings={tcFilterQ:'q',tcFilterStatus:'status',tcFilterLabel:'label',tcFilterPriority:'priority',tv5Date:'date',tcFilterMatrix:'matrix',tcFilterSort:'sort'};
  Object.entries(bindings).forEach(([id,key])=>$(id).addEventListener(key==='q'?'input':'change',e=>{filters[key]=e.target.value;render();}));
  $('tcClear').onclick=()=>{filters={q:'',status:'all',priority:'all',label:'all',date:'all',matrix:'all',sort:'priority'};Object.entries(bindings).forEach(([id,key])=>{$(id).value=filters[key];});render();};
  window.TaskCenter={render,openProject,openTask,newTask,editTask,getContext:()=>({projectId:selected,project:currentProject()||null,tasks:projectRows().filter(t=>!t.archived&&t.status!=='已完成')}),getState:()=>({projectId:selected,view,renderCount})};
  render();
})();
