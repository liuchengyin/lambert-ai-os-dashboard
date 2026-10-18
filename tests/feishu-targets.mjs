import assert from 'node:assert/strict';
import handler from '../api/feishu-targets.js';
import archive from '../api/feishu-daily.js';
import {normalizeConfig,archiveTarget,LEGACY_TOKEN} from '../lib/feishu-targets.js';
const store=new Map(),calls=[];const original=globalThis.fetch,env={...process.env};
Object.assign(process.env,{UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'fake',AI_ACCESS_PASSWORD:'test-password',FEISHU_APP_ID:'fake-id',FEISHU_APP_SECRET:'fake-secret'});
const cfg={locations:[{id:'reading',name:'每日阅读',url:'https://my.feishu.cn/wiki/ReadingToken1234'},{id:'extension',name:'插件笔记',url:'https://my.feishu.cn/wiki/ExtensionToken1234'}],defaults:{reading:'reading',extension:'extension'}};
globalThis.fetch=async(url,opts={})=>{url=String(url);const body=opts.body?JSON.parse(opts.body):{};if(url==='https://redis.test'){const [cmd,key,value]=body;let result=null;if(cmd==='GET')result=store.get(key)||null;if(cmd==='SET'){store.set(key,value);result='OK'}if(cmd==='EVAL')result=1;return Response.json({result})}calls.push({url,method:opts.method||'GET',body});if(url.includes('auth/v3'))return Response.json({code:0,tenant_access_token:'fake'});if(url.includes('get_node'))return Response.json({code:0,data:{node:{space_id:'space',node_token:new URL(url).searchParams.get('token')}}});if(url.endsWith('/blocks/convert'))return Response.json({code:0,data:{blocks:[],first_level_block_ids:[]}});if(url.endsWith('/docx/v1/documents'))return Response.json({code:0,data:{document:{document_id:'new-doc'}}});if(url.includes('move_docs_to_wiki'))return Response.json({code:0,data:{wiki_token:'new-wiki'}});if(url.includes('/children'))return Response.json({code:0,data:{items:[{block_id:'old-block'}]}});return Response.json({code:0,data:{}})};
const req=(method,body)=>({method,body,headers:{origin:'https://workspace.test',host:'workspace.test'}});
async function invoke(fn,request){const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this},json(d){this.body=d;return this}};await fn(request,res);return res}
try{
 assert.throws(()=>normalizeConfig({...cfg,defaults:{reading:'missing',extension:'extension'}}));assert.throws(()=>normalizeConfig({...cfg,locations:[{id:'x',name:'坏网址',url:'https://my.feishu.cn.evil.test/wiki/ReadingToken1234'}]}));assert.throws(()=>normalizeConfig({...cfg,locations:[{id:'x',name:'文件夹',url:'https://my.feishu.cn/drive/folder/ReadingToken1234'}]}));
 let r=await invoke(handler,req('PUT',{...cfg,password:'wrong'}));assert.equal(r.statusCode,401);assert.equal(store.size,0);
 r=await invoke(handler,req('PUT',{...cfg,password:'test-password'}));assert.equal(r.statusCode,200);assert.ok(!JSON.stringify([...store.values()]).includes('test-password'));
 r=await invoke(handler,req('GET'));assert.equal(r.body.config.defaults.extension,'extension');
 assert.equal((await archiveTarget({source:'reading'})).token,'ReadingToken1234');assert.equal((await archiveTarget({source:'extension'})).token,'ExtensionToken1234');await assert.rejects(()=>archiveTarget({source:'reading',locationId:'deleted'}));
 calls.length=0;r=await invoke(archive,req('POST',{source:'reading',markdown:'笔记',documentToken:'old-doc',wikiToken:'old-wiki',previousTargetToken:'ExtensionToken1234'}));assert.equal(r.body.ok,true);assert.equal(r.body.updated,false);assert.equal(r.body.targetToken,'ReadingToken1234');assert.ok(calls.some(c=>c.body.parent_wiki_token==='ReadingToken1234'));assert.ok(!calls.some(c=>c.url.includes('old-doc')),'changed destination must not touch old document');
 calls.length=0;r=await invoke(archive,req('POST',{source:'extension',markdown:'笔记',documentToken:'old-doc',wikiToken:'old-wiki',previousTargetToken:'ExtensionToken1234'}));assert.equal(r.body.updated,true);assert.ok(calls.some(c=>c.url.includes('old-doc')&&c.method==='DELETE'));
 calls.length=0;r=await invoke(archive,req('POST',{targetWikiToken:'Unconfigured1234',markdown:'笔记'}));assert.equal(r.statusCode,400);assert.equal(calls.length,0);
 assert.equal((await archiveTarget({targetWikiToken:LEGACY_TOKEN})).token,LEGACY_TOKEN);
 console.log('PASS: independent destinations, protected configuration, persistence without password, invalid/deleted targets, legacy compatibility, changed target preserves old doc and same-target updates');
}finally{globalThis.fetch=original;process.env=env}
