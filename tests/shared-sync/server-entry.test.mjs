import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import handler from '../../api/feishu-review.js';
import {createServerClient} from '../../lib/feishu-review-handler.js';
const require=createRequire(import.meta.url);
test('服务端 SDK 可以由 CommonJS 加载，归档入口未登录返回401',async()=>{const sdk=require('../../lib/vendor/supabase-2.118.0.cjs');assert.equal(typeof sdk.createClient,'function');const r={setHeader(){},status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};await handler({method:'POST',headers:{},body:{}},r);assert.equal(r.statusCode,401);assert.equal(r.body.code,'LOGIN_REQUIRED');});

test("服务端 SDK 通过命名空间导入实际构造客户端",async()=>{const client=createServerClient({url:"https://project.supabase.co",publishableKey:"sb_publishable_test"});const result=await client.auth.getSession();assert.equal(result.data.session,null);client.auth.stopAutoRefresh();});

test("未配置云服务时，携带令牌也返回配置提示而非模块异常",async()=>{const old={...process.env};for(const key of ["LAMBERT_SUPABASE_URL","LAMBERT_SUPABASE_PUBLISHABLE_KEY","LAMBERT_PUBLIC_SITE_URL"])delete process.env[key];try{const r={setHeader(){},status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};await handler({method:"POST",headers:{authorization:"Bearer test-token"},body:{date:"2026-10-20"}},r);assert.equal(r.statusCode,503);assert.equal(r.body.code,"CLOUD_NOT_CONFIGURED");}finally{process.env=old;}});

test('函数编译为 CommonJS 后仍可由动态入口调用',async()=>{
 const {mkdtemp,readFile,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
 const toolsRequire=createRequire(new URL('../../shared-sync/tooling/package.json',import.meta.url));const {build}=toolsRequire('esbuild');const temp=await mkdtemp(join(tmpdir(),'lambert-function-'));
 try{
  await build({entryPoints:[new URL('../../lib/feishu-review-handler.js',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',outfile:join(temp,'compiled.cjs'),logLevel:'silent'});
  const source=(await readFile(new URL('../../api/feishu-review.js',import.meta.url),'utf8')).replace('../lib/feishu-review-handler.js','./compiled.cjs');await writeFile(join(temp,'entry.mjs'),source);
  const {default:compiledHandler}=await import(pathToFileURL(join(temp,'entry.mjs')).href);const r={setHeader(){},status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};await compiledHandler({method:'POST',headers:{},body:{}},r);assert.equal(r.statusCode,401);assert.equal(r.body.code,'LOGIN_REQUIRED');
 }finally{await rm(temp,{recursive:true,force:true});}
});
