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
check('malformed legacy exchange data must not be overwritten',()=>{
 const d=document(),n=d.modules[0].nodes[0];n.exchanges={legacy:{custom:'keep'}};
 const old=JSON.stringify(d);
 assert.equal(model.addExchange(d,'road','a',{id:'valid',source:'OMS',target:'EDI',message:'notify'}),false);
 assert.equal(JSON.stringify(d),old);
});
check('branch truncation is visible while preserving the full original graph',()=>{
 const d=document(),m=d.modules[0];
 m.nodes='abcdefghi'.split('').map(id=>({id,title:id}));
 m.branches='abcdefgh'.split('').map((id,i)=>({id:'edge'+i,from:id,to:'bcdefghi'[i],type:'branch'}));
 const old=JSON.stringify(d),top=model.tree(m,'a');
 let deepest=top[0];while(deepest.children.length)deepest=deepest.children[0];
 assert.equal(deepest.target.id,'h');
 assert.equal(deepest.truncated,true);
 assert.equal(JSON.stringify(d),old);
});

check('node-first context separates display order and explicit incoming/outgoing branches',()=>{
 const m={id:'head',nodes:[{id:'scan',title:'安检',stageId:'receiving'}, {id:'error',title:'异常',stageId:'receiving',branchOnly:true},
   {id:'next',title:'复检',stageId:'receiving'}, {id:'other',title:'发运',stageId:'dispatch'}],
   branches:[{id:'e1',from:'scan',to:'error',type:'exception',label:'安检失败'},
             {id:'e2',from:'error',to:'next',type:'branch',label:'再次检查'}]};
 const stageFor=(_m,n)=>n.stageId;
 const scan=model.operationContext(m,'scan',stageFor);
 assert.equal(scan.previous,null);assert.equal(scan.next.id,'next');
 assert.equal(scan.incoming.length,0);assert.equal(scan.outgoing.length,1);
 assert.equal(scan.outgoing[0].type,'exception');
 const error=model.operationContext(m,'error',stageFor);
 assert.equal(error.branchOnly,true);assert.equal(error.previous,null);assert.equal(error.next,null);
 assert.equal(error.incoming[0].from.id,'scan');assert.equal(error.outgoing[0].to.id,'next');
 assert.equal(model.operationContext(m,'missing',stageFor),null);
});
check('node-first context ignores broken legacy edges but keeps source intact',()=>{
 const m=document().modules[0],snapshot=JSON.stringify(m);
 m.branches.push({id:'missing',from:'unknown',to:'a',type:'exception'});
 const ctx=model.operationContext(m,'a');
 assert.equal(ctx.incoming.length,0);
 assert.equal(ctx.outgoing.length,2);
 assert.equal(m.branches.at(-1).id,'missing');
 assert.ok(JSON.stringify(m).includes(snapshot.slice(0,30)));
});
console.log('V3.5 model: 10 checks passed');
