import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../logistics-drawio-model.js',import.meta.url),'utf8'),context);
const api=context.LambertDrawioModel;
const source={schema:1,modules:[
  {id:'warehouse',name:'国内中心仓',category:'仓',stages:[{id:'receive',name:'收入'}],
    nodes:[{id:'scan',title:'安检扫描',stageId:'receive',infrastructure:{trace:{eventCode:'NOT_FOR_EXPORT'},routing:{destination:'PRIVATE_HOST'}}},{id:'fail',title:'安检异常处理',branchOnly:true,stageId:'receive'}],
    branches:[{id:'b1',from:'scan',to:'fail',type:'exception',label:'安检异常'}]},
  {id:'customs',name:'出口关务',category:'关',nodes:[{id:'clear',title:'出口放行'}],branches:[]}
]};
let writes=[];
const disk=new Map();
const store={getItem:k=>disk.has(k)?disk.get(k):null,setItem:(k,v)=>{writes.push(k);disk.set(k,v);}};
function check(name,fn){fn();console.log('PASS:',name);}
check('seed displays modules and all operation names, real exception branch but no inferred sequence or private values',()=>{
 const prior=JSON.stringify(source),xml=api.seed(source);
 assert(xml.startsWith('<mxfile'));
 assert(xml.includes('国内中心仓')&&xml.includes('安检扫描')&&xml.includes('出口放行'));
 assert(xml.includes('branch_0_0'));
 assert(xml.includes('安检异常'));
 assert.equal(xml.includes('PRIVATE_HOST'),false);
 assert.equal(xml.includes('NOT_FOR_EXPORT'),false);
 assert.equal(xml.includes('source="op_0_0"'),true);
 assert.equal(xml.includes('edge="1"'),true);
 assert.equal(JSON.stringify(source),prior);
});
check('escapes untrusted diagram values and keeps valid XML',()=>{
 const x=JSON.parse(JSON.stringify(source));x.modules[0].nodes[0].title='<img src=x onerror=alert(1)>';
 const xml=api.seed(x);
 assert(xml.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.equal(xml.includes('<img'),false);
});
check('independent save never mutates legacy doc or version keys',()=>{
 const xml=api.seed(source);
 assert.equal(api.save(store,xml,7),true);
 assert.deepEqual(writes,[api.KEY]);
 const load=api.load(store);assert.equal(load.exists,true);
 assert.equal(load.data.sourceVersion,7);
 assert.equal(load.data.xml,xml);
 assert.equal(disk.has('lambert_logistics_knowledge_v1'),false);
 assert.equal(disk.has('lambert_logistics_versions_v1'),false);
});
check('later save creates protective backup before overwrite',()=>{
 const old=disk.get(api.KEY);
 assert.equal(api.save(store,api.blank(),9),true);
 assert.equal(disk.get(api.BACKUP_KEY),old);
 assert.equal(api.load(store).data.sourceVersion,9);
});
check('malformed past diagram blocks edits instead of resetting',()=>{
 const broken='{"schema":1,"xml":"bad"}';disk.set(api.KEY,broken);
 assert(api.load(store).error);
 assert.equal(api.save(store,api.blank(),10),false);
 assert.equal(disk.get(api.KEY),broken);
});
check('rejects invalid XML, DOCTYPE and oversize',()=>{
 assert.equal(api.validXml('<?xml version="1.0"?><mxfile/>'),false);
 assert.equal(api.validXml('<!DOCTYPE mxfile><mxfile/>'),false);
 assert.equal(api.validXml(api.blank()),true);
 assert.equal(api.save(store,'<script>alert(1)</script>',1),false);
});
console.log('Draw.io model checks passed.');
