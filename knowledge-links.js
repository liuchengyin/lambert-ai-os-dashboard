// Common links dashboard: iTab-style launcher + editable groups + wallpaper
(function(){
  const section=document.getElementById('knowledge');if(!section)return;
  if(!document.querySelector('link[href^="knowledge-itab-v2.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='knowledge-itab-v2.css?v=20261017-2';document.head.appendChild(l)}
  const navBtn=document.querySelector('nav button[data-v="knowledge"]');if(navBtn)navBtn.textContent='常用链接';
  const STORAGE='knowledge_link_library_v1',LOCK='knowledge_link_locked_v1',WALL='knowledge_wallpaper_v1';
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v||'').replace(/[&<>'\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
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
    <div class="knowledge-head"><div><h2>常用链接</h2><p>个人快捷启动台</p></div><div class="knowledge-head-actions"><button id="knowledgeWallpaper" class="knowledge-wallpaper-btn" type="button">壁纸</button><button id="knowledgeLock" class="knowledge-lock"></button></div></div>
    <div class="knowledge-searchbar"><input id="knowledgeSearch" placeholder="搜索 / 粘贴网址，回车快速添加"><button id="knowledgeQuickAdd" type="button">添加链接</button></div>
    <div id="knowledgeEditBar" class="knowledge-editbar"><button id="knowledgeAddGroup" type="button">+ 添加分组</button><span>编辑模式：可改名、拖动分组、编辑链接</span></div>
    <div id="knowledgeGroups"></div>
    <div id="knowledgeLinks" style="display:none"></div>
  </div>`;

  const lockBtn=document.getElementById('knowledgeLock'),wallBtn=document.getElementById('knowledgeWallpaper'),search=document.getElementById('knowledgeSearch'),root=document.getElementById('knowledgeGroups'),editBar=document.getElementById('knowledgeEditBar'),quickBtn=document.getElementById('knowledgeQuickAdd');
  const applyWallpaper=url=>{if(url){section.style.setProperty('--knowledge-wallpaper',`url("${url.replace(/"/g,'\\\"')}")`)}else section.style.removeProperty('--knowledge-wallpaper')};
  applyWallpaper(get(WALL,''));

  const dlg=document.createElement('dialog');dlg.id='knowledgeLinkDlg';dlg.innerHTML=`<form class="knowledge-dialog"><h3 id="kDlgTitle">添加链接</h3><label id="kUrlLabel">链接地址<input id="kUrl" type="url" placeholder="粘贴网址，自动识别网站信息" required></label><div class="knowledge-icon-row"><div class="knowledge-icon-preview" id="kPreviewBox"></div><div class="knowledge-recognition-info"><strong id="kRecognizedName">等待粘贴网址</strong><p id="kPreviewDesc"></p><p id="kRecognitionStatus" role="status" aria-live="polite">自动获取网站名称和图标</p></div><button id="kAutoIcon" type="button">重新识别</button></div><label id="kTitleLabel">网站名称<input id="kTitle" placeholder="识别后自动填写" readonly></label><details id="kManual" hidden><summary>识别失败，手动补充</summary><p class="knowledge-manual-note">展开后可修改名称和图标地址。</p><label>图标链接（可选）<input id="kIcon" type="url" placeholder="https://… / 留空使用备用图标"></label></details><label id="kDescLabel">说明（可选）<input id="kDesc" placeholder="一句话说明用途"></label><label id="kGroupLabel">分组<select id="kGroup"></select></label><div class="dlgActions"><button id="kCancel" type="button">取消</button><button id="kSave" type="submit" class="task-primary-btn" disabled>保存</button></div></form>`;document.body.appendChild(dlg);
  const groupDlg=document.createElement('dialog');groupDlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3>添加分组</h3><label>分组名称<input id="kgName" placeholder="例如：工具 / 工作 / 学习"></label><div class="dlgActions"><button value="cancel">取消</button><button id="kgSave" type="button" class="task-primary-btn">保存</button></div></form>`;document.body.appendChild(groupDlg);
  const wallDlg=document.createElement('dialog');wallDlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3>设置壁纸</h3><label>图片链接<input id="kwUrl" type="url" placeholder="https://.../wallpaper.jpg"></label><div class="dlgActions"><button id="kwClear" type="button">恢复默认</button><button value="cancel">取消</button><button id="kwSave" type="button" class="task-primary-btn">应用</button></div></form>`;document.body.appendChild(wallDlg);

  const $=id=>document.getElementById(id);
  function safeUrl(raw){let v=(raw||'').trim();if(!v||v.length>2048)return '';if(!/^https?:\/\//i.test(v))v='https://'+v;try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.'))return '';return u.href}catch{return ''}}
  function host(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return '网站'}}
  function brandFor(url){return globalThis.LambertLinkSites?.identify(url)||null}
  function favicon(url){return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(url))}&sz=256`}
  function usableIcon(raw){if(typeof raw!=='string')return '';return /^https?:\/\//i.test(raw)&&safeUrl(raw)?raw:''}
  function mountIcon(box,url,icon,title){
    box.replaceChildren();const fallback=document.createElement('span');fallback.className='knowledge-icon-fallback';fallback.textContent=Array.from(title||host(url))[0]?.toUpperCase()||'↗';fallback.setAttribute('aria-hidden','true');box.append(fallback);
    const brand=brandFor(url),candidates=[brand?.icon,usableIcon(icon),new URL('/apple-touch-icon.png',url).href,favicon(url)].filter((v,i,a)=>v&&a.indexOf(v)===i);let i=0;
    const img=document.createElement('img');img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';img.hidden=true;box.append(img);
    function next(){if(i<candidates.length){img.hidden=true;fallback.hidden=false;img.src=candidates[i++]}else{img.remove();fallback.hidden=false}}
    img.onload=()=>{if(!/\.svg(?:[?#]|$)/i.test(img.src)&&img.naturalWidth<64){next();return}img.hidden=false;fallback.hidden=true};img.onerror=next;next();
  }
  function persist(){set(STORAGE,groups)}
  function updateLock(){lockBtn.textContent=locked?'🔒':'🔓';lockBtn.title=locked?'点击解锁编辑':'点击锁定';editBar.style.display=locked?'none':'flex';quickBtn.style.display='inline-block';document.body.classList.toggle('knowledge-unlocked',!locked)}
  let autoDesc='';
  let recognition={status:'idle',url:''},recognitionVersion=0,recognitionTimer=null,recognitionController=null;
  function updateRecognition(){
    $('kTitleLabel').hidden=recognition.status!=='failed';$('kTitle').readOnly=!(recognition.status==='failed'&&$('kManual').open);$('kIcon').disabled=$('kTitle').readOnly;$('kManual').hidden=recognition.status!=='failed';
    $('kSave').disabled=recognition.status!=='ready'&&!(recognition.status==='failed'&&$('kManual').open);
    $('kAutoIcon').disabled=!safeUrl($('kUrl').value)||recognition.status==='pending';
    $('kAutoIcon').textContent=recognition.status==='pending'?'识别中…':'重新识别';
  }
  function resetRecognition(){
    clearTimeout(recognitionTimer);recognitionController?.abort();recognitionVersion++;
    if(autoDesc&&$('kDesc').value===autoDesc)$('kDesc').value='';autoDesc='';
    recognition={status:'idle',url:''};$('kTitle').value='';$('kIcon').value='';$('kPreviewDesc').textContent='';$('kManual').open=false;$('kPreviewBox').replaceChildren();$('kRecognizedName').textContent='等待识别';$('kRecognitionStatus').textContent='自动获取网站名称和图标';updateRecognition();
  }
  async function recognizeLink(){
    clearTimeout(recognitionTimer);const url=safeUrl($('kUrl').value);
    if(!url){resetRecognition();$('kRecognitionStatus').textContent='请粘贴完整的 http / https 网站地址。';return}
    if(recognition.status==='pending'&&recognition.url===url)return;
    $('kUrl').value=url;
    recognitionController?.abort();recognitionController=new AbortController();const controller=recognitionController,version=++recognitionVersion;
    recognition={status:'pending',url};$('kTitle').value='';$('kIcon').value='';$('kPreviewDesc').textContent='';$('kManual').open=false;$('kRecognizedName').textContent=host(url);$('kRecognitionStatus').textContent='正在识别网站名称和图标…';updateRecognition();
    try{
      const brand=brandFor(url);let data=brand?.direct?brand:null;
      if(!data){const timer=setTimeout(()=>controller.abort(),9000);try{const response=await fetch('/api/link-metadata',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:controller.signal});const out=await response.json();if(!response.ok||!out.ok||typeof out.title!=='string'||!out.title.trim())throw Error('recognition');data={title:out.title.slice(0,140),description:String(out.description||'').slice(0,240),source:out.source,icon:usableIcon(out.icon)}}finally{clearTimeout(timer)}}
      if(version!==recognitionVersion||!dlg.open)return;
      recognition={status:'ready',url,title:data.title,icon:data.icon};$('kPreviewDesc').textContent=data.description||'';$('kTitle').value=data.title;$('kIcon').value=data.icon||'';if(!$('kDesc').value&&data.description){autoDesc=data.description;$('kDesc').value=autoDesc}$('kRecognizedName').textContent=data.title;$('kRecognitionStatus').textContent=data.source==='catalog'&&!data.direct?'已识别所属网站；此页面的具体标题暂未获取。':'已自动识别，确认分组后即可保存。';mountIcon($('kPreviewBox'),url,data.icon,data.title);
    }catch{
      if(version!==recognitionVersion||!dlg.open)return;
      recognition={status:'failed',url};$('kTitle').value=host(url);$('kRecognizedName').textContent=host(url);$('kRecognitionStatus').textContent='未能获取网站信息，可重试或展开手动补充。';mountIcon($('kPreviewBox'),url,'',host(url));
    }finally{if(version===recognitionVersion)updateRecognition()}
  }
  function openLinkDlg(groupId,link=null,prefill='',quick=false){
    if(dlg.open)dlg.close();dlg.classList.toggle('knowledge-quick-capture',quick);if(quick)section.querySelector('.knowledge-searchbar').after(dlg);else document.body.append(dlg);
    resetRecognition();editing=link?.id?{groupId,linkId:link.id}:null;$('kDlgTitle').textContent=link?.id?'编辑链接':'添加链接';
    const sel=$('kGroup');sel.replaceChildren();(groups.length?groups:[{id:'g_common',name:'常用'}]).forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;sel.append(o)});sel.value=groupId||groups[0]?.id||'g_common';$('kUrl').value=link?.url||prefill;$('kDesc').value=link?.desc||'';if(quick)dlg.show();else dlg.showModal();if(!quick)$('kUrl').focus();if(link?.url||prefill)recognizeLink();else updateRecognition();
  }
  function renameGroup(g){const name=prompt('修改分组名称',g.name);if(name===null)return;const clean=name.trim();if(!clean)return;g.name=clean;persist();render()}
  function moveGroup(fromId,toId){if(!fromId||!toId||fromId===toId)return;const from=groups.findIndex(g=>g.id===fromId),to=groups.findIndex(g=>g.id===toId);if(from<0||to<0)return;const [item]=groups.splice(from,1);groups.splice(to,0,item);persist();render()}
  function addTile(grid,g){if(query.trim())return;const b=document.createElement('button');b.type='button';b.className='knowledge-add-tile';b.innerHTML='<div class="knowledge-add-icon">＋</div><span>添加链接</span>';b.onclick=()=>openLinkDlg(g.id);grid.appendChild(b)}
  function render(){
    root.innerHTML='';const q=query.trim().toLowerCase();
    groups.forEach(g=>{
      const links=g.links.filter(l=>!q||[l.title,l.url,l.desc].some(v=>String(v||'').toLowerCase().includes(q)));if(q&&!links.length)return;
      const sec=document.createElement('section');sec.className='knowledge-group';sec.dataset.groupId=g.id;sec.draggable=!locked;
      if(!locked){sec.addEventListener('dragstart',e=>{draggingGroupId=g.id;sec.classList.add('is-dragging');e.dataTransfer.effectAllowed='move'});sec.addEventListener('dragend',()=>{draggingGroupId=null;sec.classList.remove('is-dragging');document.querySelectorAll('.knowledge-group').forEach(x=>x.classList.remove('drag-over'))});sec.addEventListener('dragover',e=>{e.preventDefault();sec.classList.add('drag-over')});sec.addEventListener('dragleave',()=>sec.classList.remove('drag-over'));sec.addEventListener('drop',e=>{e.preventDefault();sec.classList.remove('drag-over');moveGroup(draggingGroupId,g.id)})}
      const head=document.createElement('div');head.className='knowledge-group-head';head.innerHTML=`<div class="knowledge-group-title-wrap">${!locked?'<span class="knowledge-drag-handle" title="拖动分组">⋮⋮</span>':''}<h3>${esc(g.name)}</h3><span>${links.length}</span></div><div class="knowledge-group-actions"></div>`;
      const actions=head.querySelector('.knowledge-group-actions');if(!locked){const r=document.createElement('button');r.textContent='改名';r.onclick=()=>renameGroup(g);const d=document.createElement('button');d.textContent='删除分组';d.className='danger-lite';d.onclick=()=>{if(g.links.length&&!confirm(`分组“${g.name}”还有 ${g.links.length} 个链接，仍要删除吗？`))return;if(confirm(`确认删除分组“${g.name}”吗？`)){groups=groups.filter(x=>x.id!==g.id);persist();render()}};actions.append(r,d)}
      sec.appendChild(head);const grid=document.createElement('div');grid.className='knowledge-grid';
      links.forEach(l=>{const card=document.createElement('article');card.className='knowledge-link-card';card.innerHTML=`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.title||host(l.url))}"><div class="knowledge-link-icon"></div><div><strong>${esc(l.title||host(l.url))}</strong><p>${esc(l.desc||host(l.url))}</p></div></a><div class="knowledge-card-actions"></div>`;if(safeUrl(l.url))mountIcon(card.querySelector('.knowledge-link-icon'),l.url,l.icon,l.title);if(!locked){const a=card.querySelector('.knowledge-card-actions'),e=document.createElement('button'),d=document.createElement('button');e.textContent='编辑';e.onclick=()=>openLinkDlg(g.id,l);d.textContent='删除';d.onclick=()=>{if(confirm(`删除“${l.title||host(l.url)}”？`)){g.links=g.links.filter(x=>x.id!==l.id);persist();render()}};a.append(e,d)}grid.appendChild(card)});
      addTile(grid,g);sec.appendChild(grid);root.appendChild(sec)
    });
    if(!root.children.length)root.innerHTML='<div class="knowledge-empty-large">没有匹配结果。</div>'
  }
  lockBtn.onclick=()=>{locked=!locked;set(LOCK,locked);updateLock();render()};
  wallBtn.onclick=()=>{document.getElementById('kwUrl').value=get(WALL,'');wallDlg.showModal()};
  document.getElementById('kwSave').onclick=()=>{const url=safeUrl(document.getElementById('kwUrl').value);if(!url){document.getElementById('kwUrl').focus();return}set(WALL,url);applyWallpaper(url);wallDlg.close()};
  document.getElementById('kwClear').onclick=()=>{localStorage.removeItem(WALL);applyWallpaper('');wallDlg.close()};
  function searchUrl(){const value=search.value.trim();return /^(https?:\/\/|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#]|$))/i.test(value)?safeUrl(value):''}
  search.oninput=e=>{query=searchUrl()?'':e.target.value;render()};quickBtn.onclick=()=>openLinkDlg(groups[0]?.id,null,searchUrl(),!!searchUrl());search.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();quickBtn.click()}});
  document.getElementById('knowledgeAddGroup').onclick=()=>{document.getElementById('kgName').value='';groupDlg.showModal();setTimeout(()=>document.getElementById('kgName').focus(),20)};document.getElementById('kgSave').onclick=()=>{const name=document.getElementById('kgName').value.trim();if(!name)return;groups.push({id:gid(),name,links:[]});persist();groupDlg.close();render()};$('kUrl').addEventListener('input',()=>{resetRecognition();if(safeUrl($('kUrl').value))recognitionTimer=setTimeout(recognizeLink,450)});$('kUrl').addEventListener('blur',()=>{if(recognition.status==='idle'&&safeUrl($('kUrl').value))recognizeLink()});$('kAutoIcon').onclick=recognizeLink;
  $('kManual').addEventListener('toggle',updateRecognition);$('kIcon').oninput=()=>{if(recognition.status==='failed')mountIcon($('kPreviewBox'),safeUrl($('kUrl').value),$('kIcon').value,$('kTitle').value)};
  $('kCancel').onclick=()=>dlg.close();dlg.addEventListener('close',()=>{if(dlg.open)return;clearTimeout(recognitionTimer);recognitionController?.abort();recognitionVersion++});
  dlg.querySelector('form').onsubmit=e=>{
    e.preventDefault();const url=safeUrl($('kUrl').value);if(!url){$('kUrl').focus();return}
    if(recognition.url!==url||recognition.status==='idle'){recognizeLink();return}
    if(recognition.status==='pending'||recognition.status==='failed'&&!$('kManual').open)return;
    const groupId=$('kGroup').value,title=recognition.status==='ready'?recognition.title:$('kTitle').value.trim()||host(url),desc=$('kDesc').value.trim(),icon=recognition.status==='ready'?recognition.icon:usableIcon($('kIcon').value.trim());
    const next=groups.map(g=>({...g,links:[...g.links]}));if(!next.length)next.push({id:'g_common',name:'常用',links:[]});const target=next.find(g=>g.id===groupId);if(!target){$('kRecognitionStatus').textContent='分组不存在，请重新选择。';return}
    if(editing){const oldGroup=next.find(g=>g.id===editing.groupId),link=oldGroup?.links.find(l=>l.id===editing.linkId);if(!link){$('kRecognitionStatus').textContent='链接已变化，请取消后重新打开。';return}oldGroup.links=oldGroup.links.filter(x=>x.id!==link.id);target.links.unshift({...link,title,url,desc,icon})}
    else target.links.unshift({id:id(),title,url,desc,icon});
    try{set(STORAGE,next)}catch{$('kRecognitionStatus').textContent='保存失败，内容已保留。请检查浏览器存储后重试。';return}groups=next;dlg.close();search.value='';query='';render();
  };
  updateLock();render();
})();

// Load V5 overview/task enhancements last so they can safely override the MVP renderers.
(function(){
  if(!document.querySelector('link[href="dashboard-v5.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='dashboard-v5.css';document.head.appendChild(l)}
  if(!document.querySelector('script[src="dashboard-v5.js"]')){const s=document.createElement('script');s.src='dashboard-v5.js';s.defer=false;document.body.appendChild(s)}
})();
