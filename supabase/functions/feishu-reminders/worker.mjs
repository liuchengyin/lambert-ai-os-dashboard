import {chinaSchedule,taskSummary,kinds} from './policy.mjs';
export const chinaDate=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function runReminder({body={},env,store,submitted,send,now=new Date(),newId=()=>crypto.randomUUID()}){
 const mode=body.mode||'dry-run',test=mode==='test';
 if(!['dry-run','dispatch','retry','test'].includes(mode))throw Error('invalid_mode');
 if(test?env.REMINDERS_TEST_ENABLED!=='true':mode!=='dry-run'&&env.REMINDERS_ENABLED!=='true')throw Error('reminders_disabled');
 let schedule=chinaSchedule(now);
 if(mode==='dry-run'||mode==='retry'||test){
  const day=chinaDate(now),slot=body.slot||schedule?.slot||'11:45';
  if(!['11:45','19:00','21:30'].includes(slot)||body.date&&body.date!==day)throw Error('invalid_schedule');
  if(mode==='retry'){
   const hm=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
   if(hm<slot)throw Error('future_slot');
  }
  schedule={date:day,slot};
 }
 if(!schedule)throw Error('outside_schedule');
 const bindings=await store.bindings();
 // V1 is one explicitly bound user; no accidental batch delivery.
 if(!Array.isArray(bindings)||bindings.length!==1||!uuid.test(bindings[0].userId)||!/^ou_[A-Za-z0-9_-]{1,125}$/.test(bindings[0].receiveId))throw Error('binding_unavailable');
 const binding=bindings[0];if((test||mode==='retry')&&body.userId!==binding.userId)throw Error('binding_mismatch');
 const {date,slot}=schedule,userId=binding.userId;let summary={total:0,done:0,pending:[]},types;
 try{
  if(test)types=['test'];else{
   const snapshot=await store.snapshot(userId,date);summary=taskSummary(snapshot.taskIds,snapshot.records);
   const proof=slot==='21:30'?await submitted(userId,date):null;types=kinds(slot,summary,proof);
  }
 }catch(error){await store.log(userId,date,slot,error.message==='receipt_unconfirmed'?'receipt_unknown':'query_failed',0,0);return {ok:false,outcome:'cloud_or_receipt_unavailable',sent:0};}
 if(mode==='retry'){if(!['tasks','review','test'].includes(body.kind))throw Error('invalid_kind');types=types.filter(k=>k===body.kind);}
 if(mode==='dry-run'){await store.log(userId,date,slot,'dry_run',summary.total,summary.pending.length);return {ok:true,dryRun:true,date,slot,wouldSend:types,total:summary.total,pending:summary.pending.length};}
 const link=env.REMINDER_WORKSPACE_URL||'https://lambert-ai-os-dashboard.vercel.app';
 if(!['https://lambert-ai-os-dashboard.vercel.app','https://lambert-ai-os-cn-test.netlify.app'].includes(link))throw Error('invalid_workspace_url');
 let sent=0,duplicates=0,uncertain=0,rejected=0;
 for(const kind of types){
  const claimId=newId(),claim=await store.claim(userId,date,slot,kind,newId(),claimId,mode==='retry'||test&&body.retry===true);
  if(!claim){duplicates++;continue;}
  const title=kind==='tasks'?'Lambert OS｜今日任务提醒':kind==='review'?'Lambert OS｜今日复盘提醒':'Lambert OS｜连接测试';
  const list=summary.pending.slice(0,50).map((t,i)=>`${i+1}. ${t.title}`).join('\n');
  const text=kind==='tasks'?`今日任务：共 ${summary.total} 项，已完成 ${summary.done} 项，未完成 ${summary.pending.length} 项。\n\n未完成任务：\n${list}${summary.pending.length>50?'\n其余任务请在工作台查看。':''}`:kind==='review'?'今日复盘尚未提交。\n\n请完成今日成果、存在差距和改进计划的记录。':'飞书私人聊天连接测试。此消息使用模拟内容，不含真实任务或复盘。';
  let outcome;try{outcome=await send({receiveId:binding.receiveId,messageUuid:claim.message_uuid,title,text,link});}catch{outcome={state:'unknown',retryable:false,code:'sender_unexpected',messageId:null};}
  try{await store.finish(userId,date,slot,kind,claimId,outcome);}catch{uncertain++;await store.log(userId,date,slot,'delivery_record_uncertain',summary.total,summary.pending.length);continue;}
  if(outcome.state==='sent')sent++;else if(outcome.state==='unknown')uncertain++;else rejected++;
 }
 await store.log(userId,date,slot,duplicates===types.length&&duplicates?'duplicate':'checked',summary.total,summary.pending.length);
 return {ok:uncertain===0&&rejected===0,date,slot,sent,duplicates,uncertain,rejected};
}
