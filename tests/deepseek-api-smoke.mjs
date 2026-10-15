import assert from 'node:assert/strict';
import handler from '../api/ai-analyze.js';

// API smoke tests use fake Redis + fake DeepSeek. No real keys, accounts, or billing.
const previousFetch=globalThis.fetch;
const original={...process.env};
const redis=new Map();
let providerCalls=0;
let modelOverride;
const fakeResponse=(data,status=200)=>({ok:status>=200&&status<300,status,async json(){return data}});
globalThis.fetch=async(url,opts)=>{
  const target=String(url);
  if(target.startsWith('https://redis.test')){
    const command=JSON.parse(opts.body),[cmd,key,extra]=command;
    if(cmd==='SET'){if(redis.has(key))return fakeResponse({result:null});redis.set(key,extra);return fakeResponse({result:'OK'})}
    if(cmd==='EVAL'){
      const actualKey=command[3];
      if(key.includes('INCR')){const n=(redis.get(actualKey)||0)+1;redis.set(actualKey,n);return fakeResponse({result:n})}
      if(redis.get(actualKey)===command[4])redis.delete(actualKey);
      return fakeResponse({result:1});
    }
    if(cmd==='INCR'){const n=(redis.get(key)||0)+1;redis.set(key,n);return fakeResponse({result:n})}
    if(cmd==='EXPIRE')return fakeResponse({result:1});
    throw Error('unexpected redis command');
  }
  if(target==='https://api.deepseek.com/chat/completions'){
    providerCalls++;
    const request=JSON.parse(opts.body);
    assert.equal(request.model,'deepseek-flash','use supported DeepSeek Flash model');
    assert.deepEqual(request.thinking,{type:'disabled'});
    assert.equal(request.response_format.type,'json_object');
    assert.equal(opts.headers.Authorization,'Bearer test-secret');
    const data=JSON.parse(request.messages[1].content);
    assert.equal(data.tasks.length,1);
    assert.equal(data.tasks[0].title,'真实任务');
    assert.equal('note' in data.tasks[0],false,'do not send private task notes');
    return fakeResponse({choices:[{message:{content:JSON.stringify(modelOverride===undefined?{
      summary:'先完成真实任务',focus:[{taskId:'t-1',why:'优先级高',nextAction:'先做5分钟'},{taskId:'fabricated',why:'虚构',nextAction:'不应出现'}],
      alerts:[{taskId:'t-1',severity:'high',reason:'今日截止'}],observations:['今天先聚焦']
    }:modelOverride)}}]});
  }
  throw Error('unexpected fetch target '+target);
};
async function invoke(body,options={}){
  const headers={origin:'https://dashboard.example',host:'dashboard.example','x-forwarded-for':'192.0.2.33',...options.headers};
  const req={method:options.method||'POST',headers,body};
  const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
  await handler(req,res);return res;
}
function check(name,condition){assert.ok(condition,name);console.log('PASS:',name)}
try{
  delete process.env.DEEPSEEK_API_KEY;
  process.env.AI_ENABLED='true';
  let r=await invoke({action:'analyze'});
  check('Missing key fails closed',r.statusCode===503&&r.body.code==='not_configured');
  Object.assign(process.env,{DEEPSEEK_API_KEY:'test-secret',AI_ACCESS_PASSWORD:'correct horse battery staple',AI_SESSION_SECRET:'a'.repeat(48),UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'fake',AI_ENABLED:'true'});
  r=await invoke({action:'analyze'}, {headers:{origin:'https://attacker.example'}});
  check('Cross-origin request blocked',r.statusCode===403);
  r=await invoke({action:'analyze'});
  check('Unauthenticated request blocked',r.statusCode===401&&providerCalls===0);
  r=await invoke({action:'login',password:'incorrect'});
  check('Incorrect password blocked',r.statusCode===401);
  r=await invoke({action:'login',password:'correct horse battery staple'});
  const cookie=r.headers['Set-Cookie']?.split(';')[0];
  check('Correct password creates HttpOnly session',r.statusCode===200&&cookie?.includes('lambert_ai_session=')&&r.headers['Set-Cookie'].includes('HttpOnly'));
  const body={action:'analyze',localDate:'2026-10-15',tasks:[{id:'t-1',title:'真实任务',status:'待开始',priority:'P1',due:'2026-10-15',note:'私密备注不要上传'}],projects:[],top3Ids:['t-1']};
  r=await invoke(body,{headers:{cookie}});
  check('Authenticated task analysis calls provider once',r.statusCode===200&&r.body.ok&&providerCalls===1);
  check('Fabricated task IDs are rejected',r.body.result.focus.length===1&&r.body.result.focus[0].taskId==='t-1');
  check('Provider API key not returned',!JSON.stringify(r.body).includes('test-secret'));
  r=await invoke({...body,tasks:Array(31).fill(body.tasks[0])},{headers:{cookie}});
  check('Oversized task array rejected',r.statusCode===400&&providerCalls===1);
  // Repeated analysis eventually hits server-side per-minute limit.
  await invoke(body,{headers:{cookie}});
  await invoke(body,{headers:{cookie}});
  r=await invoke(body,{headers:{cookie}});
  check('Persistent rate limit blocks excess paid calls',r.statusCode===429&&providerCalls===3);
  for(const invalid of [null,[],{}, {summary:'有摘要但缺少数组'}]){
    redis.clear();modelOverride=invalid;r=await invoke(body,{headers:{cookie}});
    check('Malformed analysis output rejected: '+JSON.stringify(invalid),r.statusCode===502&&r.body.code==='invalid_model_output'&&!redis.has('ai:concurrent'));
  }
  redis.clear();modelOverride={summary:'空提醒已过滤',focus:[],alerts:[null,'bad',{reason:'有效提醒',severity:'high'}],observations:[]};
  r=await invoke(body,{headers:{cookie}});
  check('Null and primitive alerts cannot break analysis',r.statusCode===200&&r.body.result.alerts.length===1&&r.body.result.alerts[0].reason==='有效提醒');
  console.log('DeepSeek API smoke passed.');
}finally{
  globalThis.fetch=previousFetch;
  for(const k of Object.keys(process.env))if(!(k in original))delete process.env[k];
  Object.assign(process.env,original);
}
