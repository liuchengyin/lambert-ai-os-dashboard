import assert from 'node:assert/strict';
import handler from '../api/ai-room.js';
Object.assign(process.env,{
  AI_ACCESS_PASSWORD:'test-password',AI_SESSION_SECRET:'0123456789abcdef'.repeat(4),
  UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test',
  QWEN_API_KEY:'test',ZHIPU_API_KEY:'test',DEEPSEEK_API_KEY:'test'
});
const previous=globalThis.fetch;let providers=[],counter=0;
globalThis.fetch=async (url,options)=>{
  if(url.includes('upstash'))return {ok:true,json:async()=>({result:++counter})};
  providers.push(url);
  return {ok:true,json:async()=>({choices:[{message:{content:'评审建议'}}]})};
};
async function call(body,cookie='',origin='https://lambert.example'){
  let code=200,output,headers={};
  const req={method:'POST',headers:{origin,host:'lambert.example','x-forwarded-host':'lambert.example',cookie},body};
  const res={status(v){code=v;return this},setHeader(k,v){headers[k]=v;return this},json(v){output=v;return this}};
  await handler(req,res);return {code,output,headers};
}
try{
  let r=await call({action:'status'});assert.equal(r.code,401);
  r=await call({action:'login',password:'test-password'},'','https://other.example');assert.equal(r.code,403);
  r=await call({action:'login',password:'incorrect'});assert.equal(r.code,401);
  r=await call({action:'login',password:'test-password'});assert.equal(r.code,200);
  const cookie=r.headers['Set-Cookie'].split(';')[0];
  r=await call({action:'status'},cookie);assert.equal(r.output.configured.qwen,true);
  r=await call({action:'speak',provider:'qwen',stage:'initial',topic:'评审任务中心交互',context:[]},cookie);
  assert.equal(r.code,200);assert.equal(r.output.result.speaker,'qwen');
  r=await call({action:'speak',provider:'glm',stage:'review',topic:'评审任务中心交互',context:[{speaker:'qwen',content:'设计建议'}]},cookie);
  assert.equal(r.code,200);
  r=await call({action:'speak',provider:'deepseek',stage:'summary',topic:'评审任务中心交互',context:[]},cookie);
  assert.equal(r.code,400);
  assert.equal(providers.length,2);
  assert.ok(providers[0].includes('dashscope.aliyuncs.com'));
  assert.ok(providers[1].includes('open.bigmodel.cn'));
  console.log('PASS: authentication, session and bounded multi-provider routing');
}finally{globalThis.fetch=previous}
