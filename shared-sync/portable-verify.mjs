// Pure, offline-only archive validator and recovery preview. No writes/imports.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function inspectPortableSafetyArchive(archive,{expectedOwner='',validateDrawing}={}){
 if(!archive||typeof archive!=='object'||Array.isArray(archive)||archive.format!=='lambert-portable-safety-v1')
  throw Error('不是受支持的 Lambert 安全备份文件');
 if(!UUID.test(expectedOwner)&&expectedOwner!=='')throw Error('当前账号标识无效');
 const owner=archive.owner===null?'':archive.owner;
 if(owner!==''&&!UUID.test(owner))throw Error('备份账号标识无效');
 if(owner!==expectedOwner)throw Error('备份账号与当前工作台账号不一致；禁止跨账号恢复');
 if(!Number.isFinite(Date.parse(archive.createdAt)))throw Error('备份时间无效');
 const ws=archive.workspace;
 if(!ws||ws.format!=='lambert-local-backup-v2'||!ws.raw||typeof ws.raw!=='object'||Array.isArray(ws.raw))throw Error('工作区备份格式错误');
 for(const value of Object.values(ws.raw))if(value!==null&&typeof value!=='string')throw Error('工作区原始数据格式错误');
 if(owner){
  const account=ws.account;
  if(!account||account.userId!==owner||!account.rawStorage||typeof account.rawStorage!=='object'||Array.isArray(account.rawStorage))throw Error('备份账号数据不完整');
  const prefix='lambert_workspace_v1:'+owner+':',privatePrefix='lambert_private_v1:'+owner+':';
  if(Object.keys(account.rawStorage).some(key=>!key.startsWith(prefix)&&!key.startsWith(privatePrefix)))throw Error('备份包含其他账号数据');
 }else if(ws.account!==null)throw Error('访客备份包含意外账号数据');
 if(!archive.master||!Array.isArray(archive.master.files)||!Array.isArray(archive.master.trash))throw Error('图纸备份格式错误');
 const files=archive.master.files,trash=archive.master.trash;
 if(!archive.counts||archive.counts.masterFiles!==files.length||archive.counts.masterTrash!==trash.length)throw Error('图纸数量校验失败');
 if(typeof validateDrawing!=='function'||[...files,...trash].some(f=>!validateDrawing(f)))throw Error('图纸内容校验失败');
 const ids=[...files,...trash].map(f=>f.id);
 if(new Set(ids).size!==ids.length)throw Error('图纸或回收站存在重复 ID');
 return Object.freeze({
  verified:true,owner:owner||null,createdAt:archive.createdAt,
  masterFiles:files.length,masterTrash:trash.length,
  accountRows:owner?Object.keys(ws.account.rawStorage).length:0,
  guestRows:Object.values(ws.raw).filter(v=>v!==null).length,
  safeToImport:false,
  message:'备份结构校验通过。当前仅预览，不会导入、覆盖或删除任何数据。'
 });
}
