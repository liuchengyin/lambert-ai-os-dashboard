import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const host={};vm.createContext(host);
vm.runInContext(fs.readFileSync(new URL('../logistics-trigger-v33.js',import.meta.url),'utf8'),host);
const api=host.LambertLogisticsTriggerV33;
const run=(label,callback)=>{callback();console.log('PASS:',label);};
const doc=()=>({schema:1,modules:[{id:'warehouse',name:'中心仓',enabled:true,nodes:[{id:'n1',title:'换单打印',stageId:'receiving',kind:'业务操作',action:'打印或换单',information:'upp',data:'old_record',confidence:'已核实',evidence:'历史截图',operationCodes:['DDS'],eventRefs:[{code:'internal'}],branches:[],note:'old',color:'#CDEFFF'}],branches:[{id:'e1',from:'n1',to:'n1',label:'old'}]}]});
run('legacy node safely displays no invented trigger outcomes',()=>assert.equal(api.triggers(doc().modules[0].nodes[0]).length,0));
run('reject incomplete / duplicate triggers',()=>{
 assert.equal(api.normalize([{id:'a',description:'扫描'}, {id:'a',description:'事件'}]),null);
 assert.equal(api.normalize([{id:'a',description:''}]),null);
});
run('multiple trigger outcomes retain separate IDs and descriptions',()=>{
 const result=api.normalize([{id:'a',description:'装车事件'},{id:'b',description:'更新装车状态'}]);
 assert.equal(result.length,2);
 assert.equal(result[1].description,'更新装车状态');
});
run('updating legacy node keeps sensitive graph and historical fields',()=>{
 const d=doc(),before=structuredClone(d.modules[0].nodes[0]);
 assert.equal(api.updateNode(d,'warehouse','n1',{title:'换单扫描',action:'更新打印',note:'笔记',tags:['换单'],color:null},[{id:'t1',description:'打印日志'}]),true);
 const n=d.modules[0].nodes[0];
 assert.equal(n.title,'换单扫描');assert.equal(n.id,before.id);
 for(const f of ['kind','information','data','confidence','evidence','operationCodes','eventRefs','stageId'])
   assert.deepEqual(n[f],before[f],f);
 assert.equal(n.color,undefined);
 assert.equal(n.triggers[0].description,'打印日志');
 assert.equal(d.modules[0].branches.length,1);
});
run('new node requires at least one meaningful trigger outcome',()=>{
 const d=doc();
 assert.equal(api.addNode(d,'warehouse','receiving','n2',{title:'试运行'},[]),false);
 assert.equal(d.modules[0].nodes.length,1);
 assert.equal(api.addNode(d,'warehouse','receiving','n2',{title:'确认签收',action:'完成签收'},[{id:'a',description:'生成签收记录'}]),true);
 assert.equal(d.modules[0].nodes[1].eventRefs.length,0);
});
run('existing node can be edited without forced fabricated mappings',()=>{
 const d=doc();
 assert.equal(api.updateNode(d,'warehouse','n1',{title:'改名',action:'说明',note:'',tags:[],color:null},[]),true);
 assert.equal(d.modules[0].nodes[0].information,'upp');
 assert.equal(d.modules[0].nodes[0].triggers.length,0);
});
run('unknown node / invalid name never writes',()=>{
 const d=doc(),snapshot=JSON.stringify(d);
 assert.equal(api.updateNode(d,'warehouse','none',{title:'x'},[]),false);
 assert.equal(api.updateNode(d,'warehouse','n1',{title:''},[]),false);
 assert.equal(JSON.stringify(d),snapshot);
});
console.log('V3.3 trigger model: 7 pass');
