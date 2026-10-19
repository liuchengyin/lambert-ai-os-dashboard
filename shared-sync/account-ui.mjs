import {createClient} from './vendor/supabase-2.118.0.mjs';
import {createAccount,friendlyAuthError,SESSION_KEY} from './auth.mjs';
import {WorkspaceJournal,ACTIVE_KEY,DATA_KEYS,stable} from './journal.mjs';
import {synchronize,pullWorkspace} from './engine.mjs';
import {prepareLocalImport,planImport} from './import-plan.mjs';
const native=location.hostname==='appassets.androidplatform.net';
const configUrl=native?'https://lambert-ai-os-dashboard.vercel.app/api/account-config':'/api/account-config';
const entry=document.getElementById('accountButton')||document.getElementById('lambertAccountButton');
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
const root=new URL('../',import.meta.url);
if(!document.querySelector('link[data-lambert-account]')){const css=node('link');css.rel='stylesheet';css.href=new URL('account.css',import.meta.url);css.dataset.lambertAccount='';document.head.append(css);}
let account,config,user,journal,dialog,body,message,mode='login',busy=false,recovery=false,lastSync='',syncError='',inFlight=false,flushTimer;
const accountPage=document.body.dataset.accountPage!==undefined;
let resolveReady;const ready=new Promise(r=>{resolveReady=r;});
function tell(text){if(message)message.textContent=text;}
function readGuest(){const snapshot={};for(const key of DATA_KEYS){const raw=localStorage.getItem(key);snapshot[key]=raw===null?(key==='daily_reviews_v2'?{}:[]):JSON.parse(raw);}return snapshot;}
function backup(){const text=JSON.stringify({format:'lambert-local-backup-v1',createdAt:new Date().toISOString(),data:readGuest()},null,2);const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=node('a');a.href=url;a.download='Lambert-local-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function status(){if(!user)return '未登录 · 本地模式';if(localStorage.getItem(ACTIVE_KEY)!==user.id)return '已登录 · 尚未启用同步';if(syncError)return syncError;const conflicts=journal?.conflicts().length||0;if(conflicts)return '有 '+conflicts+' 条冲突待处理';const pending=journal?.pending().length||0;if(pending)return '本地已保存 · 待上传 '+pending+' 条';return lastSync?'已同步 · '+lastSync:'云端工作台 · 等待同步';}
function updateEntry(){if(entry){entry.setAttribute('aria-label',user?'我的账户：'+user.email:'邮箱登录');if(entry.id==='lambertAccountButton')entry.textContent=user?'我的账户':'登录';}const s=document.getElementById('lambertCloudStatus');if(s)s.textContent=status();}
function changed(){let b=document.getElementById('lambertCloudRefresh');if(!b){b=button('云端数据已更新，点击刷新',()=>location.reload());b.id='lambertCloudRefresh';b.className='lambert-cloud-refresh';document.body.append(b);}}
async function flush(){
  if(inFlight||!user||localStorage.getItem(ACTIVE_KEY)!==user.id||!navigator.onLine||document.hidden)return;
  inFlight=true;const current=journal;const visible=()=>stable([...current.entries().values()].map(r=>({kind:r.kind,id:r.item_id,payload:r.payload,deleted:!!r.deleted_at})));const before=visible();
  const run=async()=>{try{await synchronize(account.client,current);syncError='';lastSync=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});if(before!==visible())changed();}catch(e){syncError=e.message==='account_mismatch'?'请重新登录后同步':'同步未完成 · 本地数据已保留';}finally{updateEntry();}};
  try{if(navigator.locks)await navigator.locks.request('lambert-sync:'+user.id,{ifAvailable:true},lock=>lock?run():undefined);else await run();}finally{inFlight=false;}
}
function schedule(){clearTimeout(flushTimer);flushTimer=setTimeout(flush,400);updateEntry();}
function field(label,type,value=''){const l=node('label',label);const input=node('input');input.type=type;input.value=value;input.required=true;input.autocomplete=type==='email'?'email':mode==='login'?'current-password':'new-password';if(type==='password'&&mode!=='login')input.minLength=8;l.append(input);body.append(l);return input;}
async function action(fn,done){if(busy)return;busy=true;for(const e of body.querySelectorAll('button'))e.disabled=true;tell('正在处理…');try{const result=await fn();done?.(result);}catch(e){tell(friendlyAuthError(e));}finally{busy=false;if(body)for(const e of body.querySelectorAll('button'))e.disabled=false;}}
function showForm(){
  const email=field('邮箱','email');let password;if(mode!=='reset')password=field(mode==='password'?'新密码':'密码','password');
  if(mode==='password')email.closest('label').remove();
  const submit=node('button',({login:'登录',register:'注册',reset:'发送重置邮件',password:'保存新密码'})[mode]);submit.type='submit';body.append(submit);
  body.onsubmit=event=>{event.preventDefault();action(async()=>{const secret=password?.value;try{
    if(mode==='login'){const data=await account.login(email.value,secret);user=data.user;journal=new WorkspaceJournal(localStorage,user.id);renderBody();schedule();return;}
    if(mode==='register'){const data=await account.register(email.value,secret);if(data.session){user=data.user;journal=new WorkspaceJournal(localStorage,user.id);renderBody();}else tell('如果此邮箱可以注册，我们已发送验证邮件。验证后回到这里登录。');return;}
    if(mode==='reset'){await account.reset(email.value);tell('如果该邮箱已注册，我们会发送重置密码邮件，请检查收件箱。');return;}
    await account.changePassword(secret);recovery=false;mode='login';renderBody();tell('密码已更新。手机端可使用新密码登录。');
  }finally{if(password)password.value='';}});};
  if(mode==='login'){body.append(button('注册账号',()=>{mode='register';renderBody();}),button('忘记密码',()=>{mode='reset';renderBody();}),button('重发验证邮件',()=>{if(!email.reportValidity())return;action(()=>account.resend(email.value),()=>tell('如果需要验证，我们已发送邮件，请检查收件箱。'));}));}
  else if(mode!=='password')body.append(button('返回登录',()=>{mode='login';renderBody();}));
}
async function prepareWorkspace(importLocal){
  await action(async()=>{
    const verified=await account.verifiedUser();if(verified.id!==user.id)throw Error('account_mismatch');
    journal=new WorkspaceJournal(localStorage,user.id);const remote=await pullWorkspace(account.client,journal);
    if(!importLocal){localStorage.setItem(ACTIVE_KEY,user.id);location.reload();return;}
    const snapshot=readGuest();const records=prepareLocalImport(snapshot);
    const plan=planImport(records,remote.map(r=>({kind:r.kind,itemId:r.item_id,payload:r.payload,deletedAt:r.deleted_at})));
    // Show actual counts before changing the selected account's workspace.
    body.replaceChildren();body.onsubmit=null;body.append(node('p','将新增 '+plan.create.length+' 条，相同 '+plan.unchanged.length+' 条，冲突 '+plan.conflicts.length+' 条。冲突保留云端内容，本地原始数据仍保留。'));
    const save=button('下载本机原始备份',backup);body.append(save);
    const label=node('label');const check=node('input');check.type='checkbox';label.append(check,node('span','我已保存备份，确认导入到 '+user.email));body.append(label);
    body.append(button('确认导入并启用同步',()=>{if(!check.checked){tell('请先保存备份并勾选确认。');return;}action(async()=>{
      // Re-read server state just before importing: new conflicts become version errors, never silent overwrites.
      const values={};for(const key of DATA_KEYS){const kind=key==='daily_reviews_v2'?'reviews':key;const current=journal.read(key,key==='daily_reviews_v2'?{}:[]);const adds=plan.create.filter(r=>r.kind===kind);const merged=kind==='reviews'?{...current,...Object.fromEntries(adds.map(r=>[r.itemId,r.payload]))}:current.concat(adds.map(r=>r.payload));values[key]=merged;}journal.writeMany(values);
      localStorage.setItem(ACTIVE_KEY,user.id);location.reload();
    });}),button('返回',renderBody));
    message=node('p','', 'lambert-account-message');message.setAttribute('role','status');body.append(message);
  });
}
function renderBody(){
  if(!body)return;body.replaceChildren();body.onsubmit=null;
  if(!config?.configured){body.append(node('p','邮箱登录正在准备，暂未连接账号服务。现有数据仍保存在本机。'));}
  else if(!user||recovery){if(recovery)mode='password';showForm();}
  else {
    body.append(node('p',user.email,'lambert-account-email'),node('p',status()));
    if(localStorage.getItem(ACTIVE_KEY)!==user.id){body.append(node('p','选择使用云端数据，或将本机任务、项目和复盘导入此账号。登录本身不会自动上传本机内容。'),button('使用云端工作台',()=>prepareWorkspace(false)),button('检查并导入本机数据',()=>prepareWorkspace(true)));}
    else {
      body.append(button('立即同步',()=>action(async()=>{await flush();tell(status());})),button('下载本机原始备份',backup));
      const conflicts=journal.conflicts();for(const op of conflicts){const box=node('section');box.append(node('strong',op.payload.title||op.payload.name||op.itemId),node('p','本地和云端都有修改，请选择保留内容。'));
        for(const [label,choice] of [['保留云端','remote'],['使用本地','local']])box.append(button(label,()=>action(async()=>{journal.resolve(op.kind,op.itemId,choice);renderBody();changed();await flush();})));body.append(box);}
    }
    body.append(button('退出登录',()=>action(async()=>{await account.logout();localStorage.removeItem(ACTIVE_KEY);location.reload();})));
  }
  message=node('p','','lambert-account-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');body.append(message);updateEntry();
}
function open(){
  if(dialog?.open){dialog.focus();return;}
  dialog=node('dialog',undefined,'lambert-account');dialog.setAttribute('aria-label','我的账户');
  const header=node('div',undefined,'lambert-account-head');header.append(node('h2','我的账户'),button('关闭',()=>dialog.close()));body=node('form');header.lastChild.setAttribute('aria-label','关闭账户');dialog.append(header,body);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();dialog=null;body=null;message=null;},{once:true});renderBody();dialog.showModal();header.lastChild.focus();
}
window.LambertAccount={open,ready,status};if(entry)entry.onclick=open;
async function start(){
  try{
    const response=await fetch(configUrl,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('config_failed');config=await response.json();
    if(config.configured){if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)||!/^https:\/\/[^/?#]+$/.test(config.siteUrl))throw Error('invalid_public_config');
      account=createAccount(createClient(config.url,config.publishableKey,{auth:{storageKey:SESSION_KEY+':'+new URL(config.url).host,persistSession:true,autoRefreshToken:true,detectSessionInUrl:accountPage,flowType:'implicit'}}),{redirectTo:config.siteUrl+'/account.html'});
      // Subscribe before getSession so PASSWORD_RECOVERY is not missed on the callback page.
      account.subscribe((event,session)=>{setTimeout(()=>{user=session?.user||null;if(user)journal=new WorkspaceJournal(localStorage,user.id);if(event==='PASSWORD_RECOVERY'){recovery=true;open();}if(event==='SIGNED_OUT'){localStorage.removeItem(ACTIVE_KEY);if(window.LambertData?.active)location.reload();}renderBody();updateEntry();schedule();},0);});
      const session=await account.session();user=session?.user||null;if(user)journal=new WorkspaceJournal(localStorage,user.id);
    }
  }catch{config={configured:false};}
  updateEntry();resolveReady();if(accountPage)open();else if(dialog)renderBody();schedule();
}
window.addEventListener('lambert-local-change',schedule);
window.addEventListener('online',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
setInterval(()=>{if(!document.hidden)flush();},30000);
start();
