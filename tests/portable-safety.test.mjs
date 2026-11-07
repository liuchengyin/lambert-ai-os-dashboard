import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPortableSafetyArchive} from '../shared-sync/portable-safety.mjs';
const owner='a12b3456-1234-4234-8234-123456789abc';
const other='b12b3456-1234-4234-8234-123456789abc';
const file={id:'master-12345678-1234-4234-8234-123456789abc',title:'流程',xml:'<mxfile/>',sourceVersion:0,createdAt:'2026-11-07',updatedAt:'2026-11-07'};
function store(data={}){
 const map=new Map(Object.entries(data));
 return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),get length(){return map.size},key:i=>[...map.keys()][i]};
}
function library(files=[file],trash=[]){
 return {list:async deleted=>structuredClone(deleted?trash:files),validateRecord:x=>x?.id?.startsWith('master-')&&typeof x.xml==='string'};
}
test('guest safety backup retains both drawings and raw workspace, without writes',async()=>{
 const s=store({tasks:'[{"id":"t1"}]',projects:'[]'});
 const result=await createPortableSafetyArchive({storage:s,library:library([file],[{...file,id:'master-22222222-1234-4234-8234-123456789abc'}])});
 assert.equal(result.format,'lambert-portable-safety-v1');
 assert.equal(result.owner,null);
 assert.equal(result.workspace.raw.tasks,'[{"id":"t1"}]');
 assert.equal(result.counts.masterFiles,1);
 assert.equal(result.counts.masterTrash,1);
 assert.equal(result.master.files[0].xml,'<mxfile/>');
 assert.equal(s.map.size,2);
 assert(result.coverage.excluded.includes('PDF binary files'));
});
test('signed-in account retains owner raw workspace bytes and pending mutation, not another account',async()=>{
 const p='lambert_workspace_v1:'+owner+':';
 const s=store({'lambert_active_account_v1':owner,[p+'base']:'[]',[p+'batch:123']:'[]',
  ['lambert_workspace_v1:'+other+':base']:'[{"secret":true}]',
  ['lambert_private_v1:'+owner+':reading_workspace_v2']:'{"memo":1}'});
 const result=await createPortableSafetyArchive({storage:s,library:library(),owner});
 assert.equal(result.owner,owner);
 assert.equal(result.workspace.account.userId,owner);
 assert.equal(result.workspace.account.rawStorage[p+'base'],'[]');
 assert.equal(result.workspace.account.rawStorage[p+'batch:123'],'[]');
 assert.equal(result.workspace.account.rawStorage['lambert_private_v1:'+owner+':reading_workspace_v2'],'{"memo":1}');
 assert(!Object.keys(result.workspace.account.rawStorage).some(x=>x.includes(other)));
});
test('account switching mid-export fails closed and produces no archive',async()=>{
 const s=store({'lambert_active_account_v1':owner});
 let reads=0;
 const lib={...library(),list:async()=>{reads++;if(reads===1)s.setItem('lambert_active_account_v1',other);return []}};
 await assert.rejects(createPortableSafetyArchive({storage:s,library:lib,owner}),/backup_account_changed/);
});
test('invalid drawing record fails without deleting or changing anything',async()=>{
 const s=store();
 await assert.rejects(createPortableSafetyArchive({storage:s,library:library([{id:'bad',xml:'<mxfile/>'}])}),/invalid_master_backup_data/);
 assert.equal(s.map.size,0);
});
