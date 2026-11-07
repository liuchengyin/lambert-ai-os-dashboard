import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/ai-analyze.mjs';
const site='https://lambert-ai-os-cn-test.netlify.app';
function req(body,options={}){
 return new Request(site+'/api/ai-analyze',{method:'POST',headers:{Origin:options.origin??site,'Content-Type':'application/json',...(options.cookie?{Cookie:options.cookie}:{})},body:typeof body==='string'?body:JSON.stringify(body)});
}
test('Netlify AI refuses non-POST, cross-origin and oversized requests before invoking AI',async()=>{
 let calls=0;
 const run=createHandler({handler:()=>{calls++;throw Error('must not call');}});
 const get=await run(new Request(site+'/api/ai-analyze',{method:'GET'}));
 assert.equal(get.status,405);
 const cross=await run(req({action:'login'}, {origin:'https://evil.example'}));
 assert.equal(cross.status,403);
 const big=await run(req('x'.repeat(25000)));
 assert.equal(big.status,413);
 const malformed=await run(req('{broken'));
 assert.equal(malformed.status,400);
 assert.equal(calls,0);
});
test('Netlify adapter passes same-site login and session cookie to existing handler',async()=>{
 let calls=0;
 const run=createHandler({handler:async(request,res)=>{
  calls++;
  assert.equal(request.method,'POST');
  assert.equal(request.headers.origin,site);
  assert.equal(request.headers['x-forwarded-host'],'lambert-ai-os-cn-test.netlify.app');
  assert.equal(request.headers.cookie,'lambert_ai_session=fixture');
  assert.deepEqual(request.body,{action:'status'});
  res.setHeader('Set-Cookie','lambert_ai_session=fixture; Path=/api/ai-analyze; HttpOnly; Secure; SameSite=Strict');
  return res.status(200).json({ok:true,authenticated:true});
 }});
 const result=await run(req({action:'status'},{cookie:'lambert_ai_session=fixture'}));
 assert.equal(result.status,200);assert.equal((await result.json()).authenticated,true);
 assert.match(result.headers.get('set-cookie'),/HttpOnly/);
 assert.equal(calls,1);
});
