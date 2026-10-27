// Adapted from DeepSeek Flash draft, run 40459998607. GPT reviewed imports and fixtures.
import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {createRelay}=createRequire(import.meta.url)('../../lib/account-relay.cjs');
const cfg={url:'https://proj.supabase.co',siteUrl:'https://site.test',publishableKey:'sb_publishable_test',configured:true,transport:'relay'};
function mkRes(){return{headers:{},statusCode:0,setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;},end(){return this;}};}
test('DeepSeek: A/B bearer stays independent and caller apikey cannot replace public key',async()=>{
 const calls=[];
 const relay=createRelay({env:{},fetcher:async(url,init)=>{calls.push({url,headers:init.headers});return Response.json({});}});
 for(const [tok,api] of [['Bearer test-user-A','CALLER_A'],['Bearer test-user-B','CALLER_B']]){
  const req={method:'GET',headers:{origin:cfg.siteUrl,authorization:tok,apikey:api},query:{resource:'/rest/v1/lambert_items'}};
  const res=mkRes();await relay(req,res,cfg);assert.equal(res.statusCode,200);
 }
 assert.equal(calls.length,2);assert.equal(calls[0].headers.authorization,'Bearer test-user-A');assert.equal(calls[1].headers.authorization,'Bearer test-user-B');
 for(const call of calls)assert.equal(call.headers.apikey,cfg.publishableKey);
});
