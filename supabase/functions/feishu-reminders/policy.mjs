// Codex implementation. The DeepSeek draft was incomplete and was not adopted.
const slots=new Set(['11:45','19:00','21:30']);
export function chinaSchedule(now){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('invalid_date');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const minute=Number(parts.hour)*60+Number(parts.minute);
 for(const slot of slots){const [h,m]=slot.split(':').map(Number);if(minute>=h*60+m&&minute<h*60+m+2)return {date:`${parts.year}-${parts.month}-${parts.day}`,slot};}
 return null;
}
export function taskSummary(taskIds,records){
 if(!Array.isArray(taskIds)||taskIds.length>500||taskIds.some(id=>typeof id!=='string'||!id.trim()||id.length>200)||!Array.isArray(records))throw Error('invalid_task_data');
 const wanted=new Set(taskIds),seen=new Set(),pending=[];let total=0,done=0;
 for(const row of records){
  if(!row||typeof row.item_id!=='string'||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)||seen.has(row.item_id))throw Error('invalid_task_data');
  seen.add(row.item_id);const task=row.payload;
  if(!wanted.has(row.item_id)||row.deleted_at||task.deletedAt||task.archived||task.status==='已归档')continue;
  total++;
  if(task.status==='已完成')done++;else{
   const raw=typeof task.title==='string'?task.title:typeof task.name==='string'?task.name:row.item_id;
   pending.push({id:row.item_id,title:raw.replace(/[\u0000-\u001f\u007f]+/g,' ').trim().slice(0,180)||row.item_id});
  }
 }
 return {total,done,pending};
}
export function kinds(slot,summary,submitted){
 if(!slots.has(slot)||!summary||!Array.isArray(summary.pending))throw Error('invalid_policy');
 if(slot==='21:30'&&typeof submitted!=='boolean')throw Error('submission_unknown');
 return [...(summary.pending.length?['tasks']:[]),...(slot==='21:30'&&!submitted?['review']:[])];
}
