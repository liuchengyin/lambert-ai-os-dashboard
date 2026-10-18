// Daily Review V6: Goal + Reality stacked, Reflection parallel
(function(){
  const section=document.getElementById('review');
  if(!section)return;
  const STORE='daily_reviews_v2';
  const LEGACY='daily_reviews_v1';
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));

  function dateKey(d=new Date()){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`
  }
  function shiftDate(key,delta){const [y,m,d]=key.split('-').map(Number);const x=new Date(y,m-1,d);x.setDate(x.getDate()+delta);return dateKey(x)}
  function prettyDate(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}

  let reviews=get(STORE,{});
  const legacy=get(LEGACY,{});
  if(!Object.keys(reviews).length&&legacy&&Object.keys(legacy).length){
    Object.entries(legacy).forEach(([k,r])=>{
      reviews[k]={goal:r.goal||'',standard:r.standard||'',deadline:r.deadline||'',deliverable:'',completion:r.completion||'',delivery:'',gap:r.gap||'',reason:'',restart:r.restart||'',archived:!!r.archived,updatedAt:r.updatedAt||''}
    });
    set(STORE,reviews)
  }
  let selected=dateKey();

  section.innerHTML=`
    <div class="review-v6-page">
      <div class="review-v6-head">
        <div class="review-v7-title"><span class="review-v7-kicker">DAILY REVIEW · 10 MIN</span><h2>每日复盘</h2><p>只回答三个问题：想做什么、实际如何、明天怎么改。</p></div>
        <div class="review-v6-datebar"><button id="rv6Prev" title="前一天">←</button><input id="rv6Date" type="date"><button id="rv6Today">今天</button><button id="rv6Next" title="后一天">→</button></div>
      </div>

      <div class="review-v7-steps" aria-label="复盘步骤"><span><b>01</b> 设定目标</span><i>→</i><span><b>02</b> 核对结果</span><i>→</i><span><b>03</b> 提炼改进</span></div>
      <div class="review-v6-workspace">
        <div class="review-v6-planstack">
          <section class="review-v6-card review-v6-goal">
            <div class="review-v6-card-head"><div><span>01</span><h3>今天最重要的结果</h3></div><small>计划 · Plan</small></div>
            <label>目标<textarea id="rv6Goal" placeholder="今天最重要的结果是什么？"></textarea></label>
            <div class="rv-task-picker"><div class="rv-task-picker-head"><strong>关联目标任务</strong><input id="rvTaskSearch" type="search" aria-label="搜索目标任务" placeholder="搜索任务或项目"></div><p>勾选今天要推进的任务，完成度自动跟随任务状态。</p><div id="rvTaskChoices"></div></div>
            <div class="review-v6-grid2">
              <label>完成标准<textarea id="rv6Standard" placeholder="做到什么程度算完成？"></textarea></label>

            </div>
            <label>交付物<textarea id="rv6Deliverable" placeholder="最终要产出什么：文档、方案、结果、文件……"></textarea></label>
          </section>

          <section class="review-v6-card review-v6-reality">
            <div class="review-v6-card-head"><div><span>02</span><h3>实际完成情况</h3></div><small>结果 · Reality</small></div>
            <div class="rv-result-summary"><div><span>目标完成度</span><strong id="rv6CompletionValue">0%</strong><small id="rvTaskCount">尚未选择目标任务</small></div><progress id="rv6Completion" max="100" value="0" aria-label="关联任务完成度"></progress></div>
            <div id="rvTaskResults" class="rv-task-results"></div>
            <label>交付情况<textarea id="rv6Delivery" placeholder="限定时间内，实际交付到了什么程度？交付了什么？"></textarea></label>
            <div class="review-v6-reality-note" id="rv6RealityNote">只记录事实：做成了什么、还差多少。</div>
          </section>
        </div>

        <section class="review-v6-card review-v6-reflection">
          <div class="review-v6-card-head"><div><span>03</span><h3>差距与下次行动</h3></div><small>复盘 · Improve</small></div>
          <div class="review-v6-reflection-grid">
            <label>差距在哪<textarea id="rv6Gap" placeholder="目标与现实之间差在哪里？"></textarea></label>
            <label>关键原因<textarea id="rv6Reason" placeholder="为什么会产生这个差距？"></textarea></label>
            <label class="review-v6-restart">明天只改进哪一步<textarea id="rv6Restart" placeholder="写一个明天能执行的最小动作（5～10 分钟）。"></textarea></label>
          </div>
        </section>
      </div>

      <div class="review-v6-actions-panel">
        <div class="review-v6-actions"><button id="rv6Save" class="task-primary-btn">保存当天</button><button id="rv6Archive">归档当天</button><span id="rv6Status"></span><span class="review-v7-save-hint">填写后自动保存 · 数据保留在当前浏览器</span></div>
      </div>

      <section class="review-v6-history card"><div class="row"><h3>历史记录</h3><span class="meta">点击日期切换查看</span></div><div id="rv6History"></div></section>
    </div>`;

  const $=id=>document.getElementById(id);
  const fields=['rv6Goal','rv6Standard','rv6Deliverable','rv6Delivery','rv6Gap','rv6Reason','rv6Restart'];
  let linked=[];
  function blank(){return {goal:'',standard:'',deadline:'',deliverable:'',completion:'0',delivery:'',gap:'',reason:'',restart:'',archived:false,updatedAt:''}}
  function read(){
    const old=reviews[selected]||blank();
    return {...old,legacyCompletion:old.legacyCompletion??old.completion??'0',taskIds:[...linked],taskSnapshots:linked.map(id=>{const t=taskRows().find(t=>t.id===id)||old.taskSnapshots?.find(t=>t.id===id);return t?{id:t.id,title:t.title,status:t.status}: {id,title:'已删除任务',status:'待开始'};}),goal:$('rv6Goal').value.trim(),standard:$('rv6Standard').value.trim(),deadline:old.deadline||'',deliverable:$('rv6Deliverable').value.trim(),completion:String(taskStats().percent),delivery:$('rv6Delivery').value.trim(),gap:$('rv6Gap').value.trim(),reason:$('rv6Reason').value.trim(),restart:$('rv6Restart').value.trim(),archived:!!old.archived,updatedAt:new Date().toISOString()}
  }
  function hasContent(r){return r&&[r.goal,r.standard,r.deadline,r.deliverable,r.delivery,r.gap,r.reason,r.restart].some(Boolean)||Number(r?.completion)>0||!!r?.taskIds?.length}
  function save(silent=false){reviews[selected]=read();set(STORE,reviews);renderHistory();if(!silent){$('rv6Status').textContent='已保存';setTimeout(()=>$('rv6Status').textContent='',1500)}}
  function load(key){
    selected=key;$('rv6Date').value=key;
    const r=reviews[key]||blank();linked=Array.isArray(r.taskIds)?[...new Set(r.taskIds)]:[];
    $('rv6Goal').value=r.goal||'';$('rv6Standard').value=r.standard||'';$('rv6Deliverable').value=r.deliverable||'';$('rv6Delivery').value=r.delivery||'';$('rv6Gap').value=r.gap||'';$('rv6Reason').value=r.reason||'';$('rv6Restart').value=r.restart||'';
    $('rv6Archive').textContent=r.archived?'已归档':'归档当天';$('rv6Archive').classList.toggle('is-archived',!!r.archived);$('rv6Status').textContent=prettyDate(key);renderTaskLinks();renderHistory()
  }
  function renderHistory(){
    const root=$('rv6History');root.innerHTML='';
    const rows=Object.entries(reviews).filter(([,r])=>hasContent(r)).sort((a,b)=>b[0].localeCompare(a[0]));
    if(!rows.length){root.innerHTML='<div class="meta" style="padding:14px 0">还没有复盘记录</div>';return}
    rows.slice(0,30).forEach(([date,r])=>{
      const b=document.createElement('button');b.className=`review-v6-history-item${date===selected?' active':''}`;
      b.innerHTML=`<span>${esc(date)}</span><strong>${esc(r.goal||'未填写目标')}</strong><em>${esc(Array.isArray(r.taskIds)?taskStats(r.taskIds).percent:r.completion||0)}%</em>${r.archived?'<i>已归档</i>':''}`;
      b.onclick=()=>load(date);root.appendChild(b)
    })
  }

  function taskRows(){return typeof state!=='undefined'&&Array.isArray(state.tasks)?state.tasks:get('tasks',[]);}
  function taskStats(ids=linked){const tasks=taskRows();const done=ids.filter(id=>tasks.find(t=>t.id===id)?.status==='已完成').length;return {done,total:ids.length,percent:ids.length?Math.round(done/ids.length*100):0};}
  function renderTaskLinks(){
    const tasks=taskRows(),q=$('rvTaskSearch').value.trim().toLowerCase();
    const choices=$('rvTaskChoices');choices.replaceChildren();
    const visible=tasks.filter(t=>!q||`${t.title} ${t.project||''}`.toLowerCase().includes(q));
    visible.forEach(task=>{const row=document.createElement('label');row.className='rv-task-choice';const cb=document.createElement('input');cb.type='checkbox';cb.checked=linked.includes(task.id);cb.dataset.rvLink=task.id;cb.setAttribute('aria-label','关联目标：'+task.title);const text=document.createElement('span');text.textContent=task.title;const meta=document.createElement('small');meta.textContent=task.project||'收件箱';row.append(cb,text,meta);cb.onchange=()=>{linked=cb.checked?[...linked,task.id]:linked.filter(id=>id!==task.id);renderTaskLinks();save(true);};choices.append(row);});
    if(!visible.length)choices.textContent=tasks.length?'没有匹配的任务':'先在任务中心创建任务，再回来关联。';
    const stats=taskStats();$('rv6CompletionValue').textContent=stats.percent+'%';$('rv6Completion').value=stats.percent;$('rvTaskCount').textContent=stats.total?`完成 ${stats.done} / ${stats.total} 个目标`:'尚未选择目标任务';
    const results=$('rvTaskResults');results.replaceChildren();
    linked.forEach(id=>{const task=tasks.find(t=>t.id===id),snapshot=reviews[selected]?.taskSnapshots?.find(t=>t.id===id);const row=document.createElement('div');row.className='rv-task-result'+(task?.status==='已完成'?' is-done':'');const cb=document.createElement('input');cb.type='checkbox';cb.checked=task?.status==='已完成';cb.disabled=!task;cb.dataset.rvDone=id;cb.setAttribute('aria-label','完成任务：'+(task?.title||snapshot?.title||'已删除任务'));const label=document.createElement('label');label.append(cb,document.createTextNode(task?.title||snapshot?.title||'已删除任务'));const status=document.createElement('small');status.textContent=task?(task.status==='已完成'?'✓ 已完成':task.status):'任务已删除 · 保留目标';row.append(label,status);
      if(!task){const remove=document.createElement('button');remove.type='button';remove.textContent='移出目标';remove.onclick=()=>{linked=linked.filter(x=>x!==id);renderTaskLinks();save(true);};row.append(remove);}
      cb.onchange=()=>{task.status=cb.checked?'已完成':'待开始';if(typeof persistTasks==='function')persistTasks();else set('tasks',tasks);renderTaskLinks();save(true);};results.append(row);
    });
    $('rv6RealityNote').textContent=stats.total?'完成度 = 已完成关联任务 ÷ 目标任务总数；在任务中心修改状态也会同步。':'先选择目标任务，实际完成后自动计算进度。';
  }
  $('rvTaskSearch').oninput=renderTaskLinks;
  document.addEventListener('tasks-updated',()=>{let changed=false;Object.values(reviews).forEach(r=>{if(Array.isArray(r.taskIds)){const value=String(taskStats(r.taskIds).percent);if(String(r.completion)!==value){r.completion=value;changed=true;}}});if(changed)set(STORE,reviews);renderTaskLinks();renderHistory();});
  $('rv6Save').onclick=()=>save(false);
  $('rv6Archive').onclick=()=>{reviews[selected]=read();reviews[selected].archived=!reviews[selected].archived;set(STORE,reviews);load(selected)};
  $('rv6Prev').onclick=()=>{save(true);load(shiftDate(selected,-1))};
  $('rv6Next').onclick=()=>{save(true);load(shiftDate(selected,1))};
  $('rv6Today').onclick=()=>{save(true);load(dateKey())};
  $('rv6Date').onchange=e=>{save(true);load(e.target.value||dateKey())};
  fields.forEach(id=>$(id)?.addEventListener('change',()=>save(true)));

  window.loadReview=key=>load(key||selected);
  load(selected);
})();