// Uses only the existing native update controls; never reloads an unactivated bundle.
const mobile=location.pathname.includes('/mobile/'),native=location.hostname==='appassets.androidplatform.net';
const asset=name=>new URL('../mobile/'+name,import.meta.url);
const panels=new Set();let timer,busy=false,started=false;
let state={version:'读取中…',release:0,phase:'loading',message:'正在读取版本信息',notes:[]};
function label(release){if(!Number.isSafeInteger(release)||release<=0)return '';const d=new Date(release);if(d.getFullYear()<2020)return '构建 '+release;const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return v.year+'.'+v.month+'.'+v.day+'.'+v.hour+v.minute+v.second;}
async function json(name){const r=await fetch(asset(name),{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('unavailable');return r.json();}
function publish(){
 const entry=document.getElementById('appVersionEntry');if(entry){entry.disabled=false;entry.dataset.phase=state.phase;entry.textContent=state.phase==='ready'?'新版本 · 待重启':state.release>1577808000000?'v'+state.version.slice(5,10)+' '+state.version.slice(11,13)+':'+state.version.slice(13,15):state.version;entry.setAttribute('aria-label','当前页面版本 '+state.version+'。'+state.message+'。查看版本与更新');entry.title=entry.getAttribute('aria-label');}
 for(const view of panels){if(!view.isConnected){panels.delete(view);continue;}view.querySelector('[data-update-version]').textContent=state.version;view.querySelector('[data-update-message]').textContent=state.message;view.dataset.phase=state.phase;
 const check=view.querySelector('[data-update-check]');check.disabled=busy||state.phase==='checking';check.textContent=state.phase==='checking'?'正在检查…':native?'检查更新':'刷新版本信息';
 const help=view.querySelector('[data-update-help]');help.hidden=state.phase!=='ready';
 view.querySelector('details').hidden=!state.notes.length;const notes=view.querySelector('[data-update-notes]');notes.replaceChildren(...state.notes.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));}
 window.dispatchEvent(new CustomEvent('lambert-update-state',{detail:{...state}}));
}
function schedule(){clearTimeout(timer);if(native&&!document.hidden)timer=setTimeout(()=>refresh(false),state.phase==='checking'?1000:30000);}
async function current(){
 let release=Number(document.querySelector('meta[name="lambert-page-release"]')?.content)||0;
 if(!release)try{release=(await json('release.json')).release;}catch{}
 state.release=Number.isSafeInteger(release)&&release>0?release:0;state.version=label(state.release)||(native?'安装包内置版':'本地预览版');publish();
 try{const notes=await json('update-notes.json');state.notes=Array.isArray(notes.items)?notes.items.filter(x=>typeof x==='string').slice(0,5).map(x=>x.slice(0,120)):[];}catch{}
}
async function refresh(check){
 if(busy)return;busy=true;if(check){state.phase='checking';state.message='正在检查更新…';}publish();
 try{
  if(!native){await current();state.phase='web';state.message=state.release?'当前为移动网页版，重新打开页面可获取最新版本。':'本地预览版本；正式发布后会显示版本号。';return;}
  const result=await json('__updates/'+(check?'check':'status'));
  if(typeof result.checking!=='boolean'||typeof result.ready!=='boolean'||typeof result.message!=='string')throw Error('unsupported');
  state.phase=result.ready?'ready':result.checking?'checking':/未获取|无法|失败/.test(result.message)?'error':'idle';
  state.message=result.ready?'新版本已下载，完全退出 App 后重新打开即可生效。':result.message;
  // Native release is the highest installed OR staged release, not necessarily the running page.
  // Never replace the current version with it while a new bundle is waiting to activate.
 }catch{state.phase='error';state.message=native?'暂时无法读取更新状态，请稍后重试；当前版本仍可使用。':'版本信息暂时无法读取，请稍后重试。';}
 finally{busy=false;publish();schedule();}
}
export function mountUpdatePanel(parent){if(!mobile)return;const panel=document.createElement('section');panel.id='appUpdatePanel';panel.className='app-update-panel';panel.setAttribute('aria-label','版本与更新');panel.innerHTML='<h3>版本与更新</h3><p class="app-update-version">当前页面版本 <strong data-update-version></strong></p><p data-update-message role="status" aria-live="polite"></p><button type="button" data-update-check>检查更新</button><p data-update-help hidden>请从系统最近任务中划掉 App，再重新打开。仅刷新页面不会启用已下载的更新。</p><details><summary>本版改进</summary><ul data-update-notes></ul></details>';parent.append(panel);panels.add(panel);panel.querySelector('[data-update-check]').onclick=()=>refresh(true);publish();return panel;}
export async function startAppUpdates(openAccount){if(!mobile||started)return;started=true;const entry=document.getElementById('appVersionEntry');if(entry)entry.onclick=()=>{openAccount();requestAnimationFrame(()=>document.getElementById('appUpdatePanel')?.scrollIntoView({block:'nearest'}));};await current();await refresh(false);document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh(false);});}
