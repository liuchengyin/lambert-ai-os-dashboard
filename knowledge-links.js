// Knowledge link library: one-page link dashboard with lock/edit mode
(function(){
  const section=document.getElementById('knowledge');if(!section)return;
  const STORAGE='knowledge_link_library_v1';
  const LOCK='knowledge_link_locked_v1';
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v||'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
  const id=()=>`link_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const gid=()=>`group_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const defaults=[
    {id:'g_tools',name:'工具',links:[
      {id:'l_chatgpt',title:'ChatGPT',url:'https://chatgpt.com/',desc:'AI 工作入口'},
      {id:'l_notion',title:'Notion',url:'https://www.notion.so/',desc:'知识与笔记'},
      {id:'l_feishu',title:'飞书',url:'https://www.feishu.cn/',desc:'任务与工作资料'}
    ]},
    {id:'g_common',name:'常用',links:[]},
    {id:'g_learning',name:'学习',links:[]}
  ];
  let groups=get(STORAGE,defaults),locked=get(LOCK,true),query='';
  if(!Array.isArray(groups)||!groups.length)groups=defaults;

  section.innerHTML=`<div class="knowledge-page">
    <div class="knowledge-head"><div><h2>链接知识库</h2><p>把常用网站、资料入口和学习资源集中到一个页面。</p></div><button id="knowledgeLock" class="knowledge-lock"></button></div>
    <div class="knowledge-searchbar card"><input id="knowledgeSearch" placeholder="搜索 / 快速添加链接"><button id="knowledgeQuickAdd" type="button">快速添加</button></div>
    <div id="knowledgeEditBar" class="knowledge-editbar"><button id="knowledgeAddGroup" type="button">+ 添加分组</button><span>编辑模式：可以新增、修改、删除链接与分组</span></div>
    <div id="knowledgeGroups"></div>
    <div id="knowledgeLinks" style="display:none"></div>
  </div>`;

  const lockBtn=document.getElementById('knowledgeLock'),search=document.getElementById('knowledgeSearch'),root=document.getElementById('knowledgeGroups'),editBar=document.getElementById('knowledgeEditBar');
  const quickBtn=document.getElementById('knowledgeQuickAdd');

  const dlg=document.createElement('dialog');dlg.id='knowledgeLinkDlg';dlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3 id="kDlgTitle">添加链接</h3><label>链接地址<input id="kUrl" type="url" placeholder="https://example.com"></label><label>名称<input id="kTitle" placeholder="可不填，自动使用网站域名"></label><label>说明<input id="kDesc" placeholder="一句话说明用途"></label><label>分组<select id="kGroup"></select></label><div class="dlgActions"><button value="cancel">取消</button><button id="kSave" type="button" class="task-primary-btn">保存</button></div></form>`;document.body.appendChild(dlg);
  const groupDlg=document.createElement('dialog');groupDlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3>添加分组</h3><label>分组名称<input id="kgName" placeholder="例如：工具 / 常用 / 学习"></label><div class="dlgActions"><button value="cancel">取消</button><button id="kgSave" type="button" class="task-primary-btn">保存</button></div></form>`;document.body.appendChild(groupDlg);

  let editing=null;
  function safeUrl(raw){let v=(raw||'').trim();if(!v)return '';if(!/^https?:\/\//i.test(v))v='https://'+v;try{return new URL(v).href}catch{return ''}}
  function host(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return '网站'}}
  function favicon(url){const h=host(url);return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`}
  function persist(){set(STORAGE,groups)}
  function updateLock(){
    lockBtn.innerHTML=locked?'🔒':'🔓';lockBtn.title=locked?'点击解锁编辑':'点击锁定';
    editBar.style.display=locked?'none':'flex';quickBtn.style.display=locked?'none':'inline-block';
    document.body.classList.toggle('knowledge-unlocked',!locked)
  }
  function openLinkDlg(groupId,link=null){
    editing=link?{groupId,linkId:link.id}:null;
    document.getElementById('kDlgTitle').textContent=link?'编辑链接':'添加链接';
    const sel=document.getElementById('kGroup');sel.innerHTML='';groups.forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;sel.appendChild(o)});sel.value=groupId||groups[0]?.id||'';
    document.getElementById('kUrl').value=link?.url||'';document.getElementById('kTitle').value=link?.title||'';document.getElementById('kDesc').value=link?.desc||'';dlg.showModal();
  }
  function render(){
    root.innerHTML='';const q=query.trim().toLowerCase();
    groups.forEach(g=>{
      const links=g.links.filter(l=>!q||[l.title,l.url,l.desc].some(v=>String(v||'').toLowerCase().includes(q)));
      if(q&&!links.length)return;
      const sec=document.createElement('section');sec.className='knowledge-group card';
      const head=document.createElement('div');head.className='knowledge-group-head';head.innerHTML=`<div><h3>${esc(g.name)}</h3><span>${links.length}</span></div><div class="knowledge-group-actions"></div>`;
      const actions=head.querySelector('.knowledge-group-actions');
      if(!locked){
        const add=document.createElement('button');add.textContent='+ 链接';add.onclick=()=>openLinkDlg(g.id);actions.appendChild(add);
        const del=document.createElement('button');del.textContent='删除分组';del.className='danger-lite';del.onclick=()=>{if(g.links.length&&!confirm(`分组“${g.name}”还有 ${g.links.length} 个链接，仍要删除吗？`))return;if(confirm(`确认删除分组“${g.name}”吗？`)){groups=groups.filter(x=>x.id!==g.id);persist();render()}};actions.appendChild(del)
      }
      sec.appendChild(head);
      const grid=document.createElement('div');grid.className='knowledge-grid';
      if(!links.length)grid.innerHTML='<div class="knowledge-empty">暂无链接</div>';
      links.forEach(l=>{
        const card=document.createElement('article');card.className='knowledge-link-card';
        card.innerHTML=`<a href="${esc(l.url)}" target="_blank" rel="noopener"><img src="${favicon(l.url)}" onerror="this.style.display='none'" alt=""><div><strong>${esc(l.title||host(l.url))}</strong><p>${esc(l.desc||host(l.url))}</p></div></a><div class="knowledge-card-actions"></div>`;
        if(!locked){const a=card.querySelector('.knowledge-card-actions');const e=document.createElement('button');e.textContent='编辑';e.onclick=()=>openLinkDlg(g.id,l);const d=document.createElement('button');d.textContent='删除';d.onclick=()=>{if(confirm(`删除“${l.title||host(l.url)}”？`)){g.links=g.links.filter(x=>x.id!==l.id);persist();render()}};a.append(e,d)}
        grid.appendChild(card)
      });sec.appendChild(grid);root.appendChild(sec)
    });
    if(!root.children.length)root.innerHTML='<div class="card knowledge-empty-large">没有匹配结果。</div>'
  }
  lockBtn.onclick=()=>{locked=!locked;set(LOCK,locked);updateLock();render()};
  search.oninput=e=>{query=e.target.value;render()};
  quickBtn.onclick=()=>{const raw=search.value.trim();if(!raw){openLinkDlg(groups[0]?.id);return}const u=safeUrl(raw);if(u){openLinkDlg(groups[0]?.id,{id:'',url:u,title:'',desc:''});editing=null}else openLinkDlg(groups[0]?.id)};
  search.addEventListener('keydown',e=>{if(e.key==='Enter'&&!locked){e.preventDefault();quickBtn.click()}});
  document.getElementById('knowledgeAddGroup').onclick=()=>{document.getElementById('kgName').value='';groupDlg.showModal();setTimeout(()=>document.getElementById('kgName').focus(),20)};
  document.getElementById('kgSave').onclick=()=>{const name=document.getElementById('kgName').value.trim();if(!name)return;groups.push({id:gid(),name,links:[]});persist();groupDlg.close();render()};
  document.getElementById('kSave').onclick=()=>{
    const url=safeUrl(document.getElementById('kUrl').value);if(!url){document.getElementById('kUrl').focus();return}
    const groupId=document.getElementById('kGroup').value,title=document.getElementById('kTitle').value.trim()||host(url),desc=document.getElementById('kDesc').value.trim();
    if(editing){const oldGroup=groups.find(g=>g.id===editing.groupId),link=oldGroup?.links.find(l=>l.id===editing.linkId);if(link){oldGroup.links=oldGroup.links.filter(l=>l.id!==link.id);const target=groups.find(g=>g.id===groupId);target?.links.unshift({...link,title,url,desc})}}
    else{groups.find(g=>g.id===groupId)?.links.unshift({id:id(),title,url,desc})}
    persist();dlg.close();search.value='';query='';render()
  };
  updateLock();render();
})();