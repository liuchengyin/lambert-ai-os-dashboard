import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../logistics-flow-model.js',import.meta.url),'utf8'),ctx);
const api=ctx.LambertLogisticsFlow;
const seed=()=>({schema:1,modules:[{id:'head',category:'仓',enabled:true,nodes:[
 {id:'scan',title:'安检扫描',information:'保留信息',data:'保留数据',meta:{key:3}},
 {id:'report',title:'异常上报',branchOnly:true},
 {id:'next',title:'收入操作'}
 ],stages:[{id:'receiving',name:'收入'}]}]});
const t=(name,fn)=>{fn();console.log('PASS:',name);};
t('warehouse color fallback',()=>{assert.equal(api.moduleColor(seed().modules[0]),'#242424');});
t('invalid color does not save',()=>{const d=seed(),v=JSON.stringify(d);assert.equal(api.setColor(d,'head','red'),false);assert.equal(JSON.stringify(d),v);});
t('module accepts custom hex',()=>{const d=seed();assert.equal(api.setColor(d,'head','#ab12ef'),true);assert.equal(d.modules[0].color,'#AB12EF');assert.equal(api.moduleColor(d.modules[0]),'#AB12EF');});
t('stage color inherits module then overrides',()=>{const d=seed();api.setColor(d,'head','#123456');assert.equal(api.stageColor(d.modules[0],d.modules[0].stages[0]),'#123456');assert.equal(api.setColor(d,'head','#fedcba','receiving'),true);assert.equal(api.stageColor(d.modules[0],d.modules[0].stages[0]),'#FEDCBA');});
t('reset stage keeps module color',()=>{const d=seed();api.setColor(d,'head','#112233');api.setColor(d,'head','#445566','receiving');assert.equal(api.resetColor(d,'head','receiving'),true);assert.equal(api.stageColor(d.modules[0],d.modules[0].stages[0]),'#112233');});
t('module reset restores category palette',()=>{const d=seed();api.setColor(d,'head','#aabbcc');assert.equal(api.resetColor(d,'head'),true);assert.equal(api.moduleColor(d.modules[0]),'#242424');});
t('branch-only is mainline until a valid incoming edge',()=>{const d=seed();assert.equal(api.isBranchOnly(d.modules[0],'report'),false);});
t('add real condition branch and preserve original operation data',()=>{const d=seed(),node=JSON.stringify(d.modules[0].nodes[0]);assert.equal(api.upsertBranch(d,'head',{id:'edge1',from:'scan',to:'report',label:'异常',branchOnly:true}),true);assert.equal(api.isBranchOnly(d.modules[0],'report'),true);assert.equal(api.activeBranches(d.modules[0]).length,1);assert.equal(JSON.stringify(d.modules[0].nodes[0]),node);});
t('duplicate branch rejected without altering storage',()=>{const d=seed(),edge={id:'edge1',from:'scan',to:'report',label:'异常'};api.upsertBranch(d,'head',edge);const before=JSON.stringify(d);assert.equal(api.upsertBranch(d,'head',{id:'edge2',from:'scan',to:'report',label:'abnormal'}),false);assert.equal(JSON.stringify(d),before);});
t('self loop and unknown target refused',()=>{const d=seed(),old=JSON.stringify(d);assert.equal(api.upsertBranch(d,'head',{id:'x',from:'scan',to:'scan',label:'loop'}),false);assert.equal(api.upsertBranch(d,'head',{id:'y',from:'scan',to:'gone',label:'unknown'}),false);assert.equal(JSON.stringify(d),old);});
t('remove branch restores operation into normal display',()=>{const d=seed();api.upsertBranch(d,'head',{id:'e',from:'scan',to:'report',label:'异常',branchOnly:true});assert.equal(api.removeBranch(d,'head','e'),true);assert.equal(api.isBranchOnly(d.modules[0],'report'),false);assert.equal(d.modules[0].nodes.length,3);assert.equal(d.modules[0].nodes[1].branchOnly,undefined);});
t('orphan link kept but not displayed or destructively removed',()=>{const d=seed();d.modules[0].branches=[{id:'e',from:'scan',to:'unknown',label:'error'}];assert.equal(api.activeBranches(d.modules[0]).length,0);assert.equal(d.modules[0].branches.length,1);});
t('shared branch target retains flag until final incoming link is removed',()=>{
 const d=seed();api.upsertBranch(d,'head',{id:'a',from:'scan',to:'report',label:'安检异常',branchOnly:true});
 api.upsertBranch(d,'head',{id:'b',from:'next',to:'report',label:'复检异常',branchOnly:true});
 assert.equal(api.removeBranch(d,'head','a'),true);
 assert.equal(d.modules[0].nodes.find(n=>n.id==='report').branchOnly,true);
 assert.equal(api.removeBranch(d,'head','b'),true);
 assert.equal(d.modules[0].nodes.find(n=>n.id==='report').branchOnly,undefined);
});
console.log('Flow palette and branches: 13 pass.');
