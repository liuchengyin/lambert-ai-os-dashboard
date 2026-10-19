import {WorkspaceJournal,ACTIVE_KEY} from './journal.mjs';
const bridge=window.LambertData;
if(bridge?.active){bridge.install(new WorkspaceJournal(localStorage,bridge.active));}
// Preserve execution order and classic global bindings used by the desktop modules.
const scripts=JSON.parse(document.getElementById('lambert-app-scripts').textContent);
for(const src of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});
import('./account-ui.mjs').catch(()=>{console.warn('账户服务未加载；本地数据仍可使用');});
window.addEventListener('storage',event=>{if(event.key===ACTIVE_KEY&&event.newValue!==bridge?.active)location.reload();});
