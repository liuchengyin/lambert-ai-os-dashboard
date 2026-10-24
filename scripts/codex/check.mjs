import {spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {createDevServer,ROOT} from './dev-server.mjs';
const kind=process.argv[2];
const suites={mobile:['mobile-touch-stability.mjs','mobile-task-interactions.mjs','mobile-filter-swipe.mjs','mobile-core-space.mjs','mobile-ui-coherence.mjs','mobile-compact-compose.mjs']};
if(!['data','mobile'].includes(kind))throw Error('Usage: node scripts/codex/check.mjs data|mobile');
function run(args,env){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:ROOT,env:{...process.env,...env},stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Check failed: '+args.join(' '))));});}
let server;
try{
 if(kind==='data'){const files=(await readdir(ROOT+'/tests/shared-sync')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/shared-sync/'+n);await run(['--test',...files]);}
 else{server=createDevServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const origin='http://127.0.0.1:'+server.address().port;for(const file of suites[kind])await run(['tests/'+file],{TEST_ORIGIN:origin});}
}catch(error){console.error(error.message);process.exitCode=1;}finally{if(server)await new Promise(resolve=>server.close(resolve));}
