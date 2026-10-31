import {createBookStore,LIMIT} from './shared-sync/book-store.mjs';
const $=id=>document.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountBookshelf(){
 const reader=document.querySelector('#reading .reading-stable-reader');if(!reader||$('readingShelf'))return;
 const store=createBookStore();let active='',pdf=null,renderTask=null,generation=0,busy=false,cache=new Map();
 const shelf=document.createElement('section');shelf.id='readingShelf';shelf.setAttribute('aria-label','我的书架');
 shelf.innerHTML=`<div class="bookshelf-heading"><h3>我的书架 <small id="bookCount">0 / 7</small></h3><button id="bookImport" type="button">＋ 导入书籍</button></div><div id="bookShelfStatus" role="status" aria-live="polite"></div><div id="bookShelfSlots" class="book-shelf-slots"></div><div id="bookPending"></div><input id="bookShelfFile" type="file" accept="application/pdf,.pdf" hidden>`;
 reader.prepend(shelf);
 const viewer=document.createElement('section');viewer.id='bookViewer';viewer.hidden=true;viewer.innerHTML=`<header><button id="bookBack" type="button">← 书架</button><strong id="bookViewerTitle"></strong><button id="bookFullscreen" type="button" aria-label="全屏阅读">⛶</button><button id="bookPrev" type="button" aria-label="上一页">‹</button><label>第 <input id="bookPage" type="number" min="1" value="1" aria-label="阅读页码"> / <span id="bookPages">—</span> 页</label><button id="bookNext" type="button" aria-label="下一页">›</button></header><div id="bookCanvasShell"><canvas id="bookCanvas"></canvas></div>`;
 shelf.after(viewer);reader.insertBefore($('bookShelfStatus'),viewer);
 const progress=$('rv2Progress').closest('.reading-progress-field');reader.append(progress);progress.classList.add('book-legacy-progress');
 reader.classList.add('has-bookshelf');
 const links=document.createElement('details');links.className='book-link-reader';links.innerHTML='<summary>网页 / 链接阅读</summary>';
 for(const el of [...reader.children])if(el.matches('.reading-reader-toolbar,.reading-url-row,.reading-frame-shell'))links.append(el);
 reader.append(links);$('rv2Pdf').onclick=()=>$('bookShelfFile').click();
 const status=text=>$('bookShelfStatus').textContent=text;
 function errorMessage(e){return e.message||'操作未完成，本机文件仍保留';}
 async function renderShelf(){
  let rows;try{rows=await store.list();}catch(e){status(errorMessage(e));return;}$('bookCount').textContent=`${Math.min(rows.length,LIMIT)} / ${LIMIT}`;const shown=new Set();
  $('bookShelfSlots').innerHTML=Array.from({length:LIMIT},(_,i)=>{
   const b=rows.find(r=>r.slot===i);if(!b)return `<button type="button" class="book-slot-empty" data-add aria-label="导入第 ${i+1} 本书"><span>＋</span></button>`;
   shown.add(b.id);return `<article class="shelf-book" style="--book-hue:${[224,158,28,280,350,191,51][i]}"><button type="button" class="book-cover" data-open="${b.id}"><span class="book-cover-rule"></span><strong>${escape(b.title)}</strong><span class="book-cover-footer">第 ${b.page||1} 页</span></button><div class="book-meta"><span>${b.sync==='cloud'?'已存云端':b.sync==='remote'?'云端书籍':'仅本机'}</span><button type="button" data-remove="${b.id}" aria-label="移除《${escape(b.title)}》">移除</button></div>${b.sync==='local'?`<button class="book-retry" type="button" data-upload="${b.id}">上传云端</button>`:''}</article>`;
  }).join('');$('bookPending').replaceChildren();
  for(const b of rows.filter(r=>!shown.has(r.id))){const line=document.createElement('div');line.className='book-pending-item';line.innerHTML=`<button type="button" data-open="${b.id}">${escape(b.title)} · 本机待上传</button> <button type="button" data-upload="${b.id}">重试上传</button> <button type="button" data-remove="${b.id}">移除</button>`;$('bookPending').append(line);}
  $('bookImport').disabled=busy||rows.length>=LIMIT;
 }
 async function upload(id){status('正在上传云端…');try{await store.upload(id);status('已保存到云端');}catch(e){status(`云端保存未完成：${errorMessage(e)}。本机文件已保留，可点击上传云端重试。`);}await renderShelf();}
 async function pageTo(value){
  if(!pdf)return;const n=Math.min(pdf.numPages,Math.max(1,Math.floor(Number(value))||1)),mine=++generation;
  renderTask?.cancel();const page=await pdf.getPage(n);if(mine!==generation)return;
  const base=page.getViewport({scale:1}),width=Math.max(260,$('bookCanvasShell').clientWidth-32),scale=Math.min(2,width/base.width),viewport=page.getViewport({scale});
  const canvas=$('bookCanvas');canvas.width=viewport.width;canvas.height=viewport.height;renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});
  try{await renderTask.promise;}catch(e){if(e.name==='RenderingCancelledException')return;throw e;}if(mine!==generation)return;
  $('bookPage').value=n;$('bookPages').textContent=pdf.numPages;$('bookPrev').disabled=n===1;$('bookNext').disabled=n===pdf.numPages;
  try{await store.checkpoint(active,n);}catch{status('阅读位置已保存在本机，云端进度等待联网重试');}
 }
 async function open(id){
  const mine=++generation;status('正在打开…');try{
   const row=await store.get(id),file=await store.blob(id);if(mine!==generation)return;
   if(!cache.has(id)){const pdfjs=await import('./vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;const document=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true,isEvalSupported:false}).promise;cache.set(id,document);}
   if(mine!==generation)return;pdf=cache.get(id);active=id;$('rv2BookTitle').value=row.title;$('bookViewerTitle').textContent=row.title;$('bookViewer').hidden=false;shelf.hidden=true;reader.classList.add('book-is-open');
   await pageTo(row.page||1);status('');
  }catch(e){status(`打开失败：${errorMessage(e)}`);}
 }
 $('bookFullscreen').onclick=async()=>{if(document.fullscreenElement){await document.exitFullscreen();}else{try{await reader.requestFullscreen();}catch{reader.classList.toggle('is-reader-maximized');}}};
 $('bookBack').onclick=async()=>{++generation;renderTask?.cancel();$('bookViewer').hidden=true;shelf.hidden=false;reader.classList.remove('book-is-open');await renderShelf();};
 $('bookPrev').onclick=()=>pageTo(Number($('bookPage').value)-1).catch(e=>status(errorMessage(e)));
 $('bookNext').onclick=()=>pageTo(Number($('bookPage').value)+1).catch(e=>status(errorMessage(e)));
 $('bookPage').onchange=e=>pageTo(e.target.value).catch(e=>status(errorMessage(e)));
 const pick=()=>$('bookShelfFile').click();$('bookImport').onclick=pick;
 $('bookShelfSlots').onclick=async e=>{const b=e.target.closest('button');if(!b||busy)return;try{
  if(b.hasAttribute('data-add'))pick();
  else if(b.dataset.open)await open(b.dataset.open);
  else if(b.dataset.upload){busy=true;await upload(b.dataset.upload);}
  else if(b.dataset.remove&&confirm('从书架移除这本书？读书笔记会保留。')){busy=true;await store.remove(b.dataset.remove);const old=cache.get(b.dataset.remove);old?.destroy();cache.delete(b.dataset.remove);await renderShelf();status('已移除书籍，笔记已保留');}
 }catch(e){status(errorMessage(e));}finally{busy=false;await renderShelf();}};
 $('bookPending').onclick=$('bookShelfSlots').onclick;
 $('bookShelfFile').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||busy)return;busy=true;status('正在保存书籍…');try{const b=await store.add(file);await renderShelf();status('已保存到本机');if(store.ownerId)await upload(b.id);else status('已保存到本机，刷新后仍保留；登录后可使用云端书架');}catch(e){status(`导入失败：${errorMessage(e)}`);}finally{busy=false;await renderShelf();}};
 await renderShelf();
 if(store.ownerId){
  // Account UI is loaded asynchronously. Do not call mediaContext until its provider exists.
  let ready=typeof window.LambertAccount?.mediaContext==='function';
  for(let i=0;i<30&&!ready;i++){
    await new Promise(resolve=>setTimeout(resolve,100));
    ready=typeof window.LambertAccount?.mediaContext==='function';
  }
  if(ready){try{await store.refresh();await renderShelf();status('云端书架已同步');}catch(e){status(`暂未连接云端，显示本机书架：${errorMessage(e)}`);}}
  else status('账户服务暂未就绪；本机书架已保留，稍后可重试云端同步。');
 }
 window.addEventListener('online',async()=>{try{for(const b of await store.list()){if(b.sync==='local')await upload(b.id);else if(b.progressPending)await store.checkpoint(b.id,b.page);}await store.refresh();await renderShelf();}catch(e){status(errorMessage(e));}});
}
