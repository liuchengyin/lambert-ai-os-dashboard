import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildRequest,callAssist,reserve,readSource,usageSummary} from '../scripts/codex/model-assist.mjs';
import {createDevServer} from '../scripts/codex/dev-server.mjs';
const temp=()=>mkdtemp(path.join(tmpdir(),'lambert-codex-'));
const ok=(model='deepseek-flash',usage={prompt_tokens:12,completion_tokens:2,total_tokens:14})=>({ok:true,json:async()=>({model,usage,choices:[{finish_reason:'stop',message:{content:'OK'}}]})});
test('固定 Flash 模型和 GLM 思考参数，不接受未知提供方或带源码 smoke',()=>{
 assert.equal(buildRequest('deepseek').body.model,'deepseek-flash');assert.equal(buildRequest('deepseek').body.thinking.type,'disabled');
 assert.equal(buildRequest('glm').body.model,'glm-5.3-flash');assert.equal(buildRequest('glm').body.thinking.type,'enabled');
 assert.throws(()=>buildRequest('pro'),/unsupported_provider/);assert.throws(()=>buildRequest('glm',{task:'smoke',files:[{path:'a.js',content:'x'}]}),/smoke_must_not_include_sources/);
 assert.throws(()=>buildRequest('deepseek',{task:'review',prompt:'x'.repeat(17000)}),/assist_input_too_large/);
});
test('缺少密钥不发网络请求；实际 usage 与请求/返回模型落盘',async()=>{
 const directory=await temp();let calls=0;
 await assert.rejects(callAssist('deepseek',{}, {env:{},directory,fetcher:()=>{calls++;}}),/missing_deepseek_key/);assert.equal(calls,0);
 const result=await callAssist('deepseek',{}, {env:{DEEPSEEK_REVIEW_API_KEY:'fixture-secret'},directory,fetcher:async(url,options)=>{calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.redirect,'error');assert.equal(JSON.parse(options.body).max_tokens,32);return ok();}});
 assert.equal(calls,1);assert.equal(result.requestedModel,result.reportedModel);assert.equal(result.usage.total_tokens,14);
 const report=await readFile(result.report,'utf8');assert.ok(!report.includes('fixture-secret'));assert.ok(!report.includes('messages'));
 const summary=await usageSummary(directory);assert.equal(summary.providers.deepseek.calls,1);assert.equal(summary.providers.deepseek.promptTokens,12);
});
test('GLM 发往独立端点，1024 smoke 输出上限包含思考',async()=>{
 const result=await callAssist('glm',{}, {env:{ZHIPU_API_KEY:'fixture'},directory:await temp(),fetcher:async(url,options)=>{assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');const b=JSON.parse(options.body);assert.equal(b.model,'glm-5.3-flash');assert.deepEqual(b.thinking,{type:'enabled'});assert.equal(b.max_tokens,1024);return ok('glm-5.3-flash');}});assert.equal(result.status,'success');
});
test('型号不符、usage 缺失、HTTP 和超时失败都不重试，不伪造 0 用量',async()=>{
 for(const [code,fetcher] of [
  ['provider_model_mismatch',async()=>ok('deepseek-v4-pro')],
  ['provider_usage_missing',async()=>ok('deepseek-flash',{})],
  ['provider_http_402',async()=>({ok:false,status:402})],
  ['provider_connection_failed',async()=>{throw Error('Authorization fixture-secret');}],
  ['provider_output_incomplete',async()=>({ok:true,json:async()=>({model:'deepseek-flash',usage:{prompt_tokens:12,completion_tokens:32},choices:[{finish_reason:'length',message:{content:'truncated'}}]})})]
 ]){const directory=await temp();let calls=0;await assert.rejects(callAssist('deepseek',{}, {env:{DEEPSEEK_REVIEW_API_KEY:'fixture-secret'},directory,fetcher:async(...args)=>{calls++;return fetcher(...args);}}),new RegExp(code));assert.equal(calls,1);const data=JSON.parse(await readFile(path.join(directory,'ledger.json'),'utf8'));assert.equal(data.records[0].status,'failed');assert.ok(!JSON.stringify(data).includes('fixture-secret'));if(code==='provider_usage_missing')assert.equal(data.records[0].usage,undefined);}
});
test('失败也占调用额度，第五次被阻止，坏账本和并发锁不绕过',async()=>{
 const directory=await temp();for(let i=0;i<4;i++)await reserve('deepseek',100,{directory});await assert.rejects(reserve('deepseek',100,{directory}),/daily_assist_limit/);
 const other=await temp();await assert.rejects(reserve('glm',64001,{directory:other}),/daily_assist_limit/);
 await writeFile(path.join(other,'ledger.json'),'bad');await assert.rejects(reserve('glm',100,{directory:other}),/usage_ledger_invalid/);
 const locked=await temp();await writeFile(path.join(locked,'ledger.lock'),'');await assert.rejects(reserve('deepseek',100,{directory:locked}),/usage_ledger_locked/);
});
test('开发建议只写本地报告，不修改源码',async()=>{
 const directory=await temp();const result=await callAssist('deepseek',{task:'draft',prompt:'Suggest one small change',files:[{path:'sample.js',content:'const a=1;'}]},{env:{DEEPSEEK_REVIEW_API_KEY:'fixture'},directory,fetcher:async()=>({ok:true,json:async()=>({model:'deepseek-flash',usage:{prompt_tokens:20,completion_tokens:10},choices:[{finish_reason:'stop',message:{content:'Suggested edit; not applied.'}}]})})});assert.equal(JSON.parse(await readFile(result.report,'utf8')).output,'Suggested edit; not applied.');
});
test('显式源码限制保护隐藏文件、密钥、外部路径与软链接',async()=>{
 const root=await temp();await writeFile(path.join(root,'safe.js'),'const a=1;');await writeFile(path.join(root,'.env'),'fixture');await writeFile(path.join(root,'credentials.json'),'{}');
 assert.equal((await readSource('safe.js',root)).content,'const a=1;');await assert.rejects(readSource('.env',root),/source_not_allowed/);await assert.rejects(readSource('credentials.json',root),/source_not_allowed/);await assert.rejects(readSource('/tmp/x',root),/repo_relative/);
 const outside=await temp();await writeFile(path.join(outside,'external.js'),'x');await symlink(path.join(outside,'external.js'),path.join(root,'alias.js'));await assert.rejects(readSource('alias.js',root),/source_not_allowed/);
});
test('预览服务提供静态页面和本地账号状态，拒绝后台写入和敏感文件',async()=>{
 const root=await temp();await writeFile(path.join(root,'index.html'),'<h1>Local</h1>');await mkdir(path.join(root,'mobile'));await writeFile(path.join(root,'mobile','index.html'),'<h1>Mobile</h1>');await writeFile(path.join(root,'a.mjs'),'export const a=1');await writeFile(path.join(root,'.env'),'fixture-secret');await mkdir(path.join(root,'.codex-local'));await writeFile(path.join(root,'.codex-local','secret.json'),'{}');await symlink(path.join(root,'.codex-local','secret.json'),path.join(root,'alias.json'));await writeFile(path.join(root,'sample.mp3'),'0123456789');
 const server=createDevServer({root});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{assert.match(await (await fetch(base+'/')).text(),/Local/);assert.match(await (await fetch(base+'/mobile/')).text(),/Mobile/);assert.match((await fetch(base+'/a.mjs')).headers.get('content-type'),/javascript/);assert.equal((await (await fetch(base+'/api/account-config')).json()).configured,false);assert.equal((await fetch(base+'/api/ai-analyze',{method:'POST'})).status,405);for(const name of ['.env','alias.json','.codex-local/secret.json','scripts/private.js'])assert.equal((await fetch(base+'/'+name)).status,404);const range=await fetch(base+'/sample.mp3',{headers:{Range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(await range.text(),'2345');assert.equal((await fetch(base+'/sample.mp3',{method:'HEAD'})).headers.get('content-length'),'10');}
 finally{await new Promise(resolve=>server.close(resolve));}
});
