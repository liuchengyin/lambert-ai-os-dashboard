// Additive chat: model proposes, user reviews, this browser appends. No server data sync.
(()=>{
  'use strict';
  const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n};
  const button=(label,fn,cls='ai-secondary')=>{const b=el('button',cls,label);b.type='button';b.onclick=fn;return b};
  let sending=false,history=[],proposal=null,committing=false,committed=new Set();
  const api=()=>window.LambertAI;
  let panel,log,input,send,status,draft,examples;
  function message(role,value){
    const item=el('div','ai-chat-message ai-chat-'+role);
    item.append(el('small','',role==='user'?'你':'DeepSeek'),el('p','',value));log.append(item);
    if(examples)examples.hidden=true;
    while(log.children.length>12)log.firstElementChild.remove();
    log.scrollTop=log.scrollHeight;
  }
  function feedback(value){status.textContent=value}
  function field(label,value,onChange,type='text'){
    const wrap=el('label','ai-draft-field');wrap.append(el('span','',label));
    const control=el(type==='textarea'?'textarea':'input');if(type!=='textarea')control.type=type;
    if(type==='textarea')control.maxLength=300;
    control.value=value||'';control.addEventListener('input',()=>onChange(control.value));wrap.append(control);return wrap;
  }
  function showDraft(){
    draft.replaceChildren();
    if(!proposal||(!proposal.result.projects.length&&!proposal.result.tasks.length))return;
    const result=proposal.result;
    draft.append(el('h4','','待确认草稿 · '+result.projects.length+' 个项目 / '+result.tasks.length+' 个任务'));
    draft.append(el('p','ai-note','可直接修改下方内容。确认后新增到当前浏览器，不修改已有任务。'));
    result.projects.forEach(p=>{
      const card=el('div','ai-draft-item');card.append(el('strong','','新项目：'+p.name));
      // Keep project names stable so task associations cannot silently change during review.
      card.append(field('截止日期',p.due,v=>p.due=v,'date'),field('完成标准',p.standard,v=>p.standard=v,'textarea'));draft.append(card);
    });
    result.tasks.forEach((t,index)=>{
      if(t.due&&!t.due.includes('T'))t.due+='T23:59';
      const card=el('div','ai-draft-item');
      const title=field('任务名称',t.title,v=>t.title=v);title.querySelector('input').maxLength=140;
      card.append(title);
      const row=el('div','ai-draft-row');
      row.append(field('截止时间',t.due,v=>t.due=v,'datetime-local'));
      const priority=el('label','ai-draft-field');priority.append(el('span','','优先级'));
      const select=el('select');for(const p of ['P1','P2','P3']){const o=el('option','',p);o.value=p;select.append(o)}select.value=t.priority;select.onchange=()=>t.priority=select.value;
      priority.append(select);row.append(priority);card.append(row);
      card.append(el('small','ai-note',t.project?'关联项目：'+t.project:'独立任务'),field('下一步 / 备注',t.note,v=>t.note=v,'textarea'));
      card.append(button('从草稿移除此任务',()=>{result.tasks.splice(index,1);if(!result.tasks.length&&!result.projects.length)proposal=null;showDraft();feedback('已从草稿移除，现有任务不受影响。')},'ai-draft-remove'));draft.append(card);
    });
    const actions=el('div','ai-chat-actions');
    actions.append(button('确认创建',commit,'ai-primary'),button('取消草稿',()=>{proposal=null;showDraft();feedback('草稿已取消，没有创建任务。')}));
    draft.append(actions);
  }
  function loadRows(key){
    const parsed=JSON.parse(localStorage.getItem(key)||'[]');
    if(!Array.isArray(parsed))throw Error('invalid_storage');return parsed;
  }
  function commit(){
    if(!proposal||committing)return;
    const {requestId,result}=proposal;if(committed.has(requestId))return;
    if(result.tasks.some(t=>!t.title.trim())){feedback('请填写每个任务的名称。');return}
    committing=true;
    try{
      if(typeof state==='undefined')throw Error('missing_state');
      const projects=loadRows('projects'),tasks=loadRows('tasks');
      if([...projects,...tasks].some(x=>x.aiRequestId===requestId)){committed.add(requestId);proposal=null;showDraft();feedback('这份草稿已经创建过。');return}
      // A different tab may have written since this page rendered. Do not overwrite it.
      if(JSON.stringify(projects)!==JSON.stringify(state.projects)||JSON.stringify(tasks)!==JSON.stringify(state.tasks)){
        feedback('数据已在其他页面更新。请刷新页面后重新生成草稿，以免覆盖新内容。');return;
      }
      const createdAt=new Date().toISOString(),names=new Set(projects.map(p=>p.name));
      const newProjects=result.projects.filter(p=>!names.has(p.name)).map(p=>({id:'project_'+crypto.randomUUID(),name:p.name,status:'待开始',due:p.due,standard:p.standard.slice(0,300),createdAt,aiRequestId:requestId}));
      newProjects.forEach(p=>names.add(p.name));
      const existing=new Set(tasks.map(t=>JSON.stringify([t.title.trim(),t.project||''])));
      const newTasks=[];
      for(const t of result.tasks){
        const title=t.title.trim().slice(0,140),project=names.has(t.project)?t.project:'';
        const key=JSON.stringify([title,project]);if(existing.has(key))continue;existing.add(key);
        newTasks.push({id:'task_'+crypto.randomUUID(),title,project,status:'待开始',priority:t.priority,matrix:'q2',due:t.due,note:t.note.slice(0,300),createdAt,aiRequestId:requestId});
      }
      const nextProjects=[...newProjects,...projects],nextTasks=[...newTasks,...tasks];
      // Preserve both exact originals if the second localStorage write fails (e.g. quota).
      const originalProjects=localStorage.getItem('projects');
      if(newProjects.length)localStorage.setItem('projects',JSON.stringify(nextProjects));
      try{if(newTasks.length)localStorage.setItem('tasks',JSON.stringify(nextTasks))}
      catch(error){if(newProjects.length){if(originalProjects===null)localStorage.removeItem('projects');else localStorage.setItem('projects',originalProjects)}throw error}
      state.projects=nextProjects;state.tasks=nextTasks;
      committed.add(requestId);proposal=null;showDraft();
      // Use current renderers: refreshAll still targets inputs removed by Dashboard V5.
      renderTaskBoard();renderProjectBoard();renderHome();document.dispatchEvent(new Event('lambert:plan-created'));
      // Creating a reviewed plan should feed straight into the existing daily analysis.
      if(newTasks.length||newProjects.length){api().markChanged();if(api().hasConsent())api().analyze(false)}
      feedback('已创建 '+newProjects.length+' 个项目、'+newTasks.length+' 个任务。已有同名条目已跳过。');
      const actions=el('div','ai-chat-actions');
      actions.append(button('查看任务',()=>{const task=newTasks[0]&&state.tasks.find(t=>t.id===newTasks[0].id);if(task&&window.TaskCenter&&window.TaskCenterModel)TaskCenter.openProject(TaskCenterModel.resolveProject(task,state.projects));else openView('tasks')}),button('查看项目',()=>openView('projects')),button('分析更新后的任务',()=>{document.querySelector('#aiDailyCard .ai-secondary')?.click();document.getElementById('aiDailyCard')?.scrollIntoView({behavior:'smooth',block:'start'})}));draft.append(actions);
    }catch{feedback(committed.has(requestId)?'数据已保存，但页面未能刷新。请刷新后查看任务和项目。':'保存失败，草稿已保留。请检查浏览器存储空间后重试。')}
    finally{committing=false}
  }
  async function submit(){
    if(sending)return;
    const content=input.value.trim();if(!content){input.focus();return}
    if(!api()?.hasConsent()){feedback('请先在上方「AI 今日参谋」同意发送任务摘要并启用。');return}
    if(proposal){feedback('请先确认创建或取消当前草稿，再发送下一条消息。');return}
    sending=true;send.disabled=true;input.disabled=true;feedback('DeepSeek 正在整理…');
    try{
      const now=new Date(),snapshot=api().snapshot();
      const payload={action:'chat',...snapshot,message:content,history:history.slice(-6),weekday:now.toLocaleDateString('zh-CN',{weekday:'long'}),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
      let out=await api().call(payload);
      if(out.code==='auth_required'){
        feedback('需要登录 AI 服务。');
        if(!await api().login()){feedback('登录未完成，输入内容已保留。');return}
        out=await api().call(payload);
      }
      if(!out.ok){feedback(api().errorMessage(out));return}
      if(!out.result||typeof out.result.reply!=='string'||!Array.isArray(out.result.projects)||!Array.isArray(out.result.tasks)||typeof out.requestId!=='string')throw Error('invalid_response');
      message('user',content);message('assistant',out.result.reply);
      history.push({role:'user',content},{role:'assistant',content:out.result.reply.slice(0,2000)});history=history.slice(-6);
      input.value='';proposal=(out.result.projects.length||out.result.tasks.length)?out:null;showDraft();
      feedback(proposal?'草稿已生成，请核对后确认创建。':'回复已生成。可继续提问或说明要创建的任务。');
    }catch{feedback('连接失败或响应异常，输入内容已保留，可稍后重试。')}
    finally{sending=false;send.disabled=false;input.disabled=false;input.focus()}
  }
  function mount(){
    if(document.getElementById('aiChatPanel'))return;
    const anchor=document.getElementById('aiDailyCard');if(!anchor)return;
    // Dashboard rerenders replace home.innerHTML. Reattach the same node so an open
    // conversation, unsent message or reviewed draft survives task/project changes.
    if(panel){anchor.insertAdjacentElement('afterend',panel);return}
    panel=el('section','ai-chat-panel');panel.id='aiChatPanel';
    const head=el('div','ai-card-heading');head.append(el('strong','','和 DeepSeek 一起推进'));
    const clear=button('新对话',()=>{if(sending)return;if(proposal){feedback('请先确认或取消草稿，再开始新对话。');return}history=[];log.replaceChildren();examples.hidden=false;feedback('已开始新对话，已有任务和项目不受影响。')});head.append(clear);panel.append(head);
    panel.append(el('p','ai-note','说出要做的事，整理成任务或项目。对话仅保留在本次页面，消息和任务摘要将发送给 DeepSeek。'));
    log=el('div','ai-chat-log');log.setAttribute('role','log');log.setAttribute('aria-label','与 DeepSeek 的对话');panel.append(log);
    examples=el('div','ai-chat-examples');
    ['创建一个任务：明晚练习 SQL，先做 10 分钟','创建英语学习项目，拆成听力和跟读两个任务','分析我现在的任务，建议今天先做哪一件'].forEach(value=>examples.append(button(value,()=>{input.value=value;input.focus()})));panel.append(examples);
    const form=el('form','ai-chat-form');input=el('textarea');input.id='aiChatInput';input.rows=3;input.maxLength=2000;input.placeholder='例如：建一个求职项目，本周先修改简历、准备履约案例';input.setAttribute('aria-label','发送给 DeepSeek 的消息');form.append(input);
    const actions=el('div','ai-chat-actions');actions.append(el('small','ai-note','Enter 换行 · Ctrl / ⌘ + Enter 发送'));
    send=button('发送',submit,'ai-primary');actions.append(send);form.append(actions);
    form.onsubmit=e=>{e.preventDefault();submit()};input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit()}});panel.append(form);
    status=el('p','ai-chat-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
    draft=el('div','ai-chat-draft');panel.append(draft);anchor.insertAdjacentElement('afterend',panel);
  }
  function start(){mount();new MutationObserver(mount).observe(document.getElementById('home'),{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
