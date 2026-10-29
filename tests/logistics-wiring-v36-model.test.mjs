import vm from 'node:vm';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../logistics-wiring-v36.js',import.meta.url),'utf8'),context);
const api=context.LambertLogisticsWiringV36;
const doc=()=>({schema:1,modules:[{id:'head',nodes:[{id:'scan',title:'安检',information:'旧数据',evidence:'未核实'}],enabled:true}]});
const check=(label,fn)=>{fn();console.log('PASS:',label);};
const input=()=>({
 trace:{event:'安检事件',eventCode:'',logLocation:'内部日志路径',recordTable:'待核实表',recordKey:'运单号'},
 routing:{policy:'conditional',rule:'待核实规则',destination:'客户侧'},
 sources:[{id:'src1',kind:'OMS',table:'待核实订单表',joinKey:'运单号',fields:'订单状态'},
 {id:'src2',kind:'EDI',table:'待核实事件表',joinKey:'运单号',fields:'轨迹码'}],
 metric:{name:'及时率',formula:'待确认口径',timeField:'签收时间',slaTarget:'待核实目标',dashboard:'履约看板'},
 task:{board:'履约任务看板',condition:'逾期需处理',owner:'待分配',action:'进入工单'}
});
check('legacy empty node has five unconfigured slots and read does not mutate',()=>{
 const d=doc(),before=JSON.stringify(d);
 assert.equal(api.progress(d.modules[0].nodes[0]).count,0);
 assert.equal(JSON.stringify(d),before);
});
check('all stages accept event log routing multi sources SLA and task metadata',()=>{
 const d=doc(),n=d.modules[0].nodes[0];
 assert.equal(api.update(d,'head','scan',input()),true);
 assert.equal(n.infrastructure.sources.length,2);
 assert.equal(api.progress(n).count,5);
 assert.equal(n.information,'旧数据');assert.equal(n.evidence,'未核实');assert.equal(n.title,'安检');
});
check('internal-only routing keeps event log and persistence',()=>{
 const d=doc(),p=input();p.routing={policy:'internal',rule:'',destination:''};
 assert.equal(api.update(d,'head','scan',p),true);
 const n=d.modules[0].nodes[0];
 assert.equal(n.infrastructure.routing.policy,'internal');
 assert.equal(n.infrastructure.trace.logLocation,'内部日志路径');
 assert.equal(n.infrastructure.trace.recordTable,'待核实表');
});
check('malformed historical infrastructure rejects edit rather than overwrite',()=>{
 const d=doc(),n=d.modules[0].nodes[0];n.infrastructure='legacy';
 const before=JSON.stringify(d);assert.equal(api.update(d,'head','scan',input()),false);
 assert.equal(JSON.stringify(d),before);
});
check('invalid policy duplicate sources missing table and long field reject atomically',()=>{
 for(const change of [p=>p.routing.policy='invalid',p=>p.sources[1].id=p.sources[0].id,p=>p.sources[0].table='',p=>p.metric.formula='x'.repeat(501)]){
  const d=doc(),p=input(),before=JSON.stringify(d);change(p);
  assert.equal(api.update(d,'head','scan',p),false);
  assert.equal(JSON.stringify(d),before);
 }
});
check('editing keeps unknown extensions of existing record and source',()=>{
 const d=doc(),n=d.modules[0].nodes[0];n.infrastructure={...input(),custom:{future:true}};
 n.infrastructure.trace={...n.infrastructure.trace,customTrace:'keep'};
 n.infrastructure.sources[0].customSource='kept';
 const p=input();p.trace.event='新事件';
 assert.equal(api.update(d,'head','scan',p),true);
 assert.equal(n.infrastructure.custom.future,true);
 assert.equal(n.infrastructure.trace.customTrace,'keep');
 assert.equal(n.infrastructure.sources[0].customSource,'kept');
});
check('unknown policy never claims outbound push',()=>{
 const d=doc(),p=input();p.sources=[];p.routing={policy:'unknown',rule:'',destination:''};
 assert.equal(api.update(d,'head','scan',p),true);
 assert.equal(d.modules[0].nodes[0].infrastructure.sources.length,0);
 assert.equal(api.progress(d.modules[0].nodes[0]).count,3);
});
check('malformed legacy fields and half-specified old sources are protected',()=>{
 const damaged=[
  {trace:{event:123}},
  {sources:[{id:'x'}]},
  {routing:{policy:'not-real'}},
  {sources:[{id:'x',kind:'OMS',table:'record'},{id:'x',kind:'EDI',table:'another'}]}
 ];
 for(const legacy of damaged){
  const d=doc(),n=d.modules[0].nodes[0];n.infrastructure=legacy;
  const before=JSON.stringify(d);
  assert.equal(api.read(n).invalid,true);
  assert.equal(api.progress(n).invalid,true);
  assert.equal(api.update(d,'head','scan',input()),false);
  assert.equal(JSON.stringify(d),before);
 }
});
check('routing internal-only policy is a meaningful configured decision',()=>{
 const n={infrastructure:{routing:{policy:'internal'}}};
 assert.equal(api.progress(n).count,1);
});
check('explicitly clearing a known field is allowed but leaves custom extensions intact',()=>{
 const d=doc(),p=input();
 assert.equal(api.update(d,'head','scan',p),true);
 d.modules[0].nodes[0].infrastructure.trace.unknown='keep';
 p.trace.event='';
 assert.equal(api.update(d,'head','scan',p),true);
 assert.equal(d.modules[0].nodes[0].infrastructure.trace.event,'');
 assert.equal(d.modules[0].nodes[0].infrastructure.trace.unknown,'keep');
});
console.log('V3.6 wiring model checks passed');
