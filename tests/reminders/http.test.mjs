import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHttpHandler} from '../../supabase/functions/feishu-reminders/http.mjs';
test('unauthorized/disabled/malformed requests cannot query DB or send; failures never reflect secrets',async()=>{
 const secret='fixture-only-'+ 'x'.repeat(40);let executed=0;
 const handler=createHttpHandler({env:{REMINDER_CRON_TOKEN:secret},execute:async()=>{executed++;return {ok:true,dryRun:true};}});
 const req=(body,auth=secret)=>new Request('https://fixture.invalid/functions/v1/feishu-reminders',{method:'POST',headers:{Authorization:'Bearer '+auth},body:typeof body==='string'?body:JSON.stringify(body)});
 assert.equal((await handler(new Request('https://fixture.invalid'))).status,405);
 assert.equal((await handler(req({mode:'dry-run'},'wrong'))).status,401);
 for(const mode of ['dispatch','retry','test'])assert.equal((await handler(req({mode}))).status,403);
 for(const body of ['invalid','[]','null','x'.repeat(3000),'{} '.repeat(1000),'{"mode":"unknown"}'])assert.equal((await handler(req(body))).status,400);
 assert.equal(executed,0);assert.equal((await handler(req({mode:'dry-run'}))).status,200);assert.equal(executed,1);
 const failure=createHttpHandler({env:{REMINDER_CRON_TOKEN:secret},execute:()=>{throw Error('PRIVATE_DETAIL');}});
 const r=await failure(req({}));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('PRIVATE_DETAIL'));
});
