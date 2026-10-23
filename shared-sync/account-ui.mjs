import {createClient} from './vendor/supabase-2.118.0.mjs';
import {createAccount,friendlyAuthError,SESSION_KEY} from './auth.mjs';
import {WorkspaceJournal,ACTIVE_KEY,DATA_KEYS,stable} from './journal.mjs';
import {synchronize,pullWorkspace} from './engine.mjs';
import {prepareLocalImport,planImport} from './import-plan.mjs';
import {conflictCard} from './conflict-card.mjs';
import {createWorkspaceBackup,retainWorkspaceBackup} from './backup.mjs';
const native=location.hostname==='appassets.androidplatform.net';
const configUrl=native?'https://lambert-ai-os-dashboard.vercel.app/api/account-config':'/api/account-config';
const entry=document.getElementById('accountButton')||document.getElementById('lambertAccountButton');
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
const root=new URL('../',import.meta.url);
if(!document.querySelector('link[data-lambert-account]')){const css=node('link');css.rel='stylesheet';css.href=new URL('account.css',import.meta.url);css.dataset.lambertAccount='';document.head.append(css);}
let registrationEmail='',loginEmail='',resendAt=0;
let account,config,user,journal,dialog,body,message,mode='login',busy=false,recovery=false,lastSync='',syncError='',inFlight=false,flushTimer;
const accountPage=document.body.dataset.accountPage!==undefined;
let leaving=false;function leaveWorkspace(){if(leaving)return;leaving=true;localStorage.removeItem(ACTIVE_KEY);location.reload();}
let resolveReady;const ready=new Promise(r=>{resolveReady=r;});
function tell(text){if(message)message.textContent=text;}
function enforceWorkspaceUser(){const active=localStorage.getItem(ACTIVE_KEY);if(active&&user&&active!==user.id){leaveWorkspace();return false;}return true;}
function readGuest(){const snapshot={};for(const key of DATA_KEYS){const raw=localStorage.getItem(key);snapshot[key]=raw===null?(key==='daily_reviews_v2'?{}:[]):JSON.parse(raw);}return snapshot;}
function backup(){const text=JSON.stringify(createWorkspaceBackup(localStorage,journal),null,2);const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=node('a');a.href=url;a.download='Lambert-workspace-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}

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
function field(label,type,value=''){const l=node('label',label);const input=node('input');input.type=type;input.setAttribute('aria-label',label);input.value=value;input.required=true;input.autocomplete=type==='email'?'email':mode==='login'?'current-password':'new-password';if(type==='password'&&mode!=='login')input.minLength=8;l.append(input);body.append(l);return input;}
async function action(fn,done){if(busy)return;busy=true;for(const e of body.querySelectorAll('button'))e.disabled=true;tell('正在处理…');try{const result=await fn();done?.(result);}catch(e){tell(friendlyAuthError(e));}finally{busy=false;if(body)for(const e of body.querySelectorAll('button'))e.disabled=false;}}
function showForm(){
  const verify=mode==='verify';
  const headings={login:['登录你的工作台','手机与电脑，共用一个工作台。'],register:['创建你的账号','填写邮箱，获取注册验证码。'],verify:['验证邮箱，设置密码','验证码已发送至 '+registrationEmail],reset:['找回密码','输入注册邮箱，获取重置指引。'],password:['设置新密码','更新后可在手机与电脑使用。']};
  const [title,subtitle]=headings[mode];body.append(node('h3',title),node('p',subtitle));
  const email=field('邮箱','email',verify?registrationEmail:loginEmail);
  if(verify||mode==='password')email.closest('label').hidden=true;
  let code,password;
  if(verify){code=field('邮箱验证码','text');code.inputMode='numeric';code.autocomplete='one-time-code';code.maxLength=10;code.pattern='[0-9]{6,10}';code.placeholder='输入邮件中的验证码';}
  if(['login','verify','password'].includes(mode)){
    password=field(mode==='verify'?'设置密码':mode==='password'?'新密码':'密码','password');
    const wrap=node('div',undefined,'lambert-password');password.replaceWith(wrap);wrap.append(password);
    const toggle=button('显示',()=>{password.type=password.type==='password'?'text':'password';toggle.textContent=password.type==='password'?'显示':'隐藏';});toggle.setAttribute('aria-label','显示或隐藏密码');wrap.append(toggle);
    password.placeholder=mode==='login'?'输入密码':'至少 8 位密码';
  }
  if(mode==='password')email.required=false;
  const submit=node('button',({login:'登录',register:'发送验证码',verify:'完成注册',reset:'发送重置邮件',password:'保存新密码'})[mode]);submit.type='submit';body.append(submit);
  const formMode=mode;
  body.onsubmit=event=>{event.preventDefault();action(async()=>{
    const secret=password?.value;
    if(formMode==='login'){try{const data=await account.login(email.value,secret);loginEmail=email.value.trim();user=data.user;if(!enforceWorkspaceUser())return;journal=new WorkspaceJournal(localStorage,user.id);renderBody();schedule();}finally{password.value='';}return;}
    if(formMode==='register'){await account.sendRegistrationCode(email.value);registrationEmail=email.value.trim();loginEmail=registrationEmail;resendAt=Date.now()+60000;mode='verify';renderBody();return;}
    if(formMode==='verify'){await account.completeRegistration(registrationEmail,code.value,secret);password.value='';mode='login';renderBody();tell('注册成功，请用邮箱和密码登录。');return;}
    if(formMode==='reset'){await account.reset(email.value);tell('如果该邮箱已注册，我们会发送重置密码邮件，请检查收件箱。');return;}
    try{await account.changePassword(secret);recovery=false;mode='login';renderBody();tell('密码已更新。手机端可使用新密码登录。');}finally{password.value='';}
  });};
  if(mode==='login')body.append(button('注册账号',()=>{loginEmail=email.value.trim();mode='register';renderBody();}),button('忘记密码',()=>{loginEmail=email.value.trim();mode='reset';renderBody();}));
  else if(verify){
    const resend=button('重新发送',()=>{if(Date.now()<resendAt)return;action(async()=>{await account.resend(registrationEmail);resendAt=Date.now()+60000;tell('验证码已重新发送，请检查邮箱。');});});
    const update=()=>{if(!resend.isConnected)return;const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));resend.disabled=busy||seconds>0;resend.textContent=seconds?'重新发送（'+seconds+'s）':'重新发送';};
    body.append(resend,button('修改邮箱',()=>{mode='register';renderBody();}),button('返回登录',()=>{mode='login';renderBody();}));update();const timer=setInterval(()=>{if(!resend.isConnected){clearInterval(timer);return;}update();},1000);
  }else if(mode!=='password')body.append(button('返回登录',()=>{loginEmail=email.value.trim();mode='login';renderBody();}));
}
async function prepareWorkspace(importLocal){
  await action(async()=>{
    const selectedUser=user.id,selectedActive=localStorage.getItem(ACTIVE_KEY);
    const ensureSelection=()=>{if(leaving||user?.id!==selectedUser||localStorage.getItem(ACTIVE_KEY)!==selectedActive)throw Error('account_mismatch');};
    const verified=await account.verifiedUser();ensureSelection();if(verified.id!==selectedUser)throw Error('account_mismatch');
    const importJournal=new WorkspaceJournal(localStorage,selectedUser);await pullWorkspace(account.client,importJournal);ensureSelection();
    if(!importLocal){retainWorkspaceBackup(localStorage,importJournal);localStorage.setItem(ACTIVE_KEY,user.id);location.reload();return;}
    const snapshot=readGuest();const guestFingerprint=stable(snapshot);const records=prepareLocalImport(snapshot);
    const plan=planImport(records,[...importJournal.entries().values()].map(r=>({kind:r.kind,itemId:r.item_id,payload:r.payload,deletedAt:r.deleted_at})));
    const importFingerprint=stable([...importJournal.entries().values()]);
    // Show actual counts before changing the selected account's workspace.
    body.replaceChildren();body.onsubmit=null;body.append(node('p','将新增 '+plan.create.length+' 条，相同 '+plan.unchanged.length+' 条，冲突 '+plan.conflicts.length+' 条。冲突保留云端内容，本地原始数据仍保留。'));
    retainWorkspaceBackup(localStorage,importJournal);
    body.append(node('p','已在本机另存导入前备份；原始数据也会保留。可额外下载备份到电脑。'));
    const save=accountRow('下载完整备份','backup',backup);body.append(save);
    const label=node('label');const check=node('input');check.type='checkbox';label.append(check,node('span','确认将上述数据导入到 '+user.email));body.append(label);
    body.append(button('确认导入并启用同步',()=>{if(!check.checked){tell('请先核对导入数量并勾选确认。');return;}action(async()=>{
      // Recheck identity and remote state before committing a preview. A concurrent
      // edit after this check still becomes a version conflict at the server.
      ensureSelection();const verifiedNow=await account.verifiedUser();ensureSelection();if(verifiedNow.id!==selectedUser)throw Error('account_mismatch');
      await pullWorkspace(account.client,importJournal);ensureSelection();
      const currentEntries=[...importJournal.entries().values()];if(stable(currentEntries)!==importFingerprint||stable(readGuest())!==guestFingerprint)throw Object.assign(Error('workspace_changed'),{code:'workspace_changed'});
      const values={};for(const key of DATA_KEYS){const kind=key==='daily_reviews_v2'?'reviews':key;const current=importJournal.read(key,key==='daily_reviews_v2'?{}:[]);const adds=plan.create.filter(r=>r.kind===kind);const merged=kind==='reviews'?{...current,...Object.fromEntries(adds.map(r=>[r.itemId,r.payload]))}:current.concat(adds.map(r=>r.payload));values[key]=merged;}retainWorkspaceBackup(localStorage,importJournal);importJournal.writeMany(values);
      localStorage.setItem(ACTIVE_KEY,user.id);location.reload();
    });}),button('返回',renderBody));
    message=node('p','', 'lambert-account-message');message.setAttribute('role','status');body.append(message);
  });
}
function accountIcon(name){
 const paths={user:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-2a8 8 0 0 1 16 0v2',cloud:'M7 18h11a4 4 0 0 0 0-8h-1a6 6 0 0 0-12-1 4.5 4.5 0 0 0 2 9',import:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',sync:'M4 11a8 8 0 0 1 14-5l2 2M20 3v5h-5M20 13a8 8 0 0 1-14 5l-2-2M4 21v-5h5',backup:'M5 3h14v18H5zM8 3v6h8V3M8 21v-7h8v7',logout:'M10 4H4v16h6M9 12h12m-4-4 4 4-4 4',right:'m9 5 7 7-7 7',close:'M6 6l12 12M18 6 6 18',check:'M4 12l6 6L21 5'};
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.user);svg.append(p);return svg;
}
function accountRow(label,icon,fn){const row=button('',fn);row.className='lambert-account-row';row.setAttribute('aria-label',label);row.append(accountIcon(icon),node('span',label),accountIcon('right'));return row;}
function accountHero(email,subtitle){const hero=node('div',undefined,'lambert-account-hero'),mark=node('span',undefined,'lambert-account-mark');mark.append(accountIcon('check'));const text=node('div');text.append(node('p',email,'lambert-account-email'),node('p',subtitle));hero.append(mark,text);return hero;}
function renderBody(){
  if(!body)return;body.replaceChildren();body.onsubmit=null;
  if(!config?.configured){body.append(node('p','邮箱登录正在准备，暂未连接账号服务。现有数据仍保存在本机。'));}
  else if(!user||recovery){if(recovery)mode='password';showForm();}
  else {
    body.append(accountHero(user.email,status()));
    if(localStorage.getItem(ACTIVE_KEY)!==user.id){body.append(node('p','选择使用云端数据，或将本机任务、项目和复盘导入此账号。登录本身不会自动上传本机内容。'),accountRow('使用云端工作台','cloud',()=>prepareWorkspace(false)),accountRow('检查并导入本机数据','import',()=>prepareWorkspace(true)));}
    else {
      body.append(accountRow('检查并导入本机数据','import',()=>prepareWorkspace(true)),accountRow('立即同步','sync',()=>action(async()=>{await flush();tell(status());})),accountRow('下载完整备份','backup',backup));
      const conflicts=journal.conflicts();for(const op of conflicts){
        const latest=journal.batches().flatMap(b=>b.ops).filter(p=>p.kind===op.kind&&p.itemId===op.itemId).at(-1)||op;
        body.append(conflictCard(op,latest,choice=>action(async()=>{journal.resolve(op.kind,op.itemId,choice);renderBody();changed();await flush();})));
      }
    }
    body.append(accountRow('退出登录','logout',()=>action(async()=>{await account.logout();leaveWorkspace();})));
  }
  if(native){
    const update=accountRow('检查云端更新','sync',()=>action(async()=>{
      let response=await fetch('/assets/mobile/__updates/check',{cache:'no-store'});if(!response.ok)throw Error('暂时无法检查更新');let state=await response.json();tell(state.message);
      for(let i=0;i<12&&state.checking;i++){await new Promise(resolve=>setTimeout(resolve,1000));if(!dialog?.open)return;response=await fetch('/assets/mobile/__updates/status',{cache:'no-store'});state=await response.json();tell(state.message);}
    }));body.append(update);
  }
  message=node('p','','lambert-account-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');body.append(message);updateEntry();
}
function open(){
  if(dialog?.open){dialog.focus();return;}
  dialog=node('dialog',undefined,'lambert-account');dialog.setAttribute('aria-label','我的账户');
  const header=node('div',undefined,'lambert-account-head');const brand=node('div',undefined,'lambert-account-brand'),logo=node('span',undefined,'lambert-account-logo');logo.append(accountIcon('check'));brand.append(logo,node('h2','我的账户'));const close=button('',()=>dialog.close());close.append(accountIcon('close'));close.className='lambert-account-close';header.append(brand,close);body=node('form');header.lastChild.setAttribute('aria-label','关闭账户');dialog.append(header,body);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();dialog=null;body=null;message=null;},{once:true});dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});renderBody();dialog.showModal();header.lastChild.focus();
}
async function prepareCloudAction(){
  await ready;if(!account||!user||localStorage.getItem(ACTIVE_KEY)!==user.id)throw Error('请先登录邮箱并启用云端工作台');
  if(!navigator.onLine)throw Error('当前离线，请联网后再归档');
  const current=journal;const run=async()=>{await synchronize(account.client,current);if(current.pending().length||current.conflicts().length)throw Error('请先完成同步并处理冲突，再归档飞书');};
  if(navigator.locks)await navigator.locks.request('lambert-sync:'+user.id,run);else await run();
  const session=await account.session();if(session?.user?.id!==current.userId||!session.access_token)throw Error('账号已变化，请重新打开复盘');
  return {accessToken:session.access_token};
}
window.LambertAccount={open,ready,status,prepareCloudAction};if(entry)entry.onclick=open;
async function start(){
  try{
    try{const response=await fetch(configUrl,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('config_failed');config=await response.json();localStorage.setItem('lambert_public_config_v1',JSON.stringify(config));}
    catch{config=JSON.parse(localStorage.getItem('lambert_public_config_v1')||'{"configured":false}');}
    if(config.configured){if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)||!/^https:\/\/[^/?#]+$/.test(config.siteUrl))throw Error('invalid_public_config');
      account=createAccount(createClient(config.url,config.publishableKey,{auth:{storageKey:SESSION_KEY+':'+new URL(config.url).host,persistSession:true,autoRefreshToken:true,detectSessionInUrl:accountPage,flowType:'implicit'}}),{redirectTo:config.siteUrl+'/account.html',registrationClient:createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'lambert_registration_memory'}})});
      // Subscribe before getSession so PASSWORD_RECOVERY is not missed on the callback page.
      account.subscribe((event,session)=>{setTimeout(()=>{if(leaving)return;const changedUser=(user?.id||null)!==(session?.user?.id||null);user=session?.user||null;if(!enforceWorkspaceUser())return;if(user&&(!journal||changedUser))journal=new WorkspaceJournal(localStorage,user.id);if(event==='PASSWORD_RECOVERY'){recovery=true;open();}if(event==='SIGNED_OUT'){if(window.LambertData?.active){leaveWorkspace();return;}localStorage.removeItem(ACTIVE_KEY);}if(changedUser||event==='PASSWORD_RECOVERY')renderBody();updateEntry();schedule();},0);});
      const session=await account.session();user=session?.user||null;if(!enforceWorkspaceUser())return;if(user)journal=new WorkspaceJournal(localStorage,user.id);
    }
  }catch{config={configured:false};}
  updateEntry();resolveReady();if(accountPage)open();else if(dialog)renderBody();schedule();
}
window.addEventListener('storage',event=>{if(user&&event.key?.startsWith('lambert_workspace_v1:'+user.id+':')){changed();updateEntry();}});
window.addEventListener('lambert-local-change',schedule);
window.addEventListener('online',()=>{if(account)schedule();else start();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
setInterval(()=>{if(!document.hidden)flush();},30000);
start();
