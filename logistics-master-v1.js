/* 画master · AntV X6 editor in an isolated tab. Existing logistics documents remain read-only. */
(function(root){
 'use strict';
 const host=document.getElementById('lkMaster');
 const model=root.LambertLogisticsMasterModel;
 if(!host||!model)return;
 const byId=id=>document.getElementById(id);
 const store=()=>root.LambertPrivateStorage||localStorage;
 const el=(name,cls,text)=>{const n=document.createElement(name);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
 const today=()=>new Date().toISOString().slice(0,10);
 host.innerHTML='<div class="lm-head"><div><small>ANTV X6 · 独立实验画布</small><h2>画master</h2><p>旧画布资料只读导入；新的布局、便签和研究连线独立保存，不影响旧版本和历史记录。</p></div><div class="lm-actions"><button type="button" id="lmSave">保存画master</button><button type="button" id="lmExport">导出</button></div></div>'+
 '<div class="lm-toolbar"><label>范围 <select id="lmScope"><option value="all">全部模块</option></select></label><button type="button" id="lmFit">适应画布</button><button type="button" id="lmZoomIn">放大＋</button><button type="button" id="lmZoomOut">缩小－</button><button type="button" id="lmLayout">重新排列</button><button type="button" id="lmAddNote">＋ 自由便签</button><button type="button" id="lmReload">重新读取旧画布</button><span id="lmMeta"></span></div>'+
 '<div class="lm-board"><div class="lm-canvas-wrap"><div id="lmCanvas" aria-label="X6 物流知识关系画布"></div><div class="lm-canvas-help">滚轮平移页面 · Ctrl/⌘ + 滚轮缩放 · 拖动节点调整位置 · 拖动圆形端口创建“待核实”研究连线</div></div><aside class="lm-inspector" id="lmInspector"><h3>研究面板</h3><p>选择节点查看操作、内部事件、数据表、SLA 和相关关系；旧业务字段在此只读。</p></aside></div>'+
 '<p class="lm-status" id="lmStatus" role="status">尚未加载画布。</p>';
 const status=text=>{byId('lmStatus').textContent=text;};
 let source=null,version=null,layout=null,graph=null,dirty=false,locked=false,loaded=false,loadingGraph=false,selected=null,assetPromise=null;
 let lastSourceSignature='';
 const text=(parent,title,value)=>{
   const group=el('div','lm-field');group.append(el('strong','',title),el('p','',typeof value==='string'&&value.trim()?value:'待核实 / 未填写'));parent.append(group);
 };
 const markDirty=()=>{dirty=true;byId('lmSave').disabled=locked;byId('lmSave').textContent='保存画master · 未保存';};
 const persist=()=>{
   if(locked||!layout||!model.isValid(layout)){status('数据格式异常，已禁止保存。');return false;}
   const next=model.clone(layout);next.sourceVersion=version;
   if(!model.save(store(),next)){status('保存失败：本地存储不可写，当前更改仍在页面内。');return false;}
   dirty=false;layout=next;byId('lmSave').textContent='已保存';status('已保存画master 独立研究布局；旧画布及其版本记录没有修改。');return true;
 };
 function loadVendor(){
   if(root.X6?.Graph)return Promise.resolve(root.X6);
   if(assetPromise)return assetPromise;
   assetPromise=new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     script.src='vendor/x6-2.18.1.min.js';script.async=true;
     script.onload=()=>root.X6?.Graph?resolve(root.X6):reject(Error('x6_global_missing'));
     script.onerror=()=>reject(Error('x6_asset_unavailable'));
     document.head.append(script);
   }).catch(err=>{assetPromise=null;throw err;});
   return assetPromise;
 }
 function portStyle(stroke){
   return {circle:{r:5,magnet:true,stroke,strokeWidth:2,fill:'#fff',style:{visibility:'visible'}}};
 }
 function createGraph(){
   if(graph)return;
   const X6=root.X6;
   graph=new X6.Graph({
     container:byId('lmCanvas'),
     grid:{visible:true,size:14,type:'dot',args:{color:'#e6e9f1',thickness:1}},
     background:{color:'#f8faff'},
     panning:{enabled:true,eventTypes:['leftMouseDown']},
     mousewheel:{enabled:true,modifiers:['ctrl','meta'],minScale:0.25,maxScale:2},
     connecting:{
       snap:true,allowBlank:false,allowLoop:false,allowMulti:false,
       router:{name:'manhattan',args:{padding:14}},connector:{name:'rounded',args:{radius:12}},
       createEdge:()=>new X6.Shape.Edge({id:'research:'+encodeURIComponent('research_'+crypto.randomUUID()),attrs:{line:{stroke:'#7c68c4',strokeWidth:2,strokeDasharray:'6 4',targetMarker:'classic'}}}),
       validateConnection:({sourceCell,targetCell})=>{
         return Boolean(sourceCell&&targetCell&&sourceCell.id!==targetCell.id&&
           !String(sourceCell.id).startsWith('heading:')&&!String(targetCell.id).startsWith('heading:')&&
           !String(sourceCell.id).startsWith('stage:')&&!String(targetCell.id).startsWith('stage:'));
       }
     },
     interacting:{edgeMovable:false,vertexMovable:false,vertexAddable:false,vertexDeletable:false,arrowheadMovable:false},
     highlighting:{magnetAdsorbed:{name:'stroke',args:{attrs:{stroke:'#6948bd',strokeWidth:3}}}}
   });
   graph.on('node:moved',({node})=>{
     if(loadingGraph||locked)return;
     const pos=node.position(),id=node.id;
     if(id.startsWith('op:'))layout.positions[id]={x:pos.x,y:pos.y};
     else if(id.startsWith('note:')){
       const note=layout.notes.find(n=>model.noteId(n.id)===id);
       if(note){note.x=pos.x;note.y=pos.y;}
     }else return;
     markDirty();
   });
   graph.on('node:click',({node})=>inspect(node.id));
   graph.on('edge:click',({edge})=>inspectEdge(edge.id));
   graph.on('blank:click',()=>inspect(null));
   graph.on('edge:connected',({edge})=>{
     if(loadingGraph||locked)return;
     const a=edge.getSourceCellId(),b=edge.getTargetCellId();
     if(!a||!b||!currentVisible.has(a)||!currentVisible.has(b)){
       graph.removeEdge(edge);return;
     }
     const id=decodeURIComponent(edge.id.slice('research:'.length));
     if(!model.addLink(layout,a,b,'研究关联（待核实）',id)){
       graph.removeEdge(edge);status('关系重复或无法保存，连线已撤销。');return;
     }
     edge.setLabels(['待核实']);
     markDirty();status('已添加一条待核实研究连线；只有保存画master后才写入独立布局。');
   });
 }
 let currentVisible=new Set();
 function nodeView(n){
   const isHead=n.kind==='heading',isStage=n.kind==='stage',isNote=n.kind==='note',isBranch=n.kind==='branch';
   const width=isHead?470:isStage?170:isNote?198:isBranch?164:198;
   const height=isHead?44:isStage?34:isNote?95:isBranch?62:76;
   const accent=isHead?'#392f63':isStage?'#8972a7':isBranch?'#c95f65':isNote?'#bd8746':'#7a5bc4';
   const attrs={body:{rx:isHead?12:10,ry:isHead?12:10,fill:isHead?'#ece8fa':isStage?'#f3effa':isBranch?'#fff2f1':isNote?'#fff9e9':'#fff',stroke:isHead?'#bcb0da':isStage?'#ddd1ef':accent,strokeWidth:isHead?1:1.3},
     label:{fill:isHead?'#4f407c':isStage?'#6c588f':isBranch?'#a9464e':isNote?'#8c6223':'#322746',fontSize:isHead?16:isStage?12:13,fontWeight:650,
       textWrap:{width:width-28,height:height-12,ellipsis:true}}};
   return {
     id:n.id,shape:'rect',x:n.position.x,y:n.position.y,width,height,label:n.title,attrs,
     data:{kind:n.kind,moduleId:n.moduleId,operationId:n.operationId,noteId:n.noteId},
     ...(isHead||isStage?{movable:false}:{ports:{groups:{
       in:{position:'left',attrs:portStyle(accent)},
       out:{position:'right',attrs:portStyle(accent)}
     },items:[{id:'in',group:'in'},{id:'out',group:'out'}]}})
   };
 }
 function edgeView(e){
   const stroke=e.kind==='exception'?'#d95e64':e.kind==='branch'?'#638bc0':'#9b86c8';
   return {id:e.id,shape:'edge',source:{cell:e.from,port:'out'},target:{cell:e.to,port:'in'},
     router:{name:'manhattan',args:{padding:12}},connector:{name:'rounded',args:{radius:10}},
     attrs:{line:{stroke,strokeWidth:e.fixed?2.2:1.8,strokeDasharray:e.fixed?'':'6 5',targetMarker:{name:'classic',size:7}}},
     labels:[{attrs:{label:{text:e.label,fill:stroke,fontSize:11}}}],
     data:{kind:e.kind,fixed:e.fixed,linkId:e.linkId}};
 }
 function draw(refit=false){
   if(!graph||!source||!layout)return;
   const scope=byId('lmScope').value;
   let projection;
   try{projection=model.build(source,layout,scope);}catch{status('旧画布数据结构异常：没有修改任何原始记录。');return;}
   loadingGraph=true;
   try{
     graph.clearCells();
     currentVisible=new Set(projection.nodes.map(n=>n.id));
     for(const n of projection.nodes)graph.addNode(nodeView(n));
     for(const edge of projection.edges)if(currentVisible.has(edge.from)&&currentVisible.has(edge.to))graph.addEdge(edgeView(edge));
     byId('lmMeta').textContent='源版本 V'+version+' · '+projection.sourceCount+' 个操作 · '+projection.branchCount+' 条原业务分支'+(projection.orphanLinks?' · ⚠ '+projection.orphanLinks+' 条研究连线找不到原节点':'')+(projection.scopeHiddenLinks?' · '+projection.scopeHiddenLinks+' 条因筛选暂时隐藏':'');
     if(refit)graph.zoomToFit({padding:38,maxScale:1}); 
     inspect(selected&&currentVisible.has(selected)?selected:null);
   }finally{loadingGraph=false;}
 }
 function inspector(){
   const host=byId('lmInspector');host.replaceChildren();return host;
 }
 function inspect(id){
   selected=id;
   const p=inspector();
   if(!id){p.append(el('h3','','节点研究面板'),el('p','','点击操作节点查看旧画布的详细字段。拖动端口可添加待核实的研究关系。'));return;}
   const item=graph?.getCellById(id);
   const data=item?.getData?.()||{};
   if(data.kind==='note'){
     const note=layout.notes.find(n=>n.id===data.noteId);
     if(!note)return inspect(null);
     p.append(el('h3','',note.title));text(p,'研究便签',note.body||'尚未记录');
     if(!locked){
       const edit=el('button','lm-primary','编辑便签');
       edit.onclick=()=>{
         const title=prompt('便签标题',note.title);if(title===null)return;
         if(!title.trim()||title.length>100)return status('标题不能为空且不能超过100字符。');
         const body=prompt('便签内容（2000字符以内）',note.body);
         if(body===null)return;if(body.length>2000)return status('便签内容不能超过2000字符。');
         note.title=title.trim();note.body=body;markDirty();draw();inspect(id);
       };
       const del=el('button','lm-danger','删除此便签');
       del.onclick=()=>{
         if(!confirm('只删除画master内这张自由便签及其研究连线？旧画布不受影响。'))return;
         layout.notes=layout.notes.filter(n=>n.id!==note.id);
         layout.links=layout.links.filter(l=>l.from!==id&&l.to!==id);
         delete layout.positions[id];markDirty();selected=null;draw();
       };
       p.append(edit,del);
     }
     return;
   }
   if(data.kind!=='operation'&&data.kind!=='branch'){
     p.append(el('h3','','结构分组'),el('p','','分类和子环节仅作视觉分组；实际业务顺序仍以旧画布资料为准。'));return;
   }
   const mod=source.modules.find(m=>m.id===data.moduleId),n=mod?.nodes.find(n=>n.id===data.operationId);
   if(!n)return inspect(null);
   p.append(el('small','','来源：'+mod.name),el('h3','',n.title));
   text(p,'进入条件',n.entryCondition);
   text(p,'操作动作',n.action);
   text(p,'执行角色 / 系统',n.executor);
   text(p,'输入',n.operationInput);
   text(p,'触发结果',Array.isArray(n.triggers)?n.triggers.map(t=>t.description||t.name||'').filter(Boolean).join('；'):n.information);
   text(p,'证据 / 待核实',n.researchBasis||n.evidence||n.note);
   const w=root.LambertLogisticsWiringV36?.read(n);
   if(w?.invalid)text(p,'信息层','旧记录格式异常，请到原画布检查');
   else if(w){
     text(p,'事件 / 日志', [w.trace.event,w.trace.eventCode,w.trace.logLocation,w.trace.recordTable].filter(Boolean).join(' · '));
     text(p,'EDI / 推送策略',[w.routing.policy,w.routing.rule,w.routing.destination].filter(Boolean).join(' · '));
     text(p,'数据库来源',w.sources.map(s=>s.kind+': '+s.table).join('；'));
     text(p,'SLA / 指标',[w.metric.name,w.metric.slaTarget,w.metric.dashboard].filter(Boolean).join(' · '));
     text(p,'任务处理',[w.task.board,w.task.condition].filter(Boolean).join(' · '));
   }
   p.append(el('p','lm-readonly','业务字段只读。编辑真实操作、事件、SLA 请回到原画布。'));
 }
 function inspectEdge(id){
   const cell=graph.getCellById(id),data=cell?.getData?.()||{};
   selected=null;const p=inspector();
   p.append(el('h3','','连线详情'));
   text(p,'关系类型',data.fixed?(data.kind==='exception'?'原画布异常分支':'原画布条件分支'):'待核实研究关联');
   if(data.fixed){p.append(el('p','lm-readonly','原画布分支在这里是只读投影；不能从画master中删除。'));return;}
   const link=layout.links.find(l=>l.id===data.linkId);
   if(!link)return;
   text(p,'研究说明',link.label);
   if(!locked){
     const edit=el('button','lm-primary','编辑关系说明');
     edit.onclick=()=>{const label=prompt('关系说明',link.label);if(label===null)return;if(label.length>100)return status('关系说明超过100字符。');link.label=label.trim()||'待核实';markDirty();draw();};
     const del=el('button','lm-danger','删除研究连线');
     del.onclick=()=>{if(!confirm('删除这条画master研究连线？'))return;layout.links=layout.links.filter(l=>l.id!==link.id);markDirty();draw();};
     p.append(edit,del);
   }
 }
 function initialize(){
   const previous=model.load(store());
   if(previous.error){locked=true;status(previous.error);byId('lmSave').disabled=true;return false;}
   layout=previous.data;loaded=true;
   return true;
 }
 function populate(){
   const sel=byId('lmScope'),old=sel.value;
   sel.replaceChildren(new Option('全部模块','all'));
   for(const m of source.modules)sel.append(new Option((m.category||'业务')+' · '+m.name,m.id));
   sel.value=[...sel.options].some(o=>o.value===old)?old:'all';
 }
 async function activate(input){
   if(!input?.source||!Array.isArray(input.source.modules))return status('原始知识库不可用，未启动画master。');
   if(!loaded&&!initialize())return;
   if(dirty&&version!==null&&input.version!==version){
     status('原画布版本已经更新；当前画master还有未保存布局，请先保存或放弃后重新读取。');
     return;
   }
   const signature=JSON.stringify([input.version,input.source]);
   const changed=lastSourceSignature!==signature;
   source=model.clone(input.source);version=input.version;lastSourceSignature=signature;
   populate();
   status('X6 正在初始化；操作节点来自已发布旧画布 V'+version+'。');
   try{
     await loadVendor();
     if(!host.isConnected||host.hidden)return;
     createGraph();graph.resize(byId('lmCanvas').clientWidth,byId('lmCanvas').clientHeight);
     if(changed)draw(true);
     else graph.zoomToFit({padding:36,maxScale:1});
     if(!dirty)status('画master 已加载。原业务数据只读，新建关系默认待核实。');
   }catch(error){
     status('X6 资源未就绪（'+String(error.message||'加载失败')+'）；旧画布和数据未受影响。');
   }
 }
 byId('lmSave').onclick=persist;
 byId('lmScope').onchange=()=>draw(true);
 byId('lmFit').onclick=()=>graph?.zoomToFit({padding:42,maxScale:1});
 byId('lmZoomIn').onclick=()=>graph?.zoom(0.15);
 byId('lmZoomOut').onclick=()=>graph?.zoom(-0.15);
 byId('lmLayout').onclick=()=>{
   if(!graph||locked)return;
   if(!confirm('重新排列画master里的操作节点位置？自由便签和原业务内容不会删除。'))return;
   layout.positions={};markDirty();draw(true);
 };
 byId('lmAddNote').onclick=()=>{
   if(!graph||locked)return;
   const note={id:'note_'+crypto.randomUUID(),title:'研究便签',body:'',x:300,y:180};
   if(!model.addNote(layout,note)){status('便签数量已达上限或数据异常。');return;}
   selected=model.noteId(note.id);markDirty();draw();inspect(selected);
 };
 byId('lmReload').onclick=()=>{
   if(dirty&&!confirm('有未保存的画master修改；确定放弃并重新读取旧画布已发布版本？'))return;
   const result=model.load(store());if(result.error){status(result.error);return;}
   layout=result.data;dirty=false;byId('lmSave').textContent='保存画master';
   const record=root.LambertLogisticsVersion?.load(store(),source);
   if(record?.error){status('源画布版本数据无法读取。');return;}
   if(record?.record?.published){
     source=model.clone(record.record.published.data);version=record.record.published.number;
     lastSourceSignature=JSON.stringify([version,source]);populate();draw(true);
   }
   status('已重新读取已发布的旧画布资料；未修改任何旧画布记录。');
 };
 byId('lmExport').onclick=()=>{
   if(!layout)return;
   const content=JSON.stringify({format:'lambert-master-research-v1',exportedAt:new Date().toISOString(),sourceVersion:version,layout},null,2);
   const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=el('a');
   a.href=url;a.download='Lambert-master-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 };
 root.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 root.LambertLogisticsMaster=Object.freeze({activate});
})(window);
