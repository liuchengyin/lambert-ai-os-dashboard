// Reading Workspace Stable V4 — fixed architecture: left reader, right card note, records below.
(function(){
  const reading=document.getElementById('reading');
  if(!reading)return;

  const FEISHU_DAILY='';
  const STORE='reading_workspace_v2';
  const LEGACY='daily_reading_v1';
  const $=id=>document.getElementById(id);
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const uid=()=>`read_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const templatePrompts={
    '观念卡':['这个观点到底在说什么？','为什么它重要？','它改变了我什么理解或判断？','我能把它用在哪里？'],
    '案例卡':['这个案例发生了什么？','真正起作用的关键因果是什么？','它说明了什么规律？','我能迁移到什么场景？'],
    '方法卡':['这个方法解决什么问题？','核心步骤是什么？','使用条件 / 边界是什么？','我的下一步实践是什么？']
  };

  let state=get(STORE,{reader:{title:'',progress:'',mode:'pdf',url:''},notes:[],currentId:''});
  if(!state||typeof state!=='object')state={reader:{title:'',progress:'',mode:'pdf',url:''},notes:[],currentId:''};
  state.reader=state.reader||{title:'',progress:'',mode:'pdf',url:''};
  if(state.reader.mode==='weread')state.reader.mode='pdf';
  state.notes=Array.isArray(state.notes)?state.notes:[];

  reading.innerHTML=`
    <div class="reading-stable-page">
      <div class="reading-stable-head">
        <h2 class="reading-visually-hidden">每日阅读</h2>
      <div class="reading-view-tabs" role="tablist" aria-label="每日阅读工作模式">
        <button type="button" id="rv2SplitTab" role="tab" aria-selected="true" aria-controls="rv2SplitView">读书 + 笔记</button>
        <button type="button" id="rv2NotesTab" role="tab" aria-selected="false" aria-controls="rv2StandaloneView">独立笔记</button>
      </div>
        <label class="reading-progress-field"><span>阅读进度</span><input id="rv2Progress" placeholder="例如：42% / 第 3 章 / P120"></label>
      </div>

      <div id="rv2SplitView" role="tabpanel" aria-labelledby="rv2SplitTab"><div class="reading-stable-workspace">
        <section class="reading-stable-reader">
          <div class="reading-reader-toolbar">
            <input id="rv2BookTitle" class="reading-book-input" placeholder="当前书籍 / 阅读对象">
            <div class="reading-source-tabs" role="group" aria-label="阅读来源">
              <button id="rv2PdfMode" type="button" data-mode="pdf">PDF</button>
              <button id="rv2WebMode" type="button" data-mode="web">网页</button>
            </div>
          </div>
          <div class="reading-url-row">
            <input id="rv2Url" type="url" placeholder="粘贴 PDF / 网页链接">
            <button id="rv2Load" class="reading-secondary">加载阅读</button>
            <button id="rv2Open" class="reading-secondary">新窗口打开</button>
          </div>
          <div class="reading-frame-shell">
            <div id="rv2ReaderPlaceholder" class="reading-reader-placeholder">
              <strong>PDF / 网页阅读区</strong>
              <span>粘贴链接后加载，或选择本地 PDF。</span>
              <button id="rv2Pdf" class="reading-secondary">选择本地 PDF</button>
              <input id="rv2PdfInput" type="file" accept="application/pdf" hidden>
            </div>
            <iframe id="rv2Frame" title="阅读内容" referrerpolicy="no-referrer" loading="eager"></iframe>
          </div>
        </section>

        <section class="reading-stable-note">
          <div class="reading-note-toolbar">
            <label><span>模板</span><select id="rv2Type"><option>观念卡</option><option>案例卡</option><option>方法卡</option></select></label>
            <button id="rv2New" class="reading-secondary">新建</button>
          </div>

          <div class="reading-card-title"><strong id="rv2CardPrefix">观念卡：</strong><input id="rv2CardTitle" placeholder="给这张卡一个标题"></div>

          <label class="reading-editor-field"><span>解读</span><textarea id="rv2Thought" placeholder="写下你的解读……"></textarea></label><div id="rv2ThoughtRich" class="reading-rich-slot" hidden></div>

          <div class="reading-divider"><span>原文</span></div>
          <div class="reading-clip-row"><span>从阅读内容中摘录原文</span><button id="rv2Clipboard" class="reading-secondary">从剪贴板导入</button></div>
          <label class="reading-editor-field reading-source-field"><textarea id="rv2Excerpt" placeholder="原文 / 摘录"></textarea></label><div id="rv2ExcerptRich" class="reading-rich-slot" hidden></div>

          <div class="reading-template-hint"><strong>模板提示</strong><div id="rv2Prompts"></div></div>

          <div class="reading-note-actions">
            <button id="rv2Save" class="task-primary-btn">保存笔记</button>
            <button id="rv2Archive" class="reading-archive">归档飞书</button>
            <span id="rv2Status"></span>
          </div>
          <a id="rv2FeishuLink" class="reading-feishu-link" href="${FEISHU_DAILY}" target="_blank">打开飞书归档位置</a>
        </section>
      </div>

      </div>
      <section id="rv2StandaloneView" class="reading-standalone" role="tabpanel" aria-labelledby="rv2NotesTab" hidden>
        <header class="reading-standalone-header"><div id="rv2StandaloneArchiveTools"></div><button id="rv2StandaloneNew" type="button" class="reading-secondary">＋ 新建笔记</button></header>
        <div class="reading-standalone-grid"><aside class="reading-standalone-list" aria-label="我的独立笔记"><div id="rv2StandaloneList"></div></aside><div class="reading-standalone-editor"><input id="rv2StandaloneTitle" type="text" maxlength="160" aria-label="笔记标题" placeholder="无标题笔记"><textarea id="rv2StandaloneBody" aria-label="笔记正文" placeholder="## 解读 → 分割线 → 原文"></textarea><div id="rv2StandaloneRich" class="reading-rich-slot" hidden></div><footer><span id="rv2StandaloneStatus" role="status" aria-live="polite">本地保存</span><div class="reading-standalone-actions"><button type="button" id="rv2StandaloneArchive" class="reading-secondary">归档飞书</button><a id="rv2StandaloneFeishuLink" target="_blank" rel="noopener" hidden>查看飞书</a></div><button type="button" id="rv2StandaloneDelete" class="reading-secondary">删除当前笔记</button></footer></div></div>
      </section>
      <div id="rv2SplitHistory"> <section class="reading-records">
        <div class="reading-records-head"><div><h3>阅读记录</h3><span>已保存的卡片与历史阅读记录</span></div></div>
        <div id="rv2Records" class="reading-records-grid"></div>
      </section></div>
    </div>`;

  reading.classList.add('reading-stable-ready');

  let standaloneEditor=null,standaloneEditorReady=false,thoughtEditor=null,excerptEditor=null;
  let thoughtReady=false,excerptReady=false;
  let currentId=state.currentId||'';
  let localPdfUrl='';

  function blankNote(type='观念卡'){
    return {id:uid(),date:dateKey(),type,title:'',thought:'',excerpt:'',sourceTitle:state.reader.title||'',progress:state.reader.progress||'',savedAt:'',feishuUrl:'',feishuDocumentToken:'',feishuWikiToken:''};
  }
  function currentNote(){return state.notes.find(n=>n.id===currentId)||null}
  function persist(){state.currentId=currentId;set(STORE,state)}
  function saveReader(){state.reader={title:$('rv2BookTitle').value.trim(),progress:$('rv2Progress').value.trim(),mode:document.querySelector('.reading-source-tabs button.active')?.dataset.mode||'pdf',url:$('rv2Url').value.trim()};persist()}
  function setMode(mode){
    const safe=mode==='web'?'web':'pdf';
    document.querySelectorAll('.reading-source-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===safe));
    state.reader.mode=safe;persist();
  }
  function renderPrompts(type){$('rv2Prompts').innerHTML=(templatePrompts[type]||[]).map((p,i)=>`<span>${i+1}. ${esc(p)}</span>`).join('');$('rv2CardPrefix').textContent=`${type}：`}

  function legacyRows(){
    const legacy=get(LEGACY,{});
    return Object.entries(legacy||{}).filter(([,r])=>r&&(r.source||r.excerpt||r.insight||r.action)).map(([date,r])=>({kind:'legacy',date,sort:r.savedAt||date,title:r.source||'未命名阅读',progress:r.progress||'',excerpt:r.excerpt||'',thought:[r.insight,r.action].filter(Boolean).join('\n\n')}));
  }
  function recordRows(){
    const cards=state.notes.filter(n=>n&&(n.title||n.thought||n.excerpt||n.sourceTitle)).map(n=>({kind:'card',id:n.id,date:n.date||String(n.savedAt||'').slice(0,10),sort:n.savedAt||n.date||'',type:n.type||'观念卡',title:n.title||n.sourceTitle||'未命名',progress:n.progress||'',feishuUrl:n.feishuUrl||''}));
    return [...cards,...legacyRows()].sort((a,b)=>String(b.sort||'').localeCompare(String(a.sort||''))).slice(0,80);
  }
  function renderRecords(){
    const root=$('rv2Records');if(!root)return;root.innerHTML='';const rows=recordRows();
    if(!rows.length){root.innerHTML='<div class="reading-record-empty">还没有阅读记录</div>';return}
    rows.forEach(r=>{
      const item=document.createElement('article');item.className='reading-record-item';
      const label=r.kind==='card'?`${r.type}：${r.title}`:r.title;
      const meta=`${r.date||''}${r.progress?' · '+r.progress:''}${r.feishuUrl?' · 已归档飞书':''}`;
      if(r.feishuUrl){
        item.innerHTML=`<a href="${esc(r.feishuUrl)}" target="_blank" rel="noopener"><strong>${esc(label)} ↗</strong><span>${esc(meta)}</span></a>`;
      }else{
        item.innerHTML=`<button type="button"><strong>${esc(label)}</strong><span>${esc(meta)}</span></button>`;
        if(r.kind==='card')item.querySelector('button').onclick=()=>loadNote(r.id);
      }
      root.appendChild(item);
    });
  }
  function loadNote(id){
    const n=state.notes.find(x=>x.id===id);if(!n)return;
    currentId=n.id;persist();$('rv2Type').value=n.type||'观念卡';$('rv2CardTitle').value=n.title||'';$('rv2Thought').value=n.thought||'';$('rv2Excerpt').value=n.excerpt||'';
    if(n.sourceTitle)$('rv2BookTitle').value=n.sourceTitle;if(n.progress)$('rv2Progress').value=n.progress;
    if(thoughtReady&&thoughtEditor)thoughtEditor.setValue($('rv2Thought').value);
    if(excerptReady&&excerptEditor)excerptEditor.setValue($('rv2Excerpt').value);
    renderPrompts(n.type||'观念卡');$('rv2Status').textContent=n.savedAt?'已保存':'未保存';$('rv2Archive').textContent=n.feishuDocumentToken?'更新飞书':'归档飞书';$('rv2Archive').classList.toggle('is-archived',!!n.feishuDocumentToken);$('rv2FeishuLink').href=n.feishuUrl||FEISHU_DAILY;$('rv2FeishuLink').textContent=n.feishuUrl?'打开这张卡的飞书文档':'打开飞书归档位置';renderRecords();if(window.ArchiveTargets)refreshArchiveLink();
  }
  function readNote(){const old=currentNote()||blankNote($('rv2Type').value);return {...old,id:old.id,date:old.date||dateKey(),type:$('rv2Type').value,title:$('rv2CardTitle').value.trim(),thought:(thoughtReady&&thoughtEditor?thoughtEditor.getValue():$('rv2Thought').value).trim(),excerpt:(excerptReady&&excerptEditor?excerptEditor.getValue():$('rv2Excerpt').value).trim(),sourceTitle:$('rv2BookTitle').value.trim(),progress:$('rv2Progress').value.trim(),savedAt:new Date().toISOString()}}
  function saveNote(show=true){
    saveReader();const n=readNote();const idx=state.notes.findIndex(x=>x.id===n.id);if(idx>=0)state.notes[idx]=n;else state.notes.unshift(n);currentId=n.id;persist();renderRecords();
    if(show){$('rv2Status').textContent='已保存';setTimeout(()=>{if($('rv2Status'))$('rv2Status').textContent=''},1400)}return n;
  }
  function newNote(){
    const existing=currentNote();if(existing&&(existing.title||existing.thought||existing.excerpt))saveNote(false);
    const n=blankNote($('rv2Type').value);state.notes.unshift(n);currentId=n.id;persist();loadNote(n.id);$('rv2CardTitle').focus();
  }

  function readerUrl(){return $('rv2Url').value.trim()}
  function loadReader(url){
    const u=url||readerUrl();if(!u){$('rv2Status').textContent='请先填写 PDF / 网页链接';return}
    const frame=$('rv2Frame');$('rv2ReaderPlaceholder').classList.add('hidden');frame.src=u;frame.classList.add('loaded');saveReader();
  }
  async function importClipboard(){
    try{
      if(!navigator.clipboard?.readText)throw new Error('当前浏览器不支持直接读取剪贴板');
      const text=(await navigator.clipboard.readText()).trim();if(!text)throw new Error('剪贴板里没有文字');
      const box=$('rv2Excerpt');box.value=box.value.trim()?`${box.value.trim()}\n\n${text}`:text;$('rv2Status').textContent='已导入原文';if(excerptReady&&excerptEditor)excerptEditor.setValue(box.value);box.focus();
    }catch(e){$('rv2Status').textContent=`请手动粘贴：${e.message}`;$('rv2Excerpt').focus()}
  }

  async function archiveNote(){
    const n=saveNote(false);if(!n.title&&!n.thought&&!n.excerpt){$('rv2Status').textContent='请先填写笔记';return}
    const btn=$('rv2Archive');btn.disabled=true;btn.textContent=n.feishuDocumentToken?'正在更新…':'正在归档…';$('rv2Status').textContent='正在同步飞书…';
    const title=`${n.type}：${n.title||n.sourceTitle||'阅读笔记'}`;
    const meta=[n.sourceTitle?`**阅读对象：** ${n.sourceTitle}`:'',n.progress?`**阅读进度：** ${n.progress}`:'',`**记录日期：** ${n.date||dateKey()}`].filter(Boolean).join('\n\n');
    const markdown=`${meta}\n\n## 解读\n\n${n.thought||''}\n\n---\n\n## 原文\n\n${n.excerpt||''}`;
    try{
      if(!window.ArchiveTargets)throw Error('归档位置设置尚未加载，请刷新后重试');
      const destination=await ArchiveTargets.getDestination('reading');
      const res=await fetch('/api/feishu-daily',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:n.date||dateKey(),title,markdown,source:'reading',locationId:destination.id,previousTargetToken:n.archiveTargetToken||'',documentToken:n.feishuDocumentToken||'',wikiToken:n.feishuWikiToken||''})});
      const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.message||`归档失败 (${res.status})`);
      const idx=state.notes.findIndex(x=>x.id===n.id);state.notes[idx]={...n,archiveTargetToken:data.targetToken||destination.token,archiveLocationId:data.locationId||destination.id,archiveSource:'reading',feishuUrl:data.url||destination.url,feishuDocumentToken:data.documentToken||n.feishuDocumentToken||'',feishuWikiToken:data.wikiToken||n.feishuWikiToken||'',syncedAt:new Date().toISOString()};persist();loadNote(n.id);$('rv2Status').textContent=data.updated?'已更新飞书':'已归档飞书';renderRecords();
    }catch(e){$('rv2Status').textContent=`归档失败：${e.message}`}
    finally{btn.disabled=false;const fresh=currentNote();btn.textContent=fresh?.feishuDocumentToken?'更新飞书':'归档飞书'}
  }

  async function refreshArchiveLink(){
    if(currentNote()?.feishuUrl)return;
    try{const target=await ArchiveTargets.getDestination('reading');$('rv2FeishuLink').href=target.url;$('rv2FeishuLink').textContent='打开归档位置：'+target.name;}catch{$('rv2FeishuLink').removeAttribute('href');$('rv2FeishuLink').textContent='请先配置归档位置';}
  }
  if(window.ArchiveTargets){ArchiveTargets.mount('reading',$('rv2Archive').parentElement).then(()=>{refreshArchiveLink();if(new URLSearchParams(location.search).get('archiveSettings')==='1')ArchiveTargets.openSettings()});document.addEventListener('archive-target-changed',()=>refreshArchiveLink());}
  $('rv2Type').onchange=e=>{renderPrompts(e.target.value);const n=currentNote();if(n){n.type=e.target.value;persist()}};
  $('rv2Save').onclick=()=>saveNote(true);$('rv2Archive').onclick=archiveNote;$('rv2New').onclick=newNote;$('rv2Clipboard').onclick=importClipboard;
  $('rv2PdfMode').onclick=()=>setMode('pdf');$('rv2WebMode').onclick=()=>setMode('web');
  ['rv2BookTitle','rv2Progress','rv2Url'].forEach(id=>$(id).addEventListener('change',saveReader));
  $('rv2Load').onclick=()=>loadReader();$('rv2Open').onclick=()=>{const u=readerUrl();if(u)window.open(u,'_blank','noopener')};
  $('rv2Pdf').onclick=()=>$('rv2PdfInput').click();
  $('rv2PdfInput').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(localPdfUrl)URL.revokeObjectURL(localPdfUrl);localPdfUrl=URL.createObjectURL(file);setMode('pdf');$('rv2Url').value='';if(!$('rv2BookTitle').value)$('rv2BookTitle').value=file.name.replace(/\.pdf$/i,'');loadReader(localPdfUrl)};

  $('rv2BookTitle').value=state.reader.title||'';$('rv2Progress').value=state.reader.progress||'';$('rv2Url').value=state.reader.url||'';setMode(state.reader.mode||'pdf');
  if(currentId&&state.notes.some(n=>n.id===currentId))loadNote(currentId);else if(state.notes.length)loadNote(state.notes[0].id);else{const n=blankNote();state.notes.unshift(n);currentId=n.id;persist();loadNote(n.id)}
  renderRecords();

  // Standalone writing is isolated from reading_workspace_v2 and legacy notes.
  // No automatic migration or mutation of existing reading cards.
  const STANDALONE='reading_standalone_notes_v1';
  const TAB_PREF='reading_active_tab_v1';
  let standaloneNotes=[];
  let standaloneId='';
  let standaloneSaveTimer=0;
  const standaloneStatus=$('rv2StandaloneStatus');
  try {
    const stored=JSON.parse(localStorage.getItem(STANDALONE)||'[]');
    if(Array.isArray(stored))standaloneNotes=stored.filter(n=>n&&typeof n.id==='string').map(n=>({
      ...n,id:n.id,title:String(n.title||''),body:String(n.body||''),updatedAt:String(n.updatedAt||'')
    }));
  } catch {
    standaloneStatus.textContent='无法读取旧笔记；为避免覆盖，已暂停保存';
  }
  const standaloneReadSafe=standaloneStatus.textContent!=='无法读取旧笔记；为避免覆盖，已暂停保存';
  function persistStandalone(){
    if(!standaloneReadSafe){standaloneStatus.textContent='原数据读取失败，禁止覆盖';return false}
    try{localStorage.setItem(STANDALONE,JSON.stringify(standaloneNotes));standaloneStatus.textContent='已保存到本地';return true}
    catch{standaloneStatus.textContent='保存失败，请复制正文备份';return false}
  }
  function renderStandaloneList(){
    const list=$('rv2StandaloneList');list.replaceChildren();
    for(const note of [...standaloneNotes].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){
      const button=document.createElement('button');button.type='button';button.className='reading-standalone-item';
      button.classList.toggle('active',note.id===standaloneId);
      const name=document.createElement('strong');name.textContent=note.title||'无标题笔记';
      const stamp=document.createElement('span');stamp.textContent=note.updatedAt?note.updatedAt.slice(0,16).replace('T',' '):'新建';
      button.append(name,stamp);button.onclick=()=>selectStandalone(note.id);list.append(button);
    }
  }
  function flushStandalone(){
    clearTimeout(standaloneSaveTimer);
    if(!standaloneId)return true;
    const note=standaloneNotes.find(n=>n.id===standaloneId);if(!note)return true;
    const title=$('rv2StandaloneTitle').value,body=standaloneEditorReady&&standaloneEditor?standaloneEditor.getValue():$('rv2StandaloneBody').value;
    if(note.title===title&&note.body===body)return true;
    note.title=title;note.body=body;note.updatedAt=new Date().toISOString();
    const ok=persistStandalone();renderStandaloneList();return ok;
  }
  function selectStandalone(id){
    if(!flushStandalone())return;
    const note=standaloneNotes.find(n=>n.id===id);if(!note)return;
    standaloneId=id;$('rv2StandaloneTitle').value=note.title;$('rv2StandaloneBody').value=note.body;
    renderStandaloneList();standaloneStatus.textContent='本地保存';
    if(standaloneEditorReady&&standaloneEditor)standaloneEditor.setValue(note.body||'');
    updateStandaloneArchiveLink(note);
  }
  function newStandalone(){
    if(!flushStandalone()||!standaloneReadSafe)return;
    const note={id:uid(),title:'',body:'## 解读\n\n\n---\n\n## 原文\n\n',updatedAt:new Date().toISOString()};
    standaloneNotes.unshift(note);
    if(!persistStandalone())return;
    selectStandalone(note.id);$('rv2StandaloneTitle').focus();
  }
  function switchReadingTab(mode){
    if(mode==='standalone'&&!standaloneReadSafe){standaloneStatus.textContent='原数据读取失败，请先备份；禁止覆盖'}
    if(mode!=='standalone'&&!flushStandalone())return;
    const solo=mode==='standalone';
    $('rv2SplitView').hidden=solo;$('rv2SplitHistory').hidden=solo;$('rv2StandaloneView').hidden=!solo;
    $('rv2NotesTab').setAttribute('aria-selected',String(solo));
    $('rv2SplitTab').setAttribute('aria-selected',String(!solo));
    $('rv2Progress').closest('.reading-progress-field').hidden=solo;
    const destinationUI=document.querySelector('.archive-target-control');
    if(destinationUI){const target=solo?$('rv2StandaloneArchiveTools'):$('rv2Archive').parentElement;if(destinationUI.parentNode!==target)target.appendChild(destinationUI)}
    try{localStorage.setItem(TAB_PREF,solo?'standalone':'split')}catch{}
  }
  $('rv2SplitTab').onclick=()=>switchReadingTab('split');
  $('rv2NotesTab').onclick=()=>switchReadingTab('standalone');
  $('rv2StandaloneNew').onclick=newStandalone;
  $('rv2StandaloneDelete').onclick=()=>{
    if(!standaloneReadSafe||!standaloneId)return;
    if(!window.confirm('确定删除这条独立笔记？此操作不能撤销。'))return;
    const snapshot=standaloneNotes.slice(),target=standaloneId;
    standaloneNotes=standaloneNotes.filter(n=>n.id!==target);
    if(!persistStandalone()){standaloneNotes=snapshot;return}
    standaloneId='';$('rv2StandaloneTitle').value='';$('rv2StandaloneBody').value='';
    renderStandaloneList();if(standaloneNotes.length)selectStandalone(standaloneNotes[0].id);
  };
  for(const id of ['rv2StandaloneTitle','rv2StandaloneBody']){
    $(id).addEventListener('input',()=>{
      standaloneStatus.textContent='待保存…';
      clearTimeout(standaloneSaveTimer);standaloneSaveTimer=setTimeout(flushStandalone,450);
    });
    $(id).addEventListener('blur',flushStandalone);
  }
  window.addEventListener('pagehide',flushStandalone);
  if(standaloneNotes.length)selectStandalone(standaloneNotes[0].id);
  else if(standaloneReadSafe)newStandalone();
  let preferred='split';
  try{preferred=localStorage.getItem(TAB_PREF)==='standalone'?'standalone':'split'}catch{}
  switchReadingTab(preferred);
})();