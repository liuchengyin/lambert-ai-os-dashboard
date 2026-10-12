// Common links dashboard: iTab-style launcher + editable groups
(function(){
  const section=document.getElementById('knowledge');if(!section)return;
  if(!document.querySelector('link[href^="knowledge-itab-v2.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='knowledge-itab-v2.css?v=20261012-2';document.head.appendChild(l)}
  const navBtn=document.querySelector('nav button[data-v="knowledge"]');if(navBtn)navBtn.textContent='常用链接';
  const STORAGE='knowledge_link_library_v1',LOCK='knowledge_link_locked_v1';
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v||'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
  const id=()=>`link_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,gid=()=>`group_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const defaults=[
    {id:'g_tools',name:'工具',links:[
      {id:'l_chatgpt',title:'ChatGPT',url:'https://chatgpt.com/',desc:'AI 工作入口'},
      {id:'l_notion',title:'Notion',url:'https://www.notion.so/',desc:'知识与笔记'},
      {id:'l_feishu',title:'飞书',url:'https://www.feishu.cn/',desc:'任务与工作资料'}]},
    {id:'g_common',name:'常用',links:[]},{id:'g_learning',name:'学习',links:[]}
  ];
  let groups=get(STORAGE,defaults),locked=get(LOCK,true),query='',draggingGroupId=null,editing=null;
  if(!Array.isArray(groups)||!groups.length)groups=defaults;
  groups=groups.map(g=>({...g,links:(g.links||[]).map(l=>({...l,icon:l.icon||''}))}));

  section.innerHTML=`<div class="knowledge-page">
    <div class="knowledge-head"><div><h2>常用链接</h2><p>个人快捷启动台</p></div><button id="knowledgeLock" class="knowledge-lock"></button></div>
    <div class="knowledge-searchbar"><input id="knowledgeSearch" placeholder="搜索常用网站"><button id="knowledgeQuickAdd" type="button">添加链接</button></div>
    <div id="knowledgeEditBar" class="knowledge-editbar"><button id="knowledgeAddGroup" type="button">+ 添加分组</button><span>编辑模式：可改名、拖动分组、编辑链接</span></div>
    <div id="knowledgeGroups"></div>
    <div id="knowledgeLinks" style="display:none"></div>
  </div>`;

  const lockBtn=document.getElementById('knowledgeLock'),search=document.getElementById('knowledgeSearch'),root=document.getElementById('knowledgeGroups'),editBar=document.getElementById('knowledgeEditBar'),quickBtn=document.getElementById('knowledgeQuickAdd');
  const dlg=document.createElement('dialog');dlg.id='knowledgeLinkDlg';dlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3 id="kDlgTitle">添加链接</h3><label>链接地址<input id="kUrl" type="url" placeholder="https://example.com"></label><div class="knowledge-icon-row"><div class="knowledge-icon-preview"><img id="kIconPreview" alt=""></div><label class="knowledge-icon-input">图标链接（可选）<input id="kIcon" placeholder="留空自动识别网站图标"></label><button id="kAutoIcon" type="button">自动识别</button></div><label>名称<input id="kTitle" placeholder="可不填，自动使用网站域名"></label><label>说明<input id="kDesc" placeholder="一句话说明用途"></label><label>分组<select id="kGroup"></select></label><div class="dlgActions"><button value="cancel">取消</button><button id="kSave" type="button" class="task-primary-btn">保存</button></div></form>`;document.body.appendChild(dlg);
  const groupDlg=document.createElement('dialog');groupDlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3>添加分组</h3><label>分组名称<input id="kgName" placeholder="例如：工具 / 工作 / 学习"></label><div class="dlgActions"><button value="cancel">取消</button><button id="kgSave" type="button" class="task-primary-btn">保存</button></div></form>`;document.body.appendChild(groupDlg);

  function safeUrl(raw){let v=(raw||'').trim();if(!v)return '';if(!/^https?:\/\//i.test(v))v='https://'+v;try{return new URL(v).href}catch{return ''}}
  function host(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return '网站'}}
  function favicon(url){return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(url))}&sz=128`}
  function iconFor(link){return link.icon||favicon(link.url)}
  function persist(){set(STORAGE,groups)}
  function updateLock(){lockBtn.textContent=locked?'🔒':'🔓';lockBtn.title=locked?'点击解锁编辑':'点击锁定';editBar.style.display=locked?'none':'flex';quickBtn.style.display=locked?'none':'inline-block';document.body.classList.toggle('knowledge-unlocked',!locked)}
  function updateIconPreview(){const url=safeUrl(document.getElementById('kUrl').value),custom=document.getElementById('kIcon').value.trim(),img=document.getElementById('kIconPreview');img.src=custom||(url?favicon(url):'');img.style.visibility=img.src?'visible':'hidden'}
  function openLinkDlg(groupId,link=null){editing=link?.id?{groupId,linkId:link.id}:null;document.getElementById('kDlgTitle').textContent=link?.id?'编辑链接':'添加链接';const sel=document.getElementById('kGroup');sel.innerHTML='';groups.forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;sel.appendChild(o)});sel.value=groupId||groups[0]?.id||'';document.getElementById('kUrl').value=link?.url||'';document.getElementById('kTitle').value=link?.title||'';document.getElementById('kDesc').value=link?.desc||'';document.getElementById('kIcon').value=link?.icon||'';updateIconPreview();dlg.showModal()}
  function renameGroup(g){const name=prompt('修改分组名称',g.name);if(name===null)return;const clean=name.trim();if(!clean)return;g.name=clean;persist();render()}
  function moveGroup(fromId,toId){if(!fromId||!toId||fromId===toId)return;const from=groups.findIndex(g=>g.id===fromId),to=groups.findIndex(g=>g.id===toId);if(from<0||to<0)return;const [item]=groups.splice(from,1);groups.splice(to,0,item);persist();render()}
  function addTile(grid,g){if(locked||query.trim())return;const b=document.createElement('button');b.type='button';b.className='knowledge-add-tile';b.innerHTML='<div class="knowledge-add-icon">＋</div><span>添加链接</span>';b.onclick=()=>openLinkDlg(g.id);grid.appendChild(b)}
  function render(){
    root.innerHTML='';const q=query.trim().toLowerCase();
    groups.forEach(g=>{
      const links=g.links.filter(l=>!q||[l.title,l.url,l.desc].some(v=>String(v||'').toLowerCase().includes(q)));if(q&&!links.length)return;
      const sec=document.createElement('section');sec.className='knowledge-group';sec.dataset.groupId=g.id;sec.draggable=!locked;
      if(!locked){sec.addEventListener('dragstart',e=>{draggingGroupId=g.id;sec.classList.add('is-dragging');e.dataTransfer.effectAllowed='move'});sec.addEventListener('dragend',()=>{draggingGroupId=null;sec.classList.remove('is-dragging');document.querySelectorAll('.knowledge-group').forEach(x=>x.classList.remove('drag-over'))});sec.addEventListener('dragover',e=>{e.preventDefault();sec.classList.add('drag-over')});sec.addEventListener('dragleave',()=>sec.classList.remove('drag-over'));sec.addEventListener('drop',e=>{e.preventDefault();sec.classList.remove('drag-over');moveGroup(draggingGroupId,g.id)})}
      const head=document.createElement('div');head.className='knowledge-group-head';head.innerHTML=`<div class="knowledge-group-title-wrap">${!locked?'<span class="knowledge-drag-handle" title="拖动分组">⋮⋮</span>':''}<h3>${esc(g.name)}</h3><span>${links.length}</span></div><div class="knowledge-group-actions"></div>`;
      const actions=head.querySelector('.knowledge-group-actions');if(!locked){const r=document.createElement('button');r.textContent='改名';r.onclick=()=>renameGroup(g);const d=document.createElement('button');d.textContent='删除分组';d.className='danger-lite';d.onclick=()=>{if(g.links.length&&!confirm(`分组“${g.name}”还有 ${g.links.length} 个链接，仍要删除吗？`))return;if(confirm(`确认删除分组“${g.name}”吗？`)){groups=groups.filter(x=>x.id!==g.id);persist();render()}};actions.append(r,d)}
      sec.appendChild(head);const grid=document.createElement('div');grid.className='knowledge-grid';
      links.forEach(l=>{const card=document.createElement('article');card.className='knowledge-link-card';card.innerHTML=`<a href="${esc(l.url)}" target="_blank" rel="noopener"><div class="knowledge-link-icon"><img src="${esc(iconFor(l))}" onerror="this.style.display='none'" alt=""></div><div><strong>${esc(l.title||host(l.url))}</strong><p>${esc(l.desc||host(l.url))}</p></div></a><div class="knowledge-card-actions"></div>`;if(!locked){const a=card.querySelector('.knowledge-card-actions'),e=document.createElement('button'),d=document.createElement('button');e.textContent='编辑';e.onclick=()=>openLinkDlg(g.id,l);d.textContent='删除';d.onclick=()=>{if(confirm(`删除“${l.title||host(l.url)}”？`)){g.links=g.links.filter(x=>x.id!==l.id);persist();render()}};a.append(e,d)}grid.appendChild(card)});
      addTile(grid,g);if(!links.length&&locked)grid.innerHTML='<div class="knowledge-empty">暂无链接</div>';sec.appendChild(grid);root.appendChild(sec)
    });
    if(!root.children.length)root.innerHTML='<div class="knowledge-empty-large">没有匹配结果。</div>'
  }
  lockBtn.onclick=()=>{locked=!locked;set(LOCK,locked);updateLock();render()};search.oninput=e=>{query=e.target.value;render()};quickBtn.onclick=()=>openLinkDlg(groups[0]?.id);search.addEventListener('keydown',e=>{if(e.key==='Enter'&&!locked){e.preventDefault();quickBtn.click()}});
  document.getElementById('knowledgeAddGroup').onclick=()=>{document.getElementById('kgName').value='';groupDlg.showModal();setTimeout(()=>document.getElementById('kgName').focus(),20)};document.getElementById('kgSave').onclick=()=>{const name=document.getElementById('kgName').value.trim();if(!name)return;groups.push({id:gid(),name,links:[]});persist();groupDlg.close();render()};document.getElementById('kUrl').addEventListener('input',updateIconPreview);document.getElementById('kIcon').addEventListener('input',updateIconPreview);document.getElementById('kAutoIcon').onclick=()=>{document.getElementById('kIcon').value='';updateIconPreview()};
  document.getElementById('kSave').onclick=()=>{const url=safeUrl(document.getElementById('kUrl').value);if(!url){document.getElementById('kUrl').focus();return}const groupId=document.getElementById('kGroup').value,title=document.getElementById('kTitle').value.trim()||host(url),desc=document.getElementById('kDesc').value.trim(),icon=document.getElementById('kIcon').value.trim();if(editing){const oldGroup=groups.find(g=>g.id===editing.groupId),link=oldGroup?.links.find(l=>l.id===editing.linkId);if(link){oldGroup.links=oldGroup.links.filter(x=>x.id!==link.id);groups.find(g=>g.id===groupId)?.links.unshift({...link,title,url,desc,icon})}}else groups.find(g=>g.id===groupId)?.links.unshift({id:id(),title,url,desc,icon});persist();dlg.close();search.value='';query='';render()};
  updateLock();render();
})();

// Load V5 overview/task enhancements last so they can safely override the MVP renderers.
(function(){
  if(!document.querySelector('link[href="dashboard-v5.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='dashboard-v5.css';document.head.appendChild(l)}
  if(!document.querySelector('script[src="dashboard-v5.js"]')){const s=document.createElement('script');s.src='dashboard-v5.js';s.defer=false;document.body.appendChild(s)}
})();
