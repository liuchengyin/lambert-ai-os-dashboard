import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runReminder} from '../../supabase/functions/feishu-reminders/worker.mjs';
const userId='11111111-1111-4111-8111-111111111111';
const task=status=>({item_id:'a',payload:{title:'模拟任务',status},deleted_at:null});
function fixture(){
 const deliveries=new Map(),sent=[],logs=[];
 const state={records:[task('待开始')],taskIds:['a'],submitted:false,queryError:false,receiptError:false};
 const store={bindings:async()=>[{userId,receiveId:'ou_fixture'}],snapshot:async()=>{if(state.queryError)throw Error('query_failed');return state;},
  claim:async(u,d,s,k,m,c,receive,retry)=>{const key=[u,d,s,k].join('|'),previous=deliveries.get(key);if(previous&&!(retry&&previous.state==='rejected'&&previous.retryable))return null;const row={message_uuid:previous?.message_uuid||m,claim_uuid:c,state:'sending'};deliveries.set(key,row);return row;},
  finish:async(u,d,s,k,c,result)=>{const row=deliveries.get([u,d,s,k].join('|'));assert.equal(row.claim_uuid,c);Object.assign(row,result);},
  log:async(...args)=>logs.push(args)};
 const options={store,env:{REMINDERS_ENABLED:'true',REMINDERS_TEST_ENABLED:'false'},submitted:async()=>{if(state.receiptError)throw Error('receipt_unconfirmed');return state.submitted;},send:async message=>{sent.push(message);return {state:'sent',retryable:false,code:'0',messageId:'om_fixture'};},now:new Date('2026-11-03T03:45:00Z'),body:{mode:'dispatch'}};
 return {state,options,deliveries,sent,logs};
}
test('complete/no targets means no task message; partial uses current cloud data each slot',async()=>{
 const f=fixture();f.state.records=[task('已完成')];assert.equal((await runReminder(f.options)).sent,0);
 f.state.records=[task('待开始')];assert.equal((await runReminder(f.options)).sent,1);
 f.options.now=new Date('2026-11-03T11:00:00Z');assert.equal((await runReminder(f.options)).sent,1);
 assert.equal(f.sent.length,2);assert.match(f.sent[0].text,/共 1 项，已完成 0 项，未完成 1 项/);
 const empty=fixture();empty.state.taskIds=[];assert.equal((await runReminder(empty.options)).sent,0);empty.options.now=new Date('2026-11-03T13:30:00Z');assert.equal((await runReminder(empty.options)).sent,1);
});
test('concurrent same slot/type only claims once; repeat neither sends nor overwrites receipt',async()=>{
 const f=fixture();const r=await Promise.all([runReminder(f.options),runReminder(f.options)]);assert.equal(r.reduce((n,v)=>n+v.sent,0),1);assert.equal(f.sent.length,1);assert.equal((await runReminder(f.options)).sent,0);
});
test('night two independent messages or only applicable kind',async()=>{
 for(const [status,proof,n] of [['已完成',false,1],['待开始',true,1],['待开始',false,2],['已完成',true,0]]){
  const f=fixture();f.options.now=new Date('2026-11-03T13:30:00Z');f.state.records=[task(status)];f.state.submitted=proof;
  assert.equal((await runReminder(f.options)).sent,n);if(n===2)assert.notEqual(f.sent[0].messageUuid,f.sent[1].messageUuid);
 }
});
test('cloud failure/uncertain submission sends nothing and persists sanitized check',async()=>{
 const f=fixture();f.state.queryError=true;assert.equal((await runReminder(f.options)).sent,0);assert.equal(f.sent.length,0);assert.equal(f.logs[0][3],'query_failed');
 f.state.queryError=false;f.state.receiptError=true;f.options.now=new Date('2026-11-03T13:30:00Z');assert.equal((await runReminder(f.options)).sent,0);assert.equal(f.logs.at(-1)[3],'receipt_unknown');
});
test('rejection may explicitly retry with stable uuid; timeout/unknown must never automatically retry',async()=>{
 const f=fixture();let attempts=0;
 f.options.send=async m=>{f.sent.push(m);attempts++;return attempts===1?{state:'rejected',retryable:true,code:'provider_999',messageId:null}:{state:'sent',retryable:false,code:'0',messageId:'om_fixture'};};
 assert.equal((await runReminder(f.options)).rejected,1);assert.equal((await runReminder(f.options)).duplicates,1);
 f.options.body={mode:'retry',userId,slot:'11:45',kind:'tasks'};assert.equal((await runReminder(f.options)).sent,1);assert.equal(f.sent[0].messageUuid,f.sent[1].messageUuid);
 const g=fixture();g.options.send=async()=>({state:'unknown',retryable:false,code:'timeout',messageId:null});assert.equal((await runReminder(g.options)).uncertain,1);
 g.options.body={mode:'retry',userId,slot:'11:45',kind:'tasks'};assert.equal((await runReminder(g.options)).duplicates,1);
});
test('recording failure after send leaves durable sending claim, never resends',async()=>{
 const f=fixture();f.options.store.finish=async()=>{throw Error('db_failed');};assert.equal((await runReminder(f.options)).uncertain,1);assert.equal((await runReminder(f.options)).duplicates,1);assert.equal(f.sent.length,1);
});
test('disabled by default, dry run cannot consume send key, manual test single recipient/no task content',async()=>{
 const f=fixture();f.options.env={};await assert.rejects(runReminder(f.options),/disabled/);
 f.options.body={mode:'dry-run',slot:'21:30'};assert.equal((await runReminder(f.options)).dryRun,true);assert.equal(f.deliveries.size,0);assert.equal(f.sent.length,0);
 f.options.env.REMINDERS_TEST_ENABLED='true';f.options.body={mode:'test',userId};await runReminder(f.options);assert.equal(f.sent.length,1);assert.ok(!f.sent[0].text.includes('模拟任务'));
 const g=fixture();g.options.body={mode:'retry',userId:'other',slot:'11:45',kind:'tasks'};await assert.rejects(runReminder(g.options),/binding_mismatch/);
});
