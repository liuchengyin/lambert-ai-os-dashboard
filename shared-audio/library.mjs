import {openLibraryStore} from './local-store.mjs';
import {AudioCloud,audioError,downloadAudioLink} from './cloud.mjs';
import {ImportQueue} from './import-queue.mjs';
import {createLibraryView} from './library-view.mjs';
import {createPlayer} from './player.mjs';

export async function mountAudioLibrary(root,{access=()=>window.LambertAccount.audioAccess()}={}){
 const s={userId:null,collections:[],tracks:[],jobs:[],drafts:new Map(),collectionId:null,trackId:null};
 let store,queue,epoch=0,noteTimer,saveChain=Promise.resolve(),progressChain=Promise.resolve(),selection=0;
 const cloud=new AudioCloud(access),view=createLibraryView(root,(action,data)=>{void dispatch(action,data).catch(error=>view.message(audioError(error)));});
 const render=()=>view.render(s),track=id=>s.tracks.find(t=>t.id===id),collection=()=>s.collections.find(c=>c.id===s.collectionId);
 const player=createPlayer(view.playerHost,{checkpoint:saveProgress,onNext:auto=>step(1,!!auto),onPrevious:()=>step(-1,false),onError:view.message,onNativeTrack:id=>{const t=track(id);if(t){if(s.trackId)void flushNote(s.trackId);s.trackId=id;s.collectionId=t.collection_id;render();}}});
 const current=(user,token)=>s.userId===user&&epoch===token;
 async function refresh(){const user=s.userId,token=epoch;if(!user)return;const value=await cloud.read(user);if(!current(user,token))return;Object.assign(s,value);await store.saveSnapshot(user,value);render();}
 async function connect(){
  const token=++epoch;queue?.pause();player.stop();s.userId=null;s.collectionId=null;s.trackId=null;s.collections=[];s.tracks=[];s.jobs=[];s.drafts=new Map();render();
  const ctx=await access();if(token!==epoch)return;s.userId=ctx.userId;
  const cached=await store.snapshot(ctx.userId);if(token!==epoch)return;if(cached)Object.assign(s,cached);
  s.drafts=new Map((await store.drafts(ctx.userId)).map(d=>[d.trackId,d]));
  const activeUser=ctx.userId;queue=new ImportQueue({store,upload:(j,f,p)=>cloud.upload(j,f,p),onChange:jobs=>{if(current(activeUser,token)){s.jobs=jobs;render();}}});cloud.onReserved=j=>store.save(j);
  await queue.restore(activeUser);if(!current(activeUser,token))return;render();
  try{await refresh();view.message('');}catch(e){view.message(audioError(e));}
 }
 function editNote(text){const t=track(s.trackId);if(!t||!s.userId)return;const before=s.drafts.get(t.id),draft={userId:s.userId,trackId:t.id,text,baseVersion:before?.baseVersion??t.note_version,mutationId:crypto.randomUUID(),changedAt:Date.now(),...(before?.conflict?{conflict:true,remoteText:before.remoteText}: {})};s.drafts.set(t.id,draft);view.status('保存中');clearTimeout(noteTimer);
  // Write-through draft before any network request; never clear a newer mutation.
  saveChain=saveChain.catch(()=>{}).then(async()=>{const saved=await store.saveDraft(draft);if(!saved.durable)view.status('保存失败：本机空间不足，请复制备注');});
  noteTimer=setTimeout(()=>{void flushNote(t.id);},650);
 }
 function flushNote(id){const user=s.userId,token=epoch;
  const operation=async()=>{const draft=s.drafts.get(id);if(!draft||draft.conflict||!current(user,token))return;try{
   const durable=await store.saveDraft(draft);if(!durable.durable){view.status('保存失败：请复制备注');return;}
   const answer=await cloud.note(user,draft);if(!current(user,token))return;
   const live=s.drafts.get(id),t=track(id);if(answer.status==='conflict'){
    if(live){live.conflict=true;live.remoteText=answer.record.note;live.remoteVersion=answer.record.note_version;await store.saveDraft(live);}view.status('保存失败：备注冲突，草稿已保留');render();return;
   }
   if(answer.status!=='applied')throw Error('note_save_failed');if(t){t.note=answer.record.note;t.note_version=answer.record.note_version;}
   if(live?.mutationId===draft.mutationId){await store.clearDraft(user,id,draft.mutationId);s.drafts.delete(id);if(s.trackId===id)view.status('已保存');}
   else if(live){live.baseVersion=answer.record.note_version;await store.saveDraft(live);}
  }catch{if(current(user,token)&&s.trackId===id)view.status('保存失败 · 本地草稿已保留');}};
  saveChain=saveChain.catch(()=>{}).then(operation);return saveChain;
 }
 function saveProgress(id,value,remote){const user=s.userId,token=epoch,t=track(id);if(!user||!t)return;
  const row={...value,baseVersion:t.progress_version,changedAt:Date.now()};
  progressChain=progressChain.catch(()=>{}).then(async()=>{await store.saveProgress(user,id,row);if(!remote||!current(user,token))return;const live=track(id);const result=await cloud.progress(user,live,{...row,baseVersion:live.progress_version});if(!current(user,token))return;if(result.status==='applied'){live.position=result.record.position;live.rate=result.record.rate;live.progress_version=result.record.progress_version;}else{view.message('播放记录在其他设备更新；本机进度已保留，重新进入时可选择');}}).catch(()=>{if(current(user,token))view.message('播放位置已保存在本机，云同步待重试');});
 }
 async function openTrack(id,autoplay=false){const t=track(id);if(!t||t.status!=='ready')return;const token=++selection,user=s.userId,authEpoch=epoch;const old=s.trackId;if(old)void flushNote(old);player.pause();
  const [links,local]=await Promise.all([cloud.signed(user,window.LambertNativeAudio?s.tracks.filter(x=>x.collection_id===t.collection_id&&x.status==='ready').sort((a,b)=>a.sort_order-b.sort_order):[t]),store.progress(user,id)]);if(token!==selection||!current(user,authEpoch))return;const link=links.find(x=>x.id===id);if(!link?.url)throw Error('audio_unavailable');s.trackId=id;s.collectionId=t.collection_id;render();view.status(s.drafts.has(id)?'本地草稿待同步':'已保存');
  // A local checkpoint based on the same cloud version is safe to resume automatically.
  const resume=local&&local.baseVersion===t.progress_version?local:{position:t.position,rate:t.rate};
  await player.load(t,link.url,{...resume,autoplay,playlist:links.map(l=>({...track(l.id),...l}))});
 }
 async function step(delta,autoplay){const list=s.tracks.filter(t=>t.collection_id===s.collectionId&&t.status==='ready').sort((a,b)=>a.sort_order-b.sort_order),index=list.findIndex(t=>t.id===s.trackId),next=list[index+delta];if(next)try{await openTrack(next.id,autoplay||!player.audio.paused);}catch(e){view.message(audioError(e));}}
 async function runQueue(){const user=s.userId,token=epoch;await queue.run();if(current(user,token))await refresh();}
 async function dispatch(action,data){
  if(action==='note'){editNote(data);return;}
  if(action==='login'){window.LambertAccount.open();return;}
  if(action==='refresh'){if(!s.userId)return connect();await refresh();for(const id of s.drafts.keys())void flushNote(id);return;}
  if(action==='noop')return;
  if(action==='home'||action==='collection'){if(s.trackId)void flushNote(s.trackId);s.trackId=null;s.collectionId=action==='home'?null:data;render();return;}
  if(action==='track')return openTrack(data);
  if(action==='create'||action==='renameCollection'){const record=action==='create'?null:s.collections.find(c=>c.id===data.id);const result=await cloud.collection(s.userId,record,data.title);if(result.status==='conflict')view.message('名称已在其他设备修改，请刷新后重试');await refresh();return;}
  if(action==='renameTrack'){const result=await cloud.rename(s.userId,track(data.id),data.title);if(result.status==='conflict')view.message('标题已在其他设备修改，请刷新后重试');await refresh();return;}
  if(action==='move'){const ids=s.tracks.filter(t=>t.collection_id===s.collectionId).sort((a,b)=>a.sort_order-b.sort_order).map(t=>t.id),i=ids.indexOf(data.id),j=i+data.delta;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];const result=await cloud.reorder(s.userId,collection(),ids);if(result.status==='conflict')view.message('排序已变化，请刷新后重试');await refresh();return;}
  if(action==='import'||action==='link'){
   if(!s.userId||!s.collectionId)throw Error('audio_login_required');const files=action==='link'?[await downloadAudioLink(data)]:data;
   const result=await queue.add(files,{userId:s.userId,collectionId:s.collectionId,remaining:200-s.tracks.filter(t=>t.collection_id===s.collectionId).length});
   view.message(result.rejected?'超过剩余容量：每个音频集最多200条':`已加入 ${result.added} 条${result.duplicates?`，跳过重复 ${result.duplicates} 条`:''}`);if(!result.rejected)await runQueue();return;
  }
  if(action==='retry'||action==='reselect'){const result=await queue.retry(action==='retry'?data:data.id,data.file);if(!result.ok){view.message(result.error==='digest_mismatch'?'文件不匹配，请重新选择原文件':'请重新选择原文件');return;}await runQueue();return;}
  if(action==='resolve'){const d=s.drafts.get(s.trackId);if(!d)return;const text=data==='remote'?d.remoteText:d.text;d.conflict=false;d.baseVersion=d.remoteVersion;view.notesInput.value=text;editNote(text);render();}
 }
 window.addEventListener('lambert:audio-account',()=>{if(store)void connect().catch(e=>view.message(audioError(e)));});
 window.addEventListener('online',()=>{void dispatch('refresh').catch(()=>{});});
 window.addEventListener('lambert:audio-stop',()=>{++epoch;++selection;queue?.pause();player.stop();s.userId=null;s.tracks=[];s.collections=[];s.drafts.clear();s.jobs=[];s.trackId=null;view.notesInput.value='';render();});
 try{store=await openLibraryStore();await connect();}catch(e){view.message(audioError(e));render();}
 return {refresh:()=>dispatch('refresh'),pause:()=>player.pause(),state:s};
}
