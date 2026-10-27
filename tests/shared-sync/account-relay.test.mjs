import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createCloudFetch} from '../../shared-sync/transport.mjs';
const require=createRequire(import.meta.url),{createRelay}=require('../../lib/account-relay.cjs');
const cfg={configured:true,transport:'relay',url:'https://project.supabase.co',publishableKey:'sb_publishable_example',siteUrl:'https://example.com'};
function res(){return {headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){return this;}};}
const request=(resource,extra={})=>({method:'GET',query:{resource},headers:{origin:cfg.siteUrl,authorization:'Bearer user-A'},...extra});
test('fixed upstream, public key and per-request user tokens survive; no privilege escalation',async()=>{
 const seen=[];const relay=createRelay({env:{},fetcher:async(url,init)=>{seen.push({url,...init});return Response.json([{user:'from-provider'}]);}});
 for(const token of ['user-A','user-B']){const r=res();await relay(request('/rest/v1/lambert_items?select=*',{headers:{origin:cfg.siteUrl,authorization:'Bearer '+token,apikey:'sb_secret_attacker',cookie:'secret'}}),r,cfg);assert.equal(r.statusCode,200);}
 assert.equal(seen[0].url,cfg.url+'/rest/v1/lambert_items?select=*');assert.equal(seen[0].headers.apikey,cfg.publishableKey);assert.equal(seen[0].headers.authorization,'Bearer user-A');assert.equal(seen[1].headers.authorization,'Bearer user-B');assert.equal(seen[0].headers.cookie,undefined);assert.equal(seen[0].redirect,'error');
});
test('reject arbitrary routes, methods, origins, redirect destinations and unauthenticated data',async()=>{
 let calls=0;const relay=createRelay({env:{},fetcher:async()=>{calls++;return Response.json({});}});
 for(const [resource,extra,status] of [
  ['https://evil.test',{},400],['//evil.test',{},400],['/auth/v1/admin/users',{},404],['/rest/v1/other',{},404],
  ['/rest/v1/lambert_items',{method:'DELETE'},405],['/rest/v1/lambert_items',{headers:{}},401],
  ['/auth/v1/token',{method:'POST',headers:{origin:'https://evil.test'}},403],
  ['/auth/v1/recover?redirect_to=https://evil.test',{method:'POST'},400],
 ]){const r=res();await relay(request(resource,extra),r,cfg);assert.equal(r.statusCode,status,resource);}
 assert.equal(calls,0);
});
test('native preflight, disabled rollout, safe provider error and no-cache',async()=>{
 const relay=createRelay({env:{},fetcher:async()=>{throw Error('private-internal-details');}});
 let r=res();await relay(request('/auth/v1/token',{method:'OPTIONS',headers:{origin:'https://appassets.androidplatform.net'}}),r,cfg);assert.equal(r.statusCode,204);assert.equal(r.headers['access-control-allow-origin'],'https://appassets.androidplatform.net');
 r=res();await relay(request('/auth/v1/token',{method:'POST'}),r,{...cfg,transport:undefined});assert.equal(r.statusCode,503);
 r=res();await relay(request('/rest/v1/lambert_items'),r,cfg);assert.equal(r.statusCode,504);assert.equal(r.body.code,'cloud_unreachable');assert.match(r.headers['cache-control'],/no-store/);assert.doesNotMatch(JSON.stringify(r.body),/private-internal/);
});
test('JSON body limit and auth error preservation',async()=>{
 const relay=createRelay({env:{},fetcher:async()=>Response.json({error_code:'invalid_credentials',msg:'Invalid credentials'},{status:400})});
 let r=res();await relay(request('/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:{email:'example',password:'x'}}),r,cfg);assert.equal(r.statusCode,400);assert.equal(r.body.error_code,'invalid_credentials');
 r=res();await relay(request('/auth/v1/signup',{method:'POST',headers:{'content-type':'application/json'},body:{value:'x'.repeat(262145)}}),r,cfg);assert.equal(r.statusCode,413);
});
test('SDK transport preserves original URL identity and sends credentials only to configured relay',async()=>{
 const seen=[];const fetcher=async(url,init)=>{seen.push({url,...init});return Response.json({});};const wrapped=createCloudFetch(cfg,'https://example.com/api/account-config',fetcher);
 await wrapped(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{authorization:'Bearer public','content-type':'application/json'},body:JSON.stringify({email:'a'})});
 assert.equal(new URL(seen[0].url).searchParams.get('resource'),'/auth/v1/token?grant_type=password');assert.equal(seen[0].credentials,'omit');assert.equal(seen[0].headers.get('authorization'),'Bearer public');
 await assert.rejects(wrapped('https://evil.test/auth/v1/token'),/cloud_route_not_allowed/);
 assert.equal(createCloudFetch({...cfg,transport:undefined},'',fetcher),fetcher);
});
