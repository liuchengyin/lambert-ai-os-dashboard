import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context={};vm.createContext(context);
vm.runInContext(readFileSync(new URL('../logistics-canvas-model.js',import.meta.url),'utf8'),context);
const {reorder,moveModule,reorderNode,moveNode}=context.LambertLogisticsMoves;
const fixture=()=>({schema:1,modules:[
 {id:'warehouse',name:'仓储',enabled:true,nodes:[{id:'scan',title:'入库',information:'信息保留',data:'原字段',extensions:{foo:'bar'}},{id:'sort',title:'分拣'}]},
 {id:'linehaul',name:'干线',enabled:true,nodes:[{id:'batch',title:'建批次'}]},
 {id:'customs',name:'关务',enabled:false,nodes:[]}
]});
const checks=[];
const test=(name,check)=>{check();checks.push(name);console.log('PASS:',name)};

test('reorder block',()=>{
 const d=fixture();assert.equal(reorder(d.modules,0,1),true);assert.deepEqual(d.modules.map(m=>m.id),['linehaul','warehouse','customs']);
});
test('reorder rejects boundaries',()=>{
 const d=fixture(),snap=JSON.stringify(d);assert.equal(reorder(d.modules,0,-1),false);assert.equal(reorder(d.modules,1,3),false);assert.equal(reorder(d.modules,0,0),false);assert.equal(JSON.stringify(d),snap);
});
test('drag module before target',()=>{
 const d=fixture();assert.equal(moveModule(d,'customs','warehouse',false),true);assert.deepEqual(d.modules.map(m=>m.id),['customs','warehouse','linehaul']);
});
test('drag module after target',()=>{
 const d=fixture();assert.equal(moveModule(d,'warehouse','linehaul',true),true);assert.deepEqual(d.modules.map(m=>m.id),['linehaul','warehouse','customs']);
});
test('drag module self is noop',()=>{
 const d=fixture(),snap=JSON.stringify(d);assert.equal(moveModule(d,'linehaul','linehaul',true),false);assert.equal(JSON.stringify(d),snap);
});
test('within module reorder both directions',()=>{
 const d=fixture();assert.equal(reorderNode(d,'warehouse','scan',1),true);assert.deepEqual(d.modules[0].nodes.map(x=>x.id),['sort','scan']);assert.equal(reorderNode(d,'warehouse','scan',-1),true);assert.deepEqual(d.modules[0].nodes.map(x=>x.id),['scan','sort']);
});
test('move operation across modules without losing original unknown fields',()=>{
 const d=fixture(),old=JSON.stringify(d.modules[0].nodes[0]);
 assert.equal(moveNode(d,'warehouse','scan','linehaul','batch'),true);
 assert.deepEqual(d.modules[0].nodes.map(x=>x.id),['sort']);
 assert.deepEqual(d.modules[1].nodes.map(x=>x.id),['scan','batch']);
 assert.equal(JSON.stringify(d.modules[1].nodes[0]),old);
});
test('append node across modules',()=>{
 const d=fixture();assert.equal(moveNode(d,'warehouse','scan','linehaul',null),true);assert.deepEqual(d.modules[1].nodes.map(x=>x.id),['batch','scan']);
});
test('move node within same module after sibling',()=>{
 const d=fixture();assert.equal(moveNode(d,'warehouse','scan','warehouse',null),true);assert.deepEqual(d.modules[0].nodes.map(x=>x.id),['sort','scan']);
});
test('reject bad targets without removing source',()=>{
 const d=fixture(),snap=JSON.stringify(d);
 assert.equal(moveNode(d,'warehouse','scan','customs',null),false);
 assert.equal(moveNode(d,'warehouse','scan','missing',null),false);
 assert.equal(moveNode(d,'warehouse','scan','linehaul','missing-node'),false);
 assert.equal(moveNode(d,'warehouse','missing','linehaul',null),false);
 assert.equal(JSON.stringify(d),snap);
});
test('reject duplicate ID in destination',()=>{
 const d=fixture();d.modules[1].nodes.push({id:'scan'});
 const snap=JSON.stringify(d);assert.equal(moveNode(d,'warehouse','scan','linehaul',null),false);assert.equal(JSON.stringify(d),snap);
});
test('reject self before self',()=>{
 const d=fixture(),snap=JSON.stringify(d);assert.equal(moveNode(d,'warehouse','scan','warehouse','scan'),false);assert.equal(JSON.stringify(d),snap);
});
test('preserve schema and unrelated modules',()=>{
 const d=fixture();d.unknown={accountLocal:true};const snapshot=JSON.stringify(d.modules[2]);
 moveModule(d,'warehouse','linehaul',true);moveNode(d,'warehouse','sort','linehaul',null);
 assert.equal(JSON.stringify(d.modules.find(x=>x.id==='customs')),snapshot);assert.deepEqual(d.unknown,{accountLocal:true});assert.equal(d.schema,1);
});
test('drag behind target after source moves forward',()=>{
 const d=fixture();assert.equal(moveModule(d,'customs','warehouse',true),true);assert.deepEqual(d.modules.map(m=>m.id),['warehouse','customs','linehaul']);
});
test('drag module to existing adjacent location leaves layout untouched',()=>{
 const d=fixture(),snapshot=JSON.stringify(d);
 assert.equal(moveModule(d,'warehouse','linehaul',false),false);
 assert.equal(moveModule(d,'linehaul','warehouse',true),false);
 assert.equal(JSON.stringify(d),snapshot);
});
test('same module drop before next sibling is no-op',()=>{
 const d=fixture(),snapshot=JSON.stringify(d);
 assert.equal(moveNode(d,'warehouse','scan','warehouse','sort'),false);
 assert.equal(JSON.stringify(d),snapshot);
});
test('same module drop before preceding sibling changes order',()=>{
 const d=fixture();assert.equal(moveNode(d,'warehouse','sort','warehouse','scan'),true);
 assert.deepEqual(d.modules[0].nodes.map(n=>n.id),['sort','scan']);
});
test('last operation drop at end is no-op',()=>{
 const d=fixture(),snapshot=JSON.stringify(d);
 assert.equal(moveNode(d,'warehouse','sort','warehouse',null),false);
 assert.equal(JSON.stringify(d),snapshot);
});
test('disabled source cannot move its records',()=>{
 const d=fixture();d.modules[2].nodes.push({id:'disabled',title:'stays'});
 const snapshot=JSON.stringify(d);
 assert.equal(moveNode(d,'customs','disabled','warehouse',null),false);
 assert.equal(JSON.stringify(d),snapshot);
});

test('target stale edge cannot silently activate after moving matching ID',()=>{
 const d=fixture();d.modules[1].branches=[{id:'old',from:'batch',to:'scan',type:'exception'}];
 const before=JSON.stringify(d);
 assert.equal(moveNode(d,'warehouse','scan','linehaul',null),false);
 assert.equal(JSON.stringify(d),before);
});
test('cross-module move with incoming or outgoing branch is rejected with no mutation',()=>{
 const d=fixture();d.modules[0].branches=[{id:'scan-branch',from:'scan',to:'sort',type:'exception',label:'异常'}];
 const before=JSON.stringify(d);
 assert.equal(moveNode(d,'warehouse','scan','linehaul',null),false);
 assert.equal(moveNode(d,'warehouse','sort','linehaul',null),false);
 assert.equal(JSON.stringify(d),before);
 // Reordering within the owning module does not invalidate edges.
 assert.equal(moveNode(d,'warehouse','scan','warehouse',null),true);
 assert.equal(d.modules[0].branches[0].from,'scan');
});
console.log(JSON.stringify({ok:true,count:checks.length}));
