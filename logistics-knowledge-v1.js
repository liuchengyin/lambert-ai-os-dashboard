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
      branches:[{id:'security-exception-branch',from:'security-scan',to:'security-exception',label:'安检异常'}],
      nodes:[
        stageNode('arrival','arrive-scan','到车扫描','登记车辆到达及车次信息'),
        stageNode('arrival','unload-scan','下车扫描','确认包裹或包袋从车辆卸下'),
        stageNode('receiving','waybill-print','换单打印','按业务要求打印或更换面单'),
        stageNode('receiving','receiving-op','收入操作','通过 DWS 或操作终端完成收货记录'),
        stageNode('receiving','security-scan','安检扫描','对货件进行安检并登记结果'),
        ({...stageNode('receiving','security-exception','安检异常上报','对异常安检结果登记并流转处理'),branchOnly:true}),
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
  let state=null,blocked=false,locked=true,dirty=false,releaseRecord=null,tab='process',overviewMode='macro',moduleId='',selectedId='',editorMode='',dragPayload=null,activeStageId='',editingStageId='';
  const moves=window.LambertLogisticsMoves;
  const stages=window.LambertLogisticsStages;
  const flow=window.LambertLogisticsFlow;
  const versions=window.LambertLogisticsVersion,overview=window.LambertLogisticsOverview;
  const editor=window.LambertLogisticsEditor;
  const triggerApi=window.LambertLogisticsTriggerV33;
  const setup=window.LambertLogisticsSetupV34;
  const mini=window.LambertLogisticsV35;
  const wiring=window.LambertLogisticsWiringV36;
  let setupModuleId='',setupStageId=null,editingSetup=false,exchangeNodeId='',exchangeModuleId='';
  let editingModuleId='',searchTerm='',branchSourceId='',renameModuleId='',renameNodeId='',returnQuickAfterEdit=false;
  let wiringModuleId='',wiringNodeId='',wiringReturnQuick=false;
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
    if(blocked||locked){setMessage('当前已锁定。请先解锁编辑。');return false;}
    if(!versions.validData(draft)){setMessage('数据结构校验失败，修改未生效。');return false;}
    state=draft;dirty=true;
    setMessage('有未保存的草稿修改；全链路仍显示已发布版本。');
    return true;
  }
  function setMessage(message){$('lkMessage').textContent=message;}
  const current=()=>state.modules.find(m=>m.id===moduleId)||state.modules[0];
  const selected=()=>current()?.nodes.find(n=>n.id===selectedId)||null;
  function crossModuleMoveWarning(from,nodeId,to){
    if(from===to)return '';
    const source=state.modules.find(x=>x.id===from),target=state.modules.find(x=>x.id===to);
    const hasEdge=m=>Array.isArray(m?.branches)&&m.branches.some(e=>e&&(e.from===nodeId||e.to===nodeId));
    if(hasEdge(source))return '此操作存在条件或异常关联，跨大模块移动会使连线失效。请先核实并处理关联，再移动；本次未修改数据。';
    if(hasEdge(target))return '目标模块存在指向该操作 ID 的历史关联，移动可能让旧连线意外生效。请先核实目标关联；本次未修改数据。';
    return '';
  }
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
    '<div class="lk-version-bar"><span id="lkEditStatus">已锁定 · 只读</span><div class="lk-version-actions"><button type="button" id="lkUnlock">解锁编辑</button><button type="button" id="lkSaveDraft" disabled>保存草稿</button><button type="button" id="lkPublish" disabled>确认发布</button><button type="button" id="lkCancelEdit" disabled>取消并锁定</button></div><div class="lk-version-history"><label>历史版本 <select id="lkHistorySelect"><option value="">选择历史版本</option></select></label><button type="button" id="lkRollback" disabled>回滚为新版本</button></div></div>'+
    '<div class="lk-tabs" role="tablist" aria-label="知识库视图"><button type="button" role="tab" id="lkTabOverview" aria-selected="false">全链路总览</button><button type="button" role="tab" id="lkTabProcess" aria-selected="true">模块编辑 · 操作＋信息</button><button type="button" role="tab" id="lkTabData" aria-selected="false">数据关系</button><button type="button" role="tab" id="lkTabSetup" aria-selected="false">基础资料配置</button></div>'+
    '<div id="lkOverview" role="tabpanel" aria-labelledby="lkTabOverview" hidden><div class="lk-ov-switch"><span>查看已发布版本</span><div role="group" aria-label="全链路展示模式"><button type="button" id="lkModeMacro" aria-pressed="true">A · 宏观模块</button><button type="button" id="lkModeDetail" aria-pressed="false">B · 完整流程</button></div></div><div id="lkOverviewContent"></div></div>'+
    '<div id="lkProcess" role="tabpanel" aria-labelledby="lkTabProcess"><div class="lk-search-bar"><label>搜索操作、标签、操作码 <input id="lkSearch" type="search" placeholder="例如：安检 / 上车 / DDS"></label><div id="lkSearchResults" aria-live="polite"></div></div><div class="lk-canvas-categories" aria-label="物流模块底座"><span class="lk-canvas-category">仓</span><span class="lk-canvas-category">干</span><span class="lk-canvas-category">关</span><span class="lk-canvas-category">配</span></div><div class="lk-section-title"><div><strong>模块化操作画布</strong><small>大模块内包含可调整的子环节，例如：国内中心仓 → 到车／收入／分拣／发出。</small></div><button id="lkAddModule" type="button">＋ 添加模块</button></div><div class="lk-mode-toolbar"><strong>干线类型</strong><span>按运输方式分类，也可为每个环节填写前置配置</span><button type="button" data-action="add-linehaul-mode" data-mode="road">＋ 陆运</button><button type="button" data-action="add-linehaul-mode" data-mode="sea">＋ 海运</button><button type="button" data-action="add-linehaul-mode" data-mode="air">＋ 空运</button></div><details class="lk-infra-base" id="lkInfrastructureBase"><summary>信息与数据基础设施 · 所有操作节点可复用（展开查看）</summary><p>这不是业务分支，也不是已经连接系统的实时数据。操作的内部事件、日志、推送决策、数据表、指标和任务，逐节点配置；无证据时保持待配置。</p><div class="lk-infra-chain"><div><strong>① 操作</strong><small>谁执行 / 操作动作</small></div><div><strong>② 事件与留痕</strong><small>内部事件 / 日志 / 记录表</small></div><div><strong>③ 推送判断</strong><small>仅内部 / 条件推送 / 对外</small></div><div><strong>④ 数据来源</strong><small>OMS / EDI / TMS 等表及关联键</small></div><div><strong>⑤ 指标与 SLA</strong><small>业务规则 / 时间口径 / 目标</small></div><div><strong>⑥ 看板与任务</strong><small>数据看板 / 预警与任务入口</small></div></div><p>不对外推送的事件仍可有内部日志与持久化记录；是否真的产生轨迹、是否入库，都待真实系统证据核实。</p></details><div id="lkModules" class="lk-modules lk-canvas"></div>'+
    '<div class="lk-section-title lk-selection-head"><div><strong id="lkNodeTitle">操作节点详情</strong><small>选择上方的小块；系统关系放在详情内按需展开</small></div><button type="button" id="lkAddNode">＋ 为选中模块添加操作</button></div>'+
    '<details class="lk-trash-panel"><summary>回收站 · 可恢复的删除记录 <span id="lkTrashCount">0</span></summary><div id="lkTrashList"></div></details>'+
    '<div class="lk-workspace lk-canvas-workspace"><div id="lkNodes" class="lk-nodes" hidden aria-hidden="true"></div><article id="lkDetail" class="lk-detail"></article></div></div>'+
    '<div id="lkSetupTool" role="tabpanel" aria-labelledby="lkTabSetup" hidden><div class="lk-setup-tool-intro"><strong>基础资料配置工具</strong><p>机场、航线、航班、板型、车队等是配置资料，不属于物流操作流程。按模块 / 子环节拼装配置；业务画布只保留配置入口，待后续按 ID 关联操作事件。</p></div><div id="lkSetupLibrary"></div></div>'+
    '<div id="lkData" role="tabpanel" aria-labelledby="lkTabData" hidden><div class="lk-data-guide"><strong>从业务动作追到数据</strong><p>操作／事件 → 信息变化 → 记录字段 → 后续指标。这里只列研究关系，不假装已接入真实数据表或驾驶舱。</p></div><div id="lkDataRows" class="lk-data-rows"></div></div>'+
    '<p class="lk-footnote">提示：预配不等于发运，系统生成轨迹也不必然等于实物动作完成。每条事件／接口关系应以系统截图、接口响应或数据库记录确认。</p><p id="lkMessage" class="lk-message" role="status"></p></div>'+
    '<dialog id="lkNodeDialog" class="lk-dialog"><form id="lkNodeForm"><h3 id="lkEditorTitle">操作节点</h3><label>操作名称<input id="lkTitleInput" required maxlength="70"></label>'+
    '<label>进入条件 / 何时开始（可留空待核实）<textarea id="lkEntryCondition" rows="2" maxlength="1000" placeholder="例如：包裹到达中心，等待安检；未核实时可以留空"></textarea></label>'+
    '<label>执行角色 / 系统（可选）<input id="lkExecutor" maxlength="180" placeholder="例如：中心操作员／多闻 TMS（待核实）"></label>'+
    '<label>所需输入 / 操作对象（可选）<textarea id="lkOperationInput" rows="2" maxlength="1000" placeholder="例如：运单号、包裹条码、扫描设备；只记录已了解的信息"></textarea></label>'+
    '<label>操作说明<textarea id="lkActionInput" rows="2" maxlength="1500" placeholder="谁在什么场景下执行什么操作"></textarea></label>'+
    '<div class="lk-trigger-field"><div class="lk-trigger-heading"><strong>触发结果</strong><button type="button" id="lkAddTrigger">＋ 增加触发结果</button></div><p class="lk-form-hint">记录操作完成后产生的事件、系统动作或状态变化，可添加多项。新建操作至少填写一项。</p><div id="lkTriggerRows"></div></div>'+
    '<details class="lk-event-bind"><summary>关联轨迹事件码 · 按需展开</summary><label>搜索轨迹事件码或描述<input type="search" id="lkEventSearch" disabled placeholder="等待导入真实操作码表"></label><p class="lk-form-hint" id="lkEventHint">尚未导入事件码表。当前不自动生成或猜测映射关系。</p><div id="lkExistingCodes"></div></details>'+
    '<label>研究依据 / 待核实问题（可选）<textarea id="lkResearchBasis" rows="2" maxlength="1500" placeholder="记录 SOP、系统截图、接口响应、数据库字段或仍待确认的问题；填写不等于已核实"></textarea></label>'+
    '<label>备注（可选）<textarea id="lkNoteInput" rows="2" maxlength="2500" placeholder="特殊业务规则、注意事项与待补充信息"></textarea></label>'+
    '<label>标签（可选，逗号分隔）<input id="lkTagsInput" maxlength="600" placeholder="如：安检, 扫描, 中心仓"></label>'+
    '<details class="lk-node-appearance"><summary>外观 · 小模块颜色</summary><label>节点颜色<input id="lkNodeColor" type="color" value="#FFFFFF"></label><label class="lk-inline-check"><input id="lkNodeNoColor" type="checkbox"> 使用默认颜色</label></details>'+
    '<div class="lk-dialog-actions"><button type="button" id="lkNodeCancel">取消</button><button type="submit" class="lk-primary">保存节点</button></div></form></dialog>'+
    '<dialog id="lkModuleDialog" class="lk-dialog"><form id="lkModuleForm"><h3 id="lkModuleDialogTitle">添加线路模块</h3><label>模块名称<input id="lkModuleName" maxlength="60" required placeholder="例如：海外转运中心"></label>'+
    '<label>归属环节<select id="lkModuleCategory"><option>仓</option><option>干</option><option>关</option><option>配</option></select></label>'+
    '<label id="lkModuleModeRow">干线运输类型<select id="lkModuleMode"><option value="">未指定</option><option value="road">陆运</option><option value="sea">海运</option><option value="air">空运</option></select></label>'+
    '<div class="lk-dialog-actions"><button type="button" id="lkModuleCancel">取消</button><button type="submit" class="lk-primary">保存模块</button></div></form></dialog>'+
    '<dialog id="lkStageDialog" class="lk-dialog lk-stage-dialog"><form id="lkStageForm"><h3 id="lkStageDialogTitle">添加子环节</h3><label>子环节名称<input id="lkStageName" required maxlength="55" placeholder="例如：收入"></label>'+
    '<p class="lk-footnote">子环节用于组织操作步骤；原操作和业务字段不会丢失。</p><div class="lk-dialog-actions"><button type="button" id="lkStageCancel">取消</button><button type="submit" class="lk-primary">保存子环节</button></div></form></dialog>'+
    '<dialog id="lkBranchDialog" class="lk-dialog lk-stage-dialog"><form id="lkBranchForm"><h3>添加条件分支</h3><p class="lk-footnote">将当前操作连接到一个已有操作。例如：安检扫描 — 异常 → 安检异常上报。</p>'+
    '<label>触发条件<input id="lkBranchLabel" required maxlength="40" placeholder="例如：安检异常"></label>'+
    '<label id="lkBranchTypeRow" hidden>流程类型<select id="lkBranchType"><option value="exception">异常流程</option><option value="branch">普通分支</option></select></label>'+
    '<label>分支源操作<select id="lkBranchSource" required></select></label>'+
    '<label>目标操作<select id="lkBranchTarget" required></select></label>'+
    '<label>新增目标操作名称（仅在选择「新建操作」时填写）<input id="lkBranchNewTitle" maxlength="70" placeholder="例如：异常处理"></label>'+
    '<label class="lk-branch-checkbox" hidden><input id="lkBranchOnly" type="checkbox" checked>目标只显示在分支上（不加入主线）</label>'+
    '<div class="lk-dialog-actions"><button type="button" id="lkBranchCancel">取消</button><button type="submit" class="lk-primary">保存条件分支</button></div></form></dialog>'+
    '<dialog id="lkSetupDialog" class="lk-dialog lk-setup-dialog"><form id="lkSetupForm"><h3 id="lkSetupTitle">编辑前置配置</h3><p class="lk-form-hint">配置在业务操作前需要准备的基础数据或条件。名称与具体值分开保存，未填写不代表已完成配置。</p><div class="lk-setup-actions"><button id="lkAddSetup" type="button">＋ 增加配置项</button><button id="lkApplyModeSetup" type="button">＋ 套用运输类型参考项</button></div><div id="lkSetupRows"></div><p class="lk-form-hint">注：航班日志属于运行记录入口，标记为「关联记录」，不应自动视为起运前必备条件。</p><div class="lk-dialog-actions"><button type="button" id="lkSetupCancel">取消</button><button type="submit" class="lk-primary">保存前置配置</button></div></form></dialog>'+
    '<dialog id="lkExchangeDialog" class="lk-dialog lk-stage-dialog"><form id="lkExchangeForm"><h3>信息交换 · 独立于业务分支</h3><p class="lk-form-hint">信息交换记录“谁发送 → 谁接收 → 发送什么”，不新增业务流程或异常连线。可作为将来 OMS / TMS / EDI 时序图的数据入口。</p><label>发送方<input id="lkExchangeFrom" required maxlength="90" placeholder="例如 TMS"></label><label>接收方<input id="lkExchangeTo" required maxlength="90" placeholder="例如 EDI"></label><label>交换内容<input id="lkExchangeMessage" required maxlength="300" placeholder="例如 发送包裹扫描事件"></label><label>备注（可选）<textarea id="lkExchangeNote" rows="2" maxlength="500"></textarea></label><div class="lk-dialog-actions"><button id="lkExchangeCancel" type="button">取消</button><button class="lk-primary" type="submit">保存信息交换</button></div></form></dialog>'+
    '<dialog id="lkWiringDialog" class="lk-dialog lk-wiring-dialog"><form id="lkWiringForm"><h3>节点的信息 / 数据 / SLA / 任务配置</h3><p class="lk-form-hint">只记录研究中的连接关系；不会调用 OMS/EDI、写数据库或创建任务。未知信息可留空，保存后仍需保存草稿。</p>'+
'<section class="lk-wiring-form-group"><h4>① 内部事件、日志与持久化</h4><p>操作可能产生内部事件；是否有对应日志、轨迹码或持久化表，分别填写。不要把日志自动等同于对外轨迹。</p><label>事件名称<input name="trace.event" maxlength="180" placeholder="待核实"></label><label>内部事件码<input name="trace.eventCode" maxlength="100" placeholder="需从真实码表确认"></label><label>日志位置或查询入口<input name="trace.logLocation" maxlength="220" placeholder="日志服务 / 路径（待核实）"></label><label>持久化记录表<input name="trace.recordTable" maxlength="180" placeholder="真实表名待核实"></label><label>记录关联键<input name="trace.recordKey" maxlength="180" placeholder="例如运单 ID（待核实）"></label></section>'+
'<section class="lk-wiring-form-group"><h4>② 是否对外推送 · 路由规则</h4><label>推送策略<select name="routing.policy"><option value="unknown">待核实</option><option value="internal">不对外推送 · 仅内部留痕</option><option value="conditional">满足条件才推送</option><option value="external">对外推送（需核实）</option></select></label><label>判断 / 映射 / 过滤规则<textarea name="routing.rule" maxlength="500" rows="2" placeholder="EDI 判断规则待核实"></textarea></label><label>接收系统或平台<input name="routing.destination" maxlength="220" placeholder="没有或待核实均可留空"></label></section>'+
'<section class="lk-wiring-form-group"><h4>③ 数据看板可消费的数据源</h4><p>可以关联多张订单、EDI、轨迹或其他表；不是马上连数据库。仅声明表、关联键及消费字段。</p><div id="lkWiringSources"></div><button type="button" class="lk-wiring-add-source" id="lkWiringAddSource">＋ 数据源 / 表</button></section>'+
'<section class="lk-wiring-form-group"><h4>④ 指标规则、SLA 与数据看板</h4><label>指标名称<input name="metric.name" maxlength="180"></label><label>计算口径 / 规则<textarea name="metric.formula" maxlength="500" rows="2"></textarea></label><label>时间维度 / 字段<input name="metric.timeField" maxlength="180"></label><label>SLA 目标值<input name="metric.slaTarget" maxlength="180"></label><label>数据看板名称或入口<input name="metric.dashboard" maxlength="180"></label></section>'+
'<section class="lk-wiring-form-group"><h4>⑤ 任务 / 异常处理看板</h4><label>任务看板或工单入口<input name="task.board" maxlength="180"></label><label>任务触发条件<textarea name="task.condition" rows="2" maxlength="500"></textarea></label><label>责任人 / 角色<input name="task.owner" maxlength="180"></label><label>触发后的动作<textarea name="task.action" rows="2" maxlength="360"></textarea></label></section>'+
'<div class="lk-dialog-actions"><button type="button" id="lkWiringCancel">取消</button><button type="submit" class="lk-primary">保存此节点配置</button></div></form></dialog>'+'<dialog id="lkQuickDetailDialog" class="lk-dialog lk-quick-detail-dialog" aria-label="操作模块详情"><div class="lk-quick-bar"><strong>操作模块详情</strong><button type="button" id="lkQuickClose" aria-label="关闭详情">关闭 ×</button></div><div id="lkQuickReadOnly" class="lk-quick-lock-note" hidden>当前已锁定，解锁后可以修改名称、内容或删除。<button type="button" id="lkQuickUnlock">解锁编辑</button></div><article id="lkQuickDetailBody" class="lk-detail"></article></dialog>'+
    '<dialog id="lkRenameNodeDialog" class="lk-dialog lk-rename-dialog" aria-label="修改操作模块名称"><form id="lkRenameNodeForm"><h3>编辑小模块名称</h3><label>操作名称<input id="lkRenameNodeName" type="text" maxlength="70" required placeholder="例如：安检扫描"></label><p class="lk-footnote">只修改名称，保留操作 ID、备注、轨迹事件码及所有流程连线。</p><div class="lk-dialog-actions"><button type="button" id="lkRenameNodeCancel">取消</button><button type="submit" class="lk-primary">保存名称</button></div></form></dialog>';
  const makeId=prefix=>prefix+'_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  function renderModules(){
    const host=$('lkModules');
    // Preserve what the user expanded during any canvas repaint without
    // writing transient presentation state into the logistics document.
    const expanded=new Map([...host.querySelectorAll('.lk-trunk-route')]
      .map(lane=>[lane.dataset.transportMode,lane.open]));
    host.replaceChildren();
    const family=node('section',undefined,'lk-trunk-family');
    family.append(node('h3','干线 · 三条运输线','lk-trunk-title'));
    const grid=node('div',undefined,'lk-trunk-grid');
    const lanes=new Map();
    mini.ORDER.forEach(mode=>{
      const lane=node('details',undefined,'lk-trunk-route');lane.dataset.transportMode=mode;
      lane.open=expanded.has(mode)?expanded.get(mode):mode==='road';
      const toggle=node('summary',undefined,'lk-trunk-route-toggle');
      toggle.append(node('h4',mini.LABELS[mode]+'干线','lk-trunk-route-title'));
      const body=node('div',undefined,'lk-trunk-route-body');
      lane.append(toggle,body);
      grid.append(lane);lanes.set(mode,body);
    });
    family.append(grid);
    let familyInserted=false;
    state.modules.forEach((m,index)=>{
      const card=node('section',undefined,'lk-module lk-canvas-block'+(m.id===moduleId?' is-active':'')+(!m.enabled?' is-muted':''));
      card.dataset.module=m.id;
      const head=node('div',undefined,'lk-canvas-block-head');
      head.draggable=!blocked&&!locked;head.dataset.dragModule=m.id;head.title='拖动整个标题区调整模块顺序';
      const grip=button('⠿','noop','lk-drag-handle',blocked||locked);grip.draggable=false;grip.title='拖动标题区改变模块顺序';grip.setAttribute('aria-label','拖动'+m.name);
      const main=button(m.name,'select-module','lk-module-main');main.dataset.id=m.id;
      main.prepend(node('small',m.category+(m.category==='干'&&setup.infer(m)?' · '+setup.MODES[setup.infer(m)]:'')+' / '+m.nodes.length+' 个操作节点'));
      const controls=node('div',undefined,'lk-canvas-controls');
      card.style.setProperty('--lk-module-accent',flow.moduleColor(m));
      const colorLabel=node('label','颜色','lk-module-color');
      const colorInput=document.createElement('input');colorInput.type='color';colorInput.value=flow.moduleColor(m);
      colorInput.dataset.colorModule=m.id;colorInput.disabled=blocked||locked;
      colorInput.setAttribute('aria-label','设置'+m.name+'模块颜色');colorLabel.prepend(colorInput);
      const colorReset=button('默认色','color-reset-module','lk-move',blocked||locked||!m.color);
      colorReset.dataset.id=m.id;
      const fold=button(m.collapsed?'展开':'收起','collapse-module','lk-fold',blocked||locked);fold.dataset.id=m.id;
      fold.setAttribute('aria-expanded',String(!m.collapsed));fold.setAttribute('aria-label',(m.collapsed?'展开':'收起')+m.name);
      const rename=button('改名','module-rename','lk-control',blocked||locked);rename.dataset.id=m.id;
      const remove=button('删除','module-delete','lk-danger',blocked||locked);remove.dataset.id=m.id;
      const add=button('＋ 操作','add-here','lk-block-add',blocked||locked||!m.enabled);add.dataset.id=m.id;
      const toggle=node('label','启用','lk-toggle');const check=document.createElement('input');
      check.type='checkbox';check.checked=m.enabled;check.disabled=blocked||locked;check.dataset.toggle=m.id;toggle.prepend(check);
      // Only a small route-to-tool link remains on the canvas; actual setup
      // editing happens in the independent base-data tool tab.
      controls.append(colorLabel,colorReset,add,rename,remove,fold,toggle);head.append(grip,main,controls);card.append(head);
      const prereqItems=setup.list(m);
      const prereq=node('details',undefined,'lk-setup-summary');
      const summary=node('summary','前置配置 · '+prereqItems.filter(x=>x.role==='prerequisite').length+' 项条件','lk-setup-summary-head');
      prereq.append(summary);
      if(prereqItems.length){
        const list=node('div',undefined,'lk-setup-badges');
        prereqItems.forEach(item=>list.append(node('span',(item.role==='reference'?'记录：':'')+item.name+' · '+(item.value||'待配置'),'lk-setup-badge')));
        prereq.append(list);
      }else prereq.append(node('p','尚未设置，可解锁后添加。','lk-form-hint'));
      // Basic configuration is a separate tool rather than an operation step.
      // Keep a compact link and never insert configuration cards into the flow.
      prereq.remove();
      const configLink=button('基础资料 '+prereqItems.length+' 项','setup-go','lk-config-link');
      configLink.dataset.id=m.id;card.append(configLink);
      if(!m.collapsed&&m.enabled){
        const lane=node('div',undefined,'lk-canvas-lane');lane.dataset.dropModule=m.id;
        if(!m.nodes.length)lane.append(node('p','此模块没有操作，点击「＋ 操作」添加。','lk-empty'));
        m.nodes.forEach((n,i)=>{
          const wrap=node('div',undefined,'lk-step');wrap.draggable=!blocked&&!locked;wrap.dataset.dragNode=n.id;wrap.dataset.dragFrom=m.id;
          const step=button('', 'select-node','lk-node lk-canvas-op'+(n.id===selectedId&&m.id===moduleId?' is-current':''));step.dataset.id=n.id;step.dataset.module=m.id;
          step.append(node('small',String(i+1).padStart(2,'0')),node('strong',n.title));
          if(n.color)wrap.style.setProperty('--lk-node-accent',flow.color(n.color,'#222222'));
          wrap.append(step);lane.append(wrap);
        });
        const drop=node('div','拖动操作块到这里追加','lk-drop-end');drop.dataset.dropModule=m.id;lane.append(drop);
        card.append(lane);
      }else if(!m.enabled){
        card.append(node('p','模块已停用，操作内容保留；重新启用即可展开。','lk-folded-caption'));
      }else{
        card.append(node('p',m.nodes.length+' 个操作已折叠，展开后继续编排。','lk-folded-caption'));
      }
      const transport=setup.infer(m);
      if(m.category==='干'&&transport){
        if(!familyInserted){host.append(family);familyInserted=true;}
        lanes.get(transport).append(card);
      }else host.append(card);
    });
    if(!familyInserted)host.append(family);
    mini.ORDER.forEach(mode=>{
      if(!lanes.get(mode).querySelector('.lk-canvas-block')){
        const placeholder=node('div',undefined,'lk-trunk-empty');
        placeholder.append(node('p','暂无'+mini.LABELS[mode]+'业务流程'));
        const create=button('＋ 新建'+mini.LABELS[mode]+'干线','add-linehaul-mode','lk-trunk-add',blocked||locked);
        create.dataset.mode=mode;placeholder.append(create);lanes.get(mode).append(placeholder);
      }
    });
    window.LambertLogisticsStageView?.renderStageLane(host,state,blocked||locked);
  }
  function renderSearch(){
    const host=$('lkSearchResults');host.replaceChildren();
    $('lkSearch').value=searchTerm;
    if(!searchTerm.trim())return;
    const results=editor.tags(state,searchTerm).slice(0,80);
    host.append(node('span','匹配 '+results.length+(results.length===80?'+' :'')+' 个操作：','lk-search-count'));
    results.forEach(item=>{
      const b=button(item.module+' / '+item.title+(item.tags.length?'  #'+item.tags.join(' #'):''),
        'search-open','lk-search-item');
      b.dataset.module=item.moduleId;b.dataset.id=item.nodeId;host.append(b);
    });
    if(!results.length)host.append(node('span','没有找到匹配操作','lk-empty'));
  }
  function renderTrash(){
    const host=$('lkTrashList');host.replaceChildren();
    const entries=Array.isArray(state.trash)?state.trash:[];
    $('lkTrashCount').textContent=String(entries.length);
    if(!entries.length){host.append(node('p','当前没有已删除的模块或操作。','lk-empty'));return;}
    entries.slice().reverse().forEach(item=>{
      const row=node('div',undefined,'lk-trash-row');
      const names={module:'大模块',stage:'中模块',node:'小操作'};
      const summary=node('span',(names[item.type]||'模块')+' · '+(item.item?.name||item.item?.title||item.id),'lk-trash-title');
      const b=button('恢复','trash-restore','lk-control',blocked||locked);
      b.dataset.id=item.id;row.append(summary,b);host.append(row);
    });
  }
  function renderNodes(){
    const m=current();
    $('lkNodeTitle').textContent=m?m.name+' · 操作详情':'操作详情';
    $('lkAddNode').disabled=blocked||locked||!m||!m.enabled;
  }
  function field(title,text){
    const card=node('section',undefined,'lk-detail-field');
    card.append(node('h4',title),node('p',text||'尚未补充，待核实。'));return card;
  }
  function renderWiring(m,n){
    const snapshot=wiring.read(n),status=wiring.progress(n);
    const box=node('section',undefined,'lk-infra-node');
    const head=node('div',undefined,'lk-infra-head');
    head.append(node('h4','信息流 → 表 → SLA → 任务 · '+(status.invalid?'需检查旧数据':status.count+'/5 层已配置')));
    const edit=button('配置此节点连接','wiring-edit','lk-wiring-edit',blocked||locked||status.invalid);
    edit.dataset.module=m.id;edit.dataset.id=n.id;head.append(edit);box.append(head);
    box.append(node('p','业务操作与信息交换分开：无对外推送仍可记录内部日志与数据库记录。以下是配置资料，不会产生真实推送、计算指标或创建任务。','lk-infra-note'));
    if(status.invalid){
      box.append(node('p','该节点保留了无法识别的历史配置信息。编辑已禁止，请先导出备份核实，未覆盖原始数据。','lk-infra-unset'));return box;
    }
    const cards=node('div',undefined,'lk-infra-cards');
    const card=(title,rows,configured)=>{
      const c=node('div',undefined,'lk-infra-card');
      c.append(node('strong',title));
      if(!rows.length)c.append(node('p','待配置','lk-infra-unset'));
      else rows.forEach(row=>c.append(node('p',row,'lk-infra-configured')));
      cards.append(c);
    };
    const r=snapshot;
    const list=(obj,names)=>Object.entries(names).filter(([key])=>obj[key]).map(([key,label])=>label+'：'+obj[key]);
    card('① 内部事件 / 日志 / 记录表',list(r.trace,{event:'事件',eventCode:'内部码',logLocation:'日志',recordTable:'记录表',recordKey:'关联键'}));
    const statusLabel={unknown:'',internal:'仅内部留痕 · 不对外推送',conditional:'按条件对外推送',external:'对外推送（需证据）'};
    card('② 推送判断',[
      ...(statusLabel[r.routing.policy]?[statusLabel[r.routing.policy]]:[]),
      ...list(r.routing,{rule:'规则',destination:'接收方'})
    ]);
    card('③ 数据来源 / 表',r.sources.map(x=>(x.kind||'其他')+' · '+x.table+(x.joinKey?'（键：'+x.joinKey+'）':'')+(x.fields?' · '+x.fields:'')));
    card('④ 指标 / SLA / 数据看板',list(r.metric,{name:'指标',formula:'计算口径',timeField:'时间字段',slaTarget:'目标',dashboard:'看板'}));
    card('⑤ 任务看板 / 异常处理',list(r.task,{board:'任务入口',condition:'触发条件',owner:'责任角色',action:'处理动作'}));
    box.append(cards);return box;
  }
  function renderDetail(){
    const host=$('lkDetail');host.replaceChildren();
    const m=current(),n=m?.enabled?selected():null;
    if(!n){host.append(node('p','在上方画布点击一个操作块，即可查看业务动作、系统关系和数据。','lk-empty'));return;}
    const header=node('div',undefined,'lk-detail-head');
    const title=node('div');const group=stages.stages(m).find(x=>x.id===stages.stageFor(m,n));title.append(node('small',m.category+' / '+m.name+' / '+(group?.name||'操作流程')),node('h3',n.title));
    const actions=node('div',undefined,'lk-node-quick-actions');
    const rename=button('编辑名称','rename-node','lk-edit-name',blocked||locked);
    rename.dataset.id=n.id;rename.dataset.module=m.id;
    const edit=button('编辑内容','edit-node','lk-edit',blocked||locked);
    edit.dataset.id=n.id;edit.dataset.module=m.id;
    const del=button('删除模块','node-delete','lk-danger',blocked||locked);
    del.dataset.id=n.id;del.dataset.module=m.id;
    actions.append(rename,edit,del);
    header.append(title,actions);host.append(header);
    host.append(node('p','先研究单节点：进入条件 → 执行角色/输入 → 操作动作 → 触发结果，再核对分支和上下游。未填写的规则不能视为已确认。','lk-node-focus'));
    host.append(field('进入条件 / 何时开始',n.entryCondition||'尚未核实进入条件'));
    host.append(field('执行角色 / 系统',n.executor||'尚未核实执行人或系统'));
    host.append(field('所需输入 / 操作对象',n.operationInput||'尚未核实所需输入'));
    host.append(field('操作说明 / 如何执行',n.action||'暂无说明'));
    const outcomes=triggerApi.triggers(n);
    const triggerSection=node('section',undefined,'lk-trigger-summary');
    triggerSection.append(node('h4','触发结果'));
    if(outcomes.length){
      const list=document.createElement('ul');list.className='lk-trigger-list';
      outcomes.forEach(t=>list.append(node('li',t.description)));
      triggerSection.append(list);
    }else triggerSection.append(node('p','此旧节点尚未整理触发结果，可在编辑内容中补充。','lk-form-hint'));
    host.append(triggerSection);
    host.append(renderWiring(m,n));
    host.append(field('研究依据 / 待核实问题',n.researchBasis||'尚未记录证据；节点顺序和路径需用真实 SOP / 系统记录核实'));
    const exchangeBox=node('section',undefined,'lk-exchange');
    const exchangeHead=node('div',undefined,'lk-exchange-head');
    exchangeHead.append(node('h4','信息交换 · 系统时序'));
    const addExchange=button('＋ 记录交互','exchange-add','lk-exchange-add',blocked||locked);
    addExchange.dataset.module=m.id;addExchange.dataset.id=n.id;
    exchangeHead.append(addExchange);exchangeBox.append(exchangeHead);
    const items=Array.isArray(n.exchanges)?n.exchanges:[];
    if(items.length){
      items.forEach(item=>{
        const row=node('div',undefined,'lk-exchange-item');
        row.append(node('strong',item.source||'未知'),node('span','→'),node('strong',item.target||'未知'),node('span',item.message||''));
        if(item.note)row.append(node('small',item.note));
        const del=button('移除','exchange-remove','',blocked||locked);
        del.dataset.id=item.id;del.dataset.module=m.id;del.dataset.node=n.id;row.append(del);exchangeBox.append(row);
      });
    }else exchangeBox.append(node('p','尚无信息交换记录，业务分支与信息交换是不同的两种关系。','lk-form-hint'));
    host.append(exchangeBox);
    if(n.note)host.append(field('备注',n.note));
    const tags=node('div',undefined,'lk-node-chips');
    (n.tags||[]).forEach(tag=>tags.append(node('span','#'+tag,'lk-node-chip')));
    (n.operationCodes||[]).forEach(code=>tags.append(node('span','操作码 '+code,'lk-code-chip')));
    host.append(tags);
    const codes=(n.eventRefs||[]).length?(n.eventRefs||[]).map(x=>x.code||x.id).filter(Boolean):(n.operationCodes||[]);
    if(codes.length)host.append(field('关联码（旧记录／待字典确认）',codes.join('、')));
    const legacy=[n.information,n.data,n.evidence].filter(v=>typeof v==='string'&&v.trim());
    if(legacy.length){
      const more=document.createElement('details');more.className='lk-related-details';
      more.append(node('summary','查看历史字段（原样保留）'));
      if(n.information)more.append(field('原信息传递记录',n.information));
      if(n.data)more.append(field('原数据字段记录',n.data));
      if(n.evidence)more.append(field('原证据或研究记录',n.evidence));
      host.append(more);
    }
    // Keep the distinction between displayed sequence and confirmed edges.
    const context=mini.operationContext(m,n.id,stages.stageFor);
    const graphBox=node('section',undefined,'lk-node-context');
    graphBox.append(node('h4','业务路径 / 上下游研究'));
    graphBox.append(node('p','操作排序不等于真实触发或信息传输；只有下列已录入的分支边明确表达条件关系。','lk-context-caution'));
    const jump=(target,label)=>{
      const link=button(label,'select-node','lk-context-jump');
      link.dataset.module=m.id;link.dataset.id=target.id;return link;
    };
    const orderBox=node('div',undefined,'lk-context-group');
    orderBox.append(node('h5','① 同子环节正常排列 · 仅研究参考'));
    if(context?.branchOnly){
      orderBox.append(node('p','这是仅通过分支到达的操作，不属于默认主线排列。','lk-branch-hint'));
    }else{
      const pair=node('div',undefined,'lk-context-pair');
      const before=node('div',undefined,'lk-context-step');
      before.append(node('small','前序显示操作'));
      before.append(context?.previous?jump(context.previous,context.previous.title):node('span','本子环节无前一操作'));
      const after=node('div',undefined,'lk-context-step');
      after.append(node('small','后序显示操作'));
      after.append(context?.next?jump(context.next,context.next.title):node('span','本子环节无后一操作'));
      pair.append(before,after);orderBox.append(pair);
    }
    graphBox.append(orderBox);
    const paths=(heading,items,incoming)=>{
      const group=node('div',undefined,'lk-context-group');
      group.append(node('h5',heading));
      if(!items?.length)group.append(node('p','尚未记录对应的条件关联。','lk-branch-hint'));
      (items||[]).forEach(link=>{
        const row=node('div',undefined,'lk-related-edge '+(link.type==='exception'?'lk-context-exception':'lk-context-normal'));
        const tag=node('span',link.type==='exception'?'异常':'条件分支','lk-context-type');
        const peer=incoming?link.from:link.to;
        row.append(tag,jump(peer,peer.title),node('span','条件：'+(link.edge.label||'未填写')));
        if(!incoming){
          const remove=button('移除连线','branch-remove','lk-branch-remove',blocked||locked);
          remove.dataset.id=link.edge.id;remove.dataset.module=m.id;row.append(remove);
        }
        group.append(row);
      });return group;
    };
    graphBox.append(paths('② 进入本节点的条件 / 异常',context?.incoming,true));
    graphBox.append(paths('③ 离开本节点的条件 / 异常',context?.outgoing,false));
    graphBox.append(node('p','跨子环节、跨模块的真实正常流转尚需核实；这里不会凭画布顺序推断 EDI、轨迹或 SLA。新增分支请使用节点旁的「＋」。','lk-branch-hint'));
    host.append(graphBox);
    const moveBox=node('label','移动操作到其他子环节或大模块','lk-move-to');
    const select=document.createElement('select');select.dataset.moveNode=n.id;select.dataset.moveFrom=m.id;select.disabled=blocked||locked;
    const empty=document.createElement('option');empty.value='';empty.textContent='选择目标子环节（原资料随节点保留）';select.append(empty);
    state.modules.filter(x=>x.enabled).forEach(x=>{
      stages.stages(x).forEach(stage=>{
        if(x.id===m.id&&stage.id===stages.stageFor(m,n))return;
        const o=document.createElement('option');o.value=x.id+'::'+stage.id;o.textContent=x.category+' / '+x.name+' / '+stage.name;select.append(o);
      });
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
  function renderVersionControls(){
    if(!releaseRecord)return;
    const v=releaseRecord.published,hasDraft=!!releaseRecord.draft;
    $('lkEditStatus').textContent=blocked?'版本损坏 · 只读':locked
      ?'已锁定 · 已发布 V'+v.number+(hasDraft?' · 有保存的草稿':'')
      :'草稿编辑中 · '+(dirty?'存在未保存更改':hasDraft?'已保存草稿':'尚未保存');
    $('lkUnlock').disabled=blocked||!locked;
    $('lkUnlock').textContent=hasDraft?'解锁并继续草稿':'解锁编辑';
    $('lkSaveDraft').disabled=blocked||locked||!dirty;
    $('lkPublish').disabled=blocked||locked||dirty||!hasDraft;
    $('lkCancelEdit').disabled=locked;
    const select=$('lkHistorySelect'),old=select.value;
    select.replaceChildren();
    const blank=document.createElement('option');blank.value='';blank.textContent='选择历史版本';select.append(blank);
    releaseRecord.history.forEach((r,i)=>{
      const o=document.createElement('option');o.value=String(i);
      o.textContent='V'+r.number+' · '+(r.time?r.time.slice(0,10):'原始基线');
      select.append(o);
    });
    select.value=old&&[...select.options].some(o=>o.value===old)?old:'';
    select.disabled=blocked||!locked||!releaseRecord.history.length;
    $('lkRollback').disabled=blocked||!locked||!select.value;
    root.querySelector('.lk-route').textContent=v.data.route||'物流路线';
  }
  function renderSetupTool(){
    const host=$('lkSetupLibrary');host.replaceChildren();
    const build=(m,stage)=>{
      const section=node('section',undefined,'lk-config-section');
      const title=stage?m.name+' / '+stage.name:m.name;
      section.append(node('h4',title));
      const records=setup.list(stage||m);
      const line=node('div',undefined,'lk-config-records');
      records.forEach(record=>{
        const row=node('div',undefined,'lk-config-record');
        row.append(node('strong',record.name));
        row.append(node('span',record.value||'待配置'));
        if(record.role==='reference')row.append(node('small','关联记录'));
        line.append(row);
      });
      if(!records.length)line.append(node('p','暂无基础资料','lk-form-hint'));
      section.append(line);
      const b=button('编辑配置','setup-'+(stage?'stage':'module'),'lk-config-edit',blocked||locked);
      b.dataset.module=m.id;if(stage)b.dataset.stage=stage.id;else b.dataset.id=m.id;
      section.append(b);host.append(section);
    };
    state.modules.forEach(m=>{
      const group=node('div',undefined,'lk-config-module');
      const label=m.category==='干'?('干线 · '+(setup.MODES[setup.infer(m)]||'未分类')):m.category;
      const heading=node('h3',label+' / '+m.name);
      group.append(heading);host.append(group);
      build(m,null);
      stages.stages(m).filter(stage=>!stage.virtual).forEach(stage=>build(m,stage));
    });
  }
  function render(){
    if(!moduleId||!current())moduleId=state.modules[0]?.id||'';
    findSelected();
    $('lkOverview').hidden=tab!=='overview';$('lkProcess').hidden=tab!=='process';$('lkData').hidden=tab!=='data';$('lkSetupTool').hidden=tab!=='setup';
    $('lkTabOverview').setAttribute('aria-selected',String(tab==='overview'));
    $('lkTabProcess').setAttribute('aria-selected',String(tab==='process'));$('lkTabData').setAttribute('aria-selected',String(tab==='data'));$('lkTabSetup').setAttribute('aria-selected',String(tab==='setup'));
    $('lkAddModule').disabled=blocked||locked;$('lkAddNode').disabled=blocked||locked;$('lkExport').disabled=blocked;
    root.querySelectorAll('[data-action="add-linehaul-mode"]').forEach(control=>{control.disabled=blocked||locked;});
    renderVersionControls();
    if(tab==='process'){renderModules();renderNodes();renderDetail();renderSearch();renderTrash();syncQuickDetail();}
    else if(tab==='overview'){
      $('lkModeMacro').setAttribute('aria-pressed',String(overviewMode==='macro'));
      $('lkModeDetail').setAttribute('aria-pressed',String(overviewMode==='detail'));
      overview.render($('lkOverviewContent'),releaseRecord.published,overviewMode,(mId,nId)=>{
        moduleId=mId;selectedId=nId||'';tab='process';render();
        if(nId)showQuickDetail();
      });
    }else if(tab==='setup')renderSetupTool();
    else renderData();
  }
  function syncQuickDetail(){
    const dialog=$('lkQuickDetailDialog');
    if(!dialog.open)return;
    const m=current(),n=m?.nodes.find(item=>item.id===selectedId);
    if(!n){dialog.close();return;}
    const body=$('lkQuickDetailBody');
    body.replaceChildren(...Array.from($('lkDetail').cloneNode(true).childNodes));
    $('lkQuickReadOnly').hidden=!locked||blocked;
    $('lkQuickUnlock').disabled=blocked;
  }
  function showQuickDetail(){
    const m=current(),n=m?.nodes.find(item=>item.id===selectedId);
    if(!n)return;
    const dialog=$('lkQuickDetailDialog');
    if(!dialog.open)dialog.showModal();
    syncQuickDetail();
  }
  function closeQuickDetail(){
    const dialog=$('lkQuickDetailDialog');
    if(dialog.open)dialog.close();
  }
  function openRenameNode(module,key){
    if(blocked||locked)return;
    const m=state.modules.find(x=>x.id===module),n=m?.nodes.find(x=>x.id===key);
    if(!n)return;
    renameModuleId=module;renameNodeId=key;
    returnQuickAfterEdit=$('lkQuickDetailDialog').open;
    closeQuickDetail();
    $('lkRenameNodeName').value=n.title;
    $('lkRenameNodeDialog').showModal();
    $('lkRenameNodeName').focus();
    $('lkRenameNodeName').select();
  }
    function appendTriggerRow(description='',id=makeId('trigger')){
    const container=$('lkTriggerRows');
    if(container.children.length>=25){setMessage('一个操作最多配置 25 项触发结果。');return;}
    const row=node('div',undefined,'lk-trigger-row');row.dataset.triggerId=id;
    const input=document.createElement('input');input.type='text';input.maxLength=500;
    input.placeholder='例如：登记上车状态，产生内部装车事件';input.value=description;
    input.setAttribute('aria-label','触发结果内容');
    const remove=button('移除','trigger-row-delete','lk-trigger-row-delete');
    row.append(input,remove);container.append(row);
  }
  function readTriggerRows(){
    return [...$('lkTriggerRows').querySelectorAll('.lk-trigger-row')].map(el=>({
      id:el.dataset.triggerId,description:el.querySelector('input').value.trim()
    })).filter(x=>x.description);
  }
  $('lkAddTrigger').onclick=()=>appendTriggerRow();
  function appendWiringSource(source={}){
    const host=$('lkWiringSources');
    if(host.children.length>=12){setMessage('一个节点最多记录 12 个数据源。');return;}
    const row=node('div',undefined,'lk-wiring-source-row');
    row.dataset.sourceId=source.id||makeId('datasrc');
    const labelInput=(title,value,max,field)=>{
      const label=node('label',title);
      const input=document.createElement('input');input.type='text';
      input.maxLength=max;input.value=value||'';input.dataset.wiringSource=field;
      label.append(input);row.append(label);return input;
    };
    const kindLabel=node('label','数据域类型');
    const kind=document.createElement('select');kind.dataset.wiringSource='kind';
    wiring.KINDS.forEach(key=>{
      const o=document.createElement('option');o.value=key;o.textContent=key;kind.append(o);
    });kind.value=wiring.KINDS.includes(source.kind)?source.kind:'其他';
    kindLabel.append(kind);row.append(kindLabel);
    const table=labelInput('真实表名 / 数据集',source.table,180,'table');
    table.required=true;
    labelInput('关联键',source.joinKey,180,'joinKey');
    labelInput('消费字段 / 备注',source.fields,500,'fields');
    const remove=button('移除这条来源','wiring-remove-source','lk-wiring-remove-source');
    row.append(remove);host.append(row);
  }
  function wiringInput(){
    const form=$('lkWiringForm');
    const field=name=>form.querySelector('[name="'+name+'"]')?.value.trim()||'';
    const group=(section,keys)=>Object.fromEntries(keys.map(k=>[k,field(section+'.'+k)]));
    const sources=[...$('lkWiringSources').children].map(row=>{
      const get=k=>row.querySelector('[data-wiring-source="'+k+'"]')?.value.trim()||'';
      return {id:row.dataset.sourceId,kind:get('kind'),table:get('table'),joinKey:get('joinKey'),fields:get('fields')};
    });
    return {trace:group('trace',['event','eventCode','logLocation','recordTable','recordKey']),
      routing:{...group('routing',['rule','destination']),policy:field('routing.policy')},
      sources,metric:group('metric',['name','formula','timeField','slaTarget','dashboard']),
      task:group('task',['board','condition','owner','action'])};
  }
  function openWiring(mid,nid){
    if(blocked||locked){setMessage('当前是只读模式，请先解锁编辑。');return;}
    const n=state.modules.find(m=>m.id===mid)?.nodes.find(x=>x.id===nid);
    if(!n)return;
    const saved=wiring.read(n);
    if(saved.invalid){setMessage('节点存在异常历史配置，为防止覆盖已禁止编辑，请先导出备份。');return;}
    wiringModuleId=mid;wiringNodeId=nid;
    wiringReturnQuick=$('lkQuickDetailDialog').open;
    closeQuickDetail();
    const form=$('lkWiringForm');
    const fill=(prefix,values)=>Object.entries(values).forEach(([key,val])=>{
      const input=form.querySelector('[name="'+prefix+'.'+key+'"]');
      if(input)input.value=typeof val==='string'?val:'';
    });
    fill('trace',saved.trace);fill('routing',saved.routing);
    fill('metric',saved.metric);fill('task',saved.task);
    form.querySelector('[name="routing.policy"]').value=wiring.POLICIES.includes(saved.routing.policy)?saved.routing.policy:'unknown';
    $('lkWiringSources').replaceChildren();
    saved.sources.forEach(appendWiringSource);
    $('lkWiringDialog').showModal();
  }
  function closeWiring(){
    $('lkWiringDialog').close();
    if(wiringReturnQuick)showQuickDetail();
    wiringReturnQuick=false;
  }
  $('lkWiringCancel').onclick=closeWiring;
  $('lkWiringDialog').addEventListener('cancel',event=>{event.preventDefault();closeWiring();});
  $('lkWiringAddSource').onclick=()=>appendWiringSource();
  $('lkWiringForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(blocked||locked)return;
    const input=wiringInput(),module=wiringModuleId,id=wiringNodeId;
    if(mutate(next=>wiring.update(next,module,id,input))){
      $('lkWiringDialog').close();
      moduleId=module;selectedId=id;render();
      if(wiringReturnQuick)showQuickDetail();
      wiringReturnQuick=false;
      setMessage('节点信息/数据/SLA/任务连接已加入未保存草稿；未执行外部推送、数据库写入或任务创建。');
    }else setMessage('连接配置未更新：请检查必填表名、字段长度、旧格式或重复项。');
  });
  function openEditor(edit){
    if(blocked||locked)return;
    returnQuickAfterEdit=$('lkQuickDetailDialog').open;
    closeQuickDetail();
    const n=edit?selected():null;
    editorMode=n?'edit':'new';
    $('lkEditorTitle').textContent=n?'编辑操作':'新增操作';
    $('lkTitleInput').value=n?.title||'';
    $('lkActionInput').value=n?.action||'';
    $('lkEntryCondition').value=n?.entryCondition||'';
    $('lkExecutor').value=n?.executor||'';
    $('lkOperationInput').value=n?.operationInput||'';
    $('lkResearchBasis').value=n?.researchBasis||'';
    $('lkNoteInput').value=n?.note||'';
    $('lkTagsInput').value=(n?.tags||[]).join(', ');
    $('lkNodeColor').value=n?.color||'#FFFFFF';
    $('lkNodeNoColor').checked=!n?.color;
    $('lkTriggerRows').replaceChildren();
    triggerApi.triggers(n).forEach(t=>appendTriggerRow(t.description,t.id));
    if(!triggerApi.triggers(n).length)appendTriggerRow();
    const oldCodes=(n?.operationCodes||[]).join('、');
    $('lkExistingCodes').textContent=oldCodes?'保留的旧码值：'+oldCodes+'（未建立新映射）':'';
    $('lkEventSearch').disabled=true;
    $('lkEventHint').textContent='码表待导入：收到真实操作码表后，才能启用事件码／轨迹描述搜索并建立关联。';
    $('lkNodeDialog').showModal();
  }
  function mutate(fn){
    if(blocked||locked){setMessage('当前为锁定或只读状态，修改未生效。');return false;}
    const next=copy(state);
    if(fn(next)===false)return false;
    if(!persist(next))return false;
    render();return true;
  }
  function openBranchDialog(sourceId,stageId,chosenType='exception'){
    if(blocked||locked)return;
    const m=current();if(!m?.enabled||!m.nodes.length)return;
    branchSourceId=sourceId&&m.nodes.some(n=>n.id===sourceId)?sourceId:m.nodes.find(n=>stages.stageFor(m,n)===stageId)?.id||m.nodes[0].id;
    const source=$('lkBranchSource');source.replaceChildren();
    m.nodes.filter(n=>!stageId||stages.stageFor(m,n)===stageId).forEach(n=>{
      const o=document.createElement('option');o.value=n.id;o.textContent=n.title;source.append(o);
    });
    if(![...source.options].some(o=>o.value===branchSourceId)){
      const n=m.nodes.find(n=>n.id===branchSourceId);
      if(n){const o=document.createElement('option');o.value=n.id;o.textContent=n.title;source.append(o);}
    }
    source.value=branchSourceId;
    $('lkBranchLabel').value=chosenType==='branch'?'条件分支':'异常';
    $('lkBranchType').value=chosenType; $('lkBranchOnly').checked=true;
    $('lkBranchDialog').querySelector('h3').textContent=chosenType==='branch'?'新增分支流程':'新增异常流程';
    $('lkBranchNewTitle').value='';
    const target=$('lkBranchTarget');target.replaceChildren();
    const empty=document.createElement('option');empty.value='';empty.textContent='选择分支目标';target.append(empty);
    const newOption=document.createElement('option');newOption.value='__new__';newOption.textContent='＋ 新建分支／异常操作';target.append(newOption);
    m.nodes.filter(n=>n.id!==branchSourceId).forEach(n=>{
      const o=document.createElement('option');o.value=n.id;
      const sg=stages.stages(m).find(x=>x.id===stages.stageFor(m,n));
      o.textContent=(sg?.name||'操作流程')+' / '+n.title;target.append(o);
    });
    target.value='__new__';$('lkBranchDialog').showModal();
  }
  function removeWithWarning(type,mId,itemId){
    if(blocked||locked)return;
    const impact=editor.impact(state,type,mId,itemId,stages.stageFor);
    if(!impact)return;
    const message='确定将「'+impact.title+'」移入回收站？\\n影响：'+impact.nodes+' 个操作、'+impact.edges+' 条关联。\\n删除仅进入当前草稿，发布后才影响全链路；可以从回收站恢复。';
    if(!window.confirm(message))return;
    const trashId=makeId('trash');
    if(mutate(next=>editor.remove(next,type,mId,itemId,trashId))){
      closeQuickDetail();
      if(type==='module'||type==='stage'){selectedId='';activeStageId='';}
      render();setMessage('已移入草稿回收站。保存草稿后才落盘，发布后才影响全链路。');
    }
  }
  function addSetupRow(item){
    const row=node('div',undefined,'lk-setup-row');row.dataset.setupId=item?.id||makeId('setup');
    const name=document.createElement('input');name.type='text';name.maxLength=70;name.required=true;name.value=item?.name||'';name.placeholder='配置项名称：如机场管理';name.setAttribute('aria-label','前置配置名称');
    const value=document.createElement('input');value.type='text';value.maxLength=350;value.value=item?.value||'';value.placeholder='配置值：如目的机场（可留空）';value.setAttribute('aria-label','前置配置值');
    const note=document.createElement('input');note.type='text';note.maxLength=650;note.value=item?.note||'';note.placeholder='说明 / 注意事项（选填）';note.setAttribute('aria-label','前置配置说明');
    const role=document.createElement('select');role.setAttribute('aria-label','配置项角色');
    [['prerequisite','前置条件'],['reference','关联记录']].forEach(([key,label])=>{const option=new Option(label,key);role.append(option);});
    role.value=item?.role==='reference'?'reference':'prerequisite';
    const remove=button('删除','setup-row-delete','lk-setup-row-delete');
    row.append(name,value,note,role,remove);$('lkSetupRows').append(row);
  }
  function openSetup(module,stageId=null){
    if(blocked||locked)return;
    const m=state.modules.find(x=>x.id===module);
    const target=setup.scope(state,module,stageId);
    if(!m||!target)return;
    setupModuleId=module;setupStageId=stageId;
    $('lkSetupTitle').textContent='前置配置 · '+m.name+(stageId?' / '+(target.name||'子环节'):'');
    $('lkSetupRows').replaceChildren();
    setup.list(target).forEach(addSetupRow);
    $('lkApplyModeSetup').hidden=!setup.infer(m);
    $('lkSetupDialog').showModal();
  }
  function collectSetupRows(){
    return [...$('lkSetupRows').querySelectorAll('.lk-setup-row')].map(row=>{
      const [name,value,note]=row.querySelectorAll('input'),role=row.querySelector('select');
      return {id:row.dataset.setupId,name:name.value.trim(),value:value.value.trim(),note:note.value.trim(),role:role.value};
    });
  }
  $('lkExchangeCancel').onclick=()=>$('lkExchangeDialog').close();
  $('lkExchangeForm').addEventListener('submit',e=>{
    e.preventDefault();
    if(blocked||locked)return;
    const exchange={id:makeId('exchange'),source:$('lkExchangeFrom').value,
      target:$('lkExchangeTo').value,message:$('lkExchangeMessage').value,note:$('lkExchangeNote').value};
    if(mutate(next=>mini.addExchange(next,exchangeModuleId,exchangeNodeId,exchange))){
      $('lkExchangeDialog').close();setMessage('信息交换已记录到草稿；它不是流程分支，发布后才生效。');
    }
  });
  $('lkAddSetup').onclick=()=>{if($('lkSetupRows').children.length<40)addSetupRow();};
  $('lkApplyModeSetup').onclick=()=>{
    const m=state.modules.find(x=>x.id===setupModuleId),mode=setup.infer(m);
    const existing=new Set([...$('lkSetupRows').querySelectorAll('input[aria-label="前置配置名称"]')].map(x=>x.value.trim()));
    for(const item of setup.preset(mode,()=>makeId('setup'))){
      if($('lkSetupRows').children.length>=40)break;
      if(!existing.has(item.name)){addSetupRow(item);existing.add(item.name);}
    }
  };
  $('lkSetupCancel').onclick=()=>$('lkSetupDialog').close();
  $('lkSetupForm').addEventListener('submit',event=>{
    event.preventDefault();
    const rows=collectSetupRows();
    if(!setup.normalize(rows)){setMessage('配置项名称不能为空或重复 ID 不允许，请检查后保存。');return;}
    if(mutate(next=>setup.update(next,setupModuleId,setupStageId,rows))){
      $('lkSetupDialog').close();setMessage('前置配置已加入草稿，保存草稿并确认发布后才更新全链路。');
    }
  });
  root.addEventListener('click',event=>{
    const b=event.target.closest('button[data-action]');
    if(!b)return;
    const type=b.dataset.action,id=b.dataset.id;
    if(type==='wiring-remove-source'){b.closest('.lk-wiring-source-row')?.remove();return;}
    if(type==='wiring-edit'){openWiring(b.dataset.module||moduleId,id);return;}
    if(type==='setup-row-delete'){b.closest('.lk-setup-row')?.remove();return;}
    if(type==='setup-go'){moduleId=id;tab='setup';render();return;}
    if(type==='setup-module'){openSetup(id||b.dataset.module);return;}
    if(type==='setup-stage'){openSetup(b.dataset.module,b.dataset.stage);return;}
    if(type==='add-linehaul-mode'){
      if(blocked||locked)return;
      const mode=b.dataset.mode,id=makeId('linehaul');
      if(mutate(next=>setup.addModeModule(next,mode,id))){moduleId=id;selectedId='';render();}
      return;
    }
    if(type==='trigger-row-delete'){
      const row=b.closest('.lk-trigger-row');
      if(row){row.remove();if(!$('lkTriggerRows').children.length)appendTriggerRow();}
      return;
    }
    if(type==='color-reset-module'||type==='color-reset-stage'){
      mutate(next=>flow.resetColor(next,type==='color-reset-module'?id:b.dataset.module,type==='color-reset-stage'?b.dataset.stage:null));return;
    }
    if(type==='exchange-add'){
      if(locked||blocked)return;
      exchangeModuleId=b.dataset.module;exchangeNodeId=id;
      $('lkExchangeFrom').value='';$('lkExchangeTo').value='';$('lkExchangeMessage').value='';$('lkExchangeNote').value='';
      $('lkExchangeDialog').showModal();return;
    }
    if(type==='exchange-remove'){
      if(locked||blocked)return;
      const parentId=b.dataset.node,mid=b.dataset.module;
      if(window.confirm('确定从当前草稿移除这条信息交换记录吗？')){
        mutate(next=>mini.removeExchange(next,mid,parentId,id));
      }
      return;
    }
    if(type==='branch-quick-choice'){
      if(blocked||locked)return;
      const mid=b.dataset.module||moduleId;
      moduleId=mid;selectedId=id;
      const op=current()?.nodes.find(n=>n.id===id);
      if(!op)return;
      openBranchDialog(id,stages.stageFor(current(),op),b.dataset.branchType);
      return;
    }
    if(type==='branch-add'){
      moduleId=b.dataset.module;selectedId=id;openBranchDialog(id,stages.stageFor(current(),selected()));return;
    }
    if(type==='stage-branch'){
      moduleId=b.dataset.module;activeStageId=b.dataset.stage;
      openBranchDialog('',b.dataset.stage);return;
    }
    if(type==='module-rename'){
      if(blocked||locked)return;
      editingModuleId=id;
      const m=state.modules.find(x=>x.id===id);
      $('lkModuleDialogTitle').textContent='修改大模块名称';
      $('lkModuleName').value=m?.name||'';
      $('lkModuleCategory').value=m?.category||'仓';
      $('lkModuleMode').value=setup.infer(m);
      $('lkModuleModeRow').hidden=m?.category!=='干';
      $('lkModuleDialog').showModal();return;
    }
    if(type==='module-delete'){removeWithWarning('module',id,'');return;}
    if(type==='stage-delete'){removeWithWarning('stage',b.dataset.module,b.dataset.stage);return;}
    if(type==='node-delete'){removeWithWarning('node',b.dataset.module,id);return;}
    if(type==='trash-restore'){
      if(mutate(next=>editor.restore(next,id))){render();setMessage('已从回收站恢复，请保存草稿。');}
      else setMessage('恢复失败：目标模块不存在、子环节未恢复或 ID 冲突。请先恢复上级模块。');
      return;
    }
    if(type==='search-open'){
      moduleId=b.dataset.module;selectedId=id;tab='process';render();
      showQuickDetail();return;
    }
    if(type==='branch-remove'){
      mutate(next=>flow.removeBranch(next,b.dataset.module,id));return;
    }
    if(type==='select-module'){moduleId=id;selectedId='';activeStageId='';tab='process';render();return;}
    if(type==='select-node'){
      moduleId=b.dataset.module||moduleId;selectedId=id;activeStageId=b.dataset.stage||'';
      tab='process';render();showQuickDetail();return;
    }
    if(type==='add-here'){moduleId=id;selectedId='';activeStageId=stages.stages(current())[0]?.id||'';render();openEditor(false);return;}
    if(type==='collapse-module'){
      mutate(next=>{const m=next.modules.find(m=>m.id===id);if(m)m.collapsed=!m.collapsed;});return;
    }
    if(type==='node-left'||type==='node-right'){
      moduleId=b.dataset.module||moduleId;selectedId=id;
      mutate(next=>stages.reorderWithinStage(next,moduleId,id,type==='node-left'?-1:1,moves));return;
    }
    if(type==='select-stage'){
      moduleId=b.dataset.module;activeStageId=b.dataset.stage;selectedId='';render();return;
    }
    if(type==='stage-add'||type==='stage-rename'){
      moduleId=b.dataset.module;editingStageId=type==='stage-rename'?b.dataset.stage:'';
      const stage=stages.stages(current()).find(x=>x.id===editingStageId);
      $('lkStageDialogTitle').textContent=editingStageId?'修改子环节名称':'添加子环节';
      $('lkStageName').value=stage?.name||'';$('lkStageDialog').showModal();return;
    }
    if(type==='stage-add-node'){
      moduleId=b.dataset.module;activeStageId=b.dataset.stage;selectedId='';render();openEditor(false);return;
    }
    if(type==='stage-left'||type==='stage-right'){
      mutate(next=>stages.reorderStage(next,b.dataset.module,b.dataset.stage,type==='stage-left'?-1:1));return;
    }
    if(type==='stage-collapse'){
      mutate(next=>{
        const m=next.modules.find(x=>x.id===b.dataset.module),stage=m?.stages?.find(x=>x.id===b.dataset.stage);
        if(!stage)return false;stage.collapsed=!stage.collapsed;
      });return;
    }
    if(type==='to-data'){closeQuickDetail();tab='data';render();return;}
    if(type==='open-node'){moduleId=b.dataset.module;selectedId=id;tab='process';render();showQuickDetail();return;}
    if(type==='rename-node'){openRenameNode(b.dataset.module||moduleId,id);return;}
    if(type==='edit-node'){moduleId=b.dataset.module||moduleId;selectedId=id;openEditor(true);return;}
    if(type==='module-up'||type==='module-down'){
      mutate(next=>{
        const index=next.modules.findIndex(m=>m.id===id);
        return moves.reorder(next.modules,index,index+(type==='module-up'?-1:1));
      });return;
    }
  });
  root.addEventListener('change',event=>{
    const picker=event.target.closest('input[data-color-module]');
    if(picker){
      const module=picker.dataset.colorModule,stage=picker.dataset.colorStage||null;
      if(!mutate(next=>flow.setColor(next,module,picker.value,stage)))render();
      return;
    }
    const selector=event.target.closest('select[data-move-node]');
    if(selector){
      const destination=selector.value,source=selector.dataset.moveFrom,id=selector.dataset.moveNode;
      if(!destination)return;
      const [to,stageId]=destination.split('::');
      const warning=crossModuleMoveWarning(source,id,to);
      if(warning){selector.value='';setMessage(warning);return;}
      if(mutate(next=>stages.moveToStage(next,source,id,to,stageId,null,moves))){
        moduleId=to;selectedId=id;activeStageId=stageId;render();
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
    if(blocked||locked)return;
    const stageGrip=event.target.closest('[data-drag-stage]');
    const grip=event.target.closest('[data-drag-module]');
    const step=event.target.closest('[data-drag-node]');
    if(stageGrip&&!stageGrip.disabled){
      dragPayload={kind:'stage',id:stageGrip.dataset.dragStage,module:stageGrip.dataset.module};
    }else if(grip){
      dragPayload={kind:'module',id:grip.dataset.dragModule};
    }else if(step){
      dragPayload={kind:'node',id:step.dataset.dragNode,from:step.dataset.dragFrom};
    }else return;
    if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','lambert-logistics');}
    event.target.classList.add('lk-dragging');
  });
  root.addEventListener('dragover',event=>{
    if(!dragPayload)return;
    let target=null;
    if(dragPayload.kind==='module')target=event.target.closest('.lk-canvas-block-head');
    else if(dragPayload.kind==='stage')target=event.target.closest('.lk-substage-head');
    else target=event.target.closest('.lk-step,.lk-drop-end,.lk-substage-body');
    if(!target)return;
    if(dragPayload.kind==='stage'&&target.closest('.lk-substage')?.dataset.module!==dragPayload.module)return;
    if(dragPayload.kind==='node'){
      const to=target.dataset.dropModule||target.dataset.dragFrom;
      if(!state.modules.find(m=>m.id===to)?.enabled)return;
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
      mutate(next=>moves.moveModule(next,active.id,target.dataset.module,after));return;
    }
    if(active.kind==='stage'){
      const target=event.target.closest('.lk-substage-head')?.closest('.lk-substage');
      if(!target||target.dataset.module!==active.module)return;
      event.preventDefault();
      const rect=target.getBoundingClientRect(),after=event.clientX>=rect.left+rect.width/2;
      mutate(next=>stages.moveStage(next,active.module,active.id,target.dataset.stageId,after));return;
    }
    const target=event.target.closest('.lk-step,.lk-drop-end,.lk-substage-body');
    if(!target)return;
    const dest=target.dataset.dropModule||target.dataset.dragFrom;
    const targetStage=target.dataset.dropStage||target.dataset.stageId;
    const m=state.modules.find(x=>x.id===dest);
    if(!m?.enabled)return;
    const stageId=targetStage||stages.stageFor(m,m.nodes.find(n=>n.id===target.dataset.dragNode));
    if(!stages.stages(m).some(x=>x.id===stageId))return;
    event.preventDefault();
    let before=null;
    if(target.classList.contains('lk-step')){
      const stageNodes=m.nodes.filter(n=>stages.stageFor(m,n)===stageId);
      const index=stageNodes.findIndex(n=>n.id===target.dataset.dragNode);
      const rect=target.getBoundingClientRect();
      if(target.closest('.lk-flow-main')?event.clientX<rect.left+rect.width/2:event.clientY<rect.top+rect.height/2)before=target.dataset.dragNode;
      else before=stageNodes[index+1]?.id||null;
    }
    const warning=crossModuleMoveWarning(active.from,active.id,dest);
    if(warning){setMessage(warning);return;}
    if(mutate(next=>stages.moveToStage(next,active.from,active.id,dest,stageId,before,moves))){
      moduleId=dest;selectedId=active.id;activeStageId=stageId;render();
    }
  });
  root.addEventListener('dragend',event=>{dragPayload=null;event.target.classList?.remove('lk-dragging');});
  $('lkSearch').oninput=event=>{searchTerm=event.target.value;renderSearch();};
  $('lkNodeColor').oninput=()=>{$('lkNodeNoColor').checked=false;};
  $('lkTabOverview').onclick=()=>{tab='overview';render();};
  $('lkModeMacro').onclick=()=>{overviewMode='macro';render();};
  $('lkModeDetail').onclick=()=>{overviewMode='detail';render();};
  $('lkTabProcess').onclick=()=>{tab='process';render();};
  $('lkTabData').onclick=()=>{tab='data';render();};
  $('lkTabSetup').onclick=()=>{tab='setup';render();};
  $('lkAddNode').onclick=()=>{if(current()?.enabled)openEditor(false);};
  $('lkQuickClose').onclick=closeQuickDetail;
  $('lkQuickUnlock').onclick=()=>{if(!blocked&&locked){$('lkUnlock').click();syncQuickDetail();}};
  const cancelSecondaryEdit=(dialogId)=>{
    $(dialogId).close();
    if(returnQuickAfterEdit)showQuickDetail();
    returnQuickAfterEdit=false;
  };
  $('lkRenameNodeCancel').onclick=()=>cancelSecondaryEdit('lkRenameNodeDialog');
  $('lkRenameNodeDialog').addEventListener('cancel',e=>{e.preventDefault();cancelSecondaryEdit('lkRenameNodeDialog');});
  $('lkNodeDialog').addEventListener('cancel',e=>{e.preventDefault();cancelSecondaryEdit('lkNodeDialog');});
  $('lkRenameNodeForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(locked||blocked)return;
    const title=$('lkRenameNodeName').value.trim();
    if(!title)return;
    const modId=renameModuleId,key=renameNodeId;
    const changed=mutate(next=>{
      const target=next.modules.find(m=>m.id===modId)?.nodes.find(n=>n.id===key);
      if(!target)return false;
      if(target.title===title)return false;
      target.title=title;
      return true;
    });
    if(changed){
      moduleId=modId;selectedId=key;
      $('lkRenameNodeDialog').close();render();
      if(returnQuickAfterEdit)showQuickDetail();
      setMessage('小模块名称已修改（未保存草稿）。操作 ID、分支及其他字段保持不变。');
    }else{
      $('lkRenameNodeDialog').close();
      if(returnQuickAfterEdit)showQuickDetail();
    }
    returnQuickAfterEdit=false;
  });
  $('lkNodeCancel').onclick=()=>cancelSecondaryEdit('lkNodeDialog');
  $('lkNodeForm').addEventListener('submit',e=>{
    e.preventDefault();if(!current()?.enabled||blocked||locked)return;
    const rows=readTriggerRows();
    if(rows.length>25)return;
    if(editorMode==='new'&&!rows.length){
      $('lkTriggerRows').querySelector('input')?.focus();
      setMessage('新增操作至少需要一项触发结果；已有历史操作可分次补充。');
      return;
    }
    const input={title:$('lkTitleInput').value.trim(),action:$('lkActionInput').value.trim(),
      entryCondition:$('lkEntryCondition').value.trim(),
      executor:$('lkExecutor').value.trim(),operationInput:$('lkOperationInput').value.trim(),
      researchBasis:$('lkResearchBasis').value.trim(),
      note:$('lkNoteInput').value.trim(),tags:editor.labels($('lkTagsInput').value),
      color:$('lkNodeNoColor').checked?null:$('lkNodeColor').value.toUpperCase()};
    if(!input.title)return;
    const id=editorMode==='edit'?selectedId:makeId('op'),mId=moduleId;
    const changed=mutate(next=>editorMode==='edit'
      ?triggerApi.updateNode(next,mId,id,input,rows)
      :triggerApi.addNode(next,mId,activeStageId||stages.stages(next.modules.find(m=>m.id===mId))[0]?.id||'',id,input,rows));
    if(changed){
      selectedId=id;$('lkNodeDialog').close();render();
      if(returnQuickAfterEdit)showQuickDetail();
      returnQuickAfterEdit=false;
    }
  });
  $('lkBranchCancel').onclick=()=>$('lkBranchDialog').close();
  $('lkBranchForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(blocked||locked)return;
    const label=$('lkBranchLabel').value.trim(),from=$('lkBranchSource').value,
      target=$('lkBranchTarget').value,newTitle=$('lkBranchNewTitle').value.trim();
    if(!label||!from||!target||target==='__new__'&&!newTitle)return;
    const id=target==='__new__'?makeId('op'):target;
    if(mutate(next=>{
      const m=next.modules.find(x=>x.id===moduleId);if(!m)return false;
      if(target==='__new__'){
        const source=m.nodes.find(n=>n.id===from);if(!source)return false;
        m.nodes.push({id,title:newTitle,kind:'业务操作',action:'',information:'',data:'',
          note:'待补充流程说明',tags:[],operationCodes:[],confidence:'待核实',evidence:'',
          stageId:stages.stageFor(m,source),branchOnly:true});
      }
      return flow.upsertBranch(next,moduleId,{id:makeId('link'),from,to:id,label,
        type:$('lkBranchType').value,branchOnly:target==='__new__'||$('lkBranchOnly').checked});
    })){
      selectedId=from;$('lkBranchDialog').close();render();
    }
  });
  $('lkStageCancel').onclick=()=>$('lkStageDialog').close();
  $('lkStageForm').addEventListener('submit',event=>{
    event.preventDefault();if(blocked||locked)return;
    const name=$('lkStageName').value.trim();if(!name)return;
    const id=editingStageId||makeId('stage');
    const success=mutate(next=>{
      const m=next.modules.find(x=>x.id===moduleId);if(!m)return false;
      if(editingStageId){
        const stage=m.stages?.find(x=>x.id===editingStageId);
        if(!stage)return false;stage.name=name;return true;
      }
      return stages.addStage(next,moduleId,{id,name});
    });
    if(success){activeStageId=id;$('lkStageDialog').close();render();}
  });
  $('lkAddModule').onclick=()=>{
    if(blocked||locked)return;
    editingModuleId='';$('lkModuleDialogTitle').textContent='添加大模块';
    $('lkModuleName').value='';$('lkModuleCategory').value='仓';$('lkModuleMode').value='';$('lkModuleModeRow').hidden=true;$('lkModuleDialog').showModal();
  };
  $('lkModuleCancel').onclick=()=>$('lkModuleDialog').close();
  $('lkModuleCategory').onchange=()=>{
    $('lkModuleModeRow').hidden=$('lkModuleCategory').value!=='干';
    if($('lkModuleCategory').value!=='干')$('lkModuleMode').value='';
  };
  $('lkModuleForm').addEventListener('submit',e=>{
    e.preventDefault();
    const name=$('lkModuleName').value.trim(),category=$('lkModuleCategory').value,mode=category==='干'?$('lkModuleMode').value:'';
    if(!name)return;
    const id=editingModuleId||makeId('module');
    if(mutate(next=>{
      if(editingModuleId){const m=next.modules.find(x=>x.id===id);if(!m)return false;m.name=name;m.category=category;if(mode)m.transportMode=mode;else delete m.transportMode;return true;}
      const newModule={id,name,category,enabled:true,stages:[{id:'general',name:'操作流程',collapsed:false}],nodes:[]};if(mode)newModule.transportMode=mode;next.modules.push(newModule);return true;
    })){
      moduleId=id;selectedId='';$('lkModuleDialog').close();render();
    }
  });
  $('lkUnlock').onclick=()=>{
    if(blocked||!locked)return;
    state=copy(releaseRecord.draft?.data||releaseRecord.published.data);
    // Keep the operation the user opened. render()/findSelected() only falls
    // back if this operation is absent in the saved draft.
    locked=false;dirty=false;tab='process';render();
    setMessage(releaseRecord.draft?'继续编辑已保存草稿；全链路仍显示已发布版本。':'已解锁。修改暂存在内存，点击「保存草稿」后才写入本地存储。');
  };
  $('lkSaveDraft').onclick=()=>{
    if(blocked||locked||!dirty)return;
    const next=versions.saveDraft(storage(),releaseRecord,state);
    if(!next){setMessage('保存草稿失败，编辑数据仍留在页面中，旧版内容未覆盖。');return;}
    releaseRecord=next;dirty=false;render();
    setMessage('草稿已保存。全链路总览仍显示 V'+releaseRecord.published.number+'，发布后才生效。');
  };
  $('lkPublish').onclick=()=>{
    if(blocked||locked||dirty||!releaseRecord.draft)return;
    if(!window.confirm('确认将已保存草稿发布为新版本？发布后全链路总览才会更新，并保存旧版供回滚。'))return;
    const next=versions.publish(storage(),releaseRecord);
    if(!next){setMessage('发布失败：请检查存储空间；历史版本未改变。');return;}
    releaseRecord=next;state=copy(next.published.data);locked=true;dirty=false;tab='overview';overviewMode='macro';render();
    setMessage('已发布 V'+next.published.number+'。全链路总览已更新并重新锁定。');
  };
  $('lkCancelEdit').onclick=()=>{
    if(locked)return;
    if(dirty&&!window.confirm('当前有未保存的更改，确定放弃并重新锁定吗？已保存草稿不会被删除。'))return;
    locked=true;dirty=false;state=copy(releaseRecord.published.data);render();
    setMessage(releaseRecord.draft?'已锁定；保存的草稿仍保留，可再次解锁继续。':'已锁定，未修改已发布内容。');
  };
  $('lkHistorySelect').onchange=()=>{
    $('lkRollback').disabled=blocked||!locked||!$('lkHistorySelect').value;
  };
  $('lkRollback').onclick=()=>{
    if(blocked||!locked)return;
    const text=$('lkHistorySelect').value;
    if(!text)return;
    const index=Number(text),old=releaseRecord.history[index];
    if(!old)return;
    if(!window.confirm('确定将历史 V'+old.number+' 作为新的已发布版本？当前版本会自动存入历史；已保存草稿将清除。'))return;
    const next=versions.rollback(storage(),releaseRecord,index);
    if(!next){setMessage('回滚失败，原记录保持不变。');return;}
    releaseRecord=next;state=copy(next.published.data);dirty=false;locked=true;tab='overview';overviewMode='macro';render();
    setMessage('历史 V'+old.number+' 已恢复为新发布版本 V'+next.published.number+'。');
  };
  $('lkExport').onclick=()=>{
    try{
      const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='Lambert-Logistics-Knowledge-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
      setMessage('已发起知识库 JSON 导出；请检查浏览器下载记录。');
    }catch{setMessage('导出失败，请检查浏览器环境。');}
  };
  // The original V1 storage key is a read-only baseline. All new saves use
  // the separate version envelope (published + draft + append-only history).
  const legacy=read();
  const opened=versions.load(storage(),legacy);
  if(opened.error)blocked=true;
  releaseRecord=opened.record||{schema:1,published:{number:0,time:'',data:copy(legacy)},draft:null,history:[]};
  state=copy(releaseRecord.published.data);
  moduleId=state.modules[0]?.id||'';
  activeStageId=stages.stages(current())[0]?.id||'';
  render();
  if(blocked)setMessage(opened.error||'知识库记录无法读取，已开启只读保护，原数据未被覆盖。');
  else setMessage('默认锁定。解锁后修改草稿；只有确认发布才更新全链路总览。');
  window.addEventListener('beforeunload',event=>{
    if(!locked&&dirty){event.preventDefault();event.returnValue='';}
  });
})();
