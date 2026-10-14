// Task board drag V2: stable cross-column and in-column drag without DOM reparenting until drop.
(function(){
  const KEY='task_drag_order_v1';
  let BOARD=document.getElementById('taskBoard');
  if(!BOARD)return;
  let dragged=null,placeholder=null,origin=null,scheduled=false,dropped=false;

  const readOrder=()=>{try{const x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)?x:[]}catch{return []}};
  const writeOrder=ids=>{try{localStorage.setItem(KEY,JSON.stringify(ids))}catch(e){console.warn('Task order not saved',e)}};
  const allCards=()=>[...BOARD.querySelectorAll('.task-v5-body>.task-v5-card')];
  const statusOf=col=>col?.querySelector('.task-v5-col-head h3')?.textContent?.trim()||'';

  function applyOrder(){
    if(dragged)return;
    const order=readOrder();if(!order.length)return;
    const rank=new Map(order.map((id,i)=>[id,i]));
    BOARD.querySelectorAll('.task-v5-body').forEach(body=>{
      const current=[...body.querySelectorAll(':scope>.task-v5-card')];
      const sorted=[...current].sort((a,b)=>(rank.get(a.dataset.taskId)??999999)-(rank.get(b.dataset.taskId)??999999));
      if(current.every((x,i)=>x===sorted[i]))return;
      sorted.forEach((card,i)=>{if(body.children[i]!==card)body.insertBefore(card,body.children[i]||null)});
    });
  }
  function persistOrder(){
    const ids=allCards().map(c=>c.dataset.taskId).filter(Boolean);
    writeOrder([...ids,...readOrder().filter(id=>!ids.includes(id))]);
  }
  function updateCounts(){
    BOARD.querySelectorAll('.task-v5-col').forEach(col=>{
      const body=col.querySelector('.task-v5-body');
      const n=body.querySelectorAll(':scope>.task-v5-card').length;
      const count=col.querySelector('.task-v5-count');if(count)count.textContent=String(n);
      const empty=body.querySelector(':scope>.meta');
      if(n&&empty)empty.remove();
      if(!n&&!empty){const el=document.createElement('div');el.className='meta';el.textContent='暂无任务';body.appendChild(el)}
    });
  }
  function syncStatus(card){
    const id=card.dataset.taskId;
    const status=statusOf(card.closest('.task-v5-col'));
    if(!id||!['待开始','进行中','已完成'].includes(status))return;
    try{
      const task=state.tasks.find(t=>t.id===id);
      if(!task||task.status===status)return;
      task.status=status;
      localStorage.setItem('tasks',JSON.stringify(state.tasks));
      if(typeof renderHome==='function')renderHome();
      if(typeof renderProjectBoard==='function')renderProjectBoard();
      if(typeof renderProjectDashboard==='function')renderProjectDashboard();
    }catch(e){console.warn('Task status sync failed',e)}
  }
  function clearDrag(){
    if(placeholder){placeholder.remove();placeholder=null}
    if(dragged)dragged.classList.remove('is-dragging','is-dragging-ready');
    document.body.classList.remove('task-dragging');
    BOARD.querySelectorAll('.task-v5-col').forEach(col=>col.classList.remove('is-drop-target'));
    dragged=null;origin=null;dropped=false;
    updateCounts();
  }
  function insertionTarget(body,y){
    const cards=[...body.querySelectorAll(':scope>.task-v5-card:not(.is-dragging)')];
    return cards.find(card=>{const r=card.getBoundingClientRect();return y<r.top+r.height/2})||null;
  }
  function ensurePlaceholder(){
    if(placeholder)return placeholder;
    placeholder=document.createElement('div');
    placeholder.className='task-drop-placeholder';
    placeholder.setAttribute('aria-hidden','true');
    placeholder.style.height=Math.max(56,dragged?.getBoundingClientRect().height||72)+'px';
    return placeholder;
  }
  function positionPlaceholder(col,y){
    const body=col.querySelector('.task-v5-body');if(!body)return;
    const empty=body.querySelector(':scope>.meta');if(empty)empty.remove();
    const before=insertionTarget(body,y);
    const ph=ensurePlaceholder();
    if(before){if(ph.parentElement!==body||ph.nextElementSibling!==before)body.insertBefore(ph,before)}
    else if(ph.parentElement!==body||ph.nextElementSibling!==null)body.appendChild(ph);
    BOARD.querySelectorAll('.task-v5-col').forEach(c=>c.classList.toggle('is-drop-target',c===col));
  }
  function finishDrop(col){
    if(!dragged)return;
    const body=col.querySelector('.task-v5-body');if(!body)return;
    if(!placeholder||placeholder.parentElement!==body)positionPlaceholder(col,Number.POSITIVE_INFINITY);
    body.insertBefore(dragged,placeholder||null);
    if(placeholder){placeholder.remove();placeholder=null}
    dropped=true;
    syncStatus(dragged);
    persistOrder();
    updateCounts();
  }
  function bindCard(card){
    if(card.dataset.dragBound==='2')return;
    card.dataset.dragBound='2';card.draggable=true;
    card.setAttribute('aria-label',(card.querySelector('.task-v5-title')?.textContent||'任务')+'，可拖动到其他状态列');
    card.addEventListener('dragstart',e=>{
      if(!e.dataTransfer){e.preventDefault();return}
      dragged=card;origin=card.parentElement;dropped=false;
      e.dataTransfer.effectAllowed='move';
      try{e.dataTransfer.setData('text/plain',card.dataset.taskId||'')}catch{}
      document.body.classList.add('task-dragging');
      requestAnimationFrame(()=>card.classList.add('is-dragging','is-dragging-ready'));
    });
    card.addEventListener('dragend',()=>clearDrag());
  }
  function bindColumn(col){
    if(col.dataset.dropBound==='2')return;
    col.dataset.dropBound='2';
    col.addEventListener('dragenter',e=>{if(dragged){e.preventDefault();col.classList.add('is-drop-target')}});
    col.addEventListener('dragover',e=>{
      if(!dragged)return;
      e.preventDefault();
      if(e.dataTransfer)e.dataTransfer.dropEffect='move';
      positionPlaceholder(col,e.clientY);
    });
    col.addEventListener('drop',e=>{if(!dragged)return;e.preventDefault();e.stopPropagation();finishDrop(col);clearDrag()});
    col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget)&&placeholder?.closest('.task-v5-col')!==col)col.classList.remove('is-drop-target')});
  }
  function bind(){
    if(dragged)return;
    // Dashboard V5 replaces #taskBoard after this script is loaded; always rebind the live board.
    BOARD=document.getElementById('taskBoard');if(!BOARD)return;
    applyOrder();
    BOARD.querySelectorAll('.task-v5-card').forEach(bindCard);
    BOARD.querySelectorAll('.task-v5-col').forEach(bindColumn);
  }
  bind();
  const observer=new MutationObserver(()=>{
    if(dragged||scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;bind()});
  });
  observer.observe(document.getElementById('tasks')||document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-v="tasks"]'))setTimeout(bind,70)});
})();
