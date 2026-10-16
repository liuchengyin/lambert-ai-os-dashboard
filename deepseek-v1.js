// DeepSeek V1: additive, read-only assistant. Never write to existing task/project/review keys.
(()=>{
  'use strict';
  const CACHE='ai_daily_insights_v1',CONSENT='ai_consent_v1',DAY='ai_auto_day_v1';
  const $=id=>document.getElementById(id);
  const get=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}};
  const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const date=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  let busy=false,booted=false,lastHash='',result=null,generatedAt='',notice='',loginPending=null;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
  function snapshot(){
    const tasks=get('tasks',[]).filter(t=>t&&t.status!=='已完成'&&t.title).slice(0,200);
    const top3=get('top3_task_ids_v1',[]);
    const byPriority=t=>top3.includes(t.id)?-5:t.priority==='P1'?0:t.priority==='P2'?1:2;
    const selected=tasks.sort((a,b)=>byPriority(a)-byPriority(b)).slice(0,30).map(t=>({id:String(t.id||''),title:String(t.title||'').slice(0,140),status:t.status,priority:t.priority,matrix:t.matrix,due:t.due,project:t.project}));
    const projects=get('projects',[]).filter(p=>p&&p.name&&p.status!=='已完成').slice(0,15).map(p=>({id:p.id,name:p.name,status:p.status,due:p.due}));
    return {localDate:date(),tasks:selected,projects,top3Ids:top3.filter(id=>selected.some(t=>t.id===id)).slice(0,3)};
  }
  const hash=s=>JSON.stringify(s);
  function button(label,fn,cls=''){const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b}
  function mount(){
    const home=$('home'),head=home?.querySelector('.s1-head');
    if(head&&!home.querySelector('#aiDailyCard')){
      const card=node('section','s1-panel ai-daily-card');card.id='aiDailyCard';
      head.insertAdjacentElement('afterend',card);draw();
    }
    const tasks=$('tasks'),taskHead=tasks?.querySelector('.task-v5-head');
    if(taskHead&&!tasks.querySelector('#aiTaskAction')){
      const action=node('div','ai-task-action');action.id='aiTaskAction';
      action.append(button('✦ AI 分析任务',()=>analyze(true),'ai-secondary'));
      taskHead.insertAdjacentElement('afterend',action);
    }
    if(tasks?.querySelector('#aiTaskAction')&&!tasks.querySelector('#aiTaskResult')){
      const panel=node('section','ai-task-result');panel.id='aiTaskResult';
      tasks.querySelector('#aiTaskAction').insertAdjacentElement('afterend',panel);
      renderTaskResult();
    }
  }
  function renderTaskResult(){
    const el=$('aiTaskResult');if(!el)return;
    el.replaceChildren();
    if(notice)el.append(node('p','ai-note',notice));
    if(!result){el.append(node('p','ai-note','AI 建议将在这里显示；需先在首页授权并登录。'));return}
    el.append(node('strong','',result.summary||'任务分析完成'));
    const titles=new Map(snapshot().tasks.map(t=>[t.id,t.title]));
    (result.focus||[]).forEach(x=>el.append(node('p','', (titles.get(x.taskId)||'任务')+'：'+(x.nextAction||x.why||''))));
  }
  function draw(message){
    if(typeof message==='string')notice=message;
    renderTaskResult();
    const card=$('aiDailyCard');if(!card)return;
    card.replaceChildren();
    const title=node('div','ai-card-heading');title.append(node('strong','', '✦ AI 今日参谋'));
    const refresh=button(busy?'分析中…':'重新分析',()=>analyze(true),'ai-secondary');refresh.disabled=busy;title.append(refresh);
    card.append(title);
    if(notice)card.append(node('p','ai-note',notice));
    if(get(CONSENT,false)!==true){
      card.append(node('p','ai-note','启用后，每天首次打开工作台自动分析任务，也可手动刷新。任务摘要会发送给 DeepSeek；不会上传复盘或笔记。'));
      card.append(button('同意发送任务摘要并启用',async()=>{set(CONSENT,true);draw();try{if(await login())analyze(true)}catch{draw('登录连接失败，请检查网络后重试。')}},'ai-primary'));
      return;
    }
    if(!result){
      if(!notice)card.append(node('p','ai-note','尚无分析结果。首次分析需要先完成安全登录和 API 配置。'));
      card.append(button('关闭 AI 自动分析',()=>{set(CONSENT,false);draw()},'ai-quiet'));
      return;
    }
    card.append(node('p','ai-summary',result.summary||'今日分析已完成'));
    const snap=snapshot(),titles=new Map(snap.tasks.map(t=>[t.id,t.title]));
    for(const x of result.focus||[]){
      const row=node('div','ai-focus');
      row.append(node('strong','',titles.get(x.taskId)||'任务'));
      row.append(node('span','',x.why||''));
      row.append(node('small','',x.nextAction?'下一步：'+x.nextAction:''));
      card.append(row);
    }
    for(const x of result.alerts||[])card.append(node('p','ai-alert','注意：'+x.reason));
    const stale=lastHash&&lastHash!==hash(snapshot());
    card.append(node('div','ai-footer',(generatedAt?'分析于 '+new Date(generatedAt).toLocaleString('zh-CN'):'')+(stale?' · 任务有变化，可重新分析':'')));
    card.append(button('关闭 AI 自动分析',()=>{set(CONSENT,false);draw()},'ai-quiet'));
  }
  async function call(payload){
    const r=await fetch('/api/ai-analyze',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(40000)});
    const j=await r.json().catch(()=>({ok:false,code:'invalid_response'}));
    return {status:r.status,...j};
  }
  async function login(){
    if(loginPending)return loginPending;
    loginPending=performLogin();
    try{return await loginPending}finally{loginPending=null}
  }
  async function performLogin(){
    return new Promise(resolve=>{
      const dialog=node('dialog','ai-login-dialog'),form=node('form');
      form.method='dialog';
      form.append(node('h3','','AI 安全登录'),node('p','','请输入 Vercel 配置的个人 AI 访问密码（不是 DeepSeek API Key）。'));
      const input=node('input');input.type='password';input.autocomplete='current-password';input.required=true;input.maxLength=256;input.setAttribute('aria-label','AI 访问密码');
      const error=node('p','ai-login-error');error.setAttribute('role','alert');
      let pending=false;
      const actions=node('div','ai-login-actions');
      const cancel=button('取消',()=>dialog.close('cancel'));
      const confirm=button('登录',submitLogin,'ai-primary');
      actions.append(cancel,confirm);form.append(input,error,actions);dialog.append(form);document.body.append(dialog);
      form.addEventListener('submit',e=>{e.preventDefault();submitLogin()});
      async function submitLogin(){
        if(pending||!form.reportValidity())return;
        pending=true;confirm.disabled=true;confirm.textContent='登录中…';error.textContent='';
        try{
          const out=await call({action:'login',password:input.value});
          if(!dialog.isConnected)return;
          if(out.ok){dialog.close('ok');return}
          const messages={
            not_configured:'AI 服务端配置未完成（503），请检查 Preview 环境变量。',
            wrong_password:'访问密码不匹配（401），请输入 AI_ACCESS_PASSWORD，不是 API Key。',
            rate_limited:'登录尝试次数过多（429），请等待一小时后重试。',
            temporarily_unavailable:'登录服务暂不可用（503），请检查服务配置与网络。',
            rate_store_unavailable:'限流数据库连接失败（503），请检查 Upstash REST URL 和 Token。',
            origin:'请求来源校验失败（403），请从当前 Preview 地址打开网页。',
            invalid_response:'服务端未返回有效 JSON，请检查部署及网络。'
          };
          error.textContent=messages[out.code]||('AI 登录失败（HTTP '+out.status+'，'+(out.code||'unknown')+'）。');
          draw(error.textContent);input.focus();input.select();
        }catch{if(dialog.isConnected)error.textContent='连接失败，请检查网络后重试。'}
        finally{pending=false;if(dialog.isConnected){confirm.disabled=false;confirm.textContent='登录'}}
      }
      dialog.addEventListener('close',()=>{const ok=dialog.returnValue==='ok';input.value='';dialog.remove();resolve(ok)},{once:true});
      dialog.showModal();input.focus();
    });
  }
  async function analyze(manual=false){
    if(busy||get(CONSENT,false)!==true)return;
    const snap=snapshot(),fingerprint=hash(snap);
    if(!snap.tasks.length){result={summary:'当前没有待分析的任务，先添加一件最重要的事。',focus:[],alerts:[]};generatedAt=new Date().toISOString();lastHash=fingerprint;draw();return}
    busy=true;draw('正在分析任务…');
    try{
      let out=await call({action:'analyze',...snap});
      if(out.code==='auth_required'){
        busy=false;draw('需要先登录才能使用 AI');
        if(!manual){return}
        if(!await login())return;
        busy=true;out=await call({action:'analyze',...snap});
      }
      if(!out.ok){draw(errorMessage(out));return}
      result=out.result;generatedAt=out.generatedAt||new Date().toISOString();lastHash=fingerprint;notice='';
      const previous=get(CACHE,{});
      previous[date()]={result,generatedAt,fingerprint};
      const keys=Object.keys(previous).sort().slice(-7),recent={};keys.forEach(k=>recent[k]=previous[k]);set(CACHE,recent);
      set(DAY,date());draw();
    }catch{draw('网络不可用，已保留原始任务数据和之前的 AI 建议')}
    finally{busy=false;draw()}
  }
  function autoAnalyze(){
    if(get(CONSENT,false)!==true)return;
    const snap=snapshot(),cache=get(CACHE,{})[date()];
    if(cache?.result){result=cache.result;generatedAt=cache.generatedAt;lastHash=cache.fingerprint;draw();return}
    if(get(DAY,'')===date())return;
    // Only one automatic attempt per day; login is user-initiated and never prompts on page load.
    set(DAY,date());analyze(false);
  }
  function start(){
    if(booted)return;booted=true;
    mount();autoAnalyze();
    const observer=new MutationObserver(()=>{if(!$('aiDailyCard')||($('tasks')?.querySelector('.task-v5-head')&&!$('aiTaskAction')))mount()});
    observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
  }
  function errorMessage(out){
    return ({busy:'已有 AI 请求正在处理，请稍后重试。',too_large:'消息与任务摘要过长，请缩短对话或开始新对话。',not_configured:'服务端 AI 功能尚未启用，请检查 Preview 配置。',rate_limited:'已达到安全调用上限，请稍后重试。',rate_store_unavailable:'限流数据库连接失败，请检查 Upstash 配置。',provider_auth:'DeepSeek 密钥校验失败，请检查 Preview 的 API Key。',provider_quota:'DeepSeek 额度不足，请检查平台余额。',provider_rate_limited:'DeepSeek 当前请求较多，请稍后重试。',provider_timeout:'DeepSeek 响应超时，请稍后重试。',provider_unavailable:'DeepSeek 调用失败，请检查服务、模型和网络。',invalid_model_output:'模型返回格式异常，请稍后重试。',invalid_payload:'请求内容不符合要求，请缩短消息后重试。',origin:'请求来源校验失败，请从当前 Preview 地址打开。',auth_required:'需要先登录 AI 服务。'})[out.code]||'AI 暂时不可用，原始任务不受影响。';
  }
  window.LambertAI={call,login,snapshot,errorMessage,analyze,hasConsent:()=>get(CONSENT,false)===true,markChanged:()=>draw('任务已新增，正在更新分析建议。')};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
