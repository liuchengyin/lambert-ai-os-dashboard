import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,lstat,realpath,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const exec=promisify(execFile);
const safeEnv={PATH:process.env.PATH,HOME:'/nonexistent',LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'};
export const digest=s=>createHash('sha256').update(s).digest('hex');
export async function run(cmd,args,cwd,env=safeEnv){try{const r=await exec(cmd,args,{cwd,env,timeout:60000,maxBuffer:256000});return r.stdout.trim();}catch(e){throw Object.assign(Error('command_failed'),{code:'command_failed',exitCode:e.code,diagnostics:String(e.stderr||e.stdout||'').slice(0,12000)});}}
const git=(cwd,args)=>run('git',['-c','core.hooksPath=/dev/null',...args],cwd);
export function allowedName(p){return typeof p==='string'&&p.length<160&&!p.split('/').some(x=>!x||x==='..'||x.startsWith('.'))&&!path.isAbsolute(p)&&/\.(?:m?js|cjs|html|css|md|json)$/.test(p)&&!/(?:secret|credential|password|token|vendor\/|node_modules\/|studio\/|deploy\/|AGENTS\.md|package.*json)/i.test(p);}
export class Workspace {
 constructor({repo,root,tests={}}){this.repo=repo;this.root=root;this.tests=tests;}
 dir(t){return path.join(this.root,t.id);}
 async prepare(t){await mkdir(this.root,{recursive:true});const d=this.dir(t);try{await lstat(d);}catch(e){if(e.code!=='ENOENT')throw e;try{await git(this.repo,['rev-parse','--verify',t.branch]);await git(this.repo,['worktree','add',d,t.branch]);}catch{await git(this.repo,['worktree','add','-b',t.branch,d,'HEAD']);}}
  if(await git(d,['branch','--show-current'])!==t.branch)throw Error('branch_mismatch');return this.inspect(t);
 }
 async inspect(t){return {head:await git(this.dir(t),['rev-parse','HEAD']),status:await git(this.dir(t),['status','--short']),diff:(await git(this.dir(t),['diff','--stat'])).slice(0,8000)};}
 async file(t,name){if(!t.files.includes(name)||!allowedName(name))throw Error('file_not_allowed');const root=await realpath(this.dir(t));const f=path.join(root,name);const parent=await realpath(path.dirname(f));if(parent!==root&&!parent.startsWith(root+path.sep))throw Error('path_escape');try{const s=await lstat(f);if(!s.isFile()||s.isSymbolicLink())throw Error('file_not_regular');}catch(e){if(e.code!=='ENOENT')throw e;}return f;}
 async read(t,name){const f=await this.file(t,name);let text;try{text=await readFile(f,'utf8');}catch(e){if(e.code==='ENOENT')return {path:name,exists:false,hash:null,content:''};throw e;}if(Buffer.byteLength(text)>24000)throw Error('file_too_large');return {path:name,exists:true,hash:digest(text),content:text};}
 async action(t,a){
  if(a.tool==='read')return this.read(t,a.path);
  if(a.tool==='search'){const out=[];for(const f of t.files){const r=await this.read(t,f);r.content.split('\n').forEach((line,i)=>{if(line.includes(String(a.text).slice(0,100)))out.push({path:f,line:i+1,text:line.slice(0,300)});});}return out.slice(0,60);}
  if(a.tool==='status')return this.inspect(t);
  if(a.tool==='diff')return (await git(this.dir(t),['diff','--',...t.files])).slice(0,24000);
  if(a.tool==='write'){if(typeof a.content!=='string'||Buffer.byteLength(a.content)>24000)throw Error('content_too_large');const old=await this.read(t,a.path);if(old.hash===digest(a.content))return {alreadyApplied:true,hash:old.hash};if(old.hash!==a.expectedHash)throw Error('stale_file');const f=await this.file(t,a.path),tmp=f+'.studio-tmp';await writeFile(tmp,a.content,{flag:'wx',mode:0o600});await rename(tmp,f);t.testedTree=null;return {path:a.path,hash:digest(a.content)};}
  if(a.tool==='test'){
   const args=this.tests[a.id];if(!Array.isArray(args)||args[0]!=='node')throw Error('test_not_allowed');
   // No unsandboxed fallback: no network, secrets, host HOME, Git metadata or writable repository.
   const bindings=[];for(const p of ['/usr','/bin','/lib','/lib64']){try{await lstat(p);bindings.push('--ro-bind',p,p);}catch{}}
   try{const out=await run('bwrap',['--unshare-all','--die-with-parent','--new-session','--clearenv',...bindings,'--ro-bind',process.execPath,'/node','--proc','/proc','--dev','/dev','--tmpfs','/tmp','--ro-bind',this.dir(t),'/work','--ro-bind','/dev/null','/work/.git','--chdir','/work','--setenv','PATH','/usr/bin:/bin','--setenv','HOME','/tmp','--','/node',...args.slice(1)],this.dir(t));t.testedTree=await this.fingerprint(t);return {passed:true,output:out.slice(0,12000)};}catch(e){t.testedTree=null;if(e.exitCode==='ENOENT'||e.diagnostics?.startsWith('bwrap:'))throw Error('sandbox_unavailable');return {passed:false,error:'test_failed',exitCode:e.exitCode||null,output:e.diagnostics||''};}
  }
  if(a.tool==='commit'){
   if(!t.testedTree||t.testedTree!==await this.fingerprint(t))throw Error('passing_tests_required');
   await git(this.dir(t),['add','--',...t.files]);
   if(!(await git(this.dir(t),['diff','--cached','--name-only'])))return {head:await git(this.dir(t),['rev-parse','HEAD']),alreadyCommitted:true};
   await git(this.dir(t),['-c','user.name=Lambert Studio','-c','user.email=studio@localhost','commit','-m','Studio task '+t.id+' step '+t.step]);return this.inspect(t);
  }
  throw Error('unknown_tool');
 }
 async fingerprint(t){return digest(JSON.stringify(await Promise.all(t.files.map(f=>this.read(t,f)))));}
}
