import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectPortableSafetyArchive} from '../shared-sync/portable-verify.mjs';
const owner='a12b3456-1234-4234-8234-123456789abc',other='b12b3456-1234-4234-8234-123456789abc';
const draw={id:'master-12345678-1234-4234-8234-123456789abc',title:'流程',xml:'<mxfile/>',sourceVersion:0,createdAt:'2026-11-07',updatedAt:'2026-11-07'};
function backup(uid=owner){return {format:'lambert-portable-safety-v1',owner:uid,createdAt:'2026-11-07T00:00:00.000Z',
 workspace:{format:'lambert-local-backup-v2',raw:{tasks:'[]',projects:null},account:uid?{userId:uid,rawStorage:{['lambert_workspace_v1:'+uid+':base']:'[]'}}:null},
 master:{files:[draw],trash:[]},counts:{masterFiles:1,masterTrash:0}};}
const check=x=>!!(x&&x.id&&x.xml);
test('read-only preview validates owner-scoped backup',()=>{
 const p=inspectPortableSafetyArchive(backup(),{expectedOwner:owner,validateDrawing:check});
 assert.equal(p.verified,true);assert.equal(p.masterFiles,1);assert.equal(p.safeToImport,false);
});
test('guest backup accepted only in local guest mode',()=>{
 const p=inspectPortableSafetyArchive(backup(null),{expectedOwner:'',validateDrawing:check});
 assert.equal(p.guestRows,1);assert.equal(p.owner,null);
});
test('rejects different account and cross-owner private paths',()=>{
 assert.throws(()=>inspectPortableSafetyArchive(backup(),{expectedOwner:other,validateDrawing:check}),/不一致/);
 const bad=backup();bad.workspace.account.rawStorage['lambert_workspace_v1:'+other+':base']='[]';
 assert.throws(()=>inspectPortableSafetyArchive(bad,{expectedOwner:owner,validateDrawing:check}),/其他账号/);
});
test('rejects malformed backup, changed counts, duplicate IDs, invalid XML',()=>{
 const mismatch=backup();mismatch.counts.masterFiles=999;
 assert.throws(()=>inspectPortableSafetyArchive(mismatch,{expectedOwner:owner,validateDrawing:check}),/数量/);
 const duplicate=backup();duplicate.master.trash=[draw];duplicate.counts.masterTrash=1;
 assert.throws(()=>inspectPortableSafetyArchive(duplicate,{expectedOwner:owner,validateDrawing:check}),/重复 ID/);
 assert.throws(()=>inspectPortableSafetyArchive(backup(),{expectedOwner:owner,validateDrawing:()=>false}),/图纸内容/);
 assert.throws(()=>inspectPortableSafetyArchive({}, {expectedOwner:owner,validateDrawing:check}),/不是受支持/);
});
