import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const env={};vm.createContext(env);
vm.runInContext(fs.readFileSync(new URL('../logistics-v35-model.js',import.meta.url),'utf8'),env);
const model=env.LambertLogisticsV35;
function document(){
 return {schema:1,modules:[
  {id:'road',name:'陆运干线',category:'干',enabled:true,nodes:[{id:'a',title:'安检'},{id:'b',title:'异常上报'},{id:'c',title:'复检'}],branches:[
   {id:'x',from:'a',to:'b',type:'exception',label:'安检异常'},
   {id:'y',from:'a',to:'c',type:'branch',label:'需复检'},
   {id:'z',from:'b',to:'c',type:'branch',label:'需要补充'}]},
  {id:'warehouse',name:'仓库',category:'仓',enabled:true,nodes:[],branches:[]},
  {id:'air',name:'空运干线',category:'干',transportMode:'air',enabled:true,nodes:[],branches:[]}
 ]};
}
const check=(name,fn)=>{fn();console.log('PASS',name)};
check('transport family has exactly road air sea slots',()=>{
 const lanes=model.trunkModules(document().modules);
 assert.equal(lanes.length,3);
 assert.deepEqual(Array.from(lanes,x=>x.label),['陆运','空运','海运']);
 assert.equal(lanes[0].modules[0].id,'road');assert.equal(lanes[1].modules[0].id,'air');
 assert.equal(lanes[2].modules.length,0);
});
check('business path recognises normal and exception distinctly',()=>{
 const tree=model.tree(document().modules[0],'a');
 assert.equal(tree.length,2);assert.equal(tree[0].edge.type,'exception');
 assert.equal(tree[1].edge.type,'branch');assert.equal(tree[0].children[0].target.id,'c');
});
check('recursive cycles do not cause infinite expansion',()=>{
 const d=document();d.modules[0].branches.push({id:'loop',from:'c',to:'a',type:'branch',label:'返回'});
 const tree=model.tree(d.modules[0],'a');
 assert.equal(tree[0].children[0].children[0].circular,true);
});
check('information exchange never modifies business branches',()=>{
 const d=document(),edges=JSON.stringify(d.modules[0].branches);
 assert.equal(model.addExchange(d,'road','b',{id:'ex1',source:'TMS',target:'EDI',message:'发送事件'}),true);
 assert.equal(d.modules[0].nodes.find(n=>n.id==='b').exchanges.length,1);
 assert.equal(JSON.stringify(d.modules[0].branches),edges);
 assert.equal(model.addExchange(d,'road','b',{id:'ex1',source:'TMS',target:'EDI',message:'重复'}),false);
 assert.equal(model.removeExchange(d,'road','b','ex1'),true);
 assert.equal(JSON.stringify(d.modules[0].branches),edges);
});
check('unverified data never creates exchange or changes node',()=>{
 const d=document(),old=JSON.stringify(d);
 assert.equal(model.addExchange(d,'road','b',{id:'x',source:'',target:'EDI',message:'x'}),false);
 assert.equal(JSON.stringify(d),old);
});
check('orphan branches ignored when target node does not exist',()=>{
 const d=document();d.modules[0].branches.push({id:'missing',from:'a',to:'never',label:'missing',type:'branch'});
 assert.equal(model.tree(d.modules[0],'a').length,2);
});
console.log('V3.5 model: 6 checks passed');
