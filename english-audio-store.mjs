// Independent, device-local database. Never migrate or rewrite V1/localStorage.
export const DB_NAME='lambert_english_audio_v2';
export const DB_VERSION=1;
export function openAudioDatabase(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      const tracks=db.createObjectStore('tracks',{keyPath:'id'});
      tracks.createIndex('updatedAt','updatedAt');
      db.createObjectStore('blobs',{keyPath:'trackId'});
      db.createObjectStore('settings',{keyPath:'id'});
      // Reserved contracts, no AI requests or note migration in V2.1.
      db.createObjectStore('transcripts',{keyPath:'trackId'});
      const notes=db.createObjectStore('notes',{keyPath:'id'});
      notes.createIndex('trackId','trackId');
    };
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('database_blocked'));
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
  });
}
function transaction(db,stores,mode,run){
  return new Promise((resolve,reject)=>{
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
