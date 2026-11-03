/* 画Master V2: separate ProcessOn-style file library and full-screen draw.io workspace. */
(function(root){
'use strict';
const host=document.getElementById('master');
const lib=root.LambertMasterLibrary,draw=root.LambertDrawioModel,bridgeApi=root.LambertDrawioBridge;
if(!host||!lib||!draw||!bridgeApi)return;
const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;};
const store=()=>root.LambertPrivateStorage||localStorage;
host.innerHTML='<div id="masterLibrary" class="mp-library"><div class="mp-heading"><div><small>LAMBERT OS · VISUAL STUDIO</small><h2>画Master</h2><p>我的图纸 · 使用 draw.io 绘图引擎。图纸保存在当前浏览器，随时重新打开。</p></div><div class="mp-heading-actions"><button id="mpNew" type="button" class="mp-primary">＋ 新建图纸</button><button id="mpImport" type="button">导入 .drawio</button><button id="mpFromLogistics" type="button">从物流知识库创建</button></div></div><div class="mp-filters"><label class="mp-search">⌕ <input id="mpSearch" placeholder="搜索我的图纸" type="search"></label><span id="mpCount"></span><button id="mpTrashToggle" type="button">回收站</button></div><div id="mpCards" class="mp-cards"></div><p class="mp-footnote">当前是本机文件库（IndexedDB），不是云同步。跨浏览器或更换电脑前请导出 .drawio 备份。旧版画Master文件会安全导入，原件保留。</p></div>'+
'<div id="masterEditor" class="mp-editor" hidden><div class="mp-editor-toolbar"><button id="mpBack" type="button">← 返回文件</button><span class="mp-editor-title" id="mpFileTitle"></span><span class="mp-save-status" id="mpSaveStatus" role="status" aria-live="polite">正在加载…</span><div class="mp-editor-actions"><button id="mpUndo" type="button" title="撤销上一步（Ctrl/⌘ + Z）">↶ 撤销</button><button id="mpRedo" type="button" title="重做上一步（Ctrl/⌘ + Shift + Z）">↷ 重做</button><button id="mpDownload" type="button">导出 .drawio</button><button id="mpToggleToolbar" type="button">隐藏工具栏</button></div></div><button id="mpRestoreToolbar" class="mp-restore-toolbar" type="button" hidden>☰ 显示工具栏</button><iframe id="mpDrawFrame" title="画Master draw.io完整编辑器" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals" allow="clipboard-read;clipboard-write"></iframe></div>'+
'<p id="mpNotice" role="status" class="mp-notice" aria-live="polite"></p><input type="file" id="mpFileInput" hidden accept=".drawio,.xml,application/xml,text/xml">';
const notice=s=>{$('mpNotice').textContent=s;};
let loaded=false,loading=false,showTrash=false,all=[],current=null,bridge=null,pending=false,pendingAction='',editorReady=false,dirty=false,pendingTimer=null,autosaveTimer=null,autosaveXml=null,editRevision=0,editorEpoch=0,persistChain=Promise.resolve();
function safeXml(s){
 if(!draw.validXml(s))return false;
 try{const d=new DOMParser().parseFromString(s,'text/xml');return !d.querySelector('parsererror')&&['mxfile','mxGraphModel'].includes(d.documentElement?.localName);}
 catch{return false;}
}
const when=x=>{try{return new Date(x).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return x;}};
function svgPreview(xml){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 380 220');svg.setAttribute('aria-hidden','true');
 const bg=document.createElementNS(svg.namespaceURI,'rect');bg.setAttribute('width','380');bg.setAttribute('height','220');bg.setAttribute('fill','#fbfaff');svg.append(bg);
 try{
  const doc=new DOMParser().parseFromString(xml,'text/xml'),v=[...doc.querySelectorAll('mxCell[vertex="1"]')].slice(0,32).map(c=>{
   const g=c.querySelector('mxGeometry');if(!g)return null;
   return {x:Number(g.getAttribute('x')||0),y:Number(g.getAttribute('y')||0),w:Number(g.getAttribute('width')||120),h:Number(g.getAttribute('height')||44),label:c.getAttribute('value')||''};
  }).filter(v=>v&&[v.x,v.y,v.w,v.h].every(Number.isFinite));
  if(!v.length)throw Error('no_preview');
  const minX=Math.min(...v.map(x=>x.x)),minY=Math.min(...v.map(x=>x.y)),maxX=Math.max(...v.map(x=>x.x+x.w)),maxY=Math.max(...v.map(x=>x.y+x.h));
  const scale=Math.min(2.2,330/Math.max(maxX-minX,1),175/Math.max(maxY-minY,1));
  const xoff=(380-(maxX-minX)*scale)/2,yoff=(220-(maxY-minY)*scale)/2;
  for(const c of v){
   const rect=document.createElementNS(svg.namespaceURI,'rect');
   const x=xoff+(c.x-minX)*scale,y=yoff+(c.y-minY)*scale;
   rect.setAttribute('x',x);rect.setAttribute('y',y);rect.setAttribute('width',Math.max(4,c.w*scale));rect.setAttribute('height',Math.max(4,c.h*scale));
   rect.setAttribute('rx','5');rect.setAttribute('fill','#fff');rect.setAttribute('stroke','#a9a0bf');
   svg.append(rect);
   const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('x',x+5);t.setAttribute('y',y+Math.min(16,c.h*scale/2));
   t.setAttribute('fill','#5d517c');t.setAttribute('font-size','9');t.textContent=c.label.replace(/<[^>]*>/g,'').slice(0,17);svg.append(t);
  }
 }catch{
  const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('x','190');t.setAttribute('y','112');t.setAttribute('text-anchor','middle');
  t.setAttribute('fill','#a298b8');t.setAttribute('font-size','15');t.textContent='draw.io';svg.append(t);
 }
 return svg;
}
function tile(file){
 const card=el('article','mp-file-card');
 const thumb=el('button','mp-file-thumb');thumb.type='button';thumb.append(svgPreview(file.xml));thumb.onclick=()=>openFile(file.id);
 const info=el('div','mp-file-info');const title=el('button','mp-file-name',file.title);title.type='button';title.title=file.title;title.onclick=()=>openFile(file.id);
 info.append(title,el('small','',when(file.updatedAt)));
 const actions=el('div','mp-file-actions');
 const add=(label,fn)=>{const b=el('button','',label);b.type='button';b.onclick=fn;actions.append(b);};
 const editName=()=>{
  if(info.querySelector('.mp-file-rename-input'))return;
  const input=el('input','mp-file-rename-input');input.type='text';input.value=file.title;input.maxLength=96;
  input.setAttribute('aria-label','修改图纸名称');input.autocomplete='off';
  info.replaceChild(input,title);
  let finished=false,saving=false;
  const cancel=()=>{if(finished)return;finished=true;if(input.isConnected)info.replaceChild(title,input);};
  const commit=async()=>{
   if(finished||saving)return;
   const name=input.value.trim();
   if(name===file.title){cancel();return;}
   if(!lib.validTitle(name)){notice('名称不能为空，且不能超过96个字符。');input.focus();return;}
   saving=true;input.disabled=true;
   try{
    await lib.rename(file.id,name);
    finished=true;await refresh();
    notice('图纸已重命名为「'+name+'」。');
   }catch(error){
    saving=false;input.disabled=false;
    notice('重命名失败：'+(error?.message||'浏览器存储不可用')+'；旧名称仍保留。');
    input.focus();
   }
  };
  input.addEventListener('keydown',event=>{
   if(event.key==='Enter'){event.preventDefault();void commit();}
   else if(event.key==='Escape'){event.preventDefault();cancel();}
  });
  input.addEventListener('blur',()=>{if(!finished&&!saving)void commit();});
  input.focus();input.select();
 };
 if(showTrash)add('恢复',async()=>{if(!confirm('恢复「'+file.title+'」？'))return;await attempt(async()=>{await lib.restore(file.id);await refresh();});});
 else{
  add('重命名',editName);
  add('复制',async()=>attempt(async()=>{await lib.duplicate(file.id);await refresh();}));
  add('导出',()=>download(file.xml,file.title));
  add('删除',async()=>{if(!confirm('将「'+file.title+'」移入回收站？可以恢复。'))return;await attempt(async()=>{await lib.trash(file.id);await refresh();});});
 }
 card.append(thumb,info,actions);return card;
}
function render(){
 const filter=$('mpSearch').value.trim().toLowerCase();
 const files=all.filter(x=>x.title.toLowerCase().includes(filter));
 $('mpCards').replaceChildren();
 files.forEach(file=>$('mpCards').append(tile(file)));
 if(!files.length){const empty=el('div','mp-empty');empty.append(el('h3','',showTrash?'回收站为空':'这里还没有图纸'),el('p','',showTrash?'删除的图纸可以在这里恢复。':'点击「＋ 新建图纸」，打开 draw.io 自由绘制。'));$('mpCards').append(empty);}
 $('mpCount').textContent=all.length+' 份'+(showTrash?'已删除文件':'图纸');
 $('mpTrashToggle').textContent=showTrash?'← 我的文件':'回收站';
}
async function refresh(){all=await lib.list(showTrash);render();}
async function attempt(fn){try{await fn();notice('');}catch(e){notice('操作未完成：'+(e?.message||'存储不可用')+'。原文件不受影响。');}}
async function init(){
 if(loaded||loading)return;loading=true;
 try{
  const result=await lib.migrateOld();
  loaded=true;await refresh();
  if(result.migrated)notice('已将旧版画Master单张图纸导入我的文件，原始文件仍保留。');
 }catch(e){notice('文件库读取失败：'+(e?.message||'IndexedDB 不可用')+'。为保护旧文件，已禁止创建和保存。');}
 finally{loading=false;}
}
function download(xml,title){
 if(!safeXml(xml))return notice('导出失败：图纸 XML 无效。');
 const url=URL.createObjectURL(new Blob([xml],{type:'application/xml;charset=utf-8'})),a=el('a');
 a.href=url;a.download=title.replace(/[\\/:*?"<>|]/g,'_')+'.drawio';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function sourceXml(){
 const s=store();let legacy=null,number=0;
 const raw=s.getItem('lambert_logistics_knowledge_v1');
 if(raw!==null)legacy=JSON.parse(raw);
 const vr=s.getItem(root.LambertLogisticsVersion.KEY);
 if(vr!==null){
  const envelope=JSON.parse(vr);
  if(envelope?.schema!==1||!root.LambertLogisticsVersion.validData(envelope.published?.data))throw Error('invalid_published_version');
  legacy=envelope.published.data;number=envelope.published.number;
 }
 if(!root.LambertLogisticsVersion.validData(legacy))throw Error('请先在物流知识库保存节点资料');
 return {xml:draw.seed(legacy),version:number};
}
async function create(kind='blank',xml=null,title=null){
 if(!loaded){notice('文件库尚未就绪，请检查存储状态。');return;}
 await attempt(async()=>{
  let version=0;
  if(kind==='logistics'){const data=sourceXml();xml=data.xml;version=data.version;}
  else xml=xml||draw.blank();
  if(!safeXml(xml))throw Error('invalid_master_xml');
  const file=lib.makeFile(title||(kind==='logistics'?'物流流程研究图':'未命名图纸'),xml,version);
  await lib.save(file);await refresh();await openFile(file.id);
 });
}
const AUTOSAVE_DEBOUNCE_MS=550;
function setSaveStatus(value){$('mpSaveStatus').textContent=value;}
function stopAutosaveTimer(){
 if(autosaveTimer!==null){clearTimeout(autosaveTimer);autosaveTimer=null;}
}
function resetPending(){
 if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
 pending=false;pendingAction='';
 $('mpBack').disabled=false;$('mpDownload').disabled=false;
}
async function finishBack(){
 stopAutosaveTimer();
 autosaveXml=null;
 editorEpoch++;
 bridge?.close();bridge=null;current=null;editorReady=false;dirty=false;resetPending();
 document.body.classList.remove('master-editing');
 $('masterEditor').hidden=true;$('masterLibrary').hidden=false;
 $('mpDrawFrame').src='about:blank';
 await attempt(refresh);
}
function saveFailure(error){
 dirty=true;
 setSaveStatus('自动保存失败 · 修改未保存');
 notice('图纸未保存：'+(error?.message||'本机存储不可用')+'。请勿关闭当前画布；稍后修改或点击「返回文件」重试。');
}
function persistSnapshot(xml,revision){
 const file=current,epoch=editorEpoch;
 if(!file||!safeXml(xml)){
  const reason=Error('invalid_master_xml');
  saveFailure(reason);return Promise.reject(reason);
 }
 const operation=persistChain.catch(()=>{}).then(async()=>{
  // Writes from older editor sessions may not overwrite another open document.
  if(epoch!==editorEpoch||current?.id!==file.id)return false;
  await lib.save({...file,xml});
  const updated=await lib.get(file.id);
  if(epoch!==editorEpoch||current?.id!==file.id)return false;
  current=updated;
  if(revision===editRevision){
   dirty=false;
   setSaveStatus('已保存 · '+when(updated.updatedAt));
   notice('');
  }
  return true;
 });
 persistChain=operation;
 return operation;
}
function queueAutosave(xml,immediate=false){
 if(!safeXml(xml)){
  saveFailure(Error('draw.io 返回的 XML 无效'));return;
 }
 editRevision++;
 const revision=editRevision;
 autosaveXml=xml;
 dirty=true;
 setSaveStatus('保存中…');
 stopAutosaveTimer();
 if(pending)return; // A return/export request obtains the editor's final XML.
 const flush=()=>{
  autosaveTimer=null;
  const snapshot=autosaveXml;
  autosaveXml=null;
  if(snapshot===null)return;
  void persistSnapshot(snapshot,revision).catch(saveFailure);
 };
 if(immediate)flush();
 else autosaveTimer=setTimeout(flush,AUTOSAVE_DEBOUNCE_MS);
}
function openEditor(file){
 stopAutosaveTimer();
 editorEpoch++;
 current=file;dirty=false;editorReady=false;editRevision=0;autosaveXml=null;persistChain=Promise.resolve();resetPending();
 $('mpFileTitle').textContent=file.title;
 setSaveStatus('正在打开…');
 $('masterLibrary').hidden=true;$('masterEditor').hidden=false;
 document.body.classList.add('master-editing');
 bridge?.close();
 const epoch=editorEpoch;
 bridge=bridgeApi.create({frame:$('mpDrawFrame'),initialXml:file.xml,onStatus:event=>{
  if(epoch!==editorEpoch||current?.id!==file.id)return;
  if(event==='loaded'){editorReady=true;notice('');setSaveStatus('已保存 · '+when(current.updatedAt));}
  if(event==='modified'){
   dirty=true;
   setSaveStatus('保存中…');
  }
 },onXml:async(xml,meta={})=>{
  if(epoch!==editorEpoch||current?.id!==file.id)return;
  const requested=meta.trigger==='requested-export';
  if(requested){
   if(!pending)return;
   if(!safeXml(xml)){
    resetPending();saveFailure(Error('draw.io 导出内容无效'));
    return;
   }
   const action=pendingAction;
   if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
   // The XML obtained on leaving/exporting is authoritative, even if autosave is still writing.
   stopAutosaveTimer();autosaveXml=null;
   const revision=++editRevision;
   try{
    const result=await persistSnapshot(xml,revision);
    if(result!==true){resetPending();return;}
    // A user edit may have arrived while IndexedDB was writing. Never leave with a stale snapshot.
    if(revision!==editRevision){
     bridge?.requestSave();
     pendingTimer=setTimeout(()=>{
      if(pending){resetPending();dirty=true;setSaveStatus('保存未确认');notice('最新修改尚未确认写入，请再次点击「返回文件」。');}
     },15000);
     return;
    }
    if(action==='download')download(xml,current.title);
    resetPending();
    if(action==='back')await finishBack();
   }catch(error){resetPending();saveFailure(error);}
   return;
  }
  if(meta.trigger==='autosave')queueAutosave(xml);
  else if(meta.trigger==='editor-save')queueAutosave(xml,true);
 }});
 bridge.open();
 notice('连接 draw.io 完整编辑器中…');
 setTimeout(()=>{if(epoch===editorEpoch&&current?.id===file.id&&!editorReady)notice('尚未收到 draw.io 的就绪消息。若画面空白，请检查 embed.diagrams.net 连通性；已存图纸不会被覆盖。');},15000);
}
async function openFile(id){
 if(!loaded)return;
 await attempt(async()=>{
  const file=await lib.get(id);if(!file)throw Error('file_not_found');
  if(current&&current.id!==id&&!confirm('离开当前画布？如有未保存绘图，请先保存。'))return;
  openEditor(file);
 });
}
function requestSave(action='back'){
 if(!current||pending)return;
 if(!editorReady){notice('画布尚未加载完毕，暂时无法保存或返回。');return;}
 pending=true;pendingAction=action;
 $('mpBack').disabled=true;$('mpDownload').disabled=true;
 setSaveStatus('正在确认最新修改…');
 bridge.requestSave();
 pendingTimer=setTimeout(()=>{
  if(pending){
   resetPending();
   dirty=true;setSaveStatus('保存未确认');
   notice('无法取得 draw.io 的最新内容，已保留当前画布。请检查网络后重新点击「返回文件」。');
  }
 },15000);
}
async function back(){
 if(!current){await finishBack();return;}
 if(pending){notice('正在核对最新图纸，请勿关闭文件。');return;}
 // Even after the autosave badge shows 已保存, verify one final XML snapshot before leaving.
 if(!editorReady){
  if(!dirty){await finishBack();return;}
  notice('仍有尚未保存的内容，画布还未就绪；请保留此页面。');return;
 }
 requestSave('back');
}
$('mpNew').onclick=()=>create();
$('mpFromLogistics').onclick=()=>create('logistics');
$('mpImport').onclick=()=>$('mpFileInput').click();
$('mpFileInput').onchange=async event=>{
 const file=event.target.files?.[0];event.target.value='';
 if(!file)return;
 if(file.size>3800000)return notice('图纸超过3.8MB，尚未导入。');
 await attempt(async()=>{const xml=await file.text();if(!safeXml(xml))throw Error('invalid_drawio_file');
  await create('import',xml,file.name.replace(/\.(drawio|xml)$/i,'').slice(0,96)||'导入图纸');});
};
$('mpSearch').oninput=render;
$('mpTrashToggle').onclick=async()=>attempt(async()=>{showTrash=!showTrash;await refresh();});
$('mpBack').onclick=back;
$('mpUndo').onclick=()=>{if(editorReady)bridge?.invokeAction('undo');};
$('mpRedo').onclick=()=>{if(editorReady)bridge?.invokeAction('redo');};
$('mpDownload').onclick=()=>requestSave('download');
$('mpToggleToolbar').onclick=()=>{$('masterEditor').classList.add('mp-toolbar-hidden');$('mpRestoreToolbar').hidden=false;};
$('mpRestoreToolbar').onclick=()=>{$('masterEditor').classList.remove('mp-toolbar-hidden');$('mpRestoreToolbar').hidden=true;};
root.addEventListener('beforeunload',event=>{if(current&&(pending||dirty)){event.preventDefault();event.returnValue='';}});
function enter(){void init();}
root.LambertMasterPage=Object.freeze({enter,openFile});
const initial=()=>{if(host.classList.contains('activeView'))enter();};
root.addEventListener('popstate',initial);
document.querySelector('nav button[data-v="master"]')?.addEventListener('click',enter);
const activeObserver=new MutationObserver(initial);
activeObserver.observe(host,{attributes:true,attributeFilter:['class']});
initial();
})(window);
