import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planMissingMasterRecovery} from '../shared-sync/portable-recover.mjs';
const ids=['master-12345678-1234-4234-8234-123456789abc','master-22345678-1234-4234-8234-123456789abc','master-32345678-1234-4234-8234-123456789abc'];
const f=(i,title='流程')=>({id:ids[i],title,xml:'<mxfile/>',sourceVersion:1,createdAt:'2026-11-01',updatedAt:'2026-11-07'});
const valid=x=>x?.id?.startsWith('master-')&&typeof x?.xml==='string';
const plan=(files,trash,localFiles=[],localTrash=[])=>planMissingMasterRecovery({master:{files,trash}},{localFiles,localTrash,validateDrawing:valid});
test('missing-only backup restore keeps source IDs and preserves trash state',()=>{
 const x=plan([f(0)],[f(1)],[],[]);
 assert.equal(x.toAdd,2);assert.deepEqual(x.missingFiles,[f(0)]);assert.deepEqual(x.missingTrash,[f(1)]);
});
test('same ID does not overwrite local edits or resurrect trashed record',()=>{
 const x=plan([f(0,'备份版'),f(1)],[f(2)],[f(0,'本机更新版')],[f(1),f(2)]);
 assert.equal(x.toAdd,0);assert.equal(x.conflicts,2);assert.equal(x.unchanged,1);
});
test('identical files are idempotent',()=>{const x=plan([f(0)],[],[f(0)]);assert.equal(x.toAdd,0);assert.equal(x.unchanged,1);});
test('cross-store duplicate source IDs are rejected',()=>{
 assert.throws(()=>plan([f(0)],[f(0)]),/invalid_master_recovery_records/);
});
test('existing source ID in both live and trash fails closed',()=>{
 assert.throws(()=>plan([f(1)],[],[f(0)],[f(0)]),/local_master_id_exists_in_multiple_stores/);
});
