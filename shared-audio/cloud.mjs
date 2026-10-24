export const BUCKET='lambert-audio-private',MAX_BYTES=25*1024*1024;
const safeCodes=new Set(['collection_full','audio_quota_exceeded','invalid_audio','track_not_found','collection_not_found','object_not_confirmed','invalid_note','invalid_progress','invalid_track_order','mutation_id_reused']);
export function audioError(error){const code=error?.message||'';return ({invalid_type:'仅支持 MP3、M4A、WAV 音频',empty_file:'不能导入空文件',too_large:'音频超过25 MiB限制',storage_blocked:'本机存储被其他页面占用，请关闭后重试',invalid_file:'无法读取文件，请重新选择',audio_login_required:'请先登录账户',account_mismatch:'账号已变化，请重新打开音频',audio_cloud_not_configured:'音频云库尚未配置，请先应用音频迁移',collection_full:'音频集已满（最多200条）',audio_quota_exceeded:'已达到本账户音频容量限制',file_too_large:'音频超过25 MiB限制',unsupported_audio:'文件无法播放，请检查格式',network_link_not_transferable:'链接无法转存，请检查跨域授权或下载文件后导入',object_not_confirmed:'云端文件尚未确认，请重试',note_conflict:'备注存在冲突，两个版本均已保留'})[code]||'操作未完成，原文件和本地草稿已保留，请重试';}
export class AudioCloud {
 constructor(access){this.access=access;}
 async context(userId){const ctx=await this.access();if(ctx.userId!==userId)throw Error('account_mismatch');return ctx;}
 async request(ctx,path,{method='GET',body,raw=false}={}){
  const response=await fetch(ctx.url+path,{method,headers:{apikey:ctx.publishableKey,Authorization:'Bearer '+ctx.accessToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok){if(['PGRST202','PGRST205','42P01','42883'].includes(data?.code))throw Error('audio_cloud_not_configured');if(safeCodes.has(data?.message))throw Error(data.message);const e=Error('cloud_request_failed');e.status=response.status;throw e;}
  return data;
 }
 rpc(ctx,name,body){return this.request(ctx,'/rest/v1/rpc/'+name,{method:'POST',body});}
 async read(userId){const c=await this.context(userId);const all=async(table,order)=>{const rows=[];for(let offset=0;;offset+=500){const page=await this.request(c,`/rest/v1/${table}?select=*&order=${order}&limit=500&offset=${offset}`);if(!Array.isArray(page))throw Error('cloud_request_failed');rows.push(...page);if(page.length<500)return rows;}};return {collections:await all('lambert_audio_collections','created_at.asc,id.asc'),tracks:await all('lambert_audio_tracks','collection_id.asc,sort_order.asc,id.asc')};}
 async collection(userId,record,title){const c=await this.context(userId);return this.rpc(c,'lambert_audio_collection',{p_id:record?.id||crypto.randomUUID(),p_title:title,p_version:record?.version||0});}
 async rename(userId,track,title){return this.rpc(await this.context(userId),'lambert_audio_title',{p_id:track.id,p_title:title,p_version:track.meta_version});}
 async reorder(userId,collection,ids){return this.rpc(await this.context(userId),'lambert_audio_reorder',{p_collection:collection.id,p_ids:ids,p_version:collection.version});}
 async note(userId,draft){return this.rpc(await this.context(userId),'lambert_audio_note',{p_mutation:draft.mutationId,p_id:draft.trackId,p_text:draft.text,p_version:draft.baseVersion});}
 async progress(userId,track,value){return this.rpc(await this.context(userId),'lambert_audio_progress',{p_id:track.id,p_position:value.position,p_rate:value.rate,p_version:value.baseVersion});}
 async signed(userId,tracks){
  const c=await this.context(userId),paths=tracks.map(t=>t.storage_path);
  const result=await this.request(c,'/storage/v1/object/sign/'+BUCKET,{method:'POST',body:{paths,expiresIn:86400}});
  return result.map((r,i)=>({id:tracks[i].id,title:tracks[i].title,url:r.signedURL?(c.url+'/storage/v1'+r.signedURL):null,position:tracks[i].position||0}));
 }
 async upload(job,file,progress){
  if(!file||file.size>MAX_BYTES)throw Error('file_too_large');
  const mime=({mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav'})[file.name.split('.').pop().toLowerCase()];if(!mime)throw Error('unsupported_audio');
  const duration=await probeAudio(file);
  const ctx=await this.context(job.userId);
  const track=await this.rpc(ctx,'lambert_audio_reserve',{p_id:job.id,p_collection:job.collectionId,p_title:job.title||job.name||file.name,p_filename:file.name,p_mime:mime,p_bytes:file.size,p_sha256:job.sha256||job.hash});
  job.reserved=true;job.trackId=track.id;if(this.onReserved)await this.onReserved(job);
  if(track.status==='ready')return {ready:true,trackId:track.id};
  const path=BUCKET+'/'+track.storage_path.split('/').map(encodeURIComponent).join('/');
  const info=async()=>{try{return await this.request(ctx,'/storage/v1/object/info/authenticated/'+path);}catch(e){if([400,404].includes(e.status))return null;throw e;}};
  let existing=await info();
  if(!existing){
   await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',ctx.url+'/storage/v1/object/'+path);xhr.timeout=180000;xhr.setRequestHeader('apikey',ctx.publishableKey);xhr.setRequestHeader('Authorization','Bearer '+ctx.accessToken);xhr.setRequestHeader('Content-Type',mime);xhr.setRequestHeader('x-upsert','false');xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(e.loaded/e.total);};xhr.onload=()=>xhr.status>=200&&xhr.status<300||xhr.status===409?resolve():reject(Error('upload_failed'));xhr.onerror=xhr.ontimeout=()=>reject(Error('upload_interrupted'));xhr.send(file);});
   existing=await info();
  }
  if(Number(existing?.size??existing?.metadata?.size)!==file.size)throw Error('object_not_confirmed');
  const confirmed=await this.rpc(ctx,'lambert_audio_confirm',{p_id:track.id,p_duration:duration});
  if(confirmed.status!=='ready')throw Error('object_not_confirmed');
  return {ready:true,trackId:confirmed.id};
 }
}
export function probeAudio(file){return new Promise((resolve,reject)=>{
 const a=document.createElement('audio'),url=URL.createObjectURL(file);let timer;
 const finish=(error,value)=>{clearTimeout(timer);a.onloadedmetadata=a.onerror=null;a.removeAttribute('src');a.load();URL.revokeObjectURL(url);error?reject(error):resolve(value);};
 a.onloadedmetadata=()=>Number.isFinite(a.duration)&&a.duration>0?finish(null,a.duration):finish(Error('unsupported_audio'));
 a.onerror=()=>finish(Error('unsupported_audio'));timer=setTimeout(()=>finish(Error('unsupported_audio')),15000);a.preload='metadata';a.src=url;
});}
export async function downloadAudioLink(raw){
 let url;try{url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{throw Error('network_link_not_transferable');}
 try{
  const r=await fetch(url.href,{credentials:'omit',signal:AbortSignal.timeout(30000)});if(!r.ok||!r.body||Number(r.headers.get('Content-Length'))>MAX_BYTES)throw Error();
  const reader=r.body.getReader(),parts=[];let bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_BYTES)throw Error('file_too_large');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
  let name=decodeURIComponent(url.pathname.split('/').pop()||'audio.mp3');if(!/\.(mp3|m4a|wav)$/i.test(name))name+='.'+({'audio/mp4':'m4a','audio/wav':'wav','audio/x-wav':'wav'}[r.headers.get('Content-Type')?.split(';')[0]]||'mp3');
  const file=new File(parts,name,{type:r.headers.get('Content-Type')||'audio/mpeg'});await probeAudio(file);return file;
 }catch(error){if(error.message==='file_too_large')throw error;throw Error('network_link_not_transferable');}
}
