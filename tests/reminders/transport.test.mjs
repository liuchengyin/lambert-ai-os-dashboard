import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFeishu} from '../../supabase/functions/feishu-reminders/feishu.mjs';
import {reviewSubmitted} from '../../supabase/functions/feishu-reminders/receipts.mjs';
const user='11111111-1111-4111-8111-111111111111',date='2026-11-03',key=`feishu:review:v1:${user}:${date}:`+'a'.repeat(64);
test('only authoritative done receipt counts; pending/malformed/error is unknown, not a draft decision',async()=>{
 const read=value=>async c=>c[0]==='SCAN'?['0',[key]]:JSON.stringify(value);
 assert.equal(await reviewSubmitted(async()=>['0',[]],user,date),false);
 assert.equal(await reviewSubmitted(read({state:'done',url:'https://fixture.feishu.cn/docx/mock',archivedAt:'2026-11-03T13:00:00Z'}),user,date),true);
 await assert.rejects(reviewSubmitted(read({state:'pending'}),user,date),/unconfirmed/);
 await assert.rejects(reviewSubmitted(read({state:'done',url:'https://evil.example',archivedAt:'2026-11-03'}),user,date));
 await assert.rejects(reviewSubmitted(async()=>['0',['other-user-key']],user,date),/scope/);
 await assert.rejects(reviewSubmitted(async()=>['1',[]],user,date),/incomplete/);
});
test('Feishu uuid passed unchanged, permission rejection vs ambiguous network status; no automatic retry',async()=>{
 const message={receiveId:'ou_fixture',messageUuid:crypto.randomUUID(),title:'模拟测试',text:'仅模拟内容',link:'https://lambert-ai-os-dashboard.vercel.app'};
 for(const mode of ['ok','reject','timeout','bad-json','server']){
  let sends=0;const sender=createFeishu({appId:'fixture',appSecret:'fixture',fetcher:async(url,options)=>{
   if(url.includes('/auth/'))return Response.json({code:0,tenant_access_token:'fixture',expire:7200});
   sends++;const body=JSON.parse(options.body);assert.equal(body.uuid,message.messageUuid);assert.equal(body.receive_id,message.receiveId);
   if(mode==='timeout')throw Error('network');if(mode==='bad-json')return new Response('invalid');if(mode==='server')return Response.json({code:1},{status:500});if(mode==='reject')return Response.json({code:999},{status:403});return Response.json({code:0,data:{message_id:'om_fixture'}});
  }});
  const r=await sender(message);assert.equal(sends,1);assert.equal(r.state,mode==='ok'?'sent':mode==='reject'?'rejected':'unknown');
 }
});
