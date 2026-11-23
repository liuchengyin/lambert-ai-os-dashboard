/* 画Master V2: separate ProcessOn-style file library and full-screen draw.io workspace. */
(function(root){
'use strict';
const host=document.getElementById('master');
const lib=root.LambertMasterLibrary,draw=root.LambertDrawioModel,bridgeApi=root.LambertDrawioBridge;
if(!host||!lib||!draw||!bridgeApi)return;
const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;};
const store=()=>root.LambertPrivateStorage||localStorage;
host.innerHTML='<div id="masterLibrary" class="mp-library"><div class="mp-heading"><div><small>LAMBERT OS · VISUAL STUDIO</small><h2>画Master</h2><p>我的图纸 · 使用 draw.io 绘图引擎。图纸保存在当前浏览器，随时重新打开。</p></div><div class="mp-heading-actions"><button id="mpNew" type="button" class="mp-primary">＋ 新建图纸</button><button id="mpImport" type="button">导入 .drawio</button><button id="mpCloudSync" type="button">云端同步图纸</button><button id="mpSafetyBackup" type="button">下载安全备份</button><button id="mpVerifyBackup" type="button">校验备份文件</button><button id="mpRestoreMissing" type="button" hidden disabled>恢复缺失图纸</button><button id="mpFromLogistics" type="button">从物流知识库创建</button></div></div><div class="mp-filters"><label class="mp-search">⌕ <input id="mpSearch" placeholder="搜索我的图纸" type="search"></label><span id="mpCount"></span><button id="mpTrashToggle" type="button">回收站</button></div><div id="mpCards" class="mp-cards"></div><p class="mp-footnote">本机原件始终保留。登录后可点「云端同步图纸」备份并找回其他设备的图纸；同名冲突绝不覆盖，需手动处理。跨设备使用前请另存 .drawio 备份。</p></div>'+
'<div id="masterEditor" class="mp-editor" hidden><div class="mp-editor-toolbar"><button id="mpBack" type="button">← 我的文件</button><span class="mp-editor-title" id="mpFileTitle"></span><span class="mp-save-status" id="mpSaveStatus">未保存</span><div class="mp-editor-actions"><button id="mpSave" type="button" class="mp-primary">保存</button><button id="mpDownload" type="button">导出 .drawio</button><button id="mpToggleToolbar" type="button">隐藏工具栏</button></div></div><button id="mpRestoreToolbar" class="mp-restore-toolbar" type="button" hidden>☰ 显示工具栏</button><iframe id="mpDrawFrame" title="画Master draw.io完整编辑器" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals" allow="clipboard-read;clipboard-write"></iframe></div>'+
'<p id="mpNotice" role="status" class="mp-notice" aria-live="polite"></p><input type="file" id="mpFileInput" hidden accept=".drawio,.xml,application/xml,text/xml"><input type="file" id="mpBackupInput" hidden accept=".json,application/json">';
const notice=s=>{$('mpNotice').textContent=s;};
let loaded=false,loading=false,showTrash=false,all=[],current=null,bridge=null,pending=false,pendingExport=false,editorReady=false,dirty=false,pendingTimer=null;
let portableCandidate=null,portablePreview=null;
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
 if(showTrash)add('恢复',async()=>{if(!confirm('恢复「'+file.title+'」？'))return;await attempt(async()=>{await lib.restore(file.id);await refresh();});});
 else{
  add('重命名',async()=>{const name=prompt('图纸名称',file.title);if(name===null)return;await attempt(async()=>{await lib.rename(file.id,name);await refresh();});});
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
function resetPending(){
 if(pendingTimer){clearTimeout(pendingTimer);pendingTimer=null;}
 pending=false;pendingExport=false;$('mpSave').disabled=false;
}
function openEditor(file){
 current=file;dirty=false;editorReady=false;resetPending();
 $('mpFileTitle').textContent=file.title;
 $('mpSaveStatus').textContent='已加载 · 未改动原物流知识库';
 $('masterLibrary').hidden=true;$('masterEditor').hidden=false;
 document.body.classList.add('master-editing');
 bridge?.close();
 bridge=bridgeApi.create({frame:$('mpDrawFrame'),initialXml:file.xml,onStatus:event=>{
  if(event==='loaded'){editorReady=true;dirty=true;notice('');$('mpSaveStatus').textContent='编辑器已就绪';}
 },onXml:async xml=>{
  if(!pending)return; // Only direct Save/Export clicks may persist.
  if(!safeXml(xml)){resetPending();notice('draw.io 返回的图纸无效或超过大小限制，未覆盖旧文件。');return;}
  const exporting=pendingExport;
  await attempt(async()=>{
   const updated={...current,xml};
   await lib.save(updated);
   current=await lib.get(current.id);dirty=false;
   $('mpSaveStatus').textContent='已保存 · '+when(current.updatedAt);
   if(exporting)download(xml,current.title);
  });
  resetPending();
 }});
 bridge.open();
 notice('连接 draw.io 完整编辑器中…');
 setTimeout(()=>{if(current?.id===file.id&&!editorReady)notice('尚未收到 draw.io 的就绪消息。若页面空白，请检查 embed.diagrams.net 网络连通性；文件未被修改。');},15000);
}
async function openFile(id){
 if(!loaded)return;
 await attempt(async()=>{
  const file=await lib.get(id);if(!file)throw Error('file_not_found');
  if(current&&current.id!==id&&!confirm('离开当前画布？如有未保存绘图，请先保存。'))return;
  openEditor(file);
 });
}
function requestSave(exporting=false){
 if(!current||pending)return;
 if(!editorReady){notice('draw.io 尚未就绪，暂不能保存；请检查网络。');return;}
 pending=true;pendingExport=exporting;
 $('mpSave').disabled=true;$('mpSaveStatus').textContent='正在保存…';
 bridge.requestSave();
 pendingTimer=setTimeout(()=>{
  if(pending){resetPending();notice('未收到 draw.io 的图纸回传，保存未完成。请检查网络，并重新点击保存。');}
 },15000);
}
async function back(){
 if(pending){notice('正在保存，请勿关闭文件。');return;}
 if(current&&!confirm('返回我的文件？如有未保存的图形修改，将不会保存。'))return;
 bridge?.close();bridge=null;current=null;editorReady=false;dirty=false;resetPending();
 document.body.classList.remove('master-editing');
 $('masterEditor').hidden=true;$('masterLibrary').hidden=false;
 $('mpDrawFrame').src='about:blank';
 await attempt(refresh);
}
$('mpCloudSync').onclick=async()=>{
 const btn=$('mpCloudSync');if(btn.disabled)return;
 if(!root.LambertAccount?.mediaContext)return notice('账号服务尚未就绪，请先登录');
 if(!loaded)await init();if(!loaded)return;
 btn.disabled=true;btn.textContent='同步中…';
 try{
  const {syncMasterCloud}=await import('./shared-sync/master-cloud.mjs');
  const result=await syncMasterCloud({library:lib,mediaContext:()=>root.LambertAccount.mediaContext()});
  await refresh();
  notice('图纸同步：上传 '+result.uploaded+'，找回 '+result.imported+'；冲突 '+result.conflicts+'。'+(result.conflicts?'不同设备同 ID 图纸不一致，未覆盖任何版本，请先导出备份。':'原始图纸保持不变。'));
 }catch(e){notice('云同步未完成：'+(e?.message||'服务不可用')+'。本机图纸仍保留。');}
 finally{btn.disabled=false;btn.textContent='云端同步图纸';}
};
$('mpSafetyBackup').onclick=async()=>{
 const btn=$('mpSafetyBackup');if(btn.disabled)return;
 btn.disabled=true;btn.textContent='正在准备备份…';
 try{
  if(!loaded)await init();if(!loaded)throw Error('图纸库尚未准备好');
  const ownerContext=root.LambertPrivateStorage;
  ownerContext?.assertOwner?.();
  const {createPortableSafetyArchive}=await import('./shared-sync/portable-safety.mjs');
  const archive=await createPortableSafetyArchive({
   storage:localStorage,library:lib,owner:ownerContext?.owner||'',
   assertOwner:()=>ownerContext?.assertOwner?.()
  });
  const raw=JSON.stringify(archive);
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  try{
   const link=document.createElement('a');link.href=url;
   link.download='Lambert-safe-backup-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.appendChild(link);link.click();link.remove();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),10000);}
  notice('安全备份已生成：图纸 '+archive.counts.masterFiles+' 份、回收站 '+archive.counts.masterTrash+' 份，附工作区数据。请妥善保存；不含 PDF/音频原文件及图纸历史版本。');
 }catch(e){notice('备份失败：'+(e?.message||'未知错误')+'。本机数据未修改。');}
 finally{btn.disabled=false;btn.textContent='下载安全备份';}
};
function resetPortableCandidate(){
 portableCandidate=null;portablePreview=null;
 $('mpRestoreMissing').hidden=true;$('mpRestoreMissing').disabled=true;
}
$('mpVerifyBackup').onclick=()=>$('mpBackupInput').click();
$('mpBackupInput').onchange=async event=>{
 const file=event.target.files?.[0];event.target.value='';
 resetPortableCandidate();
 if(!file)return;
 if(file.size>25*1024*1024)return notice('备份文件超过25MB，本版校验器未读取；原文件不受影响。');
 try{
  if(!loaded)await init();if(!loaded)throw Error('图纸库尚未准备好');
  const ownerContext=root.LambertPrivateStorage;
  ownerContext?.assertOwner?.();
  const {inspectPortableSafetyArchive}=await import('./shared-sync/portable-verify.mjs');
  const {planMissingMasterRecovery}=await import('./shared-sync/portable-recover.mjs');
  const data=JSON.parse(await file.text());
  ownerContext?.assertOwner?.();
  const result=inspectPortableSafetyArchive(data,{
   expectedOwner:ownerContext?.owner||'',
   validateDrawing:file=>lib.validateRecord(file)
  });
  const localFiles=await lib.list(false),localTrash=await lib.list(true);
  ownerContext?.assertOwner?.();
  const plan=planMissingMasterRecovery(data,{localFiles,localTrash,validateDrawing:file=>lib.validateRecord(file)});
  portableCandidate=data;
  portablePreview={owner:ownerContext?.owner||'',localSignature:JSON.stringify([localFiles,localTrash]),plan};
  $('mpRestoreMissing').hidden=false;$('mpRestoreMissing').disabled=plan.toAdd===0;
  notice('备份校验通过：缺失图纸 '+plan.missingFiles.length+'，缺失回收站 '+plan.missingTrash.length+'，已存在 '+plan.unchanged+'，冲突 '+plan.conflicts+'。'+
   (plan.toAdd?'可选择恢复缺失项；本机已有图纸不覆盖。':'没有需要恢复的图纸。')+'任务、项目、笔记不受影响。');
 }catch(e){resetPortableCandidate();notice('备份未通过校验：'+(e?.message||'未知原因')+'。本机数据未修改。');}
};
$('mpRestoreMissing').onclick=async()=>{
 const btn=$('mpRestoreMissing');
 if(btn.disabled||!portableCandidate||!portablePreview)return;
 btn.disabled=true;
 try{
  const ownerContext=root.LambertPrivateStorage;
  ownerContext?.assertOwner?.();
  const {inspectPortableSafetyArchive}=await import('./shared-sync/portable-verify.mjs');
  const {planMissingMasterRecovery}=await import('./shared-sync/portable-recover.mjs');
  inspectPortableSafetyArchive(portableCandidate,{
   expectedOwner:ownerContext?.owner||'',validateDrawing:file=>lib.validateRecord(file)
  });
  if((ownerContext?.owner||'')!==portablePreview.owner)throw Error('账号已变化，请重新选择备份');
  const localFiles=await lib.list(false),localTrash=await lib.list(true);
  ownerContext?.assertOwner?.();
  if(JSON.stringify([localFiles,localTrash])!==portablePreview.localSignature)throw Error('图纸库已经变化，请重新校验备份');
  const plan=planMissingMasterRecovery(portableCandidate,{localFiles,localTrash,validateDrawing:file=>lib.validateRecord(file)});
  if(plan.toAdd!==portablePreview.plan.toAdd)throw Error('恢复预览已失效，请重新校验备份');
  if(!plan.toAdd){resetPortableCandidate();return notice('没有需要恢复的图纸。');}
  if(!confirm('仅新增 '+plan.missingFiles.length+' 份缺失图纸和 '+plan.missingTrash.length+' 份缺失回收站文件？本机已有 ID 均不覆盖，任务和笔记不恢复。'))return;
  ownerContext?.assertOwner?.();
  const result=await lib.importMissingPortable({files:plan.missingFiles,trash:plan.missingTrash});
  await refresh();resetPortableCandidate();
  notice('安全恢复完成：新增 '+result.added+' 份，已存在而跳过 '+result.skipped+' 份。原图纸、任务、项目、笔记均未覆盖。');
 }catch(e){resetPortableCandidate();notice('安全恢复未完成：'+(e?.message||'未知原因')+'。请检查结果后重新校验。');}
 finally{btn.disabled=!portableCandidate||portablePreview?.plan.toAdd===0;}
};
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
$('mpSave').onclick=()=>requestSave(false);
$('mpDownload').onclick=()=>requestSave(true);
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
