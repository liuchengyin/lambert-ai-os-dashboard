const text=value=>typeof value==='string'?value.trim():'';
const inline=value=>text(value).replace(/[\r\n]+/g,' ');
export function reviewMarkdown(date,review,tasks){
 const ids=[...new Set(Array.isArray(review.taskIds)?review.taskIds:[])];
 const byId=new Map(tasks.filter(t=>!t.deletedAt&&!t.archived).map(t=>[t.id,t]));
 const done=ids.filter(id=>byId.get(id)?.status==='已完成').length;
 const lines=['# '+date+'｜每日复盘','','## 今日目标',text(review.goal)||'未填写',''];
 if(ids.length){lines.push('目标进度：'+done+'/'+ids.length+'（'+Math.round(done/ids.length*100)+'%）','');for(const id of ids){const task=byId.get(id);lines.push('- ['+(task?.status==='已完成'?'x':' ')+'] '+(task?inline(task.title||task.name||id):'任务已归档或删除（'+inline(id)+'）'));}lines.push('');}
 for(const [key,label] of [['standard','完成标准'],['deliverable','预期产出'],['delivery','实际结果'],['gap','差距'],['reason','原因'],['restart','下一步']])if(text(review[key]))lines.push('## '+label,text(review[key]),'');
 if(!ids.length&&!['goal','standard','deliverable','delivery','gap','reason','restart'].some(k=>text(review[k])))throw Error('empty_review');
 return lines.join('\n');
}
