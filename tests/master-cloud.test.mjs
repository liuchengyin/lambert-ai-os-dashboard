import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncMasterCloud} from '../shared-sync/master-cloud.mjs';

const user='a12b3456-1234-4234-8234-123456789abc';
const other='b12b3456-1234-4234-8234-123456789abc';
const id='master-12345678-1234-4234-8234-123456789abc';
const file={id,title:'履约图纸',xml:'<mxfile></mxfile>',sourceVersion:1,createdAt:'2026-11-01T00:00:00.000Z',updatedAt:'2026-11-02T00:00:00.000Z'};
function library(files=[],removed=[]){
 const entries=new Map(files.map(f=>[f.id,structuredClone(f)]));
 const trash=new Map(removed.map(f=>[f.id,structuredClone(f)]));
 return {entries,trash,validateRecord:f=>f&&typeof f.id==='string'&&typeof f.xml==='string'&&typeof f.updatedAt==='string',
 list:async deleted=>structuredClone([...((deleted?trash:entries).values())]),
 importCloud:async f=>{if(!entries.has(f.id)&&!trash.has(f.id))entries.set(f.id,structuredClone(f));}
 };
}
function service(){
 const objs=new Map(),puts=[];
 const storage={
  list:async(prefix,{limit,offset})=>({data:[...objs.keys()].filter(k=>k.startsWith(prefix+'/')).sort().slice(offset,offset+limit).map(k=>({name:k.slice(prefix.length+1)})),error:null}),
  download:async path=>({data:new Blob([objs.get(path)],{type:'application/json'}),error:null}),
  upload:async (path,blob,options)=>{assert.equal(options.upsert,false);if(objs.has(path))return {error:{statusCode:409}};objs.set(path,await blob.text());puts.push(path);return {error:null};}
 };
 return {objs,puts,client:{storage:{from:name=>{assert.equal(name,'lambert-master-files');return storage;}}}};
}
const ctx=(svc,who=user)=>async()=>({client:svc.client,userId:who});
test('backup immutable drawing; repeated sync is idempotent; second browser restores exact record',async()=>{
 const svc=service(),first=library([file]),second=library();
 const a=await syncMasterCloud({library:first,mediaContext:ctx(svc)});
 assert.deepEqual([a.uploaded,a.imported,a.conflicts],[1,0,0]);
 const again=await syncMasterCloud({library:first,mediaContext:ctx(svc)});
 assert.deepEqual([again.uploaded,again.imported,again.conflicts],[0,0,0]);
 const recovered=await syncMasterCloud({library:second,mediaContext:ctx(svc)});
 assert.deepEqual([recovered.imported,recovered.conflicts],[1,0]);
 assert.deepEqual(second.entries.get(id),file);
 assert.equal(svc.puts.length,1);
});
test('two divergent versions are never overwritten; both cloud snapshots are retained',async()=>{
 const svc=service(),first=library([file]);
 await syncMasterCloud({library:first,mediaContext:ctx(svc)});
 const edited={...file,title:'第二台编辑版',updatedAt:'2026-11-04T00:00:00.000Z'};
 const second=library([edited]);
 const r=await syncMasterCloud({library:second,mediaContext:ctx(svc)});
 assert.equal(r.conflicts,1);assert.equal(r.uploaded,1);
 assert.deepEqual(second.entries.get(id),edited);
 assert.deepEqual(first.entries.get(id),file);
 assert.equal(svc.objs.size,2);
});
test('trashed local drawings are never resurrected from a cloud snapshot',async()=>{
 const svc=service(),first=library([file]);await syncMasterCloud({library:first,mediaContext:ctx(svc)});
 const second=library([],[file]);const r=await syncMasterCloud({library:second,mediaContext:ctx(svc)});
 assert.equal(r.skippedTrashed,1);assert.equal(r.imported,0);assert.equal(second.entries.size,0);
});
test('cross-account snapshots are rejected before any local change',async()=>{
 const svc=service(),source=library([file]);await syncMasterCloud({library:source,mediaContext:ctx(svc)});
 const first=[...svc.objs.keys()][0],val=svc.objs.get(first);
 svc.objs.set(other+'/'+first.split('/').pop(),val);
 const otherDevice=library();await assert.rejects(()=>syncMasterCloud({library:otherDevice,mediaContext:ctx(svc,other)}),/invalid_master_cloud_snapshot/);
 assert.equal(otherDevice.entries.size,0);
});
