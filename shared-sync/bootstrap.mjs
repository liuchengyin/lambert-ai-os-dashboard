import {WorkspaceJournal,ACTIVE_KEY} from './journal.mjs';
const bridge=window.LambertData;
const startup=window.LambertStartup;
// Track nested legacy modules too: project-v4 loads dashboard/theme modules,
// which in turn mount the current navigation and task center.
const pending=new Set(),seen=new WeakSet();let assetFailed=false;
function track(element){
  if(!startup||seen.has(element))return;
  const script=element.tagName==='SCRIPT'&&element.src;
  const style=element.tagName==='LINK'&&element.rel==='stylesheet';
  if(!script&&!style||style&&element.sheet)return;
  // Optional third-party editors must not block the core workspace.
  if(new URL(element.src||element.href,location.href).origin!==location.origin)return;
  seen.add(element);
  let finish;const promise=new Promise(resolve=>{finish=resolve;});pending.add(promise);
  const done=failed=>{clearTimeout(timer);element.removeEventListener('load',loaded);element.removeEventListener('error',errored);if(failed){assetFailed=true;console.warn('工作台资源未加载：'+(element.src||element.href));}pending.delete(promise);finish();};
  const loaded=()=>done(false),errored=()=>done(true);
  const timer=setTimeout(errored,15000);
  element.addEventListener('load',loaded,{once:true});element.addEventListener('error',errored,{once:true});
}
const observer=startup?new MutationObserver(records=>{for(const record of records)for(const element of record.addedNodes){if(element.nodeType!==1)continue;track(element);element.querySelectorAll?.('script[src],link[rel="stylesheet"]').forEach(track);}}):null;
observer?.observe(document.documentElement,{childList:true,subtree:true});
document.querySelectorAll('link[rel="stylesheet"]').forEach(track);
try{
  if(bridge?.active)bridge.install(new WorkspaceJournal(localStorage,bridge.active));
  const scripts=JSON.parse(document.getElementById('lambert-app-scripts').textContent);
  // Fetch in parallel while preserving the original execution order and globals.
  for(const src of scripts){const preload=document.createElement('link');preload.rel='preload';preload.as='script';preload.href=src;document.head.append(preload);}
  for(const src of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('app_asset_failed'));document.body.appendChild(s);});
  if(startup){
    do{await Promise.all([...pending]);await new Promise(resolve=>setTimeout(resolve,0));}while(pending.size);
    if(assetFailed||!document.getElementById('s1PrimaryNav')||!window.TaskCenter||!document.querySelector('#home .s1-head'))throw Error('app_asset_failed');
    startup.ready();
  }
}catch(error){startup?.error();console.warn('工作台加载未完成，现有数据仍保留在本机。');}
finally{observer?.disconnect();}
// Account network requests do not block opening the locally saved workspace.
import('./account-ui.mjs').catch(()=>{console.warn('账户服务未加载；本地数据仍可使用');});
window.addEventListener('storage',event=>{if(event.key===ACTIVE_KEY&&event.newValue!==bridge?.active)location.reload();});
