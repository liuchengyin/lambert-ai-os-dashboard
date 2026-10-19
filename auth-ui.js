/* Account identity is independent of localStorage and the legacy AI access-password session. */
(()=>{
  const root=document.querySelector('.lambert-brand');
  if(!root||document.getElementById('lambertAuthDialog'))return;
  const trigger=document.createElement('button');
  trigger.type='button';trigger.className='lambert-auth-trigger';trigger.textContent='登录';
  trigger.setAttribute('aria-label','打开个人账号登录');
  root.insertAdjacentElement('afterend',trigger);
  const dialog=document.createElement('dialog');dialog.id='lambertAuthDialog';
  dialog.innerHTML=`<div class="lambert-auth-inner">
    <div class="lambert-auth-head"><strong>登录 Lambert AI OS</strong><button class="lambert-auth-close" type="button" aria-label="关闭登录窗口">×</button></div>
    <div class="lambert-auth-note">登录用于识别个人账号。当前项目和任务仍保存在本机浏览器，登录不会自动同步或清除数据。</div>
    <button class="lambert-auth-option" id="lambertGoogleLogin" type="button">G　使用 Google 登录</button>
    <button class="lambert-auth-option" type="button" disabled title="微信开放平台资质待开通">微信扫码登录 · 即将支持</button>
    <div id="lambertAuthUser" class="lambert-auth-note"></div><div id="lambertAuthError" class="lambert-auth-error" role="status"></div>
    <div class="lambert-auth-controls"><button class="lambert-auth-option" id="lambertAuthLogout" type="button" hidden>退出登录</button></div>
  </div>`;
  document.body.appendChild(dialog);
  const error=dialog.querySelector('#lambertAuthError'),userBox=dialog.querySelector('#lambertAuthUser'),logout=dialog.querySelector('#lambertAuthLogout'),login=dialog.querySelector('#lambertGoogleLogin');
  function show(){if(!dialog.open)dialog.showModal()}
  trigger.addEventListener('click',show);
  dialog.querySelector('.lambert-auth-close').addEventListener('click',()=>dialog.close());
  login.addEventListener('click',()=>{location.href='/api/auth/start'});
  async function refresh(){
    try{
      const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error('unavailable');
      const payload=await response.json(),signedIn=payload.authenticated&&payload.user;
      trigger.textContent=signedIn?(payload.user.name||'我的账号'):'登录';
      userBox.textContent=signedIn?'已登录：'+(payload.user.name||'Google 用户'):'尚未登录';
      logout.hidden=!signedIn;login.hidden=!!signedIn;
    }catch{error.textContent='无法读取登录状态；本地工作台仍可继续使用。'}
  }
  logout.addEventListener('click',async()=>{
    logout.disabled=true;
    try{const res=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(!res.ok)throw Error('logout');await refresh()}
    catch{error.textContent='退出失败，请稍后重试。'}
    finally{logout.disabled=false}
  });
  const params=new URLSearchParams(location.search),result=params.get('auth');
  if(result==='failed'){error.textContent='Google 授权未完成，请重试。';show()}
  if(result==='success'){show()}
  if(result==='success'||result==='failed'){params.delete('auth');history.replaceState(null,'',location.pathname+(params.toString()?'?'+params:'')+location.hash)}
  refresh();
})();
