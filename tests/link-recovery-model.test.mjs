import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const ctx={structuredClone};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../lib/link-recovery.js',import.meta.url),'utf8'),ctx);
const api=ctx.LambertLinkRecovery;
const key='knowledge_link_library_v1',personal='knowledge_link_personal_v1';
const guest=[{id:'g1',name:'工具',links:[{id:'l1',url:'https://example.com/a',title:'保留旧名称',desc:'说明',custom:'extra'},{id:'l2',url:'https://example.com/b',title:'新增链接'}]}];
const current=[{id:'g1',name:'工具',links:[{id:'l1',url:'https://example.com/a',title:'现有名称',custom:'cloud'}]},{id:'g2',name:'私人',links:[]}];
const readStore=data=>({
 getItem:k=>Object.hasOwn(data,k)?data[k]:null,
 key:i=>Object.keys(data)[i]??null,
 get length(){return Object.keys(data).length;}
});
const check=(title,fn)=>{fn();console.log('PASS:',title)};
check('scans guest old bookmarks and compatible owner backup without other accounts',()=>{
 const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const store=readStore({
 [key]:JSON.stringify(guest),
 ['lambert_private_v1:'+owner+':'+personal]:JSON.stringify([{id:'pg',name:'个人',links:[{id:'p1',url:'https://personal.example',title:'个人链接'}]}]),
 'lambert_backup_v2:a':JSON.stringify({format:'lambert-local-backup-v2',account:{userId:other,snapshot:{[key]:[{name:'其他账号',links:[{url:'https://private.other'}]}]}}}),
 'lambert_backup_v2:b':JSON.stringify({format:'lambert-local-backup-v2',account:{userId:owner,snapshot:{[key]:guest}}})
 });
 const sources=api.findSources(store,owner);
 assert.ok(sources.some(s=>s.key===personal));
 assert.ok(sources.some(s=>s.key===key));
 assert.ok(sources.every(s=>!JSON.stringify(s.groups).includes('private.other')));
});
check('preview shows only missing links and preserves original properties',()=>{
 const snapshot=JSON.stringify(current),found=api.preview({[key]:current,[personal]:[]},[
 {key,groups:guest},{key:personal,groups:[{id:'pg',name:'个人',links:[{id:'p1',url:'https://personal.example',title:'私人'}]}]}
 ]);
 assert.equal(found.total,2);
 assert.equal(found.count[key].links,1);
 assert.equal(found.updates[key][0].links[0].title,'现有名称');
 assert.equal(found.updates[key][0].links[1].title,'新增链接');
 assert.equal(found.updates[personal][0].links[0].url,'https://personal.example');
 assert.equal(JSON.stringify(current),snapshot);
});
check('merge is idempotent and handles colliding IDs without losing links',()=>{
 const old=[{id:'g1',name:'旧组',links:[{id:'l1',url:'https://different.example/',title:'新网址'}]}];
 const one=api.merge(current,[{key,groups:old}],key);
 assert.equal(one.addedLinks,1);
 assert.notEqual(one.groups.at(-1).id,'g1');
 assert.notEqual(one.groups.at(-1).links[0].id,'l1');
 const again=api.merge(one.groups,[{key,groups:old}],key);
 assert.equal(again.addedLinks,0);
});
check('malformed current document blocks merge before any mutation',()=>{
 const data={unexpected:true};const before=JSON.stringify(data);
 assert.throws(()=>api.merge(data,[{key,groups:guest}],key));
 assert.equal(JSON.stringify(data),before);
});
check('backup-only guest snapshot is discoverable',()=>{
 const store=readStore({'lambert_backup_v2:old':JSON.stringify({format:'lambert-local-backup-v2',raw:{[key]:JSON.stringify(guest)}})});
 assert.equal(api.findSources(store,'').length,1);
});
console.log('Link recovery model checks passed');
