import {WorkspaceJournal,ACTIVE_KEY} from './journal.mjs';
const bridge=window.LambertData;
if(bridge?.active){bridge.install(new WorkspaceJournal(localStorage,bridge.active));}

// Account setup is independent of the legacy dashboard views.
// Start loading it immediately rather than after every dashboard script.
import('./account-ui.mjs').catch(()=>{console.warn('账户服务未加载；本地数据仍可使用');});

// Fetch classic dashboard scripts concurrently while preserving their execution order.
// Dynamically inserted classic scripts default to async=true; explicitly setting
// async=false before insertion ensures they execute in the insertion order.
const scripts=JSON.parse(document.getElementById('lambert-app-scripts').textContent);
await Promise.all(scripts.map(src=>new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.async=false;
  s.src=src;
  s.onload=resolve;
  s.onerror=()=>reject(new Error('脚本加载失败: '+src));
  document.body.appendChild(s);
})));
window.addEventListener('storage',event=>{if(event.key===ACTIVE_KEY&&event.newValue!==bridge?.active)location.reload();});
