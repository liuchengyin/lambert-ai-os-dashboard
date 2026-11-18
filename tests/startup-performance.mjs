import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const raw=fs.readFileSync('shared-sync/bootstrap.mjs','utf8');
const source=raw.replace(/^import \{WorkspaceJournal,ACTIVE_KEY\} from '\.\/journal\.mjs';/m,'const ACTIVE_KEY="lambert_active_account_v1";const WorkspaceJournal=class {};')
  .replace("import('./account-ui.mjs').catch(()=>{console.warn('账户服务未加载；本地数据仍可使用');});",'// account network is intentionally outside the first-paint test');

async function simulate(failedScript=''){
  let observer,visibleAt=-1,errors=0,loaded=[],styles=0;
  const list=['lib/task-center-model.js','app.js','project-v4.js','sprint1-navigation.js?v=1','optional-one.js','optional-two.js'];
  const window={TaskCenter:null,LambertData:{active:null},LambertStartup:{
    ready(){visibleAt=loaded.length;},error(){errors++;}},addEventListener(){}};
  const page={
    getElementById(id){if(id==='lambert-app-scripts')return {textContent:JSON.stringify(list)};return id==='s1PrimaryNav'&&loaded.includes('sprint1-navigation.js?v=1')?{}:null;},
    querySelector(q){return q==='#home .s1-head'&&loaded.includes('sprint1-navigation.js?v=1')?{}:null;},
    createElement(tag){return {tagName:tag.toUpperCase(),src:'',rel:'',href:'',addEventListener(){},removeEventListener(){}};},
    head:{append(link){styles++;}},
    body:{appendChild(script){
      observer?.([{addedNodes:[{nodeType:1,tagName:'DIV',querySelectorAll:()=>[]}]}]);
      queueMicrotask(()=>{
        if(script.src===failedScript)script.onerror?.();
        else {loaded.push(script.src);if(script.src.startsWith('sprint1-navigation.js'))window.TaskCenter={};script.onload?.();}
      });
    }}
  };
  const sandbox={window,document:page,localStorage:{},MutationObserver:class {constructor(cb){observer=cb;}observe(){}disconnect(){}},
    performance:{mark(){}},console:{warn(){}},setTimeout,clearTimeout,Promise,queueMicrotask,location:{origin:'https://example.com',href:'https://example.com'}};
  await vm.runInNewContext('(async()=>{'+source+'})()',sandbox);
  return {visibleAt,errors,loaded,styles};
}
const happy=await simulate();
assert.equal(happy.errors,0);
assert.equal(happy.visibleAt,4,'core becomes visible before optional modules complete');
assert.equal(happy.loaded.length,6,'optional modules still execute in original sequence');
assert.equal(happy.styles,6,'preloads remain for every script');
const failed=await simulate('app.js');
assert.equal(failed.errors,1,'core asset failure displays recoverable error');
assert.equal(failed.visibleAt,-1,'failed core cannot reveal incomplete workspace');
console.log('PASS: first paint unblocks after core; extras preserve order; core errors remain visible');
