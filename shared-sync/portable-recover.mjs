// Local-only recovery planner. It never changes user data.
// Recovered drawings are inserted with original IDs and timestamps; existing active
// or trashed IDs take priority, even if archive contents are newer.
export function planMissingMasterRecovery(archive,{localFiles,localTrash,validateDrawing}={}){
 if(!archive||!archive.master||!Array.isArray(archive.master.files)||!Array.isArray(archive.master.trash))
  throw Error('invalid_master_recovery_archive');
 if(!Array.isArray(localFiles)||!Array.isArray(localTrash)||typeof validateDrawing!=='function')
  throw Error('invalid_master_recovery_context');
 const source=[...archive.master.files.map(file=>({file,trashed:false})),...archive.master.trash.map(file=>({file,trashed:true}))];
 const seen=new Set();
 if(source.some(({file})=>!validateDrawing(file)||seen.has(file.id)?true:(seen.add(file.id),false)))
  throw Error('invalid_master_recovery_records');
 const local=new Map();
 for(const file of localFiles)local.set(file.id,{file,trashed:false});
 for(const file of localTrash){
  if(local.has(file.id))throw Error('local_master_id_exists_in_multiple_stores');
  local.set(file.id,{file,trashed:true});
 }
 let unchanged=0,conflicts=0;
 const missingFiles=[],missingTrash=[];
 for(const {file,trashed} of source){
  const existing=local.get(file.id);
  if(existing){
   if(existing.trashed===trashed&&JSON.stringify(existing.file)===JSON.stringify(file))unchanged++;
   else conflicts++;
   continue;
  }
  if(trashed)missingTrash.push(file);
  else missingFiles.push(file);
 }
 return Object.freeze({
  missingFiles,missingTrash,unchanged,conflicts,
  toAdd:missingFiles.length+missingTrash.length,
  message:'仅恢复本机缺失的图纸；本机已有 ID（包括回收站）不会被覆盖。工作区任务、项目、笔记不会被修改。'
 });
}
