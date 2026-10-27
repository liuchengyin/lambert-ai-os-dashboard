// Persist first; receipts restore only fields changed by this operation.
(function(){'use strict';
const S=window.MobileStore,copy=v=>JSON.parse(JSON.stringify(v)),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const owner=()=>localStorage.getItem('lambert_active_account_v1');
function perform(id,kind){
 const account=owner(),rows=S.read('tasks',[]),before=rows.find(t=>t.id===id);
 if(!before||before.deletedAt||before.archived)throw Error('任务不存在或已归档/删除');
 let out;
 if(kind==='toggle')out=window.MobileTaskModel.toggle(rows,id,S.date());
 else if(kind==='archive'){
  if(before.status!=='已完成')throw Error('仅已完成任务可以归档');
  out=copy(rows);const task=out.find(t=>t.id===id);task.archived=true;task.archivedAt=new Date().toISOString();task.updatedAt=task.archivedAt;
 }else throw Error('不支持的任务操作');
 const after=out.find(t=>t.id===id);after.statusMutationId=crypto.randomUUID();
 const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>k!=='updatedAt'&&!equal(before[k],after[k]));
 const added=out.filter(t=>!rows.some(old=>old.id===t.id));
 if(owner()!==account)throw Error('账户已切换，请刷新');
 S.write('tasks',out);
 return {id,account,kind,title:before.title,keys,before:copy(before),after:copy(after),added:copy(added),expires:Date.now()+5000,used:false};
}
function undo(receipt){
 if(receipt.used||Date.now()>receipt.expires)throw Error('撤销已过期');
 if(owner()!==receipt.account)throw Error('账户已切换，无法撤销');
 const rows=S.read('tasks',[]),current=rows.find(t=>t.id===receipt.id);
 if(!current||current.deletedAt||(!receipt.after.archived&&current.archived)||receipt.keys.some(k=>!equal(current[k],receipt.after[k])))throw Error('任务状态已变化，无法撤销');
 for(const added of receipt.added){if(!equal(rows.find(t=>t.id===added.id),added)||rows.some(t=>t.id!==receipt.id&&t.id!==added.id&&(t.repeatOf===added.id||t.repeatNextId===added.id)))throw Error('后续重复任务已变化，无法撤销');}
 const out=copy(rows).filter(t=>!receipt.added.some(a=>a.id===t.id)),task=out.find(t=>t.id===receipt.id);
 receipt.keys.forEach(k=>{if(Object.hasOwn(receipt.before,k))task[k]=copy(receipt.before[k]);else delete task[k];});task.updatedAt=new Date().toISOString();
 S.write('tasks',out);receipt.used=true;
}
window.MobileTaskActions={perform,undo};
})();
