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
            <div class="rv-goal-box"><details id="rvGoalDropdown"><summary>今日目标 · 点击选择任务</summary><label>项目筛选<select id="rvTaskProject" aria-label="按项目筛选任务"><option value="">全部项目</option></select></label><input id="rvTaskSearch" type="search" aria-label="搜索目标任务" placeholder="搜索任务或项目"><div id="rvTaskChoices"></div></details><div id="rvTaskSelected" aria-live="polite"></div><label>目标补充<textarea id="rv6Goal" placeholder="可选：补充目标说明"></textarea></label></div>
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
  const rows=taskRows(); linked=[...new Set(linked)];
  const rec=reviews[selected]||(reviews[selected]={});
  const snaps=Array.isArray(rec.taskSnapshots)?rec.taskSnapshots:[];
  const byId=Object.create(null);rows.forEach(t=>byId[t.id]=t);
  const projects=(typeof state!=='undefined'&&state&&state.projects)||[];
  const resolve=t=>{try{return TaskCenterModel.resolveProject(t,projects)||'inbox'}catch(e){return t.projectId||t.project||'inbox'}};
  const projName=t=>{const id=resolve(t);return projects.find(p=>String(p.id)===String(id))?.name||(id==='inbox'?'收件箱':t.project||'收件箱')};
  const projId=t=>{const p=resolve(t);if(p&&typeof p==='object')return p.id||p.name||'inbox';return p||'inbox'};
  const isDone=t=>t&&t.status==='已完成';
  const sel=$('rvTaskProject'),search=$('rvTaskSearch');
  const curProj=sel?sel.value:'';const q=search?(search.value||'').trim().toLowerCase():'';
  const allProj=Object.create(null);rows.forEach(t=>{const id=projId(t);allProj[id]=projName(t)});
  if(sel){sel.textContent='';const o0=document.createElement('option');o0.value='';o0.textContent='全部项目';sel.appendChild(o0);Object.keys(allProj).sort().forEach(id=>{const o=document.createElement('option');o.value=id;o.textContent=allProj[id];sel.appendChild(o)});sel.value=curProj&&allProj[curProj]?curProj:'';}
  const activeProj=sel?sel.value:'';
  const match=t=>{if(activeProj&&projId(t)!==activeProj)return false;if(q){const s=((t.title||'')+' '+projName(t)).toLowerCase();if(s.indexOf(q)<0)return false}return true};
  const choices=$('rvTaskChoices');
  if(choices){choices.textContent='';const cand=rows.filter(t=>t.status!=='已完成'&&!t.archived&&match(t));
    if(!cand.length){const e=document.createElement('div');e.className='rv-empty';e.textContent='无可选任务';choices.appendChild(e)}
    const dateOf=t=>String(t.due||t.start||'').slice(0,10);
    cand.sort((a,b)=>{const da=dateOf(a),db=dateOf(b);return (da===selected?0:da?1:2)-(db===selected?0:db?1:2)||da.localeCompare(db)||String(a.title).localeCompare(String(b.title));});
    let lastDate=null;
    cand.forEach(t=>{const day=dateOf(t);if(day!==lastDate){const h=document.createElement('div');h.className='rv-group-title';h.dataset.rvDateGroup=day||'unplanned';h.textContent=day===selected?(selected===dateKey()?'今日':'当日')+' · '+day:day||'未排期';choices.append(h);lastDate=day;}const lab=document.createElement('label');lab.className='rv-choice';const cb=document.createElement('input');cb.type='checkbox';cb.dataset.rvLink=t.id;cb.setAttribute('aria-label','关联目标：'+t.title);cb.checked=linked.indexOf(t.id)>=0;cb.addEventListener('change',()=>{if(cb.checked){if(linked.indexOf(t.id)<0)linked.push(t.id)}else{const i=linked.indexOf(t.id);if(i>=0)linked.splice(i,1)}renderTaskLinks();save(true)});const sp=document.createElement('span');sp.textContent=t.title||'(无标题)';lab.appendChild(cb);lab.appendChild(sp);choices.appendChild(lab)})}
  const box=$('rvTaskSelected');
  if(box){box.textContent='';const list=linked.slice();
    if(!list.length){const e=document.createElement('div');e.className='rv-empty';e.textContent='尚未选择任务';box.appendChild(e)}
    list.forEach(id=>{const t=byId[id];const done=isDone(t);const row=document.createElement('div');row.className='rv-sel'+(done?' rv-sel-done':'');const title=document.createElement('span');title.className='rv-sel-title';title.textContent=t?(t.title||'(无标题)'):(snaps.find(s=>s.id===id)?.title||'(已删除任务)');row.appendChild(title);if(done){const g=document.createElement('span');g.className='rv-check';g.textContent='✓';row.appendChild(g)}const rm=document.createElement('button');rm.type='button';rm.className='rv-remove';rm.textContent='移出';rm.addEventListener('click',()=>{const i=linked.indexOf(id);if(i>=0)linked.splice(i,1);renderTaskLinks();save(true)});row.appendChild(rm);box.appendChild(row)})}
  const res=$('rvTaskResults');
  if(res){res.textContent='';const list=linked.slice();
    if(!list.length){const e=document.createElement('div');e.className='rv-empty';e.textContent='暂无已选任务';res.appendChild(e)}
    const groups={};const today=dateKey();
    list.forEach(id=>{const t=byId[id];const d=t?(t.due||t.start||''):'';const k=d?d.slice(0,10):'__none';if(!groups[k])groups[k]=[];groups[k].push({id,t})});
    const keys=Object.keys(groups).sort((a,b)=>{if(a==='__none')return 1;if(b==='__none')return -1;if(a===selected)return -1;if(b===selected)return 1;return a<b?-1:a>b?1:0});
    keys.forEach(k=>{const g=document.createElement('div');g.className='rv-group';const h=document.createElement('div');h.className='rv-group-title';h.textContent=k==='__none'?'未排期':(k===selected?'今日 / 当日 ('+k+')':k);g.appendChild(h);groups[k].forEach(it=>{const t=it.t;const done=isDone(t);const row=document.createElement('div');row.className='rv-res'+(done?' rv-sel-done':'');const sp=document.createElement('span');sp.className='rv-sel-title';sp.textContent=t?(t.title||'(无标题)'):(snaps.find(s=>s.id===it.id)?.title||'(已删除任务)');row.appendChild(sp);if(done){const c=document.createElement('span');c.className='rv-check';c.textContent='✓';row.appendChild(c)}g.appendChild(row)});res.appendChild(g)})}
  const st=taskStats();const total=linked.length;let done=0;linked.forEach(id=>{if(isDone(byId[id]))done++});const pct=total?Math.round(done/total*100):0;
  const cv=$('rv6CompletionValue');if(cv)cv.textContent=pct+'%';
  const cb2=$('rv6Completion');if(cb2){if('value' in cb2&&cb2.tagName!=='DIV')cb2.value=pct;else cb2.textContent=pct+'%'}
  const tc=$('rvTaskCount');if(tc)tc.textContent=`完成 ${done} / ${total} 个目标`;
  const note=$('rv6RealityNote');if(note)note.textContent='完成度 = 已完成目标任务 ÷ 已选目标任务；任务状态由任务中心管理。';
}
  $('rvTaskSearch').oninput=renderTaskLinks;
  $('rvTaskProject').onchange=renderTaskLinks;
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