// Smooth Notion-style task card drag & drop: reorder within a column or move across statuses.
(function(){
  const ORDER_KEY='task_drag_order_v1';
  const getOrder=()=>{try{return JSON.parse(localStorage.getItem(ORDER_KEY))||[]}catch{return []}};
  const setOrder=v=>localStorage.setItem(ORDER_KEY,JSON.stringify(v));
  let dragging=null;
  let raf=0;

  function statusOf(col){return col?.querySelector('.task-v5-col-head h3')?.textContent?.trim()||''}

  function applySavedOrder(){
    const order=getOrder();if(!order.length)return;
    const rank=new Map(order.map((id,i)=>[id,i]));
    document.querySelectorAll('.task-v5-body').forEach(body=>{
      const cards=[...body.querySelectorAll('.task-v5-card')];
      cards.sort((a,b)=>(rank.get(a.dataset.taskId)??999999)-(rank.get(b.dataset.taskId)??999999));
      cards.forEach(c=>body.appendChild(c));
    });
  }

  function persistDomOrder(){
    const ids=[...document.querySelectorAll('.task-v5-body .task-v5-card')].map(c=>c.dataset.taskId).filter(Boolean);
    const prior=getOrder().filter(id=>!ids.includes(id));
    setOrder([...ids,...prior]);
  }

  function syncTaskStatus(card){
    const col=card.closest('.task-v5-col');const status=statusOf(col);
    const id=card.dataset.taskId;if(!id||!status)return;
    try{
      const t=state?.tasks?.find(x=>x.id===id);if(!t)return;
      if(t.status!==status)t.status=status;
      localStorage.setItem('tasks',JSON.stringify(state.tasks));
      if(typeof renderHome==='function')renderHome();
      if(typeof renderProjectBoard==='function')renderProjectBoard();
      if(typeof renderProjectDashboard==='function')renderProjectDashboard();
    }catch{}
  }

  function updateCounts(){
    document.querySelectorAll('.task-v5-col').forEach(col=>{
      const n=col.querySelectorAll('.task-v5-body .task-v5-card').length;
      const count=col.querySelector('.task-v5-count');if(count)count.textContent=String(n);
      const empty=col.querySelector('.task-v5-body>.meta');if(empty&&n)empty.remove();
      if(!n&&!col.querySelector('.task-v5-body>.meta')){
        const e=document.createElement('div');e.className='meta';e.style.padding='12px 0';e.textContent='暂无任务';col.querySelector('.task-v5-body')?.appendChild(e)
      }
    })
  }

  function afterElement(body,y){
    const els=[...body.querySelectorAll('.task-v5-card:not(.is-dragging)')];
    let best={offset:Number.NEGATIVE_INFINITY,el:null};
    for(const el of els){const r=el.getBoundingClientRect();const offset=y-r.top-r.height/2;if(offset<0&&offset>best.offset)best={offset,el}}
    return best.el;
  }

  function bindCard(card){
    if(card.dataset.dragBound==='1')return;card.dataset.dragBound='1';card.draggable=true;
    card.addEventListener('dragstart',e=>{
      dragging=card;card.classList.add('is-dragging');document.body.classList.add('task-dragging');
      e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',card.dataset.taskId||'')}catch{}
      requestAnimationFrame(()=>card.classList.add('is-dragging-ready'));
    });
    card.addEventListener('dragend',()=>{
      card.classList.remove('is-dragging','is-dragging-ready');document.body.classList.remove('task-dragging');
      document.querySelectorAll('.task-v5-col').forEach(x=>x.classList.remove('is-drop-target'));
      if(dragging){syncTaskStatus(dragging);persistDomOrder();updateCounts()}
      dragging=null;
    });
  }

  function bindColumn(col){
    if(col.dataset.dropBound==='1')return;col.dataset.dropBound='1';
    const body=col.querySelector('.task-v5-body');if(!body)return;
    col.addEventListener('dragenter',e=>{if(!dragging)return;e.preventDefault();col.classList.add('is-drop-target')});
    col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('is-drop-target')});
    col.addEventListener('dragover',e=>{
      if(!dragging)return;e.preventDefault();e.dataTransfer.dropEffect='move';
      if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
        const before=afterElement(body,e.clientY);const empty=body.querySelector(':scope>.meta');if(empty)empty.remove();
        if(before)body.insertBefore(dragging,before);else body.appendChild(dragging);
      });
    });
    col.addEventListener('drop',e=>{
      if(!dragging)return;e.preventDefault();col.classList.remove('is-drop-target');
      syncTaskStatus(dragging);persistDomOrder();updateCounts();
    });
  }

  function bind(){
    applySavedOrder();
    document.querySelectorAll('.task-v5-card').forEach(bindCard);
    document.querySelectorAll('.task-v5-col').forEach(bindColumn);
  }

  bind();
  const board=document.getElementById('taskBoard');
  if(board){const obs=new MutationObserver(()=>requestAnimationFrame(bind));obs.observe(board,{childList:true,subtree:true})}
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-v="tasks"]'))setTimeout(bind,60)});
})();