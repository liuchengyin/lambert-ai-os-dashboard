import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={};vm.createContext(context);
for(const path of ['logistics-canvas-model.js','logistics-stage-model.js']){
  vm.runInContext(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),context);
}
const moves=context.LambertLogisticsMoves,api=context.LambertLogisticsStages;
function sample(){return {schema:1,modules:[
 {id:'head',enabled:true,stages:[{id:'arrival',name:'到车'},{id:'receiving',name:'收入'},{id:'sorting',name:'分拣'},{id:'dispatch',name:'发出'}],nodes:[
  {id:'arrival-a',stageId:'arrival',extra:{source:'original'}},
  {id:'arrival-b',stageId:'arrival'},
  {id:'receive-a',stageId:'receiving'},
  {id:'sort-a',stageId:'sorting'}
 ]},
 {id:'road',enabled:true,stages:[{id:'prepare',name:'计划'}],nodes:[{id:'road-a',stageId:'prepare'}]},
 {id:'legacy',enabled:true,nodes:[{id:'legacy-a',title:'legacy operation'}]},
 {id:'inactive',enabled:false,stages:[{id:'x',name:'停用'}],nodes:[]}
]};}
const check=(name,fn)=>{fn();console.log('PASS',name)};
check('four nested warehouse stages',()=>assert.deepEqual(api.stages(sample().modules[0]).map(s=>s.name),['到车','收入','分拣','发出']));
check('preserve legacy stage for no-stage modules',()=>assert.equal(api.stageFor(sample().modules[2],sample().modules[2].nodes[0]),'general'));
check('moving stage order does not change operations',()=>{
 const d=sample(),old=JSON.stringify(d.modules[0].nodes);
 assert.equal(api.reorderStage(d,'head','receiving',1),true);
 assert.deepEqual(d.modules[0].stages.map(x=>x.id),['arrival','sorting','receiving','dispatch']);
 assert.equal(JSON.stringify(d.modules[0].nodes),old);
});
check('drag stage before another',()=>{const d=sample();assert.equal(api.moveStage(d,'head','dispatch','receiving',false),true);assert.deepEqual(d.modules[0].stages.map(s=>s.id),['arrival','dispatch','receiving','sorting']);});
check('add stage to legacy module without deleting old nodes',()=>{
 const d=sample(),before=JSON.stringify(d.modules[2].nodes);
 assert.equal(api.addStage(d,'legacy',{id:'new',name:'分拣'}),true);
 assert.equal(JSON.stringify(d.modules[2].nodes),before);
 assert.deepEqual(Array.from(d.modules[2].stages,s=>s.id),['general','new']);
});
check('reorder operations within stage only',()=>{
 const d=sample();
 assert.equal(api.reorderWithinStage(d,'head','arrival-a',1,moves),true);
 assert.deepEqual(d.modules[0].nodes.slice(0,2).map(n=>n.id),['arrival-b','arrival-a']);
 assert.equal(api.reorderWithinStage(d,'head','arrival-a',1,moves),false);
});
check('cross-stage move retains unknown custom fields',()=>{
 const d=sample();const orig=JSON.stringify(d.modules[0].nodes[0].extra);
 assert.equal(api.moveToStage(d,'head','arrival-a','head','sorting',null,moves),true);
 const moved=d.modules[0].nodes.find(n=>n.id==='arrival-a');
 assert.equal(moved.stageId,'sorting');assert.equal(JSON.stringify(moved.extra),orig);
});
check('cross-module move retains all evidence',()=>{
 const d=sample();d.modules[0].nodes[0].evidence='source image';
 assert.equal(api.moveToStage(d,'head','arrival-a','road','prepare',null,moves),true);
 assert.equal(d.modules[1].nodes.find(n=>n.id==='arrival-a').evidence,'source image');
 assert.equal(d.modules[0].nodes.some(n=>n.id==='arrival-a'),false);
});
check('wrong stage rejects without changes',()=>{
 const d=sample(),snap=JSON.stringify(d);assert.equal(api.moveToStage(d,'head','arrival-a','road','missing',null,moves),false);assert.equal(JSON.stringify(d),snap);
});
check('duplicate ID rejects without mutation of target',()=>{
 const d=sample();d.modules[1].nodes.push({id:'arrival-a',stageId:'prepare',title:'target item'});
 const snap=JSON.stringify(d);
 assert.equal(api.moveToStage(d,'head','arrival-a','road','prepare',null,moves),false);
 assert.equal(JSON.stringify(d),snap);
});
check('disabled module rejects without changes',()=>{
 const d=sample(),snap=JSON.stringify(d);
 assert.equal(api.moveToStage(d,'head','arrival-a','inactive','x',null,moves),false);
 assert.equal(JSON.stringify(d),snap);
});
check('legacy module can be given new stage while preserving old operation ID',()=>{
 const d=sample();api.addStage(d,'legacy',{id:'sorting',name:'分拣'});
 assert.equal(api.moveToStage(d,'legacy','legacy-a','legacy','sorting',null,moves),true);
 assert.equal(d.modules[2].nodes[0].id,'legacy-a');
 assert.equal(d.modules[2].nodes[0].stageId,'sorting');
});
console.log('All 12 nested-stage model checks passed.');
