import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,PUBLIC_SOURCE,SITE} from '../netlify/functions/account-config.mjs';
const request=(method='GET')=>new Request(SITE+'/api/account-config',{method,headers:{Authorization:'Bearer never-forward',Cookie:'never-forward=1'}});
const config={configured:true,url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture',siteUrl:'https://lambert-ai-os-dashboard.vercel.app',unexpected:'must-not-return'};
test('fixed public upstream, explicit projection, Netlify callback and bounded cache',async()=>{
 let calls=0,time=0;
 const handler=createHandler({env:{},clock:()=>time,fetcher:async(url,options)=>{calls++;assert.equal(url,PUBLIC_SOURCE);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.deepEqual(options.headers,{Accept:'application/json'});return Response.json(config);}});
 const results=await Promise.all([handler(request()),handler(request())]);assert.equal(calls,1);
 for(const r of results){assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{configured:true,url:config.url,publishableKey:config.publishableKey,siteUrl:SITE});}
 await handler(request());assert.equal(calls,1);time=300001;await handler(request());assert.equal(calls,2);
});
test('explicit validated public env works without upstream; bad secret/partial/callback fails closed',async()=>{
 const good={LAMBERT_SUPABASE_URL:config.url,LAMBERT_SUPABASE_PUBLISHABLE_KEY:config.publishableKey,LAMBERT_PUBLIC_SITE_URL:SITE};
 for(const env of [good,{...good,LAMBERT_SUPABASE_PUBLISHABLE_KEY:'sb_secret_do_not_publish'},{...good,LAMBERT_PUBLIC_SITE_URL:'https://evil.example'},{LAMBERT_SUPABASE_URL:config.url}]){
  const handler=createHandler({env,fetcher:()=>{throw Error('must_not_fetch');}}),r=await handler(request());const value=await r.json();assert.equal(value.configured,env===good);assert.ok(!JSON.stringify(value).includes('sb_secret'));
 }
});
test('methods do not fetch or write; unsupported and unsafe upstream fails without leaking content',async()=>{
 const handler=createHandler({env:{},fetcher:()=>{throw Error('must_not_fetch');}});
 for(const method of ['POST','PUT','DELETE','OPTIONS','HEAD'])assert.equal((await handler(request(method))).status,405);
 for(const body of [{...config,publishableKey:'sb_secret_hidden'},{...config,url:'http://internal'},{configured:true},'not-json']){
  const h=createHandler({env:{},fetcher:async()=>Response.json(body)}),r=await h(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{configured:false,error:'public_config_unavailable'});
 }
 for(const response of [new Response('upstream-private-error',{status:401}),new Response('x'.repeat(17000)),new Response('not json')]){
  const h=createHandler({env:{},fetcher:async()=>response});assert.equal((await h(request())).status,503);
 }
 assert.deepEqual(await (await createHandler({env:{},fetcher:async()=>Response.json({configured:false})})(request())).json(),{configured:false});
});
