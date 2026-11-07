import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=(await readFile(new URL('../shared-sync/bootstrap.mjs',import.meta.url),'utf8'))
 .replace(/^import .*?;\n/,'')
 .replace("import('./account-ui.mjs')",'Promise.resolve()');
function boot(view,{missingStyle=false}={}){
 let ready=0,errors=0,core=false,release;
 const styles=['knowledge-itab-v2.css','dashboard-v5.css','theme-linear.css','workspace-glass-v1.css'].map(name=>({href:'https://test/'+name,sheet:missingStyle&&name==='knowledge-itab-v2.css'?null:{}}));
 const window={LambertStartup:{ready(){ready++;},error(){errors++;}},addEventListener(){}};
 const document={documentElement:{},getElementById(id){if(id==='lambert-app-scripts')return {textContent:JSON.stringify(['core.js','optional.js'])};return core?{}:null;},querySelector(){return core?{}:null;},querySelectorAll(){return styles;},createElement(tagName){return {tagName:tagName.toUpperCase(),addEventListener(){},removeEventListener(){}};},head:{append(){}},body:{appendChild(s){if(s.src==='core.js'){core=true;window.TaskCenter={};queueMicrotask(()=>s.onload());}else release=fail=>fail?s.onerror():s.onload();}}};
 const done=runInNewContext('(async()=>{'+source+'})()',{window,document,location:{href:'https://test/?view='+view,origin:'https://test',search:'?view='+view},URL,URLSearchParams,WeakSet,Set,Promise,setTimeout,clearTimeout,console:{warn(){}},MutationObserver:class{observe(){}disconnect(){}}});
 return {done,state:()=>({ready,errors}),finish:(fail=false)=>release(fail)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('links become usable while an unrelated module is stalled; later failure does not hide them',async()=>{
 const app=boot('knowledge');await tick();assert.deepEqual(app.state(),{ready:1,errors:0});app.finish(true);await app.done;assert.deepEqual(app.state(),{ready:1,errors:0});
});
test('other entries retain the complete startup gate',async()=>{
 const app=boot('tasks');await tick();assert.equal(app.state().ready,0);app.finish();await app.done;assert.deepEqual(app.state(),{ready:1,errors:0});
});
test('missing links styling never reveals an unstyled links view',async()=>{
 const app=boot('knowledge',{missingStyle:true});await tick();assert.equal(app.state().ready,0);app.finish(true);await app.done;assert.deepEqual(app.state(),{ready:0,errors:1});
});
