import assert from 'node:assert/strict';
import {collect,review,MODEL} from '../scripts/deepseek-flash-review.mjs';
const input=collect();let calls=0;
await assert.rejects(review(input,{key:'',fetcher:()=>{calls++;}}),/missing_review_secret/);
assert.equal(calls,0);
const response=await review(input,{key:'fake-review-key',fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');
  const request=JSON.parse(options.body);assert.equal(request.model,'deepseek-flash');assert.equal(request.max_tokens,1800);
  assert.deepEqual(request.thinking,{type:'disabled'});assert.equal(request.messages[1].content.includes('fake-review-key'),false);
  assert.deepEqual(JSON.parse(request.messages[1].content).files.map(x=>x.path),input.files.map(x=>x.path));
  return {ok:true,json:async()=>({model:MODEL,usage:{prompt_tokens:10,completion_tokens:3},choices:[{message:{content:JSON.stringify({summary:'没有足够证据确认问题',findings:[]})}}]})};
}});
assert.equal(calls,1);assert.equal(response.testsExecuted,false);assert.equal(response.commit,input.sha);
calls=0;
await assert.rejects(review(input,{key:'fake-review-key',fetcher:async()=>{calls++;return {ok:false,status:401}}}),/review_provider_http_401/);
assert.equal(calls,1,'provider failure must not retry or fall back to Pro');
await assert.rejects(review(input,{key:'fake-review-key',fetcher:async()=>({ok:true,json:async()=>({model:'deepseek-v4-pro'})})}),/unexpected_provider_model/);
await assert.rejects(review(input,{key:'fake-review-key',fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'x',findings:[{file:'.env',line:1}]})}}]})})}),/review_findings_invalid/);
console.log('PASS: fixed Flash, source allowlist, missing-key guard, one call, no Pro fallback, report validation; all calls mocked.');
