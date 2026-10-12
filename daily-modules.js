// Daily Writing + Daily Reading MVP
(function(){
  const FEISHU_DAILY='https://my.feishu.cn/wiki/IH63wL0oKi6Dp2kU4cncE8gUnig?fromScene=spaceOverview';
  const $=id=>document.getElementById(id);
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  function dateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
  function shiftDate(key,n){const [y,m,d]=key.split('-').map(Number);const x=new Date(y,m-1,d);x.setDate(x.getDate()+n);return dateKey(x)}
  function pretty(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'})}

  const nav=document.querySelector('nav');
  const reviewBtn=[...nav.querySelectorAll('button')].find(b=>b.dataset.v==='review');
  function addNav(id,label){if(nav.querySelector(`[data-v="${id}"]`))return;const b=document.createElement('button');b.dataset.v=id;b.innerHTML=`<span>${label}</span>`;b.onclick=()=>openView(id);reviewBtn?.insertAdjacentElement('afterend',b);return b}
  addNav('writing','每日记录');
  const writingBtn=nav.querySelector('[data-v="writing"]');
  const readingBtn=document.createElement('button');readingBtn.dataset.v='reading';readingBtn.textContent='每日阅读';readingBtn.onclick=()=>openView('reading');writingBtn?.insertAdjacentElement('afterend',readingBtn);

  const main=document.querySelector('main');
  const settings=document.getElementById('settings');
  const writing=document.createElement('section');writing.id='writing';writing.className='view';
  const reading=document.createElement('section');reading.id='reading';reading.className='view';
  settings?.insertAdjacentElement('beforebegin',writing);settings?.insertAdjacentElement('beforebegin',reading);

  const writingStore=get('daily_writing_v1',{});let writingDate=dateKey();
  writing.innerHTML=`<div class="daily-page"><div class="daily-head"><div><h2>每日记录</h2><p>在工作台写作，按日期保存；飞书归档入口已经绑定。</p></div><div class="daily-datebar"><button id="dwPrev">←</button><input id="dwDate" type="date"><button id="dwToday">今天</button><button id="dwNext">→</button></div></div><div class="daily-layout"><div class="daily-editor"><div class="daily-meta-row"><span id="dwPretty"></span><span id="dwStatus" class="daily-status-pill">未保存</span></div><input id="dwTitle" class="daily-title" placeholder="今天想记录什么？"><textarea id="dwBody" class="daily-body" placeholder="开始写……\n\n建议直接写事实、感受、判断、下一步。"></textarea><div class="daily-actions"><button id="dwSave" class="primary">保存当天</button><button id="dwArchive" class="archive pending">归档到飞书</button></div><div class="daily-note" id="dwNote">当前先完成工作台写作与本地归档状态；飞书自动创建子文档的后端接口下一步接通。</div></div><aside class="daily-side daily-history"><h3>历史记录</h3><div id="dwHistory" class="daily-history-list"></div><div class="daily-feishu-target"><strong>飞书归档位置</strong><a href="${FEISHU_DAILY}" target="_blank">🐌 每日记录</a></div></aside></div></div>`;

  function writingBlank(){return {title:'',body:'',savedAt:'',archiveReady:false,feishuUrl:''}}
  function loadWriting(key){writingDate=key;$('dwDate').value=key;$('dwPretty').textContent=pretty(key);const r=writingStore[key]||writingBlank();$('dwTitle').value=r.title||'';$('dwBody').value=r.body||'';$('dwStatus').textContent=r.savedAt?'已保存':'未保存';$('dwStatus').classList.toggle('saved',!!r.savedAt);renderWritingHistory()}
  function saveWriting(silent=false){const title=$('dwTitle').value.trim(),body=$('dwBody').value.trim();writingStore[writingDate]={...(writingStore[writingDate]||writingBlank()),title,body,savedAt:new Date().toISOString()};set('daily_writing_v1',writingStore);$('dwStatus').textContent='已保存';$('dwStatus').classList.add('saved');renderWritingHistory();if(!silent){$('dwNote').textContent='已保存到当前浏览器。飞书自动归档接口尚未接通。'}}
  function renderWritingHistory(){const root=$('dwHistory');root.innerHTML='';const rows=Object.entries(writingStore).filter(([,r])=>r.title||r.body).sort((a,b)=>b[0].localeCompare(a[0]));if(!rows.length){root.innerHTML='<div class="daily-placeholder">还没有记录</div>';return}rows.slice(0,20).forEach(([d,r])=>{const b=document.createElement('button');b.className='daily-history-item';b.innerHTML=`<strong>${esc(r.title||'未命名记录')}</strong><span>${esc(d)} · ${r.body?Math.min(r.body.length,9999)+' 字符':'空白'}</span>`;b.onclick=()=>{saveWriting(true);loadWriting(d)};root.appendChild(b)})}
  $('dwSave').onclick=()=>saveWriting(false);$('dwPrev').onclick=()=>{saveWriting(true);loadWriting(shiftDate(writingDate,-1))};$('dwNext').onclick=()=>{saveWriting(true);loadWriting(shiftDate(writingDate,1))};$('dwToday').onclick=()=>{saveWriting(true);loadWriting(dateKey())};$('dwDate').onchange=e=>{saveWriting(true);loadWriting(e.target.value||dateKey())};
  $('dwArchive').onclick=()=>{saveWriting(true);$('dwNote').innerHTML='飞书自动归档接口还未接通；已保存工作台草稿，并打开目标目录供你预览归档位置。';window.open(FEISHU_DAILY,'_blank','noopener')};
  let autosaveTimer;['dwTitle','dwBody'].forEach(id=>$(id).addEventListener('input',()=>{clearTimeout(autosaveTimer);$('dwStatus').textContent='编辑中';$('dwStatus').classList.remove('saved');autosaveTimer=setTimeout(()=>saveWriting(true),700)}));

  const readingStore=get('daily_reading_v1',{});let readingDate=dateKey();
  reading.innerHTML=`<div class="daily-page"><div class="daily-head"><div><h2>每日阅读</h2><p>记录今天读了什么、读到哪里、理解了什么。</p></div><div class="daily-datebar"><button id="drPrev">←</button><input id="drDate" type="date"><button id="drToday">今天</button><button id="drNext">→</button></div></div><div class="daily-layout"><div class="daily-editor"><div class="daily-meta-row"><span id="drPretty"></span><span id="drStatus" class="daily-status-pill">未保存</span></div><div class="reading-form"><label>阅读对象<input id="drSource" placeholder="书名 / 文章 / 视频 / 主题"></label><div class="reading-progress"><label>阅读进度<input id="drProgress" placeholder="例如：第 3 章 / 40% / P120-P160"></label><label>时长<input id="drMinutes" type="number" min="0" placeholder="分钟"></label></div><label>今日摘录<textarea id="drExcerpt" placeholder="重要原句 / 概念 / 事实"></textarea></label><label>我的理解<textarea id="drInsight" placeholder="用自己的话解释今天真正理解了什么"></textarea></label><label>今日启发 / 行动<textarea id="drAction" placeholder="它改变了我什么判断？下一步做什么？"></textarea></label><div class="reading-actions"><button id="drSave" class="primary">保存当天</button></div></div></div><aside class="daily-side daily-history"><h3>阅读记录</h3><div id="drHistory" class="daily-history-list"></div></aside></div></div>`;
  function readingBlank(){return {source:'',progress:'',minutes:'',excerpt:'',insight:'',action:'',savedAt:''}}
  function loadReading(key){readingDate=key;$('drDate').value=key;$('drPretty').textContent=pretty(key);const r=readingStore[key]||readingBlank();['Source','Progress','Minutes','Excerpt','Insight','Action'].forEach(k=>{$('dr'+k).value=r[k.charAt(0).toLowerCase()+k.slice(1)]||''});$('drStatus').textContent=r.savedAt?'已保存':'未保存';$('drStatus').classList.toggle('saved',!!r.savedAt);renderReadingHistory()}
  function saveReading(){readingStore[readingDate]={source:$('drSource').value.trim(),progress:$('drProgress').value.trim(),minutes:$('drMinutes').value,excerpt:$('drExcerpt').value.trim(),insight:$('drInsight').value.trim(),action:$('drAction').value.trim(),savedAt:new Date().toISOString()};set('daily_reading_v1',readingStore);$('drStatus').textContent='已保存';$('drStatus').classList.add('saved');renderReadingHistory()}
  function renderReadingHistory(){const root=$('drHistory');root.innerHTML='';const rows=Object.entries(readingStore).filter(([,r])=>r.source||r.insight||r.excerpt).sort((a,b)=>b[0].localeCompare(a[0]));if(!rows.length){root.innerHTML='<div class="daily-placeholder">还没有阅读记录</div>';return}rows.slice(0,20).forEach(([d,r])=>{const b=document.createElement('button');b.className='daily-history-item';b.innerHTML=`<strong>${esc(r.source||'未命名阅读')}</strong><span>${esc(d)}${r.progress?' · '+esc(r.progress):''}</span>`;b.onclick=()=>loadReading(d);root.appendChild(b)})}
  $('drSave').onclick=saveReading;$('drPrev').onclick=()=>{saveReading();loadReading(shiftDate(readingDate,-1))};$('drNext').onclick=()=>{saveReading();loadReading(shiftDate(readingDate,1))};$('drToday').onclick=()=>{saveReading();loadReading(dateKey())};$('drDate').onchange=e=>{saveReading();loadReading(e.target.value||dateKey())};

  loadWriting(writingDate);loadReading(readingDate);
})();