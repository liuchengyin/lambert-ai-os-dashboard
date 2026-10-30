// Separate owner-scoped binary cache: no rewrites of existing notes or task stores.
export const LIMIT=7;
export const MAX_BYTES=50*1024*1024;
export function createBookStore({owner=window.LambertPrivateStorage,cloud=()=>window.LambertAccount.mediaContext(),indexedDB=window.indexedDB}={}){
 const ownerId=owner?.owner||'',identity=owner;
 const assert=()=>{if(typeof window!=='undefined'&&window.LambertPrivateStorage!==identity)throw Error('账户已变化，请重新打开页面');identity?.assertOwner();};
 const name=owner?owner.databaseName('lambert_reading_books_v1'):'lambert_reading_books_v1';
 let opened;const checkpoints=new Map();
 function db(){assert();return opened||=new Promise((resolve,reject)=>{const req=indexedDB.open(name,1);req.onupgradeneeded=()=>{req.result.createObjectStore('books',{keyPath:'id'});};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('请关闭其他旧版阅读页面后重试'));req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};});}
 async function tx(mode,run){const database=await db();assert();return new Promise((resolve,reject)=>{const t=database.transaction('books',mode);let value;t.oncomplete=()=>{try{assert();resolve(value);}catch(e){reject(e);}};t.onabort=()=>reject(t.error||Error('本机保存失败，空间可能不足'));t.onerror=()=>{};try{run(t.objectStore('books'),v=>value=v,t);}catch(e){t.abort();reject(e);}});}
 const list=()=>tx('readonly',(s,done)=>{s.getAll().onsuccess=e=>done(e.target.result.sort((a,b)=>a.slot-b.slot));});
 const get=id=>tx('readonly',(s,done)=>{s.get(id).onsuccess=e=>done(e.target.result);});
 const put=row=>tx('readwrite',s=>s.put(row));
 const context=async()=>{assert();const c=await cloud();assert();if(c.userId!==ownerId)throw Error('账户已变化，请重新打开页面');return c;};
 const result=async p=>{const r=await p;assert();if(r.error)throw r.error;return r.data;};
 async function add(file){
  if(!/\.pdf$/i.test(file.name)||file.size>MAX_BYTES||!file.size)throw Error('请选择 50 MB 以内的 PDF 文件');
  if(new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw Error('文件不是有效 PDF');
  const row={id:crypto.randomUUID(),title:file.name.replace(/\.pdf$/i,'').slice(0,200),page:1,blob:file,sync:'local',created_at:new Date().toISOString()};
  await tx('readwrite',(s,done,t)=>{s.getAll().onsuccess=e=>{const used=new Set(e.target.result.map(b=>b.slot));row.slot=Array.from({length:LIMIT},(_,i)=>i).find(i=>!used.has(i));if(row.slot===undefined){t.abort();return;}s.add(row);done(row);};});return row;
 }
 async function upload(id){
  let row=await get(id);if(!row?.blob)throw Error('本机文件不存在');
  const {client,userId}=await context();
  // Reserve a slot before uploading; database uniqueness enforces seven across devices.
  const remote=await result(client.from('lambert_books').select('*').eq('user_id',userId));
  const existing=remote.find(b=>b.id===id);let record=existing;
  if(!record){
   const used=new Set(remote.map(b=>b.slot));const slot=Array.from({length:LIMIT},(_,i)=>i).find(i=>!used.has(i));
   if(slot===undefined)throw Error('云端书架已满 7 本，请先移除一本');
   record={user_id:userId,id:row.id,slot,title:row.title,page:row.page,object_path:`${userId}/${id}.pdf`};
   await result(client.from('lambert_books').insert(record));
  }
  // Existing reservations are retried without replacing any remote file.
  await put({...row,...record,sync:'local'});
  const download=await client.storage.from('lambert-books').download(record.object_path);assert();
  if(download.error)await result(client.storage.from('lambert-books').upload(record.object_path,row.blob,{contentType:'application/pdf',upsert:false}));
  await result(client.from('lambert_books').update({file_ready:true}).eq('user_id',userId).eq('id',id));
  row={...row,...record,file_ready:true,sync:'cloud'};await put(row);return row;
 }
 async function refresh(){
  if(!ownerId)return list();
  for(const b of await list())if(b.progressPending&&b.sync==='cloud')await checkpoint(b.id,b.page);
  const {client,userId}=await context();const remote=await result(client.from('lambert_books').select('*').eq('user_id',userId).order('slot'));
  await tx('readwrite',(s)=>{s.getAll().onsuccess=e=>{
   const local=e.target.result;
   for(const b of local)if(b.sync==='cloud'&&!remote.some(r=>r.id===b.id))s.delete(b.id);
   const taken=new Set(remote.map(r=>r.slot));
   for(const r of remote){const old=local.find(b=>b.id===r.id);s.put({...r,page:old?.progressPending?old.page:r.page,progressPending:old?.progressPending,blob:old?.blob,sync:old?.blob?(r.file_ready?'cloud':'local'):'remote'});}
   for(const b of local.filter(b=>b.sync==='local'&&!remote.some(r=>r.id===b.id))){const slot=Array.from({length:LIMIT},(_,i)=>i).find(i=>!taken.has(i));if(slot!==undefined){taken.add(slot);s.put({...b,slot});}/* preserve unsynced originals even when cloud is full */}
  };});return list();
 }
 async function blob(id){let row=await get(id);if(!row)throw Error('书籍不存在');if(row.blob)return row.blob;const {client}=await context();if(!row.file_ready)throw Error('这本书的上传尚未完成，请在原设备重试上传');const file=await result(client.storage.from('lambert-books').download(row.object_path));await put({...row,blob:file,sync:'cloud'});return file;}
 function checkpoint(id,page){const run=()=>saveCheckpoint(id,page);const next=(checkpoints.get(id)||Promise.resolve()).catch(()=>{}).then(run);checkpoints.set(id,next);return next;}
 async function saveCheckpoint(id,page){const row=await get(id);if(!row)return;page=Math.max(1,Math.floor(page)||1);await put({...row,page,progressPending:true});if(row.sync!=='local'){const {client,userId}=await context();await result(client.from('lambert_books').update({page}).eq('user_id',userId).eq('id',id));const latest=await get(id);if(latest?.page===page)await put({...latest,progressPending:false});}}
 async function remove(id){const row=await get(id);if(!row)return;if(row.sync!=='local'||row.object_path){const {client,userId}=await context();await result(client.from('lambert_books').delete().eq('user_id',userId).eq('id',id));await result(client.storage.from('lambert-books').remove([row.object_path]));}await tx('readwrite',s=>s.delete(id));}
 return {list,get,add,upload,refresh,blob,checkpoint,remove,ownerId};
}
