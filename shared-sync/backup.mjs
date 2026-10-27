import {DATA_KEYS,WorkspaceJournal} from './journal.mjs';
// Export raw guest bytes separately from the signed-in account. Never substitute
// one workspace for another, and retain queued mutations and both conflict sides.
export function createWorkspaceBackup(storage, journal=null, now=new Date(),{includeGuest=false}={}) {
  const raw=!journal||includeGuest?Object.fromEntries([...DATA_KEYS,'daily_reviews_v1'].map(key=>[key,storage.getItem(key)])):{};
  let account=null;
  if(journal){
    journal=new WorkspaceJournal(storage,journal.userId);
    const rawStorage={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(journal.prefix)||key?.startsWith('lambert_private_v1:'+journal.userId+':'))rawStorage[key]=storage.getItem(key);}
    account={userId:journal.userId,rawStorage};
    try{
      account.snapshot=Object.fromEntries(DATA_KEYS.map(key=>[key,journal.read(key,key==='daily_reviews_v2'?{}:[])]));
      account.base=journal.load('base',[]);account.batches=journal.batches();
    }catch{account.parseError='账号缓存格式异常；原始字节已保留，请勿清除本机数据。';}

  }
  return {format:'lambert-local-backup-v2',createdAt:now.toISOString(),raw,account};
}

export function retainWorkspaceBackup(storage,journal=null){
  const backup=createWorkspaceBackup(storage,journal);
  const key='lambert_backup_v2:'+backup.createdAt+':'+crypto.randomUUID();
  storage.setItem(key,JSON.stringify(backup));
  return key;
}
