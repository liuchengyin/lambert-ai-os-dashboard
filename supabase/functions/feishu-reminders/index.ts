import postgres from 'npm:postgres@3.4.7';
import {runReminder} from './worker.mjs';
import {reviewSubmitted} from './receipts.mjs';
import {createFeishu} from './feishu.mjs';

import {createHttpHandler} from './http.mjs';
const env=Deno.env.toObject();
Deno.serve(createHttpHandler({env,execute:async(body:Record<string,unknown>)=>{
 let sql:ReturnType<typeof postgres>|undefined;
 try{
  const url=new URL(env.REMINDER_DATABASE_URL||'');
  if(!['postgres:','postgresql:'].includes(url.protocol)||!/^lambert_reminder_worker(?:\.[a-z0-9]+)?$/.test(decodeURIComponent(url.username))||!(url.hostname.endsWith('.pooler.supabase.com')||/^db\.[a-z0-9-]+\.supabase\.co$/.test(url.hostname)))throw Error('database_configuration');
  sql=postgres(url.href,{max:1,prepare:false,ssl:'require',connect_timeout:8,idle_timeout:5,connection:{statement_timeout:10000}});
  const db=sql;
  const store={
   bindings:async()=>(await db`select reminder_private.bindings() as value`)[0].value,
   snapshot:async(u:string,d:string)=>(await db`select reminder_private.snapshot(${u}::uuid,${d}::date) as value`)[0].value,
   claim:async(u:string,d:string,s:string,k:string,m:string,c:string,retry:boolean)=>(await db`select reminder_private.claim(${u}::uuid,${d}::date,${s},${k},${m}::uuid,${c}::uuid,${retry}) as value`)[0].value,
   finish:async(u:string,d:string,s:string,k:string,c:string,r:{state:string,retryable:boolean,code:string,messageId:string|null})=>{await db`select reminder_private.finish(${u}::uuid,${d}::date,${s},${k},${c}::uuid,${r.state},${r.retryable},${r.code},${r.messageId})`;},
   log:async(u:string,d:string,s:string,o:string,n:number,p:number)=>{await db`select reminder_private.log_check(${u}::uuid,${d}::date,${s},${o},${n},${p})`;}
  };
  const redis=async(command:unknown[])=>{
   const url=new URL(env.REMINDER_REDIS_REST_URL||'');if(url.protocol!=='https:'||!url.hostname.endsWith('.upstash.io')||!env.REMINDER_REDIS_READ_ONLY_TOKEN)throw Error('receipt_configuration');
   const response=await fetch(url.href,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+env.REMINDER_REDIS_READ_ONLY_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(5000)});
   const data=await response.json();if(!response.ok||data.error)throw Error('receipt_query_failed');return data.result;
  };
  const result=await runReminder({body,env,store,submitted:(u:string,d:string)=>reviewSubmitted(redis,u,d),send:createFeishu({appId:env.FEISHU_APP_ID,appSecret:env.FEISHU_APP_SECRET})});
  return result;
 }
 finally{if(sql)await sql.end({timeout:2}).catch(()=>{});}
}}));
