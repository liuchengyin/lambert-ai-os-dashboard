// Android-only, opt-in bridge: cloud-synced tasks -> calendar owned events.
// Calendar notifications are controlled by Android; no background polling or claims of real-time sync.
(function(){
  'use strict';
  if(!window.LambertCalendarSync || typeof window.LambertCalendarSync.postMessage!=='function')return;
  const OWNER='lambert_active_account_v1',MAX_DAYS=45,MAX_EVENTS=150;
  const control=document.createElement('button');
  control.type='button';control.id='calendarSyncEntry';control.className='app-version-entry';
  control.textContent='日历同步';control.title='将未来未完成任务同步到 vivo 系统日历';
  const holder=document.querySelector('.mobile-status-row');
  if(holder)holder.appendChild(control);else document.body.appendChild(control);
  let lastSent='',scheduled=null,lastSynced=false;
  const date=()=>window.MobileStore?.date?.()||new Date().toISOString().slice(0,10);
  function snapshot(){
    const owner=localStorage.getItem(OWNER);
    if(!owner||!window.LambertData||window.LambertData.active!==owner)return null;
    const sync=window.LambertData.syncInfo();
    if(sync.pending||sync.conflicts)return null;
    const projects=window.MobileStore.read('projects',[]);
    const inactive=new Set(projects.filter(p=>p.archived||p.deletedAt||p.status==='已完成'||p.status==='已归档').map(p=>String(p.id)));
    const today=date();
    const end=new Date(today+'T12:00:00');
    end.setDate(end.getDate()+MAX_DAYS);
    const endDay=window.MobileStore.date(end);
    const tasks=window.MobileStore.read('tasks',[]);
    if(!Array.isArray(tasks))return null;
    const planned=[],ids=new Set();
    for(const task of tasks){
      if(!task||typeof task.id!=='string'||typeof task.title!=='string')continue;
      if(task.deletedAt||task.archived||task.status==='已完成')continue;
      if(inactive.has(String(task.projectId||'')))continue;
      const due=String(task.due||'').slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||due<today||due>endDay)continue;
      if(ids.has(task.id))return null;
      ids.add(task.id);
      planned.push({id:task.id,title:task.title,date:due});
      // Never send a truncated set; it would delete mapped events missing from this snapshot.
      if(planned.length>MAX_EVENTS)return null;
    }
    return {owner,tasks:planned.sort((a,b)=>a.id.localeCompare(b.id))};
  }
  function send(action,force=false){
    const data=snapshot();if(!data)return false;
    const payload=JSON.stringify({action,...data});
    if(!force&&payload===lastSent)return true;
    try{window.LambertCalendarSync.postMessage(payload);lastSent=payload;return true}
    catch{return false}
  }
  control.onclick=()=>{
    if(!lastSynced){alert('请先在「我的账户」完成云同步，再开启日历同步。');return;}
    const data=snapshot();
    if(!data){alert('任务尚有待同步修改、冲突或数量超过150项，请先完成同步。');return;}
    send('enable',true);
  };
  function requestSync(){
    clearTimeout(scheduled);
    scheduled=setTimeout(()=>{if(lastSynced)send('sync');},450);
  }
  window.addEventListener('lambert-sync-state',event=>{
    const state=event.detail;
    lastSynced=state?.phase==='synced';
    if(lastSynced)requestSync();
  });
  window.addEventListener('mobile-change',requestSync);
  window.addEventListener('lambert-workspace-refresh',requestSync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestSync()});
  // Suppress calendar sync on any sign-out or account transition.
  window.addEventListener('storage',e=>{if(e.key===OWNER){lastSynced=false;lastSent=''}});
})();
