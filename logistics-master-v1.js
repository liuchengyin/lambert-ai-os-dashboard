/* 画master draw.io full editor, isolated from the legacy logistics canvas. */
(function(root){
 'use strict';
 const section=document.getElementById('lkMaster'),model=root.LambertDrawioModel,Bridge=root.LambertDrawioBridge;
 if(!section||!model||!Bridge)return;
 const store=()=>root.LambertPrivateStorage||localStorage;
 const $=id=>document.getElementById(id);
 const e=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;};
 section.innerHTML='<div class="lmd-top"><div><small>OPEN SOURCE · DIAGRAMS.NET / DRAW.IO</small><h2>画master</h2><p>直接使用 draw.io 完整编辑器，而不是自制简化画布。原画板与所有业务资料保留；画master 独立保存。</p></div><div class="lmd-top-actions"><button id="lmdSave" type="button" disabled>保存画master</button><button id="lmdDownload" type="button">下载 .drawio</button><button id="lmdFullscreen" type="button">沉浸模式</button></div></div>'+
 '<div class="lmd-toolbar"><button type="button" id="lmdOpen">进入完整编辑器</button><button type="button" id="lmdBlank">新建空白画布</button><button type="button" id="lmdReimport">从原画板重新导入</button><button type="button" id="lmdImport">导入 .drawio / XML</button><input id="lmdFile" type="file" hidden accept=".drawio,.xml,text/xml,application/xml"><span id="lmdInfo"></span></div>'+
 '<div class="lmd-workarea"><div class="lmd-start" id="lmdStart"><h3>真正的 draw.io 编辑器</h3><p>左侧图形库、自由绘图、连线、文字、泳道、分组、图层、缩放等功能均由开源 draw.io 提供。</p><p>首次打开会只读取原画板的模块名、操作名称和已记录的条件／异常关系，形成独立副本。不会向第三方发送业务字段、接口地址或指标内容。</p><button id="lmdStartOpen" type="button">打开完整画布</button><small>编辑器由 embed.diagrams.net 提供，需能够访问该站点。图纸保存在当前浏览器的独立账户空间，不会覆盖原画板。</small></div><iframe id="lmdFrame" title="画master draw.io 全功能编辑器" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-downloads allow-modals" hidden></iframe></div>'+
 '<p id="lmdStatus" class="lmd-status" role="status">准备就绪。点击「进入完整编辑器」，即可畅游 draw.io。</p>'+
 '<div class="lmd-footer">原画板是业务权威资料；在这里新画的连线仅属于研究草图，不自动成为真实业务、EDI、数据库或 SLA 规则。<a href="https://app.diagrams.net/" target="_blank" rel="noopener noreferrer">单独打开 draw.io 官方网页版</a></div>';
 let opened=false,blocked=false,stored=false,sourceVersion=0,workingXml='',bridge=null,savedFile=null,source=null,loaded=false,pending=false;
 const status=s=>{$('lmdStatus').textContent=s;};
 function validate(xml){
   if(!model.validXml(xml))return false;
   try{
     const doc=new DOMParser().parseFromString(xml,'text/xml');
     return !doc.querySelector('parsererror')&&['mxfile','mxGraphModel'].includes(doc.documentElement?.localName);
   }catch{return false;}
 }
 function setSource(info){
   if(loaded)return;
   loaded=true;
   source=info?.source;
   sourceVersion=info?.version||0;
   const result=model.load(store());
   if(result.error){
     blocked=true;status(result.error);return;
   }
   if(result.exists){
     stored=true;workingXml=result.data.xml;
     savedFile=result.data;
   }else{
     try{workingXml=model.seed(source);}catch{blocked=true;status('原画板数据异常，为防止错误导入已禁用画master。');return;}
   }
   $('lmdInfo').textContent=stored?'已有独立画布 · 记录源版本 V'+savedFile.sourceVersion:'新画布 · 导入源版本 V'+sourceVersion;
   $('lmdSave').disabled=blocked||!opened;
 }
 function refreshFrame(){
   if(!opened)return;
   bridge?.close();
   const frame=$('lmdFrame');
   bridge=Bridge.create({frame,initialXml:workingXml,onStatus:ev=>{
     if(ev==='loaded'){status('draw.io 编辑器已经加载。自由绘图后，点击上方「保存画master」保存到当前浏览器。');$('lmdSave').disabled=blocked;}
     if(ev==='closed')status('编辑器已关闭；画布记录仍保留。');
   },onXml:xml=>{
     if(!validate(xml)){pending=false;status('未保存：draw.io 返回的 XML 无效或过大。旧记录保持不变。');return;}
     workingXml=xml;
     if(model.save(store(),xml,sourceVersion)){
       stored=true;pending=false;status('已保存到画master 独立文件。原物流知识库和历史版本未修改。');
       $('lmdInfo').textContent='独立文件已保存 · 源版本 V'+sourceVersion;
       $('lmdSave').textContent='已保存';
     }else{pending=false;status('保存失败：浏览器存储被阻止、容量不足或旧画master记录异常。请先下载备份。');}
   }});
   $('lmdFrame').hidden=false;$('lmdStart').hidden=true;
   bridge.open();
   $('lmdSave').disabled=false;
 }
 function open(){
   if(blocked)return;
   if(!loaded){status('原画板尚未就绪，暂不能创建副本。');return;}
   if(!opened){opened=true;refreshFrame();}
   else{status('draw.io 编辑器已打开。');}
 }
 function confirmReplace(message){
   return !stored&& !opened||confirm(message);
 }
 function reimport(){
   if(blocked||!loaded||!confirmReplace('重新从旧画板导入，会替换当前画master画布（包括尚未保存的修改）。原画板保持不变。继续吗？'))return;
   try{workingXml=model.seed(source);}catch{status('无法读取原画板数据；当前画master保持不变。');return;}
   $('lmdSave').textContent='保存画master';
   if(opened)refreshFrame();else open();
   status('已从原画板导入独立副本。注意：仅包含节点标题与已记录业务分支，不包含内部敏感字段。');
 }
 function blank(){
   if(blocked||!confirmReplace('新建空白画布会替换当前画master工作内容。未保存的修改会丢失，原画板不变。继续吗？'))return;
   workingXml=model.blank();$('lmdSave').textContent='保存画master';
   if(opened)refreshFrame();else open();
 }
 function download(){
   if(!validate(workingXml)){status('目前没有可下载的有效 draw.io 文件。');return;}
   const a=e('a'),url=URL.createObjectURL(new Blob([workingXml],{type:'application/xml;charset=utf-8'}));
   a.href=url;a.download='Lambert-画master-'+new Date().toISOString().slice(0,10)+'.drawio';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
   status('已发起 .drawio 文件下载；请检查浏览器下载记录。');
 }
 function onFile(event){
   const file=event.target.files?.[0];event.target.value='';
   if(!file)return;
   if(blocked){status('当前记录锁定，禁止导入覆盖。');return;}
   if(file.size>3800000){status('文件超过 3.8MB。请缩小后重试。');return;}
   if(!confirmReplace('导入 .drawio 文件将替换画master现有工作内容，原画板不变。继续吗？'))return;
   file.text().then(xml=>{
     if(!validate(xml)){status('文件不是合法的 draw.io XML。');return;}
     workingXml=xml;
     $('lmdSave').textContent='保存画master';
     if(opened)refreshFrame();else open();
     status('已导入 draw.io 文件；请确认内容后点击保存画master。');
   }).catch(()=>status('导入文件读取失败。'));
 }
 $('lmdOpen').onclick=open;$('lmdStartOpen').onclick=open;
 $('lmdBlank').onclick=blank;$('lmdReimport').onclick=reimport;
 $('lmdImport').onclick=()=>$('lmdFile').click();$('lmdFile').onchange=onFile;
 $('lmdSave').onclick=()=>{
   if(blocked||!opened||pending)return;
   pending=true;$('lmdSave').textContent='正在保存…';
   bridge.requestSave();
   status('已请求 draw.io 导出当前图纸，收到 XML 后写入画master 独立记录。');
 };
 $('lmdDownload').onclick=download;
 $('lmdFullscreen').onclick=()=>{
   const full=section.classList.toggle('lmd-immersive');
   $('lmdFullscreen').textContent=full?'退出沉浸模式':'沉浸模式';
 };
 document.addEventListener('keydown',ev=>{
   if(ev.key==='Escape'&&section.classList.contains('lmd-immersive')){
     section.classList.remove('lmd-immersive');$('lmdFullscreen').textContent='沉浸模式';
   }
 });
 root.LambertLogisticsMaster=Object.freeze({activate:setSource});
})(window);
