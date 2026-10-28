import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const host={};vm.createContext(host);
vm.runInContext(fs.readFileSync(new URL('../logistics-setup-v34.js',import.meta.url),'utf8'),host);
const api=host.LambertLogisticsSetupV34;
const run=(label,test)=>{test();console.log('PASS:',label);};
const demo=()=>({schema:1,modules:[
 {id:'linehaul',name:'陆运干线',category:'干',enabled:true,stages:[{id:'general',name:'陆运操作',collapsed:false}],nodes:[{id:'old',title:'原装车确认'}]},
 {id:'warehouse',name:'国内中心仓',category:'仓',enabled:true,stages:[{id:'receiving',name:'收入'}],nodes:[]}
]});
run('old linehaul inferred road without changing stored data',()=>{const d=demo(),before=JSON.stringify(d);assert.equal(api.infer(d.modules[0]),'road');assert.equal(JSON.stringify(d),before);});
run('three linehaul modes listed',()=>assert.deepEqual(Array.from(api.modes(),x=>x.label),['陆运','海运','空运']));
run('mode templates create independent modules without removing road',()=>{
 const d=demo();assert.equal(api.addModeModule(d,'air','air-1'),true);assert.equal(api.addModeModule(d,'sea','sea-1'),true);
 assert.equal(d.modules.length,4);assert.equal(d.modules[0].nodes[0].id,'old');
 assert.equal(d.modules[2].transportMode,'air');assert.equal(d.modules[3].transportMode,'sea');
 assert.equal(api.addModeModule(d,'air','air-1'),false);
});
run('air submenu items are references and never prefilled with false actual configuration',()=>{
 const air=api.preset('air');
 for(const k of ['机场管理','航司管理','航线管理','航班管理','板型管理','航班日志'])
   assert.equal(air.some(x=>x.name===k),true,k);
 assert.equal(air.filter(x=>x.role==='reference').length,1);
 assert.equal(air.find(x=>x.name==='航班日志').role,'reference');
 assert.equal(air.every(x=>x.value===''),true);
});
run('module requirements accept actual Jiaxing destination input without altering graph',()=>{
 const d=demo(),old=JSON.stringify(d.modules[0].nodes);
 assert.equal(api.update(d,'linehaul',null,[{id:'airport',name:'目的机场',value:'嘉兴南湖机场',note:'用户输入',role:'prerequisite'}]),true);
 assert.equal(d.modules[0].prerequisites[0].value,'嘉兴南湖机场');
 assert.equal(JSON.stringify(d.modules[0].nodes),old);
});
run('stage prerequisites are independently stored',()=>{
 const d=demo();
 assert.equal(api.update(d,'linehaul','general',[{id:'route',name:'路线管理',value:'待配置'}]),true);
 assert.equal(d.modules[0].prerequisites,undefined);
 assert.equal(d.modules[0].stages[0].prerequisites.length,1);
});
run('invalid stage and duplicate row ID safely refuse update',()=>{
 const d=demo(),snapshot=JSON.stringify(d);
 assert.equal(api.update(d,'linehaul','missing',[{id:'a',name:'x',value:''}]),false);
 assert.equal(api.update(d,'linehaul','general',[{id:'a',name:'x'},{id:'a',name:'y'}]),false);
 assert.equal(JSON.stringify(d),snapshot);
});
run('road sea air classification only for trunk modules',()=>{
 const d=demo();
 assert.equal(api.setMode(d,'warehouse','air'),false);
 assert.equal(api.setMode(d,'linehaul','sea'),true);
 assert.equal(api.infer(d.modules[0]),'sea');
 assert.equal(api.setMode(d,'linehaul','wrong'),false);
});
run('legacy module and stage without prerequisites appear empty',()=>{
 const d=demo();assert.equal(api.list(d.modules[0]).length,0);assert.equal(api.list(d.modules[0].stages[0]).length,0);
});
console.log('V3.4 setup model: 9 passed');
