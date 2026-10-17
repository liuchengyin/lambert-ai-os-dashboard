// Daily Writing V3 + Daily Reading
(function(){
  const FEISHU_DAILY='https://my.feishu.cn/wiki/IH63wL0oKi6Dp2kU4cncE8gUnig?fromScene=spaceOverview';
  const $=id=>document.getElementById(id);
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  function dateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
  function shiftDate(key,n){const [y,m,d]=key.split('-').map(Number);const x=new Date(y,m-1,d);x.setDate(x.getDate()+n);return dateKey(x)}
  function pretty(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'})}
  function loadCss(href){if(document.querySelector(`link[href="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l)}
  function loadVditor(){return new Promise((resolve,reject)=>{if(window.Vditor)return resolve();const src='https://cdn.jsdelivr.net/npm/vditor/dist/index.min.js';if(document.querySelector(`script[src="${src}"]`)){const timer=setInterval(()=>{if(window.Vditor){clearInterval(timer);resolve()}},50);setTimeout(()=>{clearInterval(timer);reject(new Error('editor load timeout'))},10000);return}const s=document.createElement('script');s.src=src;s.onload=()=>window.Vditor?resolve():reject(new Error('editor load failed'));s.onerror=reject;document.head.appendChild(s)})}
  loadCss('https://cdn.jsdelivr.net/npm/vditor/dist/index.css');

  const nav=document.querySelector('nav');
  const reviewBtn=[...nav.querySelectorAll('button')].find(b=>b.dataset.v==='review');
  function addNav(id,label,after){if(nav.querySelector(`[data-v="${id}"]`))return nav.querySelector(`[data-v="${id}"]`);const b=document.createElement('button');b.dataset.v=id;b.textContent=label;b.onclick=()=>openView(id);after?.insertAdjacentElement('afterend',b);return b}
  const writingBtn=addNav('writing','每日记录',reviewBtn);
  const readingBtn=addNav('reading','每日阅读',writingBtn);

  const settings=document.getElementById('settings');
  let writing=document.getElementById('writing');if(!writing){writing=document.createElement('section');writing.id='writing';writing.className='view';settings?.insertAdjacentElement('beforebegin',writing)}
  let reading=document.getElementById('reading');if(!reading){reading=document.createElement('section');reading.id='reading';reading.className='view';settings?.insertAdjacentElement('beforebegin',reading)}

  const writingStore=get('daily_writing_v2',{});const legacy=get('daily_writing_v1',{});if(!Object.keys(writingStore).length&&Object.keys(legacy).length){Object.entries(legacy).forEach(([d,r])=>writingStore[d]={title:r.title||'',markdown:r.body||'',savedAt:r.savedAt||'',feishuUrl:r.feishuUrl||'',syncState:r.feishuUrl?'synced':'local'});set('daily_writing_v2',writingStore)}
  let writingDate=dateKey(),editor=null,editorReady=false,autosaveTimer=null;
  writing.innerHTML=`<div class="daily-page daily-writing-v2"><div class="daily-head"><div><h2>每日记录</h2><p>像飞书一样写。标题独立，正文支持 Markdown 快捷输入，归档后保持同一结构。</p></div><div class="daily-datebar"><button id="dwPrev">←</button><input id="dwDate" type="date"><button id="dwToday">今天</button><button id="dwNext">→</button></div></div><div class="daily-layout daily-writing-layout"><div class="daily-editor writing-editor-shell"><div class="daily-meta-row"><span id="dwPretty"></span><div class="sync-state"><span id="dwStatus" class="daily-status-pill">未保存</span><span id="dwSync" class="daily-status-pill sync">未同步飞书</span></div></div><input id="dwTitle" class="daily-title" placeholder="无标题"><div id="dwEditor" class="daily-rich-editor"><div class="editor-loading">正在加载编辑器…</div></div><div class="daily-actions"><button id="dwSave" class="primary">保存草稿</button><button id="dwArchive" class="archive">归档到飞书</button><a id="dwOpenFeishu" class="daily-open-feishu" href="${FEISHU_DAILY}" target="_blank">打开飞书目录</a></div><div class="daily-note" id="dwNote">正文支持 # + 空格标题、列表、引用、任务、表格、代码等 Markdown 快捷输入。</div></div><aside class="daily-side daily-history"><h3>记录历史</h3><div id="dwHistory" class="daily-history-list"></div><div class="daily-feishu-target"><strong>飞书正式归档位置</strong><a href="${FEISHU_DAILY}" target="_blank">🐌 每日记录</a><small>同一天重复归档会更新原文档，不再重复创建。</small></div></aside></div></div>`;

  function writingBlank(){return {title:'',markdown:'',savedAt:'',feishuUrl:'',feishuDocumentToken:'',feishuWikiToken:'',syncState:'local'}}
  function currentMarkdown(){return editorReady&&editor?editor.getValue():''}
  function applyMarkdown(md){if(editorReady&&editor)editor.setValue(md||'',true)}
  function setSyncUi(r){const sync=$('dwSync');const open=$('dwOpenFeishu');if(r?.feishuUrl){sync.textContent='已归档飞书';sync.classList.add('saved');open.href=r.feishuUrl;open.textContent='打开飞书文档'}else{sync.textContent='未同步飞书';sync.classList.remove('saved');open.href=FEISHU_DAILY;open.textContent='打开飞书目录'}}
  function loadWriting(key){writingDate=key;$('dwDate').value=key;$('dwPretty').textContent=pretty(key);const r=writingStore[key]||writingBlank();$('dwTitle').value=r.title||'';applyMarkdown(r.markdown||'');$('dwStatus').textContent=r.savedAt?'草稿已保存':'未保存';$('dwStatus').classList.toggle('saved',!!r.savedAt);setSyncUi(r);renderWritingHistory()}
  function saveWriting(silent=false){const old=writingStore[writingDate]||writingBlank();writingStore[writingDate]={...old,title:$('dwTitle').value.trim(),markdown:currentMarkdown(),savedAt:new Date().toISOString()};set('daily_writing_v2',writingStore);$('dwStatus').textContent='草稿已保存';$('dwStatus').classList.add('saved');renderWritingHistory();if(!silent)$('dwNote').textContent='草稿已保存。正式版本仍以飞书归档结果为准。'}
  function renderWritingHistory(){const root=$('dwHistory');root.innerHTML='';const rows=Object.entries(writingStore).filter(([,r])=>r.title||r.markdown).sort((a,b)=>b[0].localeCompare(a[0]));if(!rows.length){root.innerHTML='<div class="daily-placeholder">还没有记录</div>';return}rows.slice(0,30).forEach(([d,r])=>{const b=document.createElement('button');b.className='daily-history-item';b.innerHTML=`<strong>${esc(r.title||'未命名记录')}</strong><span>${esc(d)}${r.feishuUrl?' · 已归档飞书':''}</span>`;b.onclick=()=>{saveWriting(true);loadWriting(d)};root.appendChild(b)})}
  function markEditing(){clearTimeout(autosaveTimer);$('dwStatus').textContent='编辑中';$('dwStatus').classList.remove('saved');autosaveTimer=setTimeout(()=>saveWriting(true),900)}

  async function initEditor(){
    try{
      await loadVditor();
      $('dwEditor').innerHTML='';
      editor=new Vditor('dwEditor',{
        height:560,
        mode:'ir',
        cache:{enable:false},
        placeholder:'开始记录…',
        theme:'classic',
        icon:'ant',
        toolbar:['undo','redo','|','headings','bold','italic','strike','|','link','quote','|','list','ordered-list','check','|','outdent','indent','|','table','code','inline-code','|','fullscreen'],
        toolbarConfig:{pin:true},preview:{delay:80,actions:[]},counter:{enable:false},input:()=>markEditing(),
        after:()=>{editorReady=true;loadWriting(writingDate)}
      });
    }catch(e){$('dwEditor').innerHTML='<div class="editor-error">编辑器加载失败，请刷新页面重试。</div>';console.error(e)}
  }

  async function archiveWriting(){
    saveWriting(true);const r=writingStore[writingDate]||writingBlank();if(!r.title&&!r.markdown){$('dwNote').textContent='请先写点内容再归档。';return}
    const btn=$('dwArchive');btn.disabled=true;btn.textContent=r.feishuDocumentToken?'正在更新…':'正在归档…';$('dwNote').textContent=r.feishuDocumentToken?'正在更新原飞书文档…':'正在创建飞书文档…';
    try{
      const res=await fetch('/api/feishu-daily',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:writingDate,title:r.title||`${writingDate}｜每日记录`,markdown:r.markdown,targetWikiToken:'IH63wL0oKi6Dp2kU4cncE8gUnig',documentToken:r.feishuDocumentToken||'',wikiToken:r.feishuWikiToken||''})});
      const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.message||`归档失败 (${res.status})`);
      writingStore[writingDate]={...r,feishuUrl:data.url||FEISHU_DAILY,feishuDocumentToken:data.documentToken||r.feishuDocumentToken||'',feishuWikiToken:data.wikiToken||r.feishuWikiToken||'',syncState:'synced',syncedAt:new Date().toISOString()};
      set('daily_writing_v2',writingStore);setSyncUi(writingStore[writingDate]);renderWritingHistory();$('dwNote').textContent=data.updated?'已更新原飞书文档，不会重复创建。':'已完整归档到飞书。';
    }catch(e){$('dwNote').textContent=`暂未完成飞书归档：${e.message}`;}finally{btn.disabled=false;btn.textContent='归档到飞书'}
  }

  $('dwSave').onclick=()=>saveWriting(false);$('dwArchive').onclick=archiveWriting;$('dwTitle').addEventListener('input',markEditing);$('dwPrev').onclick=()=>{saveWriting(true);loadWriting(shiftDate(writingDate,-1))};$('dwNext').onclick=()=>{saveWriting(true);loadWriting(shiftDate(writingDate,1))};$('dwToday').onclick=()=>{saveWriting(true);loadWriting(dateKey())};$('dwDate').onchange=e=>{saveWriting(true);loadWriting(e.target.value||dateKey())};
  initEditor();

  // Stable reading owns this container; a late legacy loader must never replace it.
  if(reading.querySelector('.reading-stable-page'))return;
  const readingStore=get('daily_reading_v1',{});let readingDate=dateKey();
  reading.innerHTML=`<div class="daily-page"><div class="daily-head"><div><h2>每日阅读</h2><p>记录今天读了什么、读到哪里、理解了什么。</p></div><div class="daily-datebar"><button id="drPrev">←</button><input id="drDate" type="date"><button id="drToday">今天</button><button id="drNext">→</button></div></div><div class="daily-layout"><div class="daily-editor"><div class="daily-meta-row"><span id="drPretty"></span><span id="drStatus" class="daily-status-pill">未保存</span></div><div class="reading-form"><label>阅读对象<input id="drSource" placeholder="书名 / 文章 / 视频 / 主题"></label><div class="reading-progress"><label>阅读进度<input id="drProgress" placeholder="例如：第 3 章 / 40% / P120-P160"></label><label>时长<input id="drMinutes" type="number" min="0" placeholder="分钟"></label></div><label>今日摘录<textarea id="drExcerpt" placeholder="重要原句 / 概念 / 事实"></textarea></label><label>我的理解<textarea id="drInsight" placeholder="用自己的话解释今天真正理解了什么"></textarea></label><label>今日启发 / 行动<textarea id="drAction" placeholder="它改变了我什么判断？下一步做什么？"></textarea></label><div class="reading-actions"><button id="drSave" class="primary">保存当天</button></div></div></div><aside class="daily-side daily-history"><h3>阅读记录</h3><div id="drHistory" class="daily-history-list"></div></aside></div></div>`;
  function readingBlank(){return {source:'',progress:'',minutes:'',excerpt:'',insight:'',action:'',savedAt:''}}
  function loadReading(key){readingDate=key;$('drDate').value=key;$('drPretty').textContent=pretty(key);const r=readingStore[key]||readingBlank();['Source','Progress','Minutes','Excerpt','Insight','Action'].forEach(k=>{$('dr'+k).value=r[k.charAt(0).toLowerCase()+k.slice(1)]||''});$('drStatus').textContent=r.savedAt?'已保存':'未保存';$('drStatus').classList.toggle('saved',!!r.savedAt);renderReadingHistory()}
  function saveReading(){readingStore[readingDate]={source:$('drSource').value.trim(),progress:$('drProgress').value.trim(),minutes:$('drMinutes').value,excerpt:$('drExcerpt').value.trim(),insight:$('drInsight').value.trim(),action:$('drAction').value.trim(),savedAt:new Date().toISOString()};set('daily_reading_v1',readingStore);$('drStatus').textContent='已保存';$('drStatus').classList.add('saved');renderReadingHistory()}
  function renderReadingHistory(){const root=$('drHistory');root.innerHTML='';const rows=Object.entries(readingStore).filter(([,r])=>r.source||r.insight||r.excerpt).sort((a,b)=>b[0].localeCompare(a[0]));if(!rows.length){root.innerHTML='<div class="daily-placeholder">还没有阅读记录</div>';return}rows.slice(0,20).forEach(([d,r])=>{const b=document.createElement('button');b.className='daily-history-item';b.innerHTML=`<strong>${esc(r.source||'未命名阅读')}</strong><span>${esc(d)}${r.progress?' · '+esc(r.progress):''}</span>`;b.onclick=()=>loadReading(d);root.appendChild(b)})}
  $('drSave').onclick=saveReading;$('drPrev').onclick=()=>{saveReading();loadReading(shiftDate(readingDate,-1))};$('drNext').onclick=()=>{saveReading();loadReading(shiftDate(readingDate,1))};$('drToday').onclick=()=>{saveReading();loadReading(dateKey())};$('drDate').onchange=e=>{saveReading();loadReading(e.target.value||dateKey())};loadReading(readingDate);
})();