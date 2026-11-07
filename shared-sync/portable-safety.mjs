// Local-only portable safety archive. This function never uploads, restores, deletes,
// or modifies user data. It intentionally excludes binary PDFs, audio and old revisions.
import {createWorkspaceBackup} from './backup.mjs';
import {WorkspaceJournal,ACTIVE_KEY} from './journal.mjs';

export async function createPortableSafetyArchive({storage,library,owner='',assertOwner=()=>{},now=new Date()}){
 if(!storage||!library||typeof library.list!=='function')throw Error('backup_dependencies_missing');
 if(owner&&!/^[0-9a-f-]{36}$/i.test(owner))throw Error('invalid_backup_owner');
 assertOwner();
 if((storage.getItem(ACTIVE_KEY)||'')!==owner)throw Error('backup_account_changed');
 const journal=owner?new WorkspaceJournal(storage,owner):null;
 // Preserve original workspace bytes and pending mutations. Guest data are included
 // even when an account is active; no guest keys are removed or changed.
 const workspace=createWorkspaceBackup(storage,journal,now,{includeGuest:true});
 const [files,trash]=await Promise.all([library.list(false),library.list(true)]);
 assertOwner();
 if((storage.getItem(ACTIVE_KEY)||'')!==owner)throw Error('backup_account_changed');
 if(!Array.isArray(files)||!Array.isArray(trash)||
    [...files,...trash].some(file=>!library.validateRecord(file)))throw Error('invalid_master_backup_data');
 const archive={
  format:'lambert-portable-safety-v1',
  createdAt:now.toISOString(),
  owner:owner||null,
  coverage:{
   workspace:'raw guest data + account workspace, pending batches and conflicts',
   master:'current drawings and recycle bin (XML included)',
   excluded:['PDF binary files','audio/video binary files','DrawMaster historical backup revisions','cloud-only DrawMaster revisions'],
   restore:'manual validation only; this archive is not an automatic import file'
  },
  counts:{masterFiles:files.length,masterTrash:trash.length},
  workspace,
  master:{files,trash}
 };
 return archive;
}
