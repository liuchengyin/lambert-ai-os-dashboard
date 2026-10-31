/* 画Master V2 file library. Account-scoped IndexedDB; legacy single-file import is non-destructive. */
(function(root){
'use strict';
const DRAW=root.LambertDrawioModel;
const DB='lambert_master_files_v2', LEGACY_ID='legacy-drawio-v1', MAX_TITLE=96;
function ownerCheck(){root.LambertPrivateStorage?.assertOwner?.();}
function dbName(){ownerCheck();return root.LambertPrivateStorage?.databaseName(DB)||DB;}
let dbPromise=null,activeName='';
function database(){
 const name=dbName();
 if(dbPromise&&activeName===name)return dbPromise;
 activeName=name;
 dbPromise=new Promise((resolve,reject)=>{
  let request;
  try{request=indexedDB.open(name,1);}catch(error){reject(error);return;}
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'id'});
   if(!db.objectStoreNames.contains('trash'))db.createObjectStore('trash',{keyPath:'id'});
   if(!db.objectStoreNames.contains('backups'))db.createObjectStore('backups',{keyPath:'id'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('indexeddb_open_failed'));
 }).catch(e=>{dbPromise=null;throw e;});
 return dbPromise;
}
function transaction(stores,mode,action){
 ownerCheck();
 return database().then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode);let output;
  tx.oncomplete=()=>resolve(output);
  tx.onerror=()=>reject(tx.error||Error('indexeddb_write_failed'));
  tx.onabort=()=>reject(tx.error||Error('indexeddb_transaction_aborted'));
  try{action(tx,v=>{output=v;});}catch(error){tx.abort();}
 }));
}
function makeId(){return 'master-'+crypto.randomUUID();}
const validTitle=t=>typeof t==='string'&&t.trim().length>0&&t.trim().length<=MAX_TITLE;
const validXml=s=>DRAW.validXml(s);
function validateRecord(x){
 return x&&typeof x.id==='string'&&/^(master-[0-9a-f-]{36}|legacy-drawio-v1)$/.test(x.id)&&
 validTitle(x.title)&&validXml(x.xml)&&Number.isSafeInteger(x.sourceVersion)&&x.sourceVersion>=0&&
 typeof x.createdAt==='string'&&typeof x.updatedAt==='string';
}
function makeFile(title,xml,sourceVersion=0){
 if(!validTitle(title)||!validXml(xml)||!Number.isSafeInteger(sourceVersion)||sourceVersion<0)throw Error('invalid_master_document');
 const now=new Date().toISOString();
 return {id:makeId(),title:title.trim(),xml,sourceVersion,createdAt:now,updatedAt:now};
}
async function list(trashed=false){
 const rows=await transaction([trashed?'trash':'files'],'readonly',(tx,output)=>{
  const req=tx.objectStore(trashed?'trash':'files').getAll();
  req.onsuccess=()=>output(req.result);
 });
 if(rows.some(x=>!validateRecord(x)))throw Error('invalid_file_library_records');
 return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
async function get(id){
 const result=await transaction(['files'],'readonly',(tx,output)=>{
  const req=tx.objectStore('files').get(id);req.onsuccess=()=>output(req.result||null);
 });
 if(result&&!validateRecord(result))throw Error('invalid_file_record');
 return result;
}
async function save(file){
 if(!validateRecord(file))throw Error('invalid_master_document');
 return transaction(['files','backups'],'readwrite',(tx)=>{
  const main=tx.objectStore('files'),backup=tx.objectStore('backups');
  const req=main.get(file.id);
  req.onsuccess=()=>{
   const prior=req.result;
   if(prior){
    if(!validateRecord(prior)){tx.abort();return;}
    backup.put(prior);
   }
   main.put({...file,updatedAt:new Date().toISOString(),createdAt:prior?.createdAt||file.createdAt});
  };
 });
}
async function rename(id,title){
 if(!validTitle(title))throw Error('invalid_master_title');
 return transaction(['files'],'readwrite',tx=>{
  const files=tx.objectStore('files'),req=files.get(id);
  req.onsuccess=()=>{if(!validateRecord(req.result)){tx.abort();return;}
   files.put({...req.result,title:title.trim(),updatedAt:new Date().toISOString()});};
 });
}
async function duplicate(id){
 const old=await get(id);if(!old)throw Error('missing_master_file');
 const newFile=makeFile(old.title+'（副本）',old.xml,old.sourceVersion);
 await save(newFile);return newFile;
}
async function trash(id){
 return transaction(['files','trash'],'readwrite',tx=>{
  const files=tx.objectStore('files'),bin=tx.objectStore('trash'),req=files.get(id);
  req.onsuccess=()=>{if(!validateRecord(req.result)){tx.abort();return;}
   bin.put({...req.result,deletedAt:new Date().toISOString()});files.delete(id);};
 });
}
async function restore(id){
 return transaction(['files','trash'],'readwrite',tx=>{
  const files=tx.objectStore('files'),bin=tx.objectStore('trash'),req=bin.get(id);
  req.onsuccess=()=>{if(!validateRecord(req.result)){tx.abort();return;}
   const {deletedAt,...file}=req.result;files.put(file);bin.delete(id);};
 });
}
async function migrateOld(){
 ownerCheck();
 const store=root.LambertPrivateStorage||localStorage;
 const result=DRAW.load(store);
 if(result.error)throw Error('legacy_master_unreadable');
 if(!result.exists)return {migrated:false,exists:false};
 const prior=await get(LEGACY_ID);
 if(prior)return {migrated:false,exists:true};
 const r=result.data,now=r.updatedAt||new Date().toISOString();
 const file={id:LEGACY_ID,title:'旧版画Master（已导入）',xml:r.xml,sourceVersion:r.sourceVersion,createdAt:now,updatedAt:now};
 if(!validateRecord(file))throw Error('legacy_master_invalid');
 await transaction(['files'],'readwrite',tx=>{
  const files=tx.objectStore('files'),req=files.get(LEGACY_ID);
  req.onsuccess=()=>{if(!req.result)files.add(file);};
 });
 // Original lambert_logistics_master_drawio_v1 is never overwritten or removed.
 return {migrated:true,exists:true};
}
root.LambertMasterLibrary=Object.freeze({DB,LEGACY_ID,validTitle,validateRecord,makeFile,list,get,save,rename,duplicate,trash,restore,migrateOld});
})(typeof window!=='undefined'?window:globalThis);
