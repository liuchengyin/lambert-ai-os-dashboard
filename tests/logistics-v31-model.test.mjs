import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={};vm.createContext(ctx);
for(const filename of ['logistics-editor-v31.js','logistics-version-model.js'])
 vm.runInContext(fs.readFileSync(new URL('../'+filename,import.meta.url),'utf8'),ctx);
const api=ctx.LambertLogisticsEditor,version=ctx.LambertLogisticsVersion;
function fixture(){return {schema:1,modules:[
 {id:'head',name:'国内中心仓',category:'仓',enabled:true,stages:[{id:'arrival',name:'到车'},{id:'receiving',name:'收入'}],nodes:[
 {id:'scan',title:'安检',stageId:'receiving',note:'记录有价值的现场说明',tags:['安检','扫描'],operationCodes:['DDS'],information:'原轨迹码',evidence:'图片A',color:'#124578'},
 {id:'report',title:'异常上报',stageId:'receiving',branchOnly:true},{id:'arrive',title:'到车',stageId:'arrival'}],
 branches:[{id:'e1',from:'scan',to:'report',label:'安检异常',type:'exception'}]},
 {id:'road',name:'干线',category:'干',enabled:true,nodes:[{id:'ship',title:'发车'}],branches:[]}
 ]};}
const test=(name,fn)=>{fn();console.log('PASS:',name);};
test('tag names normalized and deduplicated',()=>assert.deepEqual(Array.from(api.labels('安检,扫描，安检 #可搜索')),['安检','扫描','可搜索']));
test('operation code refs preserved without fabricated mapping',()=>assert.deepEqual(Array.from(api.codes('DDS, 325141, DDS')),['DDS','325141']));
test('tag search matches notes, names and code refs',()=>{const d=fixture();assert.equal(api.tags(d,'安检').length,1);assert.equal(api.tags(d,'DDS').length,1);assert.equal(api.tags(d,'图片A').length,0);});
test('node impact includes linked edges',()=>{const i=api.impact(fixture(),'node','head','scan',()=> 'receiving');assert.equal(i.nodes,1);assert.equal(i.edges,1);});
test('delete operation stores complete snapshot and removes dangling edge',()=>{
 const d=fixture(),snapshot=JSON.stringify(d.modules[0].nodes[0]);
 assert.equal(api.remove(d,'node','head','scan','trash1'),true);
 assert.equal(d.modules[0].nodes.some(n=>n.id==='scan'),false);
 assert.equal(d.modules[0].branches.length,0);
 assert.equal(JSON.stringify(d.trash[0].item),snapshot);
 assert.equal(api.restore(d,'trash1'),true);
 assert.equal(JSON.stringify(d.modules[0].nodes.find(n=>n.id==='scan')),snapshot);
 assert.equal(d.modules[0].branches.length,1);
});
test('stage removal and restore preserve all children and cross-stage edges',()=>{
 const d=fixture(),source=JSON.stringify(d.modules[0]);
 assert.equal(api.remove(d,'stage','head','receiving','trash2'),true);
 assert.equal(d.modules[0].nodes.length,1);
 assert.equal(d.modules[0].branches.length,0);
 assert.equal(api.restore(d,'trash2'),true);
 assert.equal(JSON.stringify(d.modules[0]),source);
});
test('module restore preserves every field exactly',()=>{
 const d=fixture(),source=JSON.stringify(d.modules[0]);
 assert.equal(api.remove(d,'module','head',null,'trash3'),true);
 assert.equal(d.modules.length,1);
 assert.equal(api.restore(d,'trash3'),true);
 assert.equal(JSON.stringify(d.modules[0]),source);
});
test('restoration requires parent and protects against collisions',()=>{
 const d=fixture();
 api.remove(d,'node','head','scan','t1');
 api.remove(d,'module','head',null,'t2');
 const before=JSON.stringify(d);
 assert.equal(api.restore(d,'t1'),false);
 assert.equal(JSON.stringify(d),before);
 assert.equal(api.restore(d,'t2'),true);
 assert.equal(api.restore(d,'t1'),false); // duplicate exists in restored parent
});
test('same delete ID rejected before mutation',()=>{
 const d=fixture();api.remove(d,'node','head','scan','same');
 const before=JSON.stringify(d);
 assert.equal(api.remove(d,'node','head','report','same'),false);
 assert.equal(JSON.stringify(d),before);
});
test('all deleted records remain in draft not published release',()=>{
 const map=new Map();
 const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const old=fixture(),record=version.load(storage,old).record;
 const draft=JSON.parse(JSON.stringify(old));api.remove(draft,'module','head',null,'t');
 const saved=version.saveDraft(storage,record,draft);
 assert.equal(saved.published.data.modules.length,2);
 assert.equal(saved.draft.data.modules.length,1);
 assert.equal(saved.draft.data.trash.length,1);
 assert.equal(map.has('lambert_logistics_knowledge_v1'),false);
});
test('invalid restore ID never removes trash',()=>{const d=fixture();assert.equal(api.restore(d,'not-found'),false);assert.equal(d.modules.length,2)});
console.log('Logistics V3.1 model: 11 checks passed.');
