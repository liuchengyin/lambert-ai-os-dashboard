const NAME='lambert_audio_library_v1';
const emergency='lambert_audio_note_emergency_v1:';
export async function openLibraryStore(){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(NAME,1);let abandoned=false;r.onupgradeneeded=()=>{for(const name of ['jobs','files','snapshots','drafts','progress']){const s=r.result.createObjectStore(name,{keyPath:'id'});s.createIndex('userId','userId');}};r.onerror=()=>reject(r.error);r.onblocked=()=>{abandoned=true;reject(Error('storage_blocked'));};r.onsuccess=()=>{if(abandoned){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};});
 const run=(names,mode,fn)=>new Promise((resolve,reject)=>{const tx=db.transaction(names,mode);let value;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('local_storage_failed'));tx.onerror=()=>{};try{fn(tx,v=>{value=v;});}catch(e){tx.abort();reject(e);}});
 const put=(name,row)=>run([name],'readwrite',tx=>tx.objectStore(name).put(row));
 const get=(name,id)=>run([name],'readonly',(tx,done)=>{tx.objectStore(name).get(id).onsuccess=e=>done(e.target.result);});
 const list=(name,userId)=>run([name],'readonly',(tx,done)=>{tx.objectStore(name).index('userId').getAll(userId).onsuccess=e=>done(e.target.result);});
 const key=(u,t)=>u+':'+t;
 return {
  close:()=>db.close(),
  list:userId=>list('jobs',userId),
  stage:(job,file)=>run(['jobs','files'],'readwrite',tx=>{tx.objectStore('jobs').put(job);tx.objectStore('files').put({id:job.id,userId:job.userId,file});}),
  save:job=>put('jobs',job),
  readFile:async job=>{const r=await get('files',job.id);return r?.userId===job.userId?r.file:null;},
  snapshot:async userId=>(await get('snapshots',userId))?.value,
  saveSnapshot:(userId,value)=>put('snapshots',{id:userId,userId,value}),
  drafts:async userId=>{
   const rows=await list('drafts',userId),out=new Map(rows.map(r=>[r.trackId,r]));
   try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k.startsWith(emergency+userId+':'))continue;const r=JSON.parse(localStorage.getItem(k));if(!out.has(r.trackId)||out.get(r.trackId).changedAt<r.changedAt)out.set(r.trackId,r);}}catch{}
   return [...out.values()];
  },
  saveDraft:async draft=>{const row={...draft,id:key(draft.userId,draft.trackId)};try{await put('drafts',row);return {durable:true};}catch{try{localStorage.setItem(emergency+row.id,JSON.stringify(row));return {durable:true,emergency:true};}catch{return {durable:false};}}},
  clearDraft:async (userId,trackId,mutationId)=>{
   const id=key(userId,trackId);
   await run(['drafts'],'readwrite',tx=>{const s=tx.objectStore('drafts');s.get(id).onsuccess=e=>{if(e.target.result?.mutationId===mutationId)s.delete(id);};});
   try{const k=emergency+id;if(JSON.parse(localStorage.getItem(k)||'null')?.mutationId===mutationId)localStorage.removeItem(k);}catch{}
  },
  saveProgress:(userId,trackId,value)=>put('progress',{...value,id:key(userId,trackId),userId,trackId}),
  progress:(userId,trackId)=>get('progress',key(userId,trackId))
 };
}
