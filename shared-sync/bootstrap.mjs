import {WorkspaceJournal,ACTIVE_KEY} from './journal.mjs';
const bridge=window.LambertData;
const startup=window.LambertStartup;
// Legacy modules run in a fixed dependency order, but optional enhancement assets must not
// delay the first usable workspace. Preserve core failure reporting and local data safety.
const pending=new Set(),seen=new WeakSet();
let coreFailed=false,primaryReady=false,shown=false;
const coreReady=()=>!!(document.getElementById('s1PrimaryNav')&&window.TaskCenter&&document.querySelector('#home .s1-head'));
function reveal(){
  if(!startup||shown||coreFailed||!primaryReady||!coreReady())return false;
  shown=true;
  startup.ready();
  performance.mark?.('lambert-core-visible');
  return true;
}
function track(element){
  if(!startup||seen.has(element))return;
  // Dynamic optional styling and secondary enhancements are not first-paint requirements.
  // The static CSS in index.html is already render-blocking before this module executes.
  if(element.tagName!=='SCRIPT'||!element.src)return;
  if(new URL(element.src,location.href).origin!==location.origin)return;
  seen.add(element);
  let done;
  const promise=new Promise(resolve=>{done=resolve;});
  pending.add(promise);
  const finish=()=>{
    clearTimeout(timer);
    element.removeEventListener('load',loaded);
    element.removeEventListener('error',errored);
    pending.delete(promise);
    done();
    reveal();
  };
  const loaded=()=>finish();
  const errored=()=>{console.warn('工作台扩展资源未加载：'+element.src);finish();};
  const timer=setTimeout(errored,15000);
  element.addEventListener('load',loaded,{once:true});
  element.addEventListener('error',errored,{once:true});
}
const observer=startup?new MutationObserver(records=>{
  for(const record of records)for(const element of record.addedNodes){
    if(element.nodeType!==1)continue;
    track(element);
    element.querySelectorAll?.('script[src]').forEach(track);
  }
  reveal();
}):null;
observer?.observe(document.documentElement,{childList:true,subtree:true});
try{
  if(bridge?.active)bridge.install(new WorkspaceJournal(localStorage,bridge.active));
  const scripts=JSON.parse(document.getElementById('lambert-app-scripts').textContent);
  // Fetch in parallel while retaining the required execution order.
  for(const src of scripts){const preload=document.createElement('link');preload.rel='preload';preload.as='script';preload.href=src;document.head.append(preload);}
  for(const src of scripts){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(Error('app_asset_failed: '+src));
      document.body.appendChild(script);
    });
    if(src.startsWith('sprint1-navigation.js'))primaryReady=true;
    reveal();
  }
  // Preserve the existing fallback for legacy modules that initialize asynchronously.
  if(startup&&!shown){
    do{await Promise.all([...pending]);await new Promise(resolve=>setTimeout(resolve,0));}while(pending.size);
    if(!reveal())throw Error('app_asset_failed');
  }
}catch(error){
  // An optional enhancement failure after first paint must never re-hide the workspace.
  if(!shown)startup?.error();
  console.error('工作台加载未完成，现有数据仍保留在本机。',error);
}finally{observer?.disconnect();}
// Account network requests do not block opening the locally saved workspace.
import('./account-ui.mjs').catch(()=>{console.warn('账户服务未加载；本地数据仍可使用');});
window.addEventListener('storage',event=>{if(event.key===ACTIVE_KEY&&event.newValue!==bridge?.active)location.reload();});
