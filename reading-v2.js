// Reading Workspace V3: split-mode WeRead + embedded PDF/web + card notes + Feishu archive
(function(){
  const reading=document.getElementById('reading');
  if(!reading)return;

  const FEISHU_DAILY='https://my.feishu.cn/wiki/IH63wL0oKi6Dp2kU4cncE8gUnig?fromScene=spaceOverview';
  const TARGET_WIKI_TOKEN='IH63wL0oKi6Dp2kU4cncE8gUnig';
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

  let state=get(STORE,{reader:{title:'',progress:'',mode:'weread',url:''},notes:[],currentId:''});
  if(!state||typeof state!=='object')state={reader:{title:'',progress:'',mode:'weread',url:''},notes:[],currentId:''};
  state.reader=state.reader||{title:'',progress:'',mode:'weread',url:''};
  state.notes=Array.isArray(state.notes)?state.notes:[];

  if(!state.notes.length){
    const legacy=get(LEGACY,{});
    Object.entries(legacy||{}).forEach(([date,r])=>{
      if(!r||!(r.source||r.excerpt||r.insight||r.action))return;
      state.notes.push({id:uid(),date,type:'观念卡',title:r.source||'阅读笔记',thought:[r.insight,r.action].filter(Boolean).join('\n\n'),excerpt:r.excerpt||'',sourceTitle:r.source||'',progress:r.progress||'',savedAt:r.savedAt||'',feishuUrl:'',feishuDocumentToken:'',feishuWikiToken:''});
    });
    set(STORE,state);
  }

  reading.innerHTML=`
  <div class="reading-v2-page">
    <div class="reading-v2-head">
      <div><h2>每日阅读</h2><p>阅读占主屏，笔记只做加工。微信读书正常打开，PDF / 网页可直接嵌入。</p></div>
      <div class="reading-v2-head-progress"><span>阅读进度</span><input id="rv2Progress" placeholder="例如：42% / 第 3 章 / P120"></div>
    </div>

    <div class="reading-v2-workspace">
      <section class="reading-v2-reader">
        <div class="reading-v2-readerbar">
          <input id="rv2BookTitle" class="reading-v2-book-title" placeholder="当前书籍 / 阅读对象">
          <select id="rv2Mode" title="阅读来源"><option value="weread">微信读书</option><option value="web">PDF / 网页</option></select>
        </div>
        <div id="rv2Loadbar" class="reading-v2-loadbar">
          <input id="rv2Url" type="url" placeholder="PDF / 网页链接；微信读书可留空">
          <button id="rv2Load" class="reading-v2-secondary">加载阅读</button>
          <button id="rv2Open" class="reading-v2-secondary">新窗口打开</button>
        </div>

        <div class="reading-v2-frame-shell">
          <div id="rv2WereadPanel" class="reading-v2-weread-panel">
            <div class="reading-v2-weread-mark">微</div>
            <h3>微信读书 · 分屏阅读</h3>
            <p>微信读书不再强行嵌入。保持官方页面正常阅读，复制需要的原文，再回到右侧一键导入。</p>
            <div class="reading-v2-weread-flow"><span>1 打开微信读书</span><i>→</i><span>2 复制原文</span><i>→</i><span>3 一键导入笔记</span></div>
            <div class="reading-v2-weread-actions">
              <button id="rv2OpenWeread" class="task-primary-btn">打开微信读书</button>
              <button id="rv2SplitWeread" class="reading-v2-secondary">电脑分屏打开</button>
            </div>
            <small>手机会新开标签页；电脑优先尝试打开独立阅读窗口。不会使用插件或绕过微信风控。</small>
          </div>
          <div id="rv2ReaderPlaceholder" class="reading-v2-placeholder is-hidden">
            <strong>PDF / 网页阅读区</strong><span>粘贴链接后点击“加载阅读”，或直接选择本地 PDF。</span>
          </div>
          <iframe id="rv2Frame" title="阅读内容" referrerpolicy="no-referrer" loading="eager"></iframe>
        </div>
      </section>

      <section class="reading-v2-note">
        <div class="reading-v2-note-head">
          <div class="reading-v2-template-switch"><label>模板</label><select id="rv2Type"><option>观念卡</option><option>案例卡</option><option>方法卡</option></select></div>
          <div class="reading-v2-note-head-actions"><select id="rv2History" title="历史笔记"><option value="">历史笔记</option></select><button id="rv2New" class="reading-v2-secondary">新建</button></div>
        </div>

        <div class="reading-v2-card-title-row"><strong id="rv2CardPrefix">观念卡：</strong><input id="rv2CardTitle" placeholder="给这张卡一个标题"></div>

        <div class="reading-v2-thought-block">
          <div class="reading-v2-section-title"><span>我的思考</span><small>按模板加工原文</small></div>
          <div id="rv2Prompts" class="reading-v2-prompts"></div>
          <textarea id="rv2Thought" placeholder="写下你的理解、判断和迁移……"></textarea>
        </div>

        <div class="reading-v2-divider"><span>原文</span></div>
        <div class="reading-v2-clip-row"><span>把微信读书里复制的文字放到这里</span><button id="rv2Clipboard" class="reading-v2-secondary">从剪贴板导入</button></div>
        <div class="reading-v2-source-block"><textarea id="rv2Excerpt" placeholder="原文 / 摘录"></textarea></div>

        <div class="reading-v2-note-actions"><button id="rv2Save" class="task-primary-btn">保存笔记</button><button id="rv2Archive" class="reading-v2-archive">归档飞书</button><span id="rv2Status"></span></div>
        <a id="rv2FeishuLink" class="reading-v2-feishu-link" href="${FEISHU_DAILY}" target="_blank">打开飞书归档位置</a>
      </section>
    </div>

    <div class="reading-v2-functionbar">
      <div><strong>阅读工具</strong><span>只保留高频动作</span></div>
      <div class="reading-v2-function-actions">
        <button id="rv2Weread" class="reading-v2-secondary">打开微信读书</button>
        <button id="rv2Pdf" class="reading-v2-secondary">选择本地 PDF</button>
        <input id="rv2PdfInput" type="file" accept="application/pdf" hidden>
        <button id="rv2QuickCard" class="reading-v2-secondary">复制原文 → 新建卡</button>
        <button id="rv2Fullscreen" class="reading-v2-secondary">阅读区全屏</button>
      </div>
    </div>
  </div>`;

  let currentId=state.currentId||'';
  let localPdfUrl='';

  function blankNote(type='观念卡'){
    return {id:uid(),date:dateKey(),type,title:'',thought:'',excerpt:'',sourceTitle:state.reader.title||'',progress:state.reader.progress||'',savedAt:'',feishuUrl:'',feishuDocumentToken:'',feishuWikiToken:''};
  }
  function currentNote(){return state.notes.find(n=>n.id===currentId)||null}
  function persist(){state.currentId=currentId;set(STORE,state)}
  function saveReader(){state.reader={title:$('rv2BookTitle').value.trim(),progress:$('rv2Progress').value.trim(),mode:$('rv2Mode').value,url:$('rv2Url').value.trim()};persist()}
  function renderPrompts(type){$('rv2Prompts').innerHTML=(templatePrompts[type]||[]).map((p,i)=>`<span>${i+1}. ${esc(p)}</span>`).join('');$('rv2CardPrefix').textContent=`${type}：`}
  function renderHistory(){const sel=$('rv2History');const keep=sel.value;sel.innerHTML='<option value="">历史笔记</option>';[...state.notes].sort((a,b)=>(b.savedAt||b.date||'').localeCompare(a.savedAt||a.date||'')).forEach(n=>{const o=document.createElement('option');o.value=n.id;o.textContent=`${n.type}｜${n.title||n.sourceTitle||'未命名'}｜${n.date||''}`;sel.appendChild(o)});if([...sel.options].some(o=>o.value===keep))sel.value=keep}
  function loadNote(id){let n=state.notes.find(x=>x.id===id);if(!n){n=blankNote();state.notes.unshift(n)}currentId=n.id;persist();$('rv2Type').value=n.type||'观念卡';$('rv2CardTitle').value=n.title||'';$('rv2Thought').value=n.thought||'';$('rv2Excerpt').value=n.excerpt||'';renderPrompts(n.type||'观念卡');$('rv2Status').textContent=n.savedAt?'已保存':'未保存';$('rv2Archive').textContent=n.feishuDocumentToken?'更新飞书':'归档飞书';$('rv2Archive').classList.toggle('is-archived',!!n.feishuDocumentToken);$('rv2FeishuLink').href=n.feishuUrl||FEISHU_DAILY;$('rv2FeishuLink').textContent=n.feishuUrl?'打开这张卡的飞书文档':'打开飞书归档位置';renderHistory()}
  function readNote(){const old=currentNote()||blankNote($('rv2Type').value);return {...old,id:old.id,date:old.date||dateKey(),type:$('rv2Type').value,title:$('rv2CardTitle').value.trim(),thought:$('rv2Thought').value.trim(),excerpt:$('rv2Excerpt').value.trim(),sourceTitle:$('rv2BookTitle').value.trim(),progress:$('rv2Progress').value.trim(),savedAt:new Date().toISOString()}}
  function saveNote(show=true){saveReader();const n=readNote();const idx=state.notes.findIndex(x=>x.id===n.id);if(idx>=0)state.notes[idx]=n;else state.notes.unshift(n);currentId=n.id;persist();renderHistory();if(show){$('rv2Status').textContent='已保存';setTimeout(()=>{if($('rv2Status'))$('rv2Status').textContent=''},1400)}return n}
  function newNote(){if(currentNote())saveNote(false);const n=blankNote($('rv2Type').value);state.notes.unshift(n);currentId=n.id;persist();loadNote(n.id);$('rv2CardTitle').focus()}

  function renderReaderMode(){
    const weread=$('rv2Mode').value==='weread';
    $('rv2WereadPanel').style.display=weread?'flex':'none';
    $('rv2Loadbar').style.display=weread?'none':'grid';
    if(weread){$('rv2Frame').classList.remove('is-loaded');$('rv2Frame').src='about:blank';$('rv2ReaderPlaceholder').classList.add('is-hidden')}
    else if(!$('rv2Frame').classList.contains('is-loaded')){$('rv2ReaderPlaceholder').classList.remove('is-hidden')}
    saveReader();
  }
  function readerUrl(){return $('rv2Url').value.trim()}
  function loadReader(url){const u=url||readerUrl();if(!u){$('rv2Status').textContent='请先填写 PDF / 网页链接';return}const frame=$('rv2Frame');$('rv2Mode').value='web';$('rv2WereadPanel').style.display='none';$('rv2Loadbar').style.display='grid';$('rv2ReaderPlaceholder').classList.add('is-hidden');frame.src=u;frame.classList.add('is-loaded');saveReader()}
  function openWeread(split=false){
    const u=state.reader.url&&/weread\.qq\.com/i.test(state.reader.url)?state.reader.url:'https://weread.qq.com/';
    if(split&&window.screen?.availWidth>900){const w=Math.round(screen.availWidth*.64),h=screen.availHeight;window.open(u,'weread_reader',`popup=yes,width=${w},height=${h},left=0,top=0,resizable=yes,scrollbars=yes`)}
    else window.open(u,'_blank','noopener');
  }
  async function importClipboard(makeNew=false){
    if(makeNew)newNote();
    try{
      if(!navigator.clipboard?.readText)throw new Error('当前浏览器不支持直接读取剪贴板');
      const text=(await navigator.clipboard.readText()).trim();
      if(!text)throw new Error('剪贴板里没有文字');
      const box=$('rv2Excerpt');box.value=box.value.trim()?`${box.value.trim()}\n\n${text}`:text;
      $('rv2Status').textContent=makeNew?'已新建并导入原文':'已导入原文';box.focus();
    }catch(e){$('rv2Status').textContent=`请手动粘贴：${e.message}`;$('rv2Excerpt').focus()}
  }

  async function archiveNote(){
    const n=saveNote(false);if(!n.title&&!n.thought&&!n.excerpt){$('rv2Status').textContent='请先填写笔记';return}
    const btn=$('rv2Archive');btn.disabled=true;btn.textContent=n.feishuDocumentToken?'正在更新…':'正在归档…';$('rv2Status').textContent='正在同步飞书…';
    const title=`${n.type}：${n.title||n.sourceTitle||'阅读笔记'}`;
    const meta=[n.sourceTitle?`**阅读对象：** ${n.sourceTitle}`:'',n.progress?`**阅读进度：** ${n.progress}`:'',`**记录日期：** ${n.date||dateKey()}`].filter(Boolean).join('\n\n');
    const markdown=`${meta}\n\n## 我的思考\n\n${n.thought||''}\n\n---\n\n## 原文\n\n${n.excerpt||''}`;
    try{
      const res=await fetch('/api/feishu-daily',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:n.date||dateKey(),title,markdown,targetWikiToken:TARGET_WIKI_TOKEN,documentToken:n.feishuDocumentToken||'',wikiToken:n.feishuWikiToken||''})});
      const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.message||`归档失败 (${res.status})`);
      const idx=state.notes.findIndex(x=>x.id===n.id);state.notes[idx]={...n,feishuUrl:data.url||FEISHU_DAILY,feishuDocumentToken:data.documentToken||n.feishuDocumentToken||'',feishuWikiToken:data.wikiToken||n.feishuWikiToken||'',syncedAt:new Date().toISOString()};persist();loadNote(n.id);$('rv2Status').textContent=data.updated?'已更新飞书':'已归档飞书';
    }catch(e){$('rv2Status').textContent=`归档失败：${e.message}`}
    finally{btn.disabled=false;const fresh=currentNote();btn.textContent=fresh?.feishuDocumentToken?'更新飞书':'归档飞书'}
  }

  $('rv2Type').onchange=e=>{renderPrompts(e.target.value);const n=currentNote();if(n){n.type=e.target.value;persist()}};
  $('rv2Save').onclick=()=>saveNote(true);$('rv2Archive').onclick=archiveNote;$('rv2New').onclick=newNote;
  $('rv2History').onchange=e=>{if(e.target.value){if(currentNote())saveNote(false);loadNote(e.target.value)}};
  ['rv2BookTitle','rv2Progress','rv2Url'].forEach(id=>$(id).addEventListener('change',saveReader));
  $('rv2Mode').onchange=renderReaderMode;
  $('rv2Load').onclick=()=>loadReader();
  $('rv2Open').onclick=()=>{const u=readerUrl();if(u)window.open(u,'_blank','noopener')};
  $('rv2OpenWeread').onclick=()=>openWeread(false);$('rv2SplitWeread').onclick=()=>openWeread(true);$('rv2Weread').onclick=()=>openWeread(false);
  $('rv2Clipboard').onclick=()=>importClipboard(false);$('rv2QuickCard').onclick=()=>importClipboard(true);
  $('rv2Pdf').onclick=()=>$('rv2PdfInput').click();
  $('rv2PdfInput').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(localPdfUrl)URL.revokeObjectURL(localPdfUrl);localPdfUrl=URL.createObjectURL(file);$('rv2Mode').value='web';$('rv2Url').value='';$('rv2BookTitle').value=$('rv2BookTitle').value||file.name.replace(/\.pdf$/i,'');loadReader(localPdfUrl)};
  $('rv2Fullscreen').onclick=()=>{const shell=document.querySelector('.reading-v2-frame-shell');if(document.fullscreenElement)document.exitFullscreen?.();else shell?.requestFullscreen?.()};

  $('rv2BookTitle').value=state.reader.title||'';$('rv2Progress').value=state.reader.progress||'';$('rv2Mode').value=state.reader.mode||'weread';$('rv2Url').value=state.reader.url||'';
  renderReaderMode();
  if(currentId&&state.notes.some(n=>n.id===currentId))loadNote(currentId);else if(state.notes.length)loadNote(state.notes[0].id);else{const n=blankNote();state.notes.unshift(n);currentId=n.id;persist();loadNote(n.id)}
})();