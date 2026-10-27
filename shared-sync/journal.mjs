import {prepareLocalImport} from './import-plan.mjs';
import {DOCUMENT_KEYS} from './document-keys.mjs';
export const DATA_KEYS=['tasks','projects','daily_reviews_v2',...DOCUMENT_KEYS];
export const ACTIVE_KEY='lambert_active_account_v1';
export const kindFor=k=>DOCUMENT_KEYS.includes(k)?'documents':k==='daily_reviews_v2'?'reviews':k;
const keyFor=(kind,id)=>JSON.stringify([kind,id]);
const copy=v=>structuredClone(v);
export const stable=v=>JSON.stringify(sort(v));
function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
export class WorkspaceJournal {
  constructor(storage,userId,{uuid=()=>crypto.randomUUID(),clock=()=>Date.now()}={}){
    if(!/^[0-9a-f-]{36}$/i.test(userId))throw Error('invalid_user');
    this.storage=storage;this.userId=userId;this.prefix='lambert_workspace_v1:'+userId+':';this.uuid=uuid;this.clock=clock;this.views=new Map();
  }
  load(key,fallback){const raw=this.storage.getItem(this.prefix+key);return raw===null?copy(fallback):JSON.parse(raw);}
  save(key,value){this.storage.setItem(this.prefix+key,JSON.stringify(value));}
  batches(){const rows=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(this.prefix+'batch:'))rows.push({key:k,ops:JSON.parse(this.storage.getItem(k))});}return rows.sort((a,b)=>a.key.localeCompare(b.key));}
  nextBatchKey(){const last=this.batches().reduce((n,b)=>Math.max(n,Number(b.key.slice((this.prefix+'batch:').length).split(':')[0])||0),0);return 'batch:'+String(Math.max(this.clock()*1000,last+1)).padStart(16,'0')+':'+this.uuid();}
  entries(){const map=new Map(this.load('base',[]).map(r=>[keyFor(r.kind,r.item_id),copy(r)]));
    for(const batch of this.batches())for(const op of batch.ops){const key=keyFor(op.kind,op.itemId);map.set(key,{kind:op.kind,item_id:op.itemId,payload:copy(op.payload),version:op.expectedVersion+1,deleted_at:op.deleted?'local':null});}
    return map;
  }
  read(key,fallback){if(!DATA_KEYS.includes(key))return fallback;const kind=kindFor(key);const rows=this.views.has(key)?[...this.views.get(key).values()]:[...this.entries().values()].filter(r=>r.kind===kind&&(kind!=='documents'||r.item_id===key));if(!this.views.has(key))this.views.set(key,new Map(rows.map(r=>[r.item_id,copy(r)])));
    if(kind==='documents'){const row=rows.find(r=>!r.deleted_at);return row?copy(row.payload.value):copy(fallback);}
    return kind==='reviews'?Object.fromEntries(rows.filter(r=>!r.deleted_at).map(r=>[r.item_id,copy(r.payload)])):rows.filter(r=>!r.deleted_at).map(r=>copy(r.payload));
  }
  changesFor(key,value){
    if(!DATA_KEYS.includes(key))throw Error('unsupported_key');
    if(!this.views.has(key))this.read(key,key==='daily_reviews_v2'?{}:[]);
    const before=this.views.get(key),snapshot={[key]:value};
    const next=prepareLocalImport(snapshot).filter(r=>r.kind===kindFor(key));
    const map=new Map(next.map(r=>[r.itemId,r]));const changes=[];
    for(const [id,row] of map){const old=before.get(id);if(!old||old.deleted_at||stable(old.payload)!==stable(row.payload))changes.push({kind:row.kind,itemId:id,payload:row.payload,expectedVersion:old?.version||0,deleted:false,mutationId:this.uuid()});}
    for(const [id,row] of before){if(!row.deleted_at&&!map.has(id))changes.push({kind:row.kind,itemId:id,payload:row.payload,expectedVersion:row.version,deleted:true,mutationId:this.uuid()});}
    if(!changes.length)return [];
    const blocked=new Set(this.conflicts().map(op=>keyFor(op.kind,op.itemId)));
    const rejected=changes.find(op=>blocked.has(keyFor(op.kind,op.itemId)));if(rejected){const error=Error('此记录有同步冲突，请先在账户中处理');error.kind=rejected.kind;error.itemId=rejected.itemId;throw error;}
    return changes;
  }
  write(key,value){this.writeMany({[key]:value});}
  writeMany(values){
    const changes=Object.entries(values).flatMap(([key,value])=>this.changesFor(key,value));
    if(!changes.length)return;
    // One storage write durably commits the whole local edit before callers report success.
    this.save(this.nextBatchKey(),changes);
    // Keep each page's rendered snapshot stable until refresh. Background reads
    // must not advance versions underneath stale form/state objects.
    for(const op of changes){const key=op.kind==='documents'?op.itemId:op.kind==='reviews'?'daily_reviews_v2':op.kind;this.views.get(key).set(op.itemId,{kind:op.kind,item_id:op.itemId,payload:copy(op.payload),version:op.expectedVersion+1,deleted_at:op.deleted?'local':null});}
  }
  mergeRemote(rows){const map=new Map(this.load('base',[]).map(r=>[keyFor(r.kind,r.item_id),r]));for(const row of rows){if(row.user_id!==this.userId)throw Error('account_mismatch');const key=keyFor(row.kind,row.item_id);if((map.get(key)?.version||0)<=row.version)map.set(key,copy(row));}this.save('base',[...map.values()]);}
  pending(){return this.batches().flatMap(b=>b.ops).filter(op=>!op.conflict);}
  conflicts(){return this.batches().flatMap(b=>b.ops).filter(op=>op.conflict);}
  acknowledge(batchKey,mutationId,response){
    if(response.status==='applied')this.mergeRemote([response.record]);
    else if(response.status!=='conflict')throw Error('invalid_sync_response');
    const ops=JSON.parse(this.storage.getItem(batchKey)||'[]');
    const next=response.status==='applied'?ops.filter(op=>op.mutationId!==mutationId):ops.map(op=>op.mutationId===mutationId?{...op,conflict:response.record||{version:0}}:op);
    if(next.length)this.storage.setItem(batchKey,JSON.stringify(next));else this.storage.removeItem(batchKey);
  }
  resolve(kind,itemId,choice){
    const batches=this.batches();const all=batches.flatMap(b=>b.ops).filter(op=>op.kind===kind&&op.itemId===itemId);if(!all.some(op=>op.conflict))throw Error('conflict_missing');
    // Resolution is itself a durable journal batch; old conflicting mutations are only removed afterwards.
    const remote=all.find(op=>op.conflict).conflict;const latest=all[all.length-1];
    if(remote.user_id)this.mergeRemote([remote]);
    if(choice==='local')this.save(this.nextBatchKey(),[{...latest,conflict:undefined,expectedVersion:remote.version||0,mutationId:this.uuid(),resolves:all.map(op=>op.mutationId)}]);
    else if(choice!=='remote')throw Error('invalid_resolution');
    for(const b of batches){const next=b.ops.filter(op=>op.kind!==kind||op.itemId!==itemId);if(next.length)this.storage.setItem(b.key,JSON.stringify(next));else this.storage.removeItem(b.key);}
    this.views.clear();
  }
}
