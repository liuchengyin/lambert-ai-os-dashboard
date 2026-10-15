// DeepSeek V1: additive, read-only assistant. Never write to existing task/project/review keys.
(()=>{
  'use strict';
  const CACHE='ai_daily_insights_v1',CONSENT='ai_consent_v1',DAY='ai_auto_day_v1';
  const $=id=>document.getElementById(id);
  const get=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}};
  const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const date=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  let busy=false,booted=false,lastHash='',result=null,generatedAt='';
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
  }
  function draw(message=''){
    const card=$('aiDailyCard');if(!card)return;
    card.replaceChildren();
    const title=node('div','ai-card-heading');title.append(node('strong','', '✦ AI 今日参谋'));
    title.append(button(busy?'分析中…':'重新分析',()=>analyze(true),'ai-secondary'));
    card.append(title);
    if(message)card.append(node('p','ai-note',message));
    if(get(CONSENT,false)!==true){
      card.append(node('p','ai-note','启用后，每天首次打开工作台自动分析任务，也可手动刷新。任务摘要会发送给 DeepSeek；不会上传复盘或笔记。'));
      card.append(button('同意发送任务摘要并启用',()=>{set(CONSENT,true);draw();autoAnalyze()},'ai-primary'));
      return;
    }
    if(!result){
      card.append(node('p','ai-note',message||'尚无分析结果。首次分析需要先完成安全登录和 API 配置。'));
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
    const r=await fetch('/api/ai-analyze',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json().catch(()=>({ok:false,code:'invalid_response'}));
    return {status:r.status,...j};
  }
  async function login(){
    const pass=window.prompt('AI 安全登录：请输入你在 Vercel 配置的个人 AI 访问密码（不要填写 DeepSeek API Key）');
    if(!pass)return false;
    const out=await call({action:'login',password:pass});
    if(!out.ok){draw(out.code==='not_configured'?'AI 尚未完成服务端安全配置':'登录失败或已达到安全限制');return false}
    return true;
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
      if(!out.ok){draw(out.code==='not_configured'?'服务端 AI 功能尚未启用':out.code==='rate_limited'?'已达到安全调用上限，请稍后重试':'分析失败，原始任务不受影响');return}
      result=out.result;generatedAt=out.generatedAt||new Date().toISOString();lastHash=fingerprint;
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
