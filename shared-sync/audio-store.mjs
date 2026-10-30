// Independent, device-local database. Never migrate or rewrite V1/localStorage.
export const DB_NAME='lambert_english_audio_v2';
export const DB_VERSION=1;
const dbOwners=new WeakMap();
const currentOwner=()=>typeof window==='undefined'?null:window.LambertPrivateStorage||null;
function assertDatabaseOwner(db){const owner=dbOwners.get(db);if(owner!==currentOwner())throw Error('account_changed');owner?.assertOwner();}
export function openAudioDatabase(){
  const owner=currentOwner();owner?.assertOwner();
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(owner?owner.databaseName(DB_NAME):DB_NAME,DB_VERSION);let abandoned=false;
    request.onupgradeneeded=()=>{
      const db=request.result;
      try{if(owner!==currentOwner())throw Error('account_changed');owner?.assertOwner();}catch(error){db.close();reject(error);return;}
      const tracks=db.objectStoreNames.contains('tracks')?request.transaction.objectStore('tracks'):db.createObjectStore('tracks',{keyPath:'id'});
      if(!tracks.indexNames.contains('updatedAt'))tracks.createIndex('updatedAt','updatedAt');
      for(const [name,keyPath] of [['blobs','trackId'],['settings','id'],['transcripts','trackId']]){
        if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath});
      }
      // Reserved contracts, no AI requests or note migration in V2.1.
      const notes=db.objectStoreNames.contains('notes')?request.transaction.objectStore('notes'):db.createObjectStore('notes',{keyPath:'id'});
      if(!notes.indexNames.contains('trackId'))notes.createIndex('trackId','trackId');
    };
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>{abandoned=true;reject(Error('database_blocked'));};
    request.onsuccess=()=>{
      const db=request.result;
      try{if(owner!==currentOwner())throw Error('account_changed');owner?.assertOwner();}catch(error){db.close();reject(error);return;}
      if(abandoned){db.close();return;}
      if(!['tracks','blobs','settings','transcripts','notes'].every(name=>db.objectStoreNames.contains(name))){db.close();reject(Error('incomplete_schema'));return;}
      dbOwners.set(db,owner);db.onversionchange=()=>db.close();resolve(db);
    };
  });
}
function transaction(db,stores,mode,run){
  return new Promise((resolve,reject)=>{
    try{assertDatabaseOwner(db);}catch(error){reject(error);return;}
    const tx=db.transaction(stores,mode);let result;
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(tx.error||Error('storage_failed'));
    tx.onerror=()=>{}; // onabort preserves transaction atomicity on quota errors.
    try{run(tx,value=>{result=value;});}catch(error){tx.abort();reject(error);}
  });
}
export function listTracks(db){return transaction(db,['tracks','settings'],'readonly',(tx,done)=>{
  let tracks=[],activeTrackId=null;
  const finish=()=>done({tracks,activeTrackId});
  tx.objectStore('tracks').getAll().onsuccess=e=>{tracks=e.target.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));finish();};
  tx.objectStore('settings').get('workspace').onsuccess=e=>{activeTrackId=e.target.result?.activeTrackId||null;finish();};
});}
export function readBlob(db,id){return transaction(db,['blobs'],'readonly',(tx,done)=>{
  tx.objectStore('blobs').get(id).onsuccess=e=>done(e.target.result?.blob);
});}
export function addTrack(db,track,blob){return transaction(db,['tracks','blobs','settings'],'readwrite',tx=>{
  tx.objectStore('tracks').add(track);
  if(blob)tx.objectStore('blobs').add({trackId:track.id,blob});
  tx.objectStore('settings').put({id:'workspace',activeTrackId:track.id});
});}
export function selectTrack(db,id){return transaction(db,['settings'],'readwrite',tx=>{
  tx.objectStore('settings').put({id:'workspace',activeTrackId:id});
});}
export function checkpoint(db,id,position,rate,duration){return transaction(db,['tracks'],'readwrite',tx=>{
  const store=tx.objectStore('tracks');
  store.get(id).onsuccess=e=>{
    const track=e.target.result;if(!track)return;
    store.put({...track,position:Number.isFinite(position)?Math.max(0,position):0,rate,
      duration:Number.isFinite(duration)?duration:track.duration,updatedAt:new Date().toISOString()});
  };
});}

// Count and writes share the same transaction, including concurrent tabs.
export function addTracks(db,entries){
  if(!Array.isArray(entries)||!entries.length||entries.length>200)return Promise.reject(Error('audio_limit'));
  return transaction(db,['tracks','blobs','settings'],'readwrite',(tx)=>{
    const tracks=tx.objectStore('tracks');
    tracks.count().onsuccess=e=>{
      try{
      if(e.target.result+entries.length>200){tx.abort();return;}
      for(const {track,blob} of entries){tracks.add(track);if(blob)tx.objectStore('blobs').add({trackId:track.id,blob});}
      tx.objectStore('settings').put({id:'workspace',activeTrackId:entries[0].track.id});
      }catch{tx.abort();}
    };
  });
}
export function updateTrack(db,id,patch){
  const fields=['title','collection','note','loop','a','b','nativeReady','completed','listenedSeconds'];
  return transaction(db,['tracks'],'readwrite',tx=>{
    const store=tx.objectStore('tracks');store.get(id).onsuccess=e=>{
      if(!e.target.result){tx.abort();return;}
      const row={...e.target.result};for(const k of fields)if(Object.hasOwn(patch,k))row[k]=patch[k];
      row.updatedAt=new Date().toISOString();store.put(row);
    };
  });
}
