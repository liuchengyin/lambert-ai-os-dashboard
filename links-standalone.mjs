// Standalone common-links entry: never load the dashboard or private workspace modules.
import {WorkspaceJournal,ACTIVE_KEY} from './shared-sync/journal.mjs';
const status=document.getElementById('linksStatus');
const failure=document.getElementById('linksError');
try {
  const owner=localStorage.getItem(ACTIVE_KEY);
  if(owner) {
    // Install the same account-isolated journal as the main workspace before rendering links.
    window.LambertData.install(new WorkspaceJournal(localStorage,owner));
  }
  await import('./shared-sync/account-ui.mjs');
  await window.LambertAccount.ready;
  const script=(src)=>new Promise((resolve,reject)=>{
    const node=document.createElement('script');node.src=src;
    node.onload=resolve;node.onerror=()=>reject(Error('asset_load_failed:'+src));
    document.body.append(node);
  });
  await script('/lib/link-sites.js');
  await script('/lib/link-recovery.js');
  await script('/knowledge-links.js');
  status.textContent=window.LambertData?.active?'链接已打开 · 云同步状态见账户':'链接已打开 · 本地模式';
} catch(error) {
  failure.hidden=false;
  failure.textContent='链接页暂时无法加载。原有数据没有被删除，请返回原网站或检查账户状态。';
  status.textContent='加载失败';
  console.warn('Standalone Links boot failed',error);
}
