import http from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {Store} from './store.mjs';
import {Workspace,allowedName} from './tools.mjs';
import {Engine} from './engine.mjs';
import {availability} from './providers.mjs';
export async function authenticate(req,env,fetcher=fetch){
 const origin=env.LAMBERT_PUBLIC_SITE_URL;
 if(!origin||!/^https:\/\//.test(origin))throw Error('site_not_configured');
 if(req.method!=='GET'&&req.headers.origin!==origin)throw Error('origin');
 const token=req.headers.authorization;if(!/^Bearer [A-Za-z0-9._-]+$/.test(token||''))throw Error('auth_required');
 const url=env.LAMBERT_SUPABASE_URL;if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||''))throw Error('account_not_configured');
 const r=await fetcher(url+'/auth/v1/user',{redirect:'error',headers:{apikey:env.LAMBERT_SUPABASE_PUBLISHABLE_KEY,Authorization:token},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('auth_required');const u=await r.json();
 if(!u.id||!String(env.STUDIO_ALLOWED_USER_IDS||'').split(',').map(x=>x.trim()).includes(u.id))throw Error('studio_access_denied');return u.id;
}
export function createServer(store,engine,{env=process.env,auth=authenticate,policy=[]}={}){
 return http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const reply=(code,obj)=>{res.writeHead(code);res.end(JSON.stringify(obj));};
  try{
   const owner=await auth(req,env);const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'){
    if(url.pathname==='/api/studio/status')return reply(200,{providers:availability(env),disabled:Object.keys(availability(env)).filter(p=>!store.enabled(p)),reservedProviders:['gpt','kimi'],allowedFiles:policy,tests:Object.keys(engine.workspace.tests)});
    if(url.pathname==='/api/studio/tasks')return reply(200,{tasks:store.list(owner)});
    const id=url.pathname.split('/')[4],t=store.get(id);if(!t||t.owner!==owner)return reply(404,{error:'not_found'});
    return reply(200,{task:t,events:store.events(id)});
   }
   if(req.method!=='POST')return reply(405,{error:'method'});
   let data='';for await(const c of req){data+=c;if(Buffer.byteLength(data)>20000)return reply(413,{error:'body_too_large'});}
   const b=JSON.parse(data||'{}');
   if(url.pathname==='/api/studio/tasks'){
    if(store.list(owner).length>=100)return reply(409,{error:'task_limit'});
    if(typeof b.goal!=='string'||b.goal.length<3||b.goal.length>3000||!Array.isArray(b.files)||b.files.length>4||!b.files.length||b.files.some(f=>!allowedName(f)||!policy.includes(f))||[b.constraints,b.acceptance].some(v=>v!==undefined&&(typeof v!=='string'||v.length>3000)))return reply(400,{error:'invalid_task'});
    return reply(201,{task:store.create(owner,b)});
   }
   if(url.pathname==='/api/studio/smoke'){
    if(!['deepseek','glm'].includes(b.provider))return reply(400,{error:'provider'});
    const recent=store.list(owner).filter(t=>t.kind==='smoke'&&t.createdAt.slice(0,10)===new Date().toISOString().slice(0,10));
    if(recent.length>=4)return reply(429,{error:'daily_smoke_limit'});
    const t=store.create(owner,{goal:'固定 OK 连通测试',files:[]});t.kind='smoke';t.provider=b.provider;t.status='queued';t.autoSwitch=[];store.transition(t,'smoke_queued');return reply(202,{task:t});
   }
   const id=url.pathname.split('/')[4],t=store.get(id);if(!t||t.owner!==owner)return reply(404,{error:'not_found'});
   if(b.action==='pause'){t.control='pause';if(t.status!=='running')t.status='paused';}
   else if(b.action==='resume'){if(t.status==='running')return reply(409,{error:'step_in_flight'});if(t.calls>=24&&t.phase!=='publish')return reply(409,{error:'task_call_budget_exhausted'});t.control=null;t.failedProviders=[];t.status='queued';}
   else if(b.action==='switch'){if(!['deepseek','glm'].includes(b.provider))return reply(400,{error:'provider'});if(t.status==='running')return reply(409,{error:'pause_and_wait_first'});t.provider=b.provider;t.control=null;t.status='paused';}
   else if(b.action==='policy'){if(t.status==='running')return reply(409,{error:'pause_and_wait_first'});if(!Array.isArray(b.errors)||b.errors.some(e=>!['rate_limit','quota','timeout','service','connection'].includes(e)))return reply(400,{error:'invalid_policy'});t.autoSwitch=b.errors;}
   else return reply(400,{error:'action'});
   store.transition(t,'user_control',{action:b.action,provider:t.provider});return reply(200,{task:t});
  }catch(e){const code=/^[a-z_]+$/.test(e.message)?e.message:'request_failed';reply(['auth_required','studio_access_denied','origin'].includes(code)?403:400,{error:code});}
 });
}
async function main(){
 const state=process.env.STUDIO_STATE_DIR;if(!state||!path.isAbsolute(state))throw Error('absolute_state_dir_required');await mkdir(state,{recursive:true,mode:0o700});
 // Kernel lock covers the entire service lifetime. Crash releases it; no lease expiry races.
 if(!process.argv.includes('--locked')){const child=spawn('flock',['--nonblock',path.join(state,'service.lock'),process.execPath,...process.execArgv,process.argv[1],'--locked'],{stdio:'inherit',env:process.env});for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));child.on('exit',code=>process.exit(code??1));return;}
 const config=JSON.parse(await readFile(process.env.STUDIO_POLICY_FILE,'utf8'));
 if(!Array.isArray(config.files)||config.files.some(f=>!allowedName(f)))throw Error('invalid_policy');
 const store=new Store(path.join(state,'studio.sqlite'));store.recover();
 const workspace=new Workspace({repo:process.env.STUDIO_REPO_DIR,root:path.join(state,'worktrees'),tests:config.tests||{}});
 const engine=new Engine(store,workspace);const server=createServer(store,engine,{policy:config.files});
 const timer=setInterval(()=>engine.tick().catch(()=>console.error('studio_tick_failed')),1000);
 server.listen(Number(process.env.STUDIO_PORT||3001),'127.0.0.1',()=>console.log('studio_listening'));
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{clearInterval(timer);server.close();const poll=setInterval(()=>{if(!engine.busy){clearInterval(poll);store.close();process.exit(0);}},100);});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('studio_start_failed');process.exitCode=1;});
