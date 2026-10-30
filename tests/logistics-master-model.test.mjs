import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../logistics-master-model.js',import.meta.url),'utf8'),ctx);
const m=ctx.LambertLogisticsMasterModel;
const source={schema:1,modules:[
 {id:'domestic',name:'国内中心仓',category:'仓',enabled:true,stages:[{id:'arrival',name:'到车'},{id:'security',name:'安检'}],
  branches:[{id:'error-flow',from:'scan',to:'abnormal',label:'安检异常',type:'exception'}],
  nodes:[{id:'arrive',stageId:'arrival',title:'到车扫描',note:'原备注'},
   {id:'scan',stageId:'security',title:'安检扫描',infrastructure:{routing:{policy:'internal'}}},
   {id:'abnormal',stageId:'security',title:'异常处理',branchOnly:true,unknown:'保留未知字段'}]},
 {id:'transport',name:'陆运干线',category:'干',enabled:true,nodes:[{id:'departure',title:'实际发运'}]}
]};
const old=JSON.stringify(source);
const original={schema:1,positions:{},notes:[],links:[],collapsed:{},sourceVersion:4};
const store=new Map();
const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)};
const check=(name,fn)=>{fn();console.log('PASS:',name);};
check('empty master only reads/writes its own key',()=>{
 const a=m.load(storage);assert.equal(a.persisted,false);assert.equal(a.data.schema,1);
 assert.equal(m.save(storage,a.data),true);
 assert.deepEqual([...store.keys()],[m.KEY]);
});
check('model projects original operations, headings and confirmed exception without altering input',()=>{
 const view=m.build(source,original);
 assert.equal(view.sourceCount,4);assert.equal(view.branchCount,1);
 assert.ok(view.nodes.some(n=>n.id===m.nodeId('domestic','abnormal')&&n.kind==='branch'));
 assert.ok(view.edges.some(e=>e.fixed&&e.kind==='exception'&&e.label==='安检异常'));
 assert.equal(JSON.stringify(source),old);
});
check('positions are separately stored, stable IDs and version remain',()=>{
 const layout=m.fresh(),id=m.nodeId('domestic','scan');
 layout.positions[id]={x:888,y:444};layout.sourceVersion=8;
 assert.equal(m.save(storage,layout),true);
 const next=m.load(storage);assert.equal(next.data.positions[id].x,888);
 assert.equal(next.data.sourceVersion,8);
 assert.equal(m.build(source,next.data).nodes.find(n=>n.id===id).position.y,444);
 assert.equal(JSON.stringify(source),old);
});
check('extra note and unverified link are separate; confirmed branch remains fixed',()=>{
 const l=m.fresh();const src=m.nodeId('domestic','scan'),dst=m.nodeId('transport','departure');
 assert.equal(m.addNote(l,{id:'n1',title:'研究中',body:'操作证据还没找到',x:20,y:40}),true);
 assert.equal(m.addLink(l,src,dst,'需核实接口','connection1'),true);
 assert.equal(m.addLink(l,src,dst,'不重复','connection2'),false);
 const v=m.build(source,l);
 assert.equal(v.edges.filter(e=>e.kind==='hypothesis').length,1);
 assert.equal(v.edges.filter(e=>e.kind==='exception').length,1);
 assert.equal(v.nodes.filter(n=>n.kind==='note').length,1);
 assert.equal(JSON.stringify(source),old);
});
check('scoping modules does not alter underlying data and hides disconnected research edges',()=>{
 const l=m.fresh(),a=m.nodeId('domestic','scan'),b=m.nodeId('transport','departure');
 m.addLink(l,a,b,'研究关联','one');
 const v=m.build(source,l,'domestic');
 assert.equal(v.sourceCount,3);
 assert.equal(v.edges.filter(e=>e.kind==='hypothesis').length,0);
});
check('malformed legacy master storage blocks writes, never silently reset',()=>{
 const bad='{"schema":1,"positions":{"x":{"x":"oops"}},"notes":[],"links":[],"collapsed":{}}';
 storage.setItem(m.KEY,bad);
 assert.ok(m.load(storage).error);
 assert.equal(m.save(storage,{schema:1,positions:{bad:{x:1,y:NaN}},notes:[],links:[],collapsed:{}}),false);
 assert.equal(storage.getItem(m.KEY),bad);
});
console.log('Master model checks passed.');
