/* Lambert OS · 物流知识库 V1 | isolated owner-scoped notes, no legacy data writes */
(function () {
  'use strict';
  const root=document.getElementById('logistics');
  if (!root) return;
  const KEY='lambert_logistics_knowledge_v1';
  const storage=()=>window.LambertPrivateStorage||localStorage;
  const $=id=>document.getElementById(id);
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const seedNode=(id,title,action,information,data,kind='业务操作')=>({
    id,title,kind,action,information,data,confidence:'待核实',evidence:''
  });
  const stageNode=(stageId,id,title,action)=>({...seedNode(id,title,action,'待核实：对应事件码、系统接口与轨迹处理','待核实：记录字段、操作时间与关联物流对象'),stageId});
  // The first route is a learning example, NOT an assertion about the production system.
  const defaults=()=>({schema:1,route:'中国 → 哈萨克斯坦 · 陆运（研究模板）',modules:[
    {id:'head',name:'国内中心仓',category:'仓',enabled:true,
      stages:[{id:'arrival',name:'到车',collapsed:false},{id:'receiving',name:'收入',collapsed:false},{id:'sorting',name:'分拣',collapsed:false},{id:'dispatch',name:'发出',collapsed:false}],
      nodes:[
        stageNode('arrival','arrive-scan','到车扫描','登记车辆到达及车次信息'),
        stageNode('arrival','unload-scan','下车扫描','确认包裹或包袋从车辆卸下'),
        stageNode('receiving','waybill-print','换单打印','按业务要求打印或更换面单'),
        stageNode('receiving','receiving-op','收入操作','通过 DWS 或操作终端完成收货记录'),
        stageNode('receiving','security-scan','安检扫描','对货件进行安检并登记结果'),
        stageNode('receiving','security-exception','安检异常上报','对异常安检结果登记并流转处理'),
        stageNode('sorting','weigh-recheck','称重复核','核实包裹或包袋的重量记录'),
        stageNode('sorting','bag-label','打印包签','为包袋打印可识别的标签'),
        stageNode('sorting','bag-build','建包扫描','扫描建立包袋与运单的关联'),
        stageNode('sorting','big-bag-check','大包复核','核对包袋及其包含运单'),
        stageNode('sorting','batch-create','批次创建','建立发运批次并关联运输货件'),
        stageNode('sorting','batch-bind','批次绑定','将需要发运的货件与批次绑定'),
        stageNode('dispatch','vehicle-create','创建车签','建立车辆或车次标签'),
        stageNode('dispatch','vehicle-print','打印车签','打印车签以供出库扫描使用'),
        stageNode('dispatch','truck-loading','上车扫描','扫描确认货件装载到车辆'),
        stageNode('dispatch','truck-departure','发车扫描','记录车辆实际发出操作')
      ]},
        {id:'export',name:'出口关务',category:'关',enabled:true,nodes:[
      seedNode('export-submit','出口申报','整理申报要素并提交出口申报','需核实申报系统、对接接口和状态回传','申报单号、报关状态、申报时间'),
      seedNode('export-release','出口放行','确认货物已满足出口放行条件','放行结果来源和内部系统更新机制待核实','放行时间、状态、关联运单号','外部事件')
    ]},
    {id:'linehaul',name:'陆运干线',category:'干',enabled:true,nodes:[
      seedNode('vehicle-label','制作车签','创建或维护运输车辆标识','车签与车次、批次的绑定规则待核实','车签、车次标识、创建时间'),
      seedNode('batch','创建批次','将运单组织到运输批次','批次保存是否产生事件、是否触发下游接口待核实','批次号、运单号、创建时间'),
      seedNode('preload','预配载','提前安排批次与车辆的计划关系','预配成功后如何更新计划与通知下游待核实','预配关系、计划时间、车辆'),
      seedNode('loading','装车确认','核实实物装载并确认','是否有装车事件码与对外轨迹需要核实','装车时间、车次、件数'),
      seedNode('departure','实际发运','确认干线车辆实际发出','需核实发运事件经 TMS / EDI / 轨迹中心的实际链路','实际发运时间、运输状态、关联批次')
    ]},
    {id:'import',name:'进口关务',category:'关',enabled:true,nodes:[
      seedNode('import-clear','进口清关','根据目的国要求完成清关与放行','服务商清关状态怎样映射内部状态待核实','申报信息、清关状态、完成时间','外部事件')
    ]},
    {id:'lastmile',name:'海外尾程',category:'配',enabled:true,nodes:[
      seedNode('overseas-scan','海外首扫','海外服务商或网点确认收到货件','首扫信息可能来自合作商 EDI，需核实来源与时间语义','首扫时间、服务商、运单号','外部事件'),
      seedNode('delivery','末端派送','分配派件任务并执行配送','派送状态回传与内部事件映射待核实','派件时间、派件网点、运单状态'),
      seedNode('signed','签收','确认妥投或签收结果','回传签收轨迹及其用于 SLA 的时间字段需核实','签收时间、签收证明、运单号','外部事件')
    ]}
  ]});
  let state=null,blocked=false,tab='process',moduleId='',selectedId='',editorMode='',dragPayload=null,activeStageId='',editingStageId='';
  const moves=window.LambertLogisticsMoves;
  const stages=window.LambertLogisticsStages;
  const copy=x=>JSON.parse(JSON.stringify(x));
  function read() {
    try {
      const raw=storage().getItem(KEY);
      if (raw===null) return defaults();
      const data=JSON.parse(raw);
      if (data?.schema!==1||!Array.isArray(data.modules)||data.modules.some(m=>!m||typeof m.id!=='string'||!Array.isArray(m.nodes)||typeof m.enabled!=='boolean')) throw Error('invalid');
      return data;
    }catch { blocked=true;return defaults(); }
  }
  function persist(draft){
    if(blocked){setMessage('无法读取已有知识库记录，已禁止覆盖。请先备份或检查本机存储。');return false;}
    try {storage().setItem(KEY,JSON.stringify(draft));state=draft;setMessage('已保存到当前浏览器的独立知识库空间');return true;}
    catch {setMessage('保存失败，本次修改未写入。请检查浏览器存储空间或账号状态。');return false;}
  }
  function setMessage(message){$('lkMessage').textContent=message;}
  const current=()=>state.modules.find(m=>m.id===moduleId)||state.modules[0];
  const selected=()=>current()?.nodes.find(n=>n.id===selectedId)||null;
  function findSelected(){
    if(!current()){moduleId='';selectedId='';return;}
    if(!current().nodes.some(n=>n.id===selectedId)) selectedId=current().nodes[0]?.id||'';
  }
  function button(label,action,cls,disabled){
    const b=node('button',label,cls);b.type='button';b.dataset.action=action;b.disabled=!!disabled;return b;
  }
  root.innerHTML='<div class="lk-page">'+
    '<header class="lk-head"><div><small>LOGISTICS KNOWLEDGE · P0 CANVAS</small><h2>物流知识库</h2><p>以操作为底座，把业务动作、信息传递和数据记录串起来。</p></div>'+
    '<button type="button" id="lkExport">导出知识库</button></header>'+
    '<div class="lk-toolbar"><span class="lk-route">中国 → 哈萨克斯坦 · 陆运示例</span><span class="lk-warning">示意链路 · 实际系统规则待核实</span></div>'+
    '<div class="lk-tabs" role="tablist" aria-label="知识库视图"><button type="button" role="tab" id="lkTabProcess" aria-selected="true">业务链路 · 操作＋信息</button><button type="button" role="tab" id="lkTabData" aria-selected="false">数据关系</button></div>'+
    '<div id="lkProcess" role="tabpanel" aria-labelledby="lkTabProcess"><div class="lk-canvas-categories" aria-label="物流模块底座"><span class="lk-canvas-category">仓</span><span class="lk-canvas-category">干</span><span class="lk-canvas-category">关</span><span class="lk-canvas-category">配</span></div><div class="lk-section-title"><div><strong>模块化操作画布</strong><small>大模块内包含可调整的子环节，例如：国内中心仓 → 到车／收入／分拣／发出。</small></div><button id="lkAddModule" type="button">＋ 添加模块</button></div><div id="lkModules" class="lk-modules lk-canvas"></div>'+
    '<div class="lk-section-title lk-selection-head"><div><strong id="lkNodeTitle">操作节点详情</strong><small>选择上方的小块；系统关系放在详情内按需展开</small></div><button type="button" id="lkAddNode">＋ 为选中模块添加操作</button></div>'+
    '<div class="lk-workspace lk-canvas-workspace"><div id="lkNodes" class="lk-nodes" hidden aria-hidden="true"></div><article id="lkDetail" class="lk-detail"></article></div></div>'+
    '<div id="lkData" role="tabpanel" aria-labelledby="lkTabData" hidden><div class="lk-data-guide"><strong>从业务动作追到数据</strong><p>操作／事件 → 信息变化 → 记录字段 → 后续指标。这里只列研究关系，不假装已接入真实数据表或驾驶舱。</p></div><div id="lkDataRows" class="lk-data-rows"></div></div>'+
    '<p class="lk-footnote">提示：预配不等于发运，系统生成轨迹也不必然等于实物动作完成。每条事件／接口关系应以系统截图、接口响应或数据库记录确认。</p><p id="lkMessage" class="lk-message" role="status"></p></div>'+
    '<dialog id="lkNodeDialog" class="lk-dialog"><form id="lkNodeForm"><h3 id="lkEditorTitle">操作节点</h3><label>操作名称<input id="lkTitleInput" required maxlength="70"></label>'+
    '<label>动作类型<select id="lkKindInput"><option>业务操作</option><option>系统动作</option><option>外部事件</option></select></label>'+
    '<label>业务操作 / 触发条件<textarea id="lkActionInput" rows="3" maxlength="1500"></textarea></label>'+
    '<label>信息传递 / 系统触发<textarea id="lkInfoInput" rows="3" maxlength="1500"></textarea></label>'+
    '<label>数据字段 / 记录<textarea id="lkRecordInput" rows="2" maxlength="1500"></textarea></label>'+
    '<label>核实状态<select id="lkConfidenceInput"><option>待核实</option><option>部分核实</option><option>已核实</option></select></label>'+
    '<label>证据 / 待核实问题<textarea id="lkEvidenceInput" rows="2" maxlength="1500" placeholder="例如：接口路径、截图描述、SQL、待核实问题"></textarea></label>'+
    '<div class="lk-dialog-actions"><button type="button" id="lkNodeCancel">取消</button><button type="submit" class="lk-primary">保存节点</button></div></form></dialog>'+
    '<dialog id="lkModuleDialog" class="lk-dialog"><form id="lkModuleForm"><h3>添加线路模块</h3><label>模块名称<input id="lkModuleName" maxlength="60" required placeholder="例如：海外转运中心"></label>'+
    '<label>归属环节<select id="lkModuleCategory"><option>头程</option><option>关务</option><option>干线</option><option>尾程</option></select></label>'+
    '<div class="lk-dialog-actions"><button type="button" id="lkModuleCancel">取消</button><button type="submit" class="lk-primary">添加模块</button></div></form></dialog>'+
    '<dialog id="lkStageDialog" class="lk-dialog lk-stage-dialog"><form id="lkStageForm"><h3 id="lkStageDialogTitle">添加子环节</h3><label>子环节名称<input id="lkStageName" required maxlength="55" placeholder="例如：收入"></label>'+
    '<p class="lk-footnote">子环节用于组织操作步骤；原操作和业务字段不会丢失。</p><div class="lk-dialog-actions"><button type="button" id="lkStageCancel">取消</button><button type="submit" class="lk-primary">保存子环节</button></div></form></dialog>';
  const makeId=prefix=>prefix+'_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  function renderModules(){
    const host=$('lkModules');host.replaceChildren();
    state.modules.forEach((m,index)=>{
      const card=node('section',undefined,'lk-module lk-canvas-block'+(m.id===moduleId?' is-active':'')+(!m.enabled?' is-muted':''));
      card.dataset.module=m.id;
      const head=node('div',undefined,'lk-canvas-block-head');
      const grip=button('⠿','noop','lk-drag-handle',blocked);grip.draggable=!blocked;grip.dataset.dragModule=m.id;grip.title='拖动大模块改变顺序';grip.setAttribute('aria-label','拖动'+m.name);
      const main=button(m.name,'select-module','lk-module-main');main.dataset.id=m.id;
      main.prepend(node('small',m.category+' / '+m.nodes.length+' 个操作节点'));
      const controls=node('div',undefined,'lk-canvas-controls');
      const fold=button(m.collapsed?'展开':'收起','collapse-module','lk-fold',blocked);fold.dataset.id=m.id;
      fold.setAttribute('aria-expanded',String(!m.collapsed));fold.setAttribute('aria-label',(m.collapsed?'展开':'收起')+m.name);
      const prev=button('↑','module-up','lk-move',blocked||index===0);prev.dataset.id=m.id;prev.setAttribute('aria-label',m.name+'上移');
      const next=button('↓','module-down','lk-move',blocked||index===state.modules.length-1);next.dataset.id=m.id;next.setAttribute('aria-label',m.name+'下移');
      const add=button('＋ 操作','add-here','lk-block-add',blocked||!m.enabled);add.dataset.id=m.id;
      const toggle=node('label','启用','lk-toggle');const check=document.createElement('input');
      check.type='checkbox';check.checked=m.enabled;check.disabled=blocked;check.dataset.toggle=m.id;toggle.prepend(check);
      controls.append(add,prev,next,fold,toggle);head.append(grip,main,controls);card.append(head);
      if(!m.collapsed&&m.enabled){
        const lane=node('div',undefined,'lk-canvas-lane');lane.dataset.dropModule=m.id;
        if(!m.nodes.length)lane.append(node('p','此模块没有操作，点击「＋ 操作」添加。','lk-empty'));
        m.nodes.forEach((n,i)=>{
          const wrap=node('div',undefined,'lk-step');wrap.draggable=!blocked;wrap.dataset.dragNode=n.id;wrap.dataset.dragFrom=m.id;
          const step=button('', 'select-node','lk-node lk-canvas-op'+(n.id===selectedId&&m.id===moduleId?' is-current':''));step.dataset.id=n.id;step.dataset.module=m.id;
          step.append(node('small',String(i+1).padStart(2,'0')+' · '+n.kind),node('strong',n.title),node('span',n.confidence||'待核实'));
          const move=node('div',undefined,'lk-step-actions');
          const left=button('←','node-left','',blocked||i===0);left.dataset.id=n.id;left.dataset.module=m.id;left.setAttribute('aria-label',n.title+'向前移动');
          const right=button('→','node-right','',blocked||i===m.nodes.length-1);right.dataset.id=n.id;right.dataset.module=m.id;right.setAttribute('aria-label',n.title+'向后移动');
          move.append(left,right);wrap.append(step,move);lane.append(wrap);
        });
        const drop=node('div','拖动操作块到这里追加','lk-drop-end');drop.dataset.dropModule=m.id;lane.append(drop);
        card.append(lane);
      }else if(!m.enabled){
        card.append(node('p','模块已停用，操作内容保留；重新启用即可展开。','lk-folded-caption'));
      }else{
        card.append(node('p',m.nodes.length+' 个操作已折叠，展开后继续编排。','lk-folded-caption'));
      }
      host.append(card);
    });
    window.LambertLogisticsStageView?.renderStageLane(host,state,blocked);
  }
  function renderNodes(){
    const m=current();
    $('lkNodeTitle').textContent=m?m.name+' · 操作详情':'操作详情';
    $('lkAddNode').disabled=blocked||!m||!m.enabled;
  }
  function field(title,text){
    const card=node('section',undefined,'lk-detail-field');
    card.append(node('h4',title),node('p',text||'尚未补充，待核实。'));return card;
  }
  function renderDetail(){
    const host=$('lkDetail');host.replaceChildren();
    const m=current(),n=m?.enabled?selected():null;
    if(!n){host.append(node('p','在上方画布点击一个操作块，即可查看业务动作、系统关系和数据。','lk-empty'));return;}
    const header=node('div',undefined,'lk-detail-head');
    const title=node('div');title.append(node('small',m.name+' / '+n.kind),node('h3',n.title));
    const edit=button('编辑节点','edit-node','lk-edit',blocked);edit.dataset.id=n.id;
    header.append(title,edit);host.append(header);
    host.append(node('span','核实状态：'+(n.confidence||'待核实'),'lk-status'));
    host.append(field('① 业务操作 / 触发条件',n.action));
    const more=document.createElement('details');more.className='lk-related-details';
    const summary=node('summary','按需展开 · 系统信息流与数据记录');more.append(summary);
    more.append(field('② 信息流 / 系统触发',n.information),field('③ 数据流 / 记录字段',n.data),field('核实依据 / 证据',n.evidence));
    host.append(more);
    const moveBox=node('label','移动此操作至另一模块','lk-move-to');
    const select=document.createElement('select');select.dataset.moveNode=n.id;select.dataset.moveFrom=m.id;select.disabled=blocked;
    const empty=document.createElement('option');empty.value='';empty.textContent='选择目标模块（保留所有关联字段）';select.append(empty);
    state.modules.filter(x=>x.enabled&&x.id!==m.id).forEach(x=>{
      const o=document.createElement('option');o.value=x.id;o.textContent=x.name;select.append(o);
    });
    moveBox.append(select);host.append(moveBox);
    const go=button('查看此操作的数据关系 →','to-data','lk-go');go.dataset.id=n.id;host.append(go);
  }
  function renderData(){
    const host=$('lkDataRows');host.replaceChildren();
    const active=state.modules.filter(m=>m.enabled);
    if(!active.length){host.append(node('p','没有启用的模块。','lk-empty'));return;}
    active.forEach(m=>{
      const group=node('section',undefined,'lk-data-group');group.append(node('h3',m.name+' · '+m.category));
      if(!m.nodes.length)group.append(node('p','尚未添加操作节点。','lk-empty'));
      m.nodes.forEach(n=>{
        const row=node('div',undefined,'lk-data-row');
        row.append(field('操作 / 事件',n.title),field('信息变化',n.information),field('业务数据记录',n.data));
        const foot=node('div',undefined,'lk-data-foot');
        foot.append(node('small','状态：'+(n.confidence||'待核实')));
        const link=button('定位操作 ↗','open-node','lk-jump');link.dataset.module=m.id;link.dataset.id=n.id;foot.append(link);
        row.append(foot);group.append(row);
      });
      host.append(group);
    });
  }
  function render(){
    if(!moduleId||!current())moduleId=state.modules[0]?.id||'';
    findSelected();
    $('lkProcess').hidden=tab!=='process';$('lkData').hidden=tab!=='data';
    $('lkTabProcess').setAttribute('aria-selected',String(tab==='process'));$('lkTabData').setAttribute('aria-selected',String(tab==='data'));
    $('lkAddModule').disabled=blocked;$('lkAddNode').disabled=blocked;$('lkExport').disabled=blocked;
    if(tab==='process'){renderModules();renderNodes();renderDetail();}
    else renderData();
  }
  function openEditor(edit){
    if(blocked)return;
    const n=edit?selected():null;
    editorMode=n?'edit':'new';
    $('lkEditorTitle').textContent=n?'编辑操作节点':'添加操作节点';
    $('lkTitleInput').value=n?.title||'';
    $('lkKindInput').value=n?.kind||'业务操作';
    $('lkActionInput').value=n?.action||'';
    $('lkInfoInput').value=n?.information||'待核实：操作后哪些系统接收什么事件？';
    $('lkRecordInput').value=n?.data||'待核实：关联对象、记录字段及时间';
    $('lkConfidenceInput').value=n?.confidence||'待核实';
    $('lkEvidenceInput').value=n?.evidence||'';
    $('lkNodeDialog').showModal();
  }
  function mutate(fn){
    if(blocked){setMessage('知识库处于只读保护状态，已停止写入。');return false;}
    const next=copy(state);
    if(fn(next)===false)return false;
    if(!persist(next))return false;
    render();return true;
  }
  root.addEventListener('click',event=>{
    const b=event.target.closest('button[data-action]');
    if(!b)return;
    const type=b.dataset.action,id=b.dataset.id;
    if(type==='select-module'){moduleId=id;selectedId='';tab='process';render();return;}
    if(type==='select-node'){moduleId=b.dataset.module||moduleId;selectedId=id;render();return;}
    if(type==='add-here'){moduleId=id;selectedId='';render();openEditor(false);return;}
    if(type==='collapse-module'){
      mutate(next=>{const m=next.modules.find(m=>m.id===id);if(m)m.collapsed=!m.collapsed;});return;
    }
    if(type==='node-left'||type==='node-right'){
      moduleId=b.dataset.module||moduleId;selectedId=id;
      mutate(next=>moves.reorderNode(next,moduleId,id,type==='node-left'?-1:1));return;
    }
    if(type==='to-data'){tab='data';render();return;}
    if(type==='open-node'){moduleId=b.dataset.module;selectedId=id;tab='process';render();return;}
    if(type==='edit-node'){selectedId=id;openEditor(true);return;}
    if(type==='module-up'||type==='module-down'){
      mutate(next=>{
        const index=next.modules.findIndex(m=>m.id===id);
        return moves.reorder(next.modules,index,index+(type==='module-up'?-1:1));
      });return;
    }
  });
  root.addEventListener('change',event=>{
    const selector=event.target.closest('select[data-move-node]');
    if(selector){
      const destination=selector.value,source=selector.dataset.moveFrom,id=selector.dataset.moveNode;
      if(!destination)return;
      if(mutate(next=>moves.moveNode(next,source,id,destination))){
        moduleId=destination;selectedId=id;render();
        setMessage('已移动操作节点，原有信息和数据记录均保留。');
      }else selector.value='';
      return;
    }
    const input=event.target.closest('input[data-toggle]');if(!input)return;
    const id=input.dataset.toggle,enabled=input.checked;
    if(!mutate(next=>{const item=next.modules.find(x=>x.id===id);if(item)item.enabled=enabled;})) input.checked=!enabled;
  });
  // Native drag-and-drop for desktop; arrow controls and the move selector
  // provide an accessible non-drag route on mobile and keyboard.
  root.addEventListener('dragstart',event=>{
    if(blocked)return;
    const grip=event.target.closest('[data-drag-module]');
    const step=event.target.closest('[data-drag-node]');
    if(grip){dragPayload={kind:'module',id:grip.dataset.dragModule};}
    else if(step){dragPayload={kind:'node',id:step.dataset.dragNode,from:step.dataset.dragFrom};}
    else return;
    if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','lambert-logistics');}
    event.target.classList.add('lk-dragging');
  });
  root.addEventListener('dragover',event=>{
    if(!dragPayload)return;
    const isModule=!!event.target.closest('.lk-canvas-block-head');
    const target=dragPayload.kind==='module'?(isModule?event.target.closest('.lk-canvas-block'):null):event.target.closest('.lk-step,.lk-drop-end,.lk-canvas-lane');
    if(!target)return;
    if(dragPayload.kind==='node'){
      const id=target.dataset.dropModule||target.dataset.dragFrom;
      if(!state.modules.find(m=>m.id===id)?.enabled)return;
    }
    event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';
  });
  root.addEventListener('drop',event=>{
    if(!dragPayload)return;
    const active=dragPayload;dragPayload=null;
    if(active.kind==='module'){
      const target=event.target.closest('.lk-canvas-block-head')?.closest('.lk-canvas-block');
      if(!target)return;
      event.preventDefault();
      const rect=target.getBoundingClientRect(),after=event.clientY>=rect.top+rect.height/2;
      mutate(next=>moves.moveModule(next,active.id,target.dataset.module,after));
    }else{
      const target=event.target.closest('.lk-step,.lk-drop-end,.lk-canvas-lane');
      if(!target)return;
      const dest=target.dataset.dropModule||target.dataset.dragFrom;
      const m=state.modules.find(m=>m.id===dest);
      if(!m?.enabled)return;
      event.preventDefault();
      let before=null;
      if(target.classList.contains('lk-step')){
        const rect=target.getBoundingClientRect();
        const after=event.clientX>rect.left+rect.width/2;
        if(!after)before=target.dataset.dragNode;
        else{
          const index=m.nodes.findIndex(n=>n.id===target.dataset.dragNode);
          before=m.nodes[index+1]?.id||null;
        }
      }
      if(active.from===dest&&before===active.id)return;
      if(mutate(next=>moves.moveNode(next,active.from,active.id,dest,before))){
        moduleId=dest;selectedId=active.id;render();
      }
    }
  });
  root.addEventListener('dragend',event=>{dragPayload=null;event.target.classList?.remove('lk-dragging');});
  $('lkTabProcess').onclick=()=>{tab='process';render();};
  $('lkTabData').onclick=()=>{tab='data';render();};
  $('lkAddNode').onclick=()=>{if(current()?.enabled)openEditor(false);};
  $('lkNodeCancel').onclick=()=>$('lkNodeDialog').close();
  $('lkNodeForm').addEventListener('submit',e=>{
    e.preventDefault();if(!current()?.enabled)return;
    const input={
      title:$('lkTitleInput').value.trim(),kind:$('lkKindInput').value,action:$('lkActionInput').value.trim(),
      information:$('lkInfoInput').value.trim(),data:$('lkRecordInput').value.trim(),
      confidence:$('lkConfidenceInput').value,evidence:$('lkEvidenceInput').value.trim()
    };
    if(!input.title)return;
    const id=editorMode==='edit'?selectedId:makeId('op');
    if(mutate(next=>{
      const m=next.modules.find(x=>x.id===moduleId);if(!m)return;
      const old=m.nodes.find(n=>n.id===id);
      if(old)Object.assign(old,input);
      else m.nodes.push({id,...input});
    })){selectedId=id;$('lkNodeDialog').close();render();}
  });
  $('lkAddModule').onclick=()=>{
    if(blocked)return;
    $('lkModuleName').value='';$('lkModuleCategory').value='干线';$('lkModuleDialog').showModal();
  };
  $('lkModuleCancel').onclick=()=>$('lkModuleDialog').close();
  $('lkModuleForm').addEventListener('submit',e=>{
    e.preventDefault();
    const name=$('lkModuleName').value.trim(),category=$('lkModuleCategory').value;
    if(!name)return;
    const id=makeId('module');
    if(mutate(next=>next.modules.push({id,name,category,enabled:true,nodes:[]}))){
      moduleId=id;selectedId='';$('lkModuleDialog').close();render();
    }
  });
  $('lkExport').onclick=()=>{
    try{
      const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='Lambert-Logistics-Knowledge-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
      setMessage('已发起知识库 JSON 导出；请检查浏览器下载记录。');
    }catch{setMessage('导出失败，请检查浏览器环境。');}
  };
  state=read();moduleId=state.modules[0]?.id||'';render();
  if(blocked)setMessage('检测到既有知识库读取异常：当前为只读示意内容，原记录不会被覆盖。');
})();
