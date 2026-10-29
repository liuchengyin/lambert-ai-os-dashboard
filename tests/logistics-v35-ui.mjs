import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1400,height:930},serviceWorkers:'block'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const check=(label,yes)=>{assert.ok(yes,label);console.log('PASS:',label)};
const version=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_versions_v1')));
try{
 await page.goto(base+'/?view=logistics',{waitUntil:'domcontentloaded'});
 await page.locator('#lkEditStatus').waitFor({timeout:30000});
 await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-lambert-boot'),null,{timeout:30000});
 check('process contains one linehaul parent and three transport lanes',await page.locator('.lk-trunk-family').count()===1&&await page.locator('.lk-trunk-route').count()===3);
 check('original road operations under road lane',await page.locator('.lk-trunk-route[data-transport-mode="road"] [data-module="linehaul"]').count()>=1);
 check('sea and air lanes have their own add placeholders',await page.locator('.lk-trunk-route[data-transport-mode="sea"] .lk-trunk-add').count()===1&&await page.locator('.lk-trunk-route[data-transport-mode="air"] .lk-trunk-add').count()===1);
 const processRoutes=page.locator('#lkProcess .lk-trunk-route');
 check('transport routes stack vertically at desktop width',await processRoutes.evaluateAll(routes=>routes.length===3&&routes.every((route,i)=>i===0||route.getBoundingClientRect().top>=routes[i-1].getBoundingClientRect().bottom)));
 check('road initially expanded; air and sea collapsed',await processRoutes.evaluateAll(routes=>routes[0].open&&!routes[1].open&&!routes[2].open));
 check('collapsed air lane hides new-route action',!await processRoutes.nth(1).locator('.lk-trunk-add').isVisible());
 await processRoutes.nth(1).locator(':scope > summary').click();
 check('air lane can expand independently',await processRoutes.nth(1).evaluate(lane=>lane.open)&&await processRoutes.nth(1).locator('.lk-trunk-add').isVisible()&&await processRoutes.nth(0).evaluate(lane=>lane.open));
 await processRoutes.nth(1).locator(':scope > summary').click();
 await processRoutes.nth(0).locator(':scope > summary').click();
 check('road route can collapse without deleting nodes',!await processRoutes.nth(0).evaluate(lane=>lane.open)&&await processRoutes.nth(0).locator('.lk-canvas-block[data-module="linehaul"]').count()===1);
 await processRoutes.nth(0).locator(':scope > summary').click();
 check('road route expands again with original nodes',await processRoutes.nth(0).evaluate(lane=>lane.open)&&await processRoutes.nth(0).locator('.lk-canvas-block[data-module="linehaul"]').isVisible());
 check('every operation exposes its optional information wiring slot',
   await page.locator('.lk-canvas-block[data-module="head"] .lk-wiring-indicator').count()>2);
 check('base infrastructure blueprint is present without claiming live integrations',
   await page.locator('#lkInfrastructureBase .lk-infra-chain > div').count()===6);
 check('stage toolbar has no branch or exception button',await page.locator('.lk-stage-actions [data-action="stage-branch"]').count()===0);
 const warehouse=page.locator('.lk-canvas-block[data-module="head"]');
 const scan=warehouse.locator('.lk-flow-item').filter({has:page.locator('[data-drag-node="security-scan"]')});
 console.log('DIAG',JSON.stringify({scan:await scan.count(),plus:await scan.locator('.lk-mini-add').count(),errors,
   html:await warehouse.locator('.lk-flow-item').first().evaluate(el=>el.outerHTML.slice(0,1800))}));
 check('each main operation has single compact plus',await scan.locator(':scope > .lk-mini-add').count()===1);
 check('red branch miniature linked below same operation',await scan.locator('.lk-mini-exception > .lk-mini-card').count()===1);
 check('miniature is narrower than normal operation',await scan.locator('.lk-mini-card').first().evaluate(el=>el.getBoundingClientRect().width)<=100);
 check('locked plus disabled',await scan.locator(':scope > .lk-mini-add').getAttribute('class').then(x=>x.includes('is-disabled')));
 check('old local version not mutated merely by viewing',await page.evaluate(()=>localStorage.getItem('lambert_logistics_versions_v1')===null&&localStorage.getItem('lambert_logistics_knowledge_v1')===null));

 await scan.locator('.lk-step button[data-action="select-node"][data-id="security-scan"]').click();
 check('wiring empty cards are visible in read-only node detail',
   await page.locator('#lkQuickDetailBody .lk-infra-card').count()===5&&
   await page.locator('#lkQuickDetailBody [data-action="wiring-edit"]').isDisabled());
 check('node-first details show entry condition, operation and trigger outcomes in order',
   await page.locator('#lkQuickDetailBody').innerText().then(t=>t.includes('进入条件 / 何时开始')&&t.includes('执行角色 / 系统')&&t.includes('所需输入 / 操作对象')&&t.includes('操作说明 / 如何执行')&&t.includes('触发结果')));
 const research=page.locator('#lkQuickDetailBody .lk-node-context');
 check('node context clearly flags display order not proven relationship',await research.innerText().then(t=>t.includes('操作排序不等于真实触发')));
 check('existing exception edge is distinguished from normal operation sequence',
   await research.locator('.lk-context-exception').count()===1&&await research.innerText().then(t=>t.includes('安检异常')));
 await research.locator('.lk-context-exception [data-action="select-node"][data-id="security-exception"]').click();
 check('following exception opens target and displays incoming source',
   await page.locator('#lkQuickDetailBody h3').innerText().then(t=>t.includes('安检异常上报'))&&
   await page.locator('#lkQuickDetailBody .lk-node-context').innerText().then(t=>t.includes('安检扫描')));
 await page.locator('#lkQuickClose').click();

 await page.locator('#lkTabSetup').click();
 check('new basic-data tool tab exists apart from process',await page.locator('#lkSetupTool').isVisible()&&!await page.locator('#lkProcess').isVisible());
 check('base-data tool shows editable module/stage cards',await page.locator('#lkSetupLibrary .lk-config-section').count()>=5);
 await page.locator('#lkUnlock').click();
 await page.locator('#lkTabProcess').click();
 await scan.locator('.lk-step button[data-action="select-node"][data-id="security-scan"]').click();
 await page.locator('#lkQuickDetailBody [data-action="wiring-edit"]').click();
 check('node wiring editor is separate from business branching',
   await page.locator('#lkWiringDialog').isVisible()&&!await page.locator('#lkBranchDialog').isVisible());
 await page.locator('#lkWiringForm [name="trace.event"]').fill('内部扫描事件');
 await page.locator('#lkWiringForm [name="trace.logLocation"]').fill('内部事件日志');
 await page.locator('#lkWiringForm [name="trace.recordTable"]').fill('待核实扫描记录表');
 await page.locator('#lkWiringForm [name="trace.recordKey"]').fill('运单号');
 await page.locator('#lkWiringForm [name="routing.policy"]').selectOption('internal');
 await page.locator('#lkWiringAddSource').click();
 const src=page.locator('#lkWiringSources .lk-wiring-source-row');
 await src.nth(0).locator('[data-wiring-source="kind"]').selectOption('OMS');
 await src.nth(0).locator('[data-wiring-source="table"]').fill('待核实订单表');
 await src.nth(0).locator('[data-wiring-source="joinKey"]').fill('运单号');
 await page.locator('#lkWiringAddSource').click();
 await src.nth(1).locator('[data-wiring-source="kind"]').selectOption('EDI');
 await src.nth(1).locator('[data-wiring-source="table"]').fill('待核实轨迹表');
 await src.nth(1).locator('[data-wiring-source="joinKey"]').fill('运单号');
 await page.locator('#lkWiringForm [name="metric.name"]').fill('履约及时率');
 await page.locator('#lkWiringForm [name="metric.slaTarget"]').fill('待核实目标');
 await page.locator('#lkWiringForm [name="metric.dashboard"]').fill('履约数据看板');
 await page.locator('#lkWiringForm [name="task.board"]').fill('异常任务看板');
 await page.locator('#lkWiringForm [name="task.condition"]').fill('超期后人工核查');
 await page.locator('#lkWiringForm button[type="submit"]').click();
 check('internal-only path still records log, data sources and SLA',
   await page.locator('#lkQuickDetailBody .lk-infra-node').innerText().then(t=>
   t.includes('5/5')&&t.includes('仅内部留痕')&&t.includes('待核实订单表')&&t.includes('待核实轨迹表')&&t.includes('履约数据看板')&&t.includes('异常任务看板')));
 check('wiring changes not written before explicit draft save',
   await page.evaluate(()=>localStorage.getItem('lambert_logistics_versions_v1')===null));
 await page.locator('#lkQuickClose').click();

 await scan.locator('.lk-step button[data-action="select-node"][data-id="security-scan"]').click();
 await page.locator('#lkQuickDetailBody [data-action="edit-node"]').click();
 await page.locator('#lkEntryCondition').fill('中心收到包裹后执行安检');
 await page.locator('#lkExecutor').fill('中心安检员');
 await page.locator('#lkOperationInput').fill('包裹条码、安检设备');
 await page.locator('#lkResearchBasis').fill('待核实：安检操作 SOP 和接口记录');
 await page.locator('#lkNodeForm button[type="submit"]').click();
 check('node-first fields save in unsaved working copy without losing links',
   await page.locator('#lkQuickDetailBody').innerText().then(t=>t.includes('中心收到包裹后执行安检')&&t.includes('中心安检员')&&t.includes('包裹条码、安检设备')&&t.includes('待核实：安检操作 SOP')));
 const moveSelector=page.locator('#lkQuickDetailBody select[data-move-node]');
 await moveSelector.selectOption('linehaul::general');
 check('linked source cannot be moved to another module without relinking',
   await page.locator('#lkMessage').innerText().then(t=>t.includes('跨大模块移动会使连线失效'))&&
   await scan.locator('.lk-step button[data-id="security-scan"]').count()===1);
 await page.locator('#lkQuickClose').click();

 await scan.locator(':scope > .lk-mini-add > summary').click();
 await scan.locator(':scope > .lk-mini-add [data-action="branch-quick-choice"][data-branch-type="branch"]').click();
 check('single plus chooses branching without separate type toolbar',await page.locator('#lkBranchDialog').isVisible()&&await page.locator('#lkBranchType').inputValue()==='branch');
 check('new mini branch operation selected by default',await page.locator('#lkBranchTarget').inputValue()==='__new__');
 await page.locator('#lkBranchLabel').fill('需要复检');
 await page.locator('#lkBranchNewTitle').fill('人工复检');
 await page.locator('#lkBranchForm button[type="submit"]').click();
 check('ordinary branch is small and blue',await scan.locator('.lk-mini-branch .lk-mini-card').filter({hasText:'人工复检'}).count()===1);
 await scan.locator('.lk-mini-exception .lk-mini-add > summary').first().click();
 await scan.locator('.lk-mini-exception [data-action="branch-quick-choice"][data-branch-type="exception"]').first().click();
 await page.locator('#lkBranchLabel').fill('二次异常');
 await page.locator('#lkBranchNewTitle').fill('再次复核上报');
 await page.locator('#lkBranchForm button[type="submit"]').click();
 check('nested exception child remains miniature',await scan.locator('.lk-mini-descendants .lk-mini-exception .lk-mini-card').filter({hasText:'再次复核上报'}).count()===1);
 await page.locator('.lk-canvas-block[data-module="head"] [data-id="security-scan"][data-action="select-node"]').click();
 await page.locator('#lkQuickDetailBody [data-action="exchange-add"]').click();
 check('exchange editor explicitly separate from flow branching',await page.locator('#lkExchangeDialog').isVisible());
 await page.locator('#lkExchangeFrom').fill('多闻 TMS');
 await page.locator('#lkExchangeTo').fill('EDI');
 await page.locator('#lkExchangeMessage').fill('上报扫描结果事件');
 await page.locator('#lkExchangeForm button[type="submit"]').click();
 check('detail shows TMS → EDI information exchange',await page.locator('#lkQuickDetailBody .lk-exchange-item').innerText().then(t=>t.includes('多闻 TMS')&&t.includes('EDI')));
 await page.locator('#lkQuickClose').click();
 check('metadata edits not persisted before saving draft',await page.evaluate(()=>localStorage.getItem('lambert_logistics_versions_v1')===null));
 await page.locator('#lkSaveDraft').click();
 const draft=await version();const m=draft.draft.data.modules.find(x=>x.id==='head'),orig=draft.published.data.modules.find(x=>x.id==='head');
 check('two new branches survive in draft',m.branches.some(e=>e.label==='需要复检'&&e.type==='branch')&&m.branches.some(e=>e.label==='二次异常'&&e.type==='exception'));
 check('exchanges are not branch edges',m.nodes.find(n=>n.id==='security-scan').exchanges.length===1&&m.branches.every(e=>!e.message));
 check('node-first research fields survive draft save',m.nodes.find(n=>n.id==='security-scan').entryCondition==='中心收到包裹后执行安检'&&m.nodes.find(n=>n.id==='security-scan').executor==='中心安检员'&&m.nodes.find(n=>n.id==='security-scan').operationInput.includes('包裹条码')&&m.nodes.find(n=>n.id==='security-scan').researchBasis.includes('待核实'));
 check('wiring configuration persists in draft and cannot create real tasks',
   m.nodes.find(n=>n.id==='security-scan').infrastructure.sources.length===2&&
   m.nodes.find(n=>n.id==='security-scan').infrastructure.routing.policy==='internal'&&
   m.nodes.find(n=>n.id==='security-scan').infrastructure.metric.dashboard==='履约数据看板'&&
   !orig.nodes.find(n=>n.id==='security-scan').infrastructure);
 check('published graph unchanged by saved draft',orig.branches.length===1&&!orig.nodes.find(n=>n.id==='security-scan').exchanges);
 await page.locator('#lkPublish').click();
 check('publish updates release',!!(await version()).published.data.modules.find(m=>m.id==='head').nodes.find(n=>n.id==='security-scan').exchanges?.length);
 await page.locator('#lkTabData').click();
 const dataScan=page.locator('#lkDataRows .lk-data-row').filter({hasText:'安检扫描'}).first();
 await dataScan.locator('.lk-data-lineage > summary').click();
 check('data relationship tab can consume configured OMS/EDI source descriptions',
   await dataScan.locator('.lk-data-lineage').innerText().then(t=>
     t.includes('待核实订单表')&&t.includes('待核实轨迹表')&&t.includes('不对外推送')&&t.includes('履约数据看板')&&t.includes('异常任务看板')));
 await page.locator('#lkTabOverview').click();
 check('A overview is macro only',await page.locator('#lkOverview .lk-ov-op').count()===0);
 check('published linehaul has a 3-branch transport parent',await page.locator('#lkOverview .lk-ov-transport-family .lk-trunk-route').count()===3);

 check('published transport routes also stack vertically',await page.locator('#lkOverview .lk-ov-transport-family .lk-trunk-route').evaluateAll(routes=>routes.length===3&&routes.every((r,i)=>i===0||r.getBoundingClientRect().top>=routes[i-1].getBoundingClientRect().bottom)));
 const publishedAir=page.locator('#lkOverview .lk-ov-transport-family .lk-trunk-route[data-transport-mode="air"]');
 await publishedAir.locator(':scope > summary').click();
 check('published air route expands independently',await publishedAir.evaluate(lane=>lane.open));
 await page.locator('#lkModeDetail').click();
 check('published expansion survives A/B overview switch',await publishedAir.evaluate(lane=>lane.open));
 check('B overview displays detailed operation nodes',await page.locator('#lkOverview .lk-ov-op').count()>0);
 await page.setViewportSize({width:390,height:830});
 check('transport lanes remain vertical at mobile width',await page.locator('#lkOverview .lk-ov-transport-family .lk-trunk-route').evaluateAll(routes=>routes.length===3&&routes.every((r,i)=>i===0||r.getBoundingClientRect().top>=routes[i-1].getBoundingClientRect().bottom)));
 check('mobile transport cards stay inside their parent',await page.locator('#lkOverview .lk-ov-transport-family .lk-trunk-route').evaluateAll(routes=>routes.every(r=>r.getBoundingClientRect().width<=r.parentElement.getBoundingClientRect().width+1)));

 check('no runtime errors',errors.length===0);
 console.log('V3.5 browser checks passed');
}finally{await browser.close();}
