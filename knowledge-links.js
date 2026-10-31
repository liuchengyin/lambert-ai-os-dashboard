// Common links dashboard: iTab-style launcher + editable groups + wallpaper
(function(){
  const section=document.getElementById('knowledge');if(!section)return;
  if(!document.querySelector('link[href^="knowledge-itab-v2.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='knowledge-itab-v2.css?v=20261031-wallpaper1';document.head.appendChild(l)}
  const navBtn=document.querySelector('nav button[data-v="knowledge"]');if(navBtn)navBtn.textContent='常用链接';
  const STORAGE='knowledge_link_library_v1',PERSONAL='knowledge_link_personal_v1',ACTIVE_TAB='knowledge_active_tab_v1',LOCK='knowledge_link_locked_v1',WALL='knowledge_wallpaper_v1';
  let libraryReadFailed=false;
  const get=(k,d)=>{
    try{return JSON.parse((window.LambertPrivateStorage||localStorage).getItem(k))??d}
    catch(error){if(k===STORAGE||k===PERSONAL)libraryReadFailed=true;return d}
  };
  const set=(k,v)=>{
    if(libraryReadFailed)throw Error('link_library_read_failed');
    return (window.LambertPrivateStorage||localStorage).setItem(k,JSON.stringify(v));
  };
  const esc=v=>String(v||'').replace(/[&<>'\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
  const id=()=>`link_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,gid=()=>`group_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const defaults=[
    {id:'g_tools',name:'工具',links:[
      {id:'l_chatgpt',title:'ChatGPT',url:'https://chatgpt.com/',desc:'AI 工作入口'},
      {id:'l_notion',title:'Notion',url:'https://www.notion.so/',desc:'知识与笔记'},
      {id:'l_feishu',title:'飞书',url:'https://www.feishu.cn/',desc:'任务与工作资料'}]},
    {id:'g_common',name:'常用',links:[]},{id:'g_learning',name:'学习',links:[]}
  ];
  const personalDefaults=[{id:'g_personal',name:'个人',links:[]}];
  let activeTab=get(ACTIVE_TAB,'common')==='personal'?'personal':'common';
  const tabStorage=()=>activeTab==='personal'?PERSONAL:STORAGE;
  const tabDefaults=()=>activeTab==='personal'?personalDefaults:defaults;
  function loadGroups(){
    const stored=get(tabStorage(),tabDefaults());
    const list=Array.isArray(stored)&&stored.length?stored:tabDefaults();
    return list.map(g=>({...g,links:(Array.isArray(g.links)?g.links:[]).map(l=>({...l,icon:l.icon||''}))}));
  }
  let groups=loadGroups(),locked=get(LOCK,true),query='',draggingGroupId=null,editing=null;

  section.innerHTML=`<div class="knowledge-page">
    <div class="knowledge-head"><div class="knowledge-head-actions"><button id="knowledgeRecoveryOpen" type="button" title="检查并恢复旧链接">恢复</button><button id="knowledgeTabSwitch" class="knowledge-tab-switch" type="button" aria-label="切换链接分类">切换</button><button id="knowledgeWallpaper" class="knowledge-wallpaper-btn" type="button">壁纸</button><button id="knowledgeLock" class="knowledge-lock"></button></div></div>
    <div class="knowledge-searchbar"><input id="knowledgeSearch" placeholder="搜索 / 粘贴网址，回车快速添加"><button id="knowledgeQuickAdd" type="button">添加链接</button><button id="knowledgeManualCreate" type="button" hidden>手动创建</button><span id="knowledgeSearchSpinner" class="knowledge-spinner" aria-label="识别中" hidden></span></div>
    <div id="knowledgeEditBar" class="knowledge-editbar"><button id="knowledgeAddGroup" type="button">+ 添加分组</button><span>编辑模式：可改名、拖动分组、编辑链接</span></div>
    <div class="knowledge-library-indicator"><span id="knowledgeLibraryTag" class="knowledge-library-tag" data-library="common">常用</span></div>
    <div id="knowledgeGroups"></div>
    <div id="knowledgeLinks" style="display:none"></div>
  </div>`;

  const tabBtn=document.getElementById('knowledgeTabSwitch'),libraryTag=document.getElementById('knowledgeLibraryTag'),lockBtn=document.getElementById('knowledgeLock'),wallBtn=document.getElementById('knowledgeWallpaper'),search=document.getElementById('knowledgeSearch'),root=document.getElementById('knowledgeGroups'),editBar=document.getElementById('knowledgeEditBar'),quickBtn=document.getElementById('knowledgeQuickAdd'),manualBtn=document.getElementById('knowledgeManualCreate'),searchSpinner=document.getElementById('knowledgeSearchSpinner');
  const recoveryDlg=document.createElement('dialog');
  recoveryDlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3>恢复旧链接</h3><p>检查当前浏览器中的旧链接，确认后合并，保留已有内容。</p><button type="button" id="knowledgeRecoverLocal">检查并恢复旧链接</button><p id="knowledgeRecoveryStatus" role="status" aria-live="polite"></p><div class="dlgActions"><button>关闭</button></div></form>`;
  document.body.append(recoveryDlg);
  document.getElementById('knowledgeRecoveryOpen').onclick=()=>recoveryDlg.showModal();
  const recoveryStatus=document.getElementById('knowledgeRecoveryStatus');
  if(libraryReadFailed){
    recoveryStatus.textContent='当前账号链接库读取失败；为保护旧数据，已禁止修改。请检查账号登录及同步状态。';
  }
  document.getElementById('knowledgeRecoverLocal').onclick=()=>{
    if(!window.LambertLinkRecovery){recoveryStatus.textContent='恢复工具未加载，未修改链接。';return;}
    if(libraryReadFailed){recoveryStatus.textContent='链接数据读取异常，已拒绝覆盖。请先解决账号同步问题。';return;}
    const api=window.LambertLinkRecovery;
    const store=window.LambertPrivateStorage||localStorage;
    const current={},raw={};
    try{
      for(const key of api.KEYS){
        const text=store.getItem(key);
        raw[key]=text;
        current[key]=text===null?null:JSON.parse(text);
        if(current[key]!==null&&!api.validGroups(current[key]))throw Error('当前链接库格式不完整');
      }
      const sources=api.findSources(localStorage,window.LambertPrivateStorage?.owner||'');
      const plan=api.preview(current,sources);
      if(!plan.total){
        recoveryStatus.textContent='未发现当前浏览器中可合并的旧链接；原数据未修改。请检查其他设备的浏览器或已有备份。';
        return;
      }
      const breakdown='常用 '+plan.count[STORAGE].links+' 条，个人 '+plan.count[PERSONAL].links+' 条';
      if(!window.confirm('找到可恢复的旧链接：'+breakdown+'。将先备份当前链接，再将缺少的链接合并（不会删除已有链接）。确认恢复吗？'))return;
      // The local backup is durable before any account-cloud write begins.
      const backupKey='lambert_link_recovery_backup_v1:'+new Date().toISOString()+':'+crypto.randomUUID();
      localStorage.setItem(backupKey,JSON.stringify({
        format:'lambert-link-recovery-backup-v1',createdAt:new Date().toISOString(),
        owner:window.LambertPrivateStorage?.owner||'',original:raw
      }));
      if(!window.LambertData?.writeMany)throw Error('数据写入服务未准备好');
      window.LambertData.writeMany(plan.updates);
      groups=loadGroups();query='';search.value='';render();
      recoveryStatus.textContent='已恢复 '+plan.total+' 条旧链接（'+breakdown+'）。原内容未删除，恢复前备份已保存在本机；登录账号的云端同步状态请在账户菜单核对。';
    }catch(error){
      recoveryStatus.textContent='恢复已停止，未自动清空原数据。请检查登录、存储空间或同步冲突后再重试。';
    }
  };
  const applyWallpaper=url=>{if(url){section.style.setProperty('--knowledge-wallpaper',`url("${url.replace(/"/g,'\\\"')}")`)}else section.style.removeProperty('--knowledge-wallpaper')};
  applyWallpaper(get(WALL,''));

  const dlg=document.createElement('dialog');dlg.id='knowledgeLinkDlg';dlg.innerHTML=`<form class="knowledge-dialog"><h3 id="kDlgTitle">添加链接</h3><label id="kUrlLabel">链接地址<input id="kUrl" type="url" placeholder="粘贴网址，自动识别网站信息" required></label><div class="knowledge-icon-row"><div class="knowledge-icon-preview" id="kPreviewBox"></div><div class="knowledge-recognition-info"><strong id="kRecognizedName">等待粘贴网址</strong><p id="kPreviewDesc"></p><p id="kRecognitionStatus" role="status" aria-live="polite">自动获取网站名称和图标</p></div><span id="kDlgSpinner" class="knowledge-spinner" aria-label="识别中" hidden></span><button id="kAutoIcon" type="button">重新识别</button><button id="kManualCreate" type="button" hidden>手动创建</button></div><label id="kTitleLabel">网站名称<input id="kTitle" placeholder="识别后自动填写" readonly></label><details id="kManual" hidden><summary>手动填写</summary><p class="knowledge-manual-note">可修改名称和图标地址。</p><label>图标链接（可选）<input id="kIcon" type="text" placeholder="https://… / 留空使用备用图标"></label><label>上传图标（可选，PNG/JPEG/WebP，≤2MB）<input id="kIconFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p id="kIconFileError" class="knowledge-icon-file-error" role="alert" hidden></p></details><label id="kDescLabel">说明（可选）<textarea id="kDesc" rows="2" placeholder="一句话说明用途"></textarea></label><label id="kGroupLabel">分组<select id="kGroup"></select></label><div class="dlgActions"><button id="kCancel" type="button">取消</button><button id="kSave" type="submit" class="task-primary-btn" disabled>保存</button></div></form>`;document.body.appendChild(dlg);
  const groupDlg=document.createElement('dialog');groupDlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3>添加分组</h3><label>分组名称<input id="kgName" placeholder="例如：工具 / 工作 / 学习"></label><div class="dlgActions"><button value="cancel">取消</button><button id="kgSave" type="button" class="task-primary-btn">保存</button></div></form>`;document.body.appendChild(groupDlg);
  const wallDlg=document.createElement('dialog');wallDlg.innerHTML=`<form method="dialog" class="knowledge-dialog"><h3>设置壁纸</h3><label class="knowledge-wallpaper-upload">本地图片<input id="kwFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p>支持 JPG、PNG、WebP，最大 10 MB；自动压缩保存。</p><p id="kwStatus" role="status" aria-live="polite"></p><label>图片链接（可选）<input id="kwUrl" type="url" placeholder="https://.../wallpaper.jpg"></label><div class="dlgActions"><button id="kwClear" type="button">恢复默认</button><button value="cancel">取消</button><button id="kwSave" type="button" class="task-primary-btn">应用</button></div></form>`;document.body.appendChild(wallDlg);

  const $=id=>document.getElementById(id);
  function safeUrl(raw){let v=(raw||'').trim();if(!v||v.length>2048)return '';if(!/^https?:\/\//i.test(v))v='https://'+v;try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.'))return '';return u.href}catch{return ''}}
  function host(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return '网站'}}
  function brandFor(url){return globalThis.LambertLinkSites?.identify(url)||null}
  function usableIcon(raw){if(typeof raw!=='string')return '';if(/^data:image\/png;base64,/i.test(raw)){if(raw.length>180000)return '';const b64=raw.slice(raw.indexOf(',')+1);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))return '';return raw}return /^https?:\/\//i.test(raw)&&safeUrl(raw)?raw:''}
  function mountIcon(box,url,icon,title){
    box.replaceChildren();const fallback=document.createElement('span');fallback.className='knowledge-icon-fallback';fallback.textContent=Array.from(title||host(url))[0]?.toUpperCase()||'↗';fallback.setAttribute('aria-hidden','true');box.append(fallback);
    const custom=usableIcon(icon);const brand=brandFor(url);const candidates=[custom,brand?.icon,safeUrl(url)?new URL('/apple-touch-icon.png',url).href:''].filter((v,i,a)=>v&&a.indexOf(v)===i);let i=0;
    const img=document.createElement('img');img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';img.hidden=true;box.append(img);
    function next(){if(i<candidates.length){img.hidden=true;fallback.hidden=false;img.src=candidates[i++]}else{img.remove();fallback.hidden=false}}
    img.onload=()=>{if(!/\.svg(?:[?#]|$)/i.test(img.src)&&img.naturalWidth<64){next();return}img.hidden=false;fallback.hidden=true};img.onerror=next;next();
  }
  function persist(){set(tabStorage(),groups)}
  function updateTab(){const personal=activeTab==='personal';libraryTag.textContent=personal?'个人':'常用';libraryTag.dataset.library=personal?'personal':'common';tabBtn.textContent='切换';tabBtn.title=personal?'切换到常用':'切换到个人';tabBtn.setAttribute('aria-label',tabBtn.title)}
  function updateLock(){lockBtn.textContent=locked?'🔒':'🔓';lockBtn.title=locked?'点击解锁编辑':'点击锁定';editBar.style.display=locked?'none':'flex';quickBtn.style.display='inline-block';document.body.classList.toggle('knowledge-unlocked',!locked)}
  let autoDesc='';
  let recognition={status:'idle',url:''},recognitionVersion=0,recognitionTimer=null,recognitionController=null,iconUploadVersion=0;
  function updateRecognition(){
    const manual=recognition.status==='failed'||recognition.status==='manual';
    const pending=recognition.status==='pending';
    dlg.classList.toggle('knowledge-manual-mode',manual);
    $('kTitleLabel').hidden=!manual;$('kTitle').readOnly=!manual;$('kIcon').disabled=$('kTitle').readOnly;$('kManual').hidden=!manual;
    $('kSave').disabled=recognition.status!=='ready'&&!manual;
    $('kAutoIcon').disabled=!safeUrl($('kUrl').value)||pending;
    $('kAutoIcon').hidden=manual;
    $('kAutoIcon').textContent=pending?'识别中…':'重新识别';
    $('kDlgSpinner').hidden=!pending;
    searchSpinner.hidden=!pending;
    $('kManualCreate').hidden=manual||!safeUrl($('kUrl').value);
    if(manual)$('kManual').open=true;
  }
  function switchToManual(){
    clearTimeout(recognitionTimer);recognitionTimer=null;
    recognitionController?.abort();recognitionController=null;
    recognitionVersion++;
    const url=safeUrl($('kUrl').value)||recognition.url||'';
    recognition={status:'manual',url};
    dlg.classList.remove('knowledge-quick-capture');
    if(!$('kTitle').value.trim())$('kTitle').value=host(url);
    if(!$('kRecognizedName').textContent||$('kRecognizedName').textContent==='等待识别')$('kRecognizedName').textContent=$('kTitle').value||host(url);
    $('kRecognitionStatus').textContent='手动填写模式：请填写名称与图标后保存。';
    $('kManual').open=true;
    if(!dlg.open){document.body.append(dlg);dlg.showModal()}
    else if(!dlg.matches(':modal')){dlg.close();document.body.append(dlg);dlg.showModal()}
    updateRecognition();
    setTimeout(()=>$('kTitle').focus(),20);
  }
  function resetRecognition(){
    clearTimeout(recognitionTimer);recognitionController?.abort();recognitionVersion++;
    if(autoDesc&&$('kDesc').value===autoDesc)$('kDesc').value='';autoDesc='';
    recognition={status:'idle',url:''};$('kTitle').value='';$('kIcon').value='';$('kPreviewDesc').textContent='';$('kManual').open=false;$('kPreviewBox').replaceChildren();$('kRecognizedName').textContent='等待识别';$('kRecognitionStatus').textContent='自动获取网站名称和图标';updateRecognition();
  }
  async function recognizeLink(){
    if(editing)return;
    if(recognition.status==='manual')return;
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
      recognition={status:'failed',url};$('kManual').open=true;$('kTitle').value=host(url);$('kRecognizedName').textContent=host(url);$('kRecognitionStatus').textContent='识别失败，已切换手动添加，填写后即可保存。';mountIcon($('kPreviewBox'),url,'',host(url));
      dlg.classList.remove('knowledge-quick-capture');if(!dlg.matches(':modal')){dlg.close();document.body.append(dlg);dlg.showModal()}
    }finally{if(version===recognitionVersion)updateRecognition()}
  }
  function openLinkDlg(groupId,link=null,prefill='',quick=false,manual=false){
    if(dlg.open)dlg.close();dlg.classList.toggle('knowledge-quick-capture',quick);if(quick)section.querySelector('.knowledge-searchbar').after(dlg);else document.body.append(dlg);
    $('kIconFileError').hidden=true;$('kIconFile').value='';iconUploadVersion++;
    resetRecognition();editing=link?.id?{groupId,linkId:link.id}:null;$('kDlgTitle').textContent=link?.id?'编辑链接':'添加链接';
    if(editing){recognition={status:'manual',url:link?.url||''};$('kManual').open=true;$('kTitle').value=link?.title||'';$('kIcon').value=link?.icon||'';$('kRecognizedName').textContent=link?.title||host(link?.url||'');$('kRecognitionStatus').textContent='编辑模式：手动修改名称和图标。';if(link?.url)mountIcon($('kPreviewBox'),link.url,link.icon,link.title);}
    const sel=$('kGroup');sel.replaceChildren();(groups.length?groups:[{id:'g_common',name:'常用'}]).forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;sel.append(o)});sel.value=groupId||groups[0]?.id||'g_common';$('kUrl').value=link?.url||prefill;$('kDesc').value=link?.desc||'';if(quick)dlg.show();else dlg.showModal();if(!quick)$('kUrl').focus();if(manual)switchToManual();else if(editing)updateRecognition();else if(link?.url||prefill)recognizeLink();else updateRecognition();
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
      links.forEach(l=>{const card=document.createElement('article');card.className='knowledge-link-card';card.innerHTML=`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-tooltip="${esc(l.title||host(l.url))}" aria-label="${esc(l.title||host(l.url))}"><div class="knowledge-link-icon"></div><div><strong>${esc(l.title||host(l.url))}</strong><p>${esc(l.desc||host(l.url))}</p></div></a><div class="knowledge-card-actions"></div>`;if(safeUrl(l.url))mountIcon(card.querySelector('.knowledge-link-icon'),l.url,l.icon,l.title);if(!locked){const a=card.querySelector('.knowledge-card-actions'),e=document.createElement('button'),d=document.createElement('button');e.textContent='编辑';e.onclick=()=>openLinkDlg(g.id,l);d.textContent='删除';d.onclick=()=>{if(confirm(`删除“${l.title||host(l.url)}”？`)){g.links=g.links.filter(x=>x.id!==l.id);persist();render()}};a.append(e,d)}grid.appendChild(card)});
      addTile(grid,g);sec.appendChild(grid);root.appendChild(sec)
    });
    if(!root.children.length)root.innerHTML='<div class="knowledge-empty-large">没有匹配结果。</div>'
  }
  tabBtn.onclick=()=>{
    clearSearchAuto();if(dlg.open)dlg.close();
    const next=activeTab==='common'?'personal':'common';
    set(ACTIVE_TAB,next);activeTab=next;groups=loadGroups();editing=null;
    clearTimeout(searchRenderTimer);query='';search.value='';updateTab();render();
  };
  lockBtn.onclick=()=>{locked=!locked;set(LOCK,locked);updateLock();render()};
  let wallpaperDraft='',wallpaperJob=0;
  const wallStatus=$('kwStatus'),wallSave=$('kwSave');
  wallBtn.onclick=()=>{
    wallpaperJob++;wallpaperDraft=get(WALL,'');
    $('kwUrl').value=wallpaperDraft.startsWith('data:')?'':wallpaperDraft;
    $('kwFile').value='';wallStatus.textContent=wallpaperDraft.startsWith('data:')?'当前使用本地图片':'';
    wallSave.disabled=false;wallDlg.showModal();
  };
  wallDlg.addEventListener('close',()=>{wallpaperJob++});
  $('kwUrl').oninput=()=>{wallpaperJob++;wallpaperDraft='';$('kwFile').value='';wallStatus.textContent='';wallSave.disabled=false};
  $('kwFile').onchange=async()=>{
    const file=$('kwFile').files[0];if(!file)return;
    const job=++wallpaperJob,owner=window.LambertPrivateStorage?.owner;
    wallSave.disabled=true;wallStatus.textContent='正在处理图片…';
    let bitmap;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024)throw Error('请选择 10 MB 以内的 JPG、PNG 或 WebP 图片');
      bitmap=await createImageBitmap(file);
      const canvas=document.createElement('canvas');let scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height)),data='';
      for(let i=0;i<6;i++){
        canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        const ctx=canvas.getContext('2d');ctx.fillStyle='#edf2f7';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
        data=canvas.toDataURL('image/jpeg',0.78-i*0.06);
        if(data.length<=150000)break;scale*=0.75;
      }
      if(data.length>150000)throw Error('图片过于复杂，请选择更小的图片');
      if(job!==wallpaperJob||owner!==window.LambertPrivateStorage?.owner)return;
      wallpaperDraft=data;$('kwUrl').value='';wallStatus.textContent='图片已准备好，点击应用保存';
    }catch(error){if(job===wallpaperJob){wallpaperDraft='';wallStatus.textContent=error.message||'图片无法读取，请换一张图片'}}
    finally{bitmap?.close();if(job===wallpaperJob)wallSave.disabled=false}
  };
  wallSave.onclick=()=>{
    const value=$('kwUrl').value.trim()?safeUrl($('kwUrl').value):wallpaperDraft;
    if(!value){wallStatus.textContent='请选择本地图片，或填写有效图片链接';return}
    try{set(WALL,value);applyWallpaper(value);wallDlg.close()}catch{wallStatus.textContent='壁纸未保存，请检查存储空间或账号同步状态后重试'}
  };
  $('kwClear').onclick=()=>{
    try{(window.LambertPrivateStorage||localStorage).removeItem(WALL);applyWallpaper('');wallDlg.close()}catch{wallStatus.textContent='恢复默认失败，请重试'}
  };
  function searchUrl(){const value=search.value.trim();return /^(https?:\/\/|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#]|$))/i.test(value)?safeUrl(value):''}
  let searchAutoTimer=null,searchAutoUrl='';
  function clearSearchAuto(){clearTimeout(searchAutoTimer);searchAutoTimer=null;searchAutoUrl='';searchSpinner.hidden=true;manualBtn.hidden=true}
  function triggerSearchAuto(){
    const url=searchUrl();
    if(!url){clearSearchAuto();return}
    if(url===searchAutoUrl&&dlg.open)return;
    searchAutoUrl=url;searchSpinner.hidden=false;manualBtn.hidden=false;
    openLinkDlg(groups[0]?.id,null,url,true);
  }
  let searchRenderTimer=null;
  search.oninput=e=>{
    const previousQuery=query,url=searchUrl();query=url?'':e.target.value;
    clearTimeout(searchRenderTimer);
    if(url){if(previousQuery)render()}
    else searchRenderTimer=setTimeout(()=>{searchRenderTimer=null;render()},130);
    clearTimeout(searchAutoTimer);
    if(!url){clearSearchAuto();return}
    searchSpinner.hidden=false;manualBtn.hidden=false;
    searchAutoTimer=setTimeout(()=>{searchAutoTimer=null;if(searchUrl()===url)triggerSearchAuto()},450);
  };
  quickBtn.onclick=()=>{clearSearchAuto();openLinkDlg(groups[0]?.id,null,searchUrl(),!!searchUrl())};
  manualBtn.onclick=()=>{const url=searchUrl();clearSearchAuto();if(dlg.open&&safeUrl($('kUrl').value)===url)switchToManual();else openLinkDlg(groups[0]?.id,null,url,false,true)};
  search.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();clearSearchAuto();quickBtn.click()}});
  document.getElementById('knowledgeAddGroup').onclick=()=>{document.getElementById('kgName').value='';groupDlg.showModal();setTimeout(()=>document.getElementById('kgName').focus(),20)};document.getElementById('kgSave').onclick=()=>{const name=document.getElementById('kgName').value.trim();if(!name)return;groups.push({id:gid(),name,links:[]});persist();groupDlg.close();render()};$('kUrl').addEventListener('input',()=>{if(editing){recognition={status:'manual',url:safeUrl($('kUrl').value)||''};updateRecognition();return}if(recognition.status==='manual'){recognition.url=safeUrl($('kUrl').value)||'';updateRecognition();return}resetRecognition();if(safeUrl($('kUrl').value))recognitionTimer=setTimeout(recognizeLink,450)});$('kUrl').addEventListener('blur',()=>{if(editing)return;if(recognition.status==='manual')return;if(recognition.status==='idle'&&safeUrl($('kUrl').value))recognizeLink()});$('kAutoIcon').onclick=recognizeLink;
  $('kManualCreate').onclick=switchToManual;
  $('kManual').addEventListener('toggle',updateRecognition);$('kIcon').oninput=()=>{if(recognition.status==='failed'||recognition.status==='manual')mountIcon($('kPreviewBox'),safeUrl($('kUrl').value),$('kIcon').value,$('kTitle').value)};
  $('kIconFile').addEventListener('change',()=>{
    const token=++iconUploadVersion;const file=$('kIconFile').files&&$('kIconFile').files[0];const err=$('kIconFileError');err.hidden=true;
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type)){err.textContent='仅支持 PNG / JPEG / WebP 图片。';err.hidden=false;$('kIconFile').value='';return}
    if(file.size>2*1024*1024){err.textContent='图片不能超过 2MB。';err.hidden=false;$('kIconFile').value='';return}
    const reader=new FileReader();
    reader.onerror=()=>{if(token!==iconUploadVersion)return;err.textContent='读取图片失败，请重试。';err.hidden=false};
    reader.onload=()=>{
      if(token!==iconUploadVersion)return;
      try{
        const img=new Image();
        img.onload=()=>{
          if(token!==iconUploadVersion)return;
          try{
            const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
            const ctx=canvas.getContext('2d');if(!ctx)throw Error('ctx');
            const size=Math.min(img.naturalWidth,img.naturalHeight);const sx=(img.naturalWidth-size)/2,sy=(img.naturalHeight-size)/2;
            ctx.clearRect(0,0,128,128);ctx.drawImage(img,sx,sy,size,size,0,0,128,128);
            const dataUrl=canvas.toDataURL('image/png');
            if(token!==iconUploadVersion)return;
            if(!usableIcon(dataUrl)){err.textContent='图标处理失败，请换一张更小的图片。';err.hidden=false;return}
            $('kIcon').value=dataUrl;
            mountIcon($('kPreviewBox'),safeUrl($('kUrl').value),dataUrl,$('kTitle').value);
          }catch{err.textContent='图标处理失败，请换一张图片。';err.hidden=false}
        };
        img.onerror=()=>{if(token!==iconUploadVersion)return;err.textContent='图片解析失败，请换一张图片。';err.hidden=false};
        img.src=String(reader.result||'');
      }catch{err.textContent='图片处理失败，请重试。';err.hidden=false}
    };
    reader.readAsDataURL(file);
  });
  $('kCancel').onclick=()=>{clearSearchAuto();dlg.close()};dlg.addEventListener('close',()=>{if(dlg.open)return;clearTimeout(recognitionTimer);recognitionController?.abort();recognitionVersion++;iconUploadVersion++;clearSearchAuto()});
  dlg.querySelector('form').onsubmit=e=>{
    e.preventDefault();const url=safeUrl($('kUrl').value);if(!url){$('kUrl').focus();return}
    const manual=recognition.status==='manual'||recognition.status==='failed';
    if(!editing&&!manual){if(recognition.url!==url||recognition.status==='idle'){recognizeLink();return}
    if(recognition.status==='pending')return;}
    const groupId=$('kGroup').value;
    let title,icon;
    if(manual){title=$('kTitle').value.trim();if(!title){$('kTitle').focus();$('kRecognitionStatus').textContent='请填写网站名称。';return}icon=usableIcon($('kIcon').value.trim())}
    else{title=recognition.status==='ready'?recognition.title:$('kTitle').value.trim()||host(url);icon=recognition.status==='ready'?recognition.icon:usableIcon($('kIcon').value.trim())}
    const desc=$('kDesc').value.trim();
    const next=groups.map(g=>({...g,links:[...g.links]}));if(!next.length)next.push({id:'g_common',name:'常用',links:[]});const target=next.find(g=>g.id===groupId);if(!target){$('kRecognitionStatus').textContent='分组不存在，请重新选择。';return}
    if(editing){const oldGroup=next.find(g=>g.id===editing.groupId),link=oldGroup?.links.find(l=>l.id===editing.linkId);if(!link){$('kRecognitionStatus').textContent='链接已变化，请取消后重新打开。';return}oldGroup.links=oldGroup.links.filter(x=>x.id!==link.id);target.links.unshift({...link,title,url,desc,icon})}
    else target.links.unshift({id:id(),title,url,desc,icon});
    try{set(tabStorage(),next)}catch{$('kRecognitionStatus').textContent='保存失败，内容已保留。请检查浏览器存储后重试。';return}groups=next;dlg.close();search.value='';query='';render();
  };
  updateTab();updateLock();render();
})();

// Load V5 overview/task enhancements last so they can safely override the MVP renderers.
(function(){
  if(!document.querySelector('link[href="dashboard-v5.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='dashboard-v5.css';document.head.appendChild(l)}
  if(!document.querySelector('script[src="dashboard-v5.js"]')){const s=document.createElement('script');s.src='dashboard-v5.js';s.defer=false;document.body.appendChild(s)}
})();
