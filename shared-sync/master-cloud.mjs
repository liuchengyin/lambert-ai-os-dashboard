// Manual, non-destructive DrawMaster cloud snapshots. Never overwrites or deletes a
// local drawing, cloud object, trash entry or historical revision.
const BUCKET='lambert-master-files';
const FILE=/^(master-[a-f0-9-]{36}|legacy-drawio-v1)--[a-f0-9]{64}\.json$/i;
const MAX=200;
const fail=(error)=>{if(error)throw Error(error.message||'master_cloud_unavailable');};
const bytes=async content=>new TextEncoder().encode(content);
const digest=async content=>{
 const hash=await crypto.subtle.digest('SHA-256',await bytes(content));
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const asJSON=async blob=>JSON.parse(await blob.text());
const snapshot=(userId,file)=>({format:'lambert-master-cloud-v1',userId,file});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export async function syncMasterCloud({library,mediaContext}){
 if(!library||typeof mediaContext!=='function')throw Error('missing_master_dependencies');
 const {client,userId}=await mediaContext();
 if(!/^[0-9a-f-]{36}$/i.test(userId))throw Error('invalid_master_owner');
 const storage=client.storage.from(BUCKET);
 const before=await library.list(false),trash=await library.list(true);
 const local=new Map(before.map(f=>[f.id,f]));
 const removed=new Set(trash.map(f=>f.id));
 const cloud=[];
 for(let offset=0;offset<MAX;offset+=100){
  const response=await storage.list(userId,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
  fail(response.error);
  const page=response.data||[];
  if(page.some(x=>!FILE.test(x.name)))throw Error('unexpected_master_cloud_objects');
  cloud.push(...page);
  if(page.length<100)break;
  if(offset+100>=MAX)throw Error('master_cloud_limit_reached');
 }
 const known=new Set(cloud.map(x=>x.name));
 const latest=new Map();
 for(const entry of cloud){
  const downloaded=await storage.download(userId+'/'+entry.name);
  fail(downloaded.error);
  const data=await asJSON(downloaded.data);
  if(data?.format!=='lambert-master-cloud-v1'||data.userId!==userId||!library.validateRecord(data.file))throw Error('invalid_master_cloud_snapshot');
  const body=JSON.stringify(snapshot(userId,data.file)),hash=await digest(body);
  if(entry.name!==data.file.id+'--'+hash+'.json')throw Error('master_cloud_integrity_check_failed');
  const prior=latest.get(data.file.id);
  if(!prior||prior.updatedAt<data.file.updatedAt)latest.set(data.file.id,data.file);
 }
 let uploaded=0,imported=0,conflicts=0,skippedTrashed=0,existing=0;
 // Conflict is detected against the original remote set before uploading, never
 // silently resolved by the subsequent immutable snapshot upload.
 for(const [id,remote] of latest){
  if(removed.has(id)){skippedTrashed++;continue;}
  const original=local.get(id);
  if(!original){
   await library.importCloud(remote);imported++;
  }else if(!same(original,remote))conflicts++;
 }
 for(const file of before){
  const body=JSON.stringify(snapshot(userId,file)),hash=await digest(body),name=file.id+'--'+hash+'.json';
  if(known.has(name)){existing++;continue;}
  const response=await storage.upload(userId+'/'+name,new Blob([body],{type:'application/json'}),{contentType:'application/json',upsert:false,cacheControl:'0'});
  // Concurrent uploads of the same immutable content may return duplicate conflict.
  if(response.error&&response.error.statusCode!==409&&response.error.status!==409)fail(response.error);
  else if(!response.error)uploaded++;
 }
 return {uploaded,imported,conflicts,skippedTrashed,existing,remoteSnapshots:cloud.length};
}
