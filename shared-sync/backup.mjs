import {DATA_KEYS,WorkspaceJournal} from './journal.mjs';
// Export raw guest bytes separately from the signed-in account. Never substitute
// one workspace for another, and retain queued mutations and both conflict sides.
export function createWorkspaceBackup(storage, journal=null, now=new Date()) {
  const raw=Object.fromEntries([...DATA_KEYS,'daily_reviews_v1'].map(key=>[key,storage.getItem(key)]));
  let account=null;
  if(journal){
    journal=new WorkspaceJournal(storage,journal.userId);
    const snapshot=Object.fromEntries(DATA_KEYS.map(key=>[key,journal.read(key,key==='daily_reviews_v2'?{}:[])]));
    account={userId:journal.userId,snapshot,base:journal.load('base',[]),batches:journal.batches()};
  }
  return {format:'lambert-local-backup-v2',createdAt:now.toISOString(),raw,account};
}

export function retainWorkspaceBackup(storage,journal=null){
  const backup=createWorkspaceBackup(storage,journal);
  const key='lambert_backup_v2:'+backup.createdAt+':'+crypto.randomUUID();
  storage.setItem(key,JSON.stringify(backup));
  return key;
}
