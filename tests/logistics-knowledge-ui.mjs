import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true,serviceWorkers:'block'});
const fixture={tasks:[{id:'t1',title:'旧任务',extra:'保留属性'}],projects:[{id:'p1',name:'原项目'}],daily_reviews_v2:{'2026-10-28':{goal:'复盘原样'}}};
await context.addInitScript(seed=>{for(const [key,val] of Object.entries(seed))localStorage.setItem(key,JSON.stringify(val));},fixture);
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const read=key=>page.evaluate(key=>localStorage.getItem(key),key);
function pass(name,ok){assert.ok(ok,name);console.log('PASS',name);}
try{
 await page.goto(origin+'/?view=logistics',{waitUntil:'domcontentloaded'});
 await page.locator('#lkModules .lk-canvas-block').first().waitFor({timeout:25000});
 await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-lambert-boot'),null,{timeout:25000});
 pass('tools navigation',await page.locator('.s1-nav-group[data-group="tools"] button[data-v="logistics"]').count()===1);
 pass('Logistics direct route',await page.locator('#logistics').isVisible());
 pass('five modular blocks',await page.locator('#lkModules .lk-canvas-block').count()===5);
 pass('untouched initial storage',await read('lambert_logistics_knowledge_v1')===null);
 const before=Object.fromEntries(await Promise.all(Object.keys(fixture).map(async k=>[k,await read(k)])));
 const linehaul=page.locator('#lkModules .lk-canvas-block[data-module="linehaul"]');
 pass('linehaul shows nested operations',await linehaul.locator('.lk-step').count()===5);
 await linehaul.locator('button[data-action="select-node"][data-id="batch"]').click();
 pass('operation business detail',await page.locator('#lkDetail h3').innerText()==='创建批次');
 pass('information shown only when expanded',await page.locator('#lkDetail .lk-related-details').count()===1);
 await page.locator('#lkDetail .lk-related-details summary').click();
 pass('info is expandable',await page.locator('#lkDetail .lk-related-details .lk-detail-field').count()===3);

 // Operations can be moved with keyboard-accessible buttons.
 await linehaul.locator('button[data-action="node-right"][data-id="batch"]').click();
 pass('node moved to following position',await page.evaluate(()=>{
   const m=JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')).modules.find(x=>x.id==='linehaul');
   return m.nodes.map(x=>x.id).indexOf('batch')===2;
 }));
 // Cross-module transfer keeps all fields.
 await page.locator('#lkDetail select[data-move-node="batch"]').selectOption('head::arrival');
 pass('cross-block move keeps details',await page.evaluate(()=>{
   const d=JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1'));
   return !d.modules.find(m=>m.id==='linehaul').nodes.some(n=>n.id==='batch')&&
    d.modules.find(m=>m.id==='head').nodes.some(n=>n.id==='batch'&&n.title==='创建批次'&&n.information.includes('待核实'));
 }));
 pass('after move selected detail follows node',await page.locator('#lkDetail h3').innerText()==='创建批次');
 await page.locator('button[data-action="collapse-module"][data-id="head"]').click();
 pass('collapse hides cards',await page.locator('.lk-canvas-block[data-module="head"] .lk-step').count()===0);
 await page.locator('button[data-action="collapse-module"][data-id="head"]').click();
 pass('expand restores cards',await page.locator('.lk-canvas-block[data-module="head"] .lk-step').count()===17);

 // Module arrows reorder the large blocks and save.
 await page.locator('button[data-action="module-down"][data-id="head"]').click();
 pass('module order persists',await page.evaluate(()=>{
   const m=JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')).modules;
   return m[0].id==='export'&&m[1].id==='head';
 }));

 // Real HTML5 drag event: move batch operation back to linehaul.
 const drag=page.locator('.lk-canvas-block[data-module="head"] .lk-step[data-drag-node="batch"]');
 const drop=page.locator('.lk-canvas-block[data-module="linehaul"] .lk-drop-end');
 await page.evaluate(()=>{
   window.__lkTrace=[];
   for(const name of ['dragstart','dragover','drop','dragend']){
     document.getElementById('logistics').addEventListener(name,e=>{
       if(window.__lkTrace.length<30)window.__lkTrace.push({event:name,target:e.target?.className,from:e.target?.dataset?.dragFrom,dest:e.target?.dataset?.dropModule,defaultPrevented:e.defaultPrevented});
     },true);
   }
 });
 await drag.dragTo(drop);
 console.log('DRAG_DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({
   trace:window.__lkTrace,
   state:JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')).modules.map(m=>({name:m.id,nodes:m.nodes.map(n=>n.id)})),
   ui:{selected:document.querySelector('#lkDetail h3')?.textContent}
 }))));
 pass('drag-and-drop relocates operation',await page.evaluate(()=>{
   const d=JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1'));
   return d.modules.find(m=>m.id==='linehaul').nodes.some(n=>n.id==='batch');
 }));

 // Drag the large linehaul module before the export module.
 const moduleGrip=page.locator('.lk-canvas-block[data-module="linehaul"] [data-drag-module="linehaul"]');
 const moduleTarget=page.locator('.lk-canvas-block[data-module="export"] .lk-canvas-block-head');
 await moduleGrip.dragTo(moduleTarget,{targetPosition:{x:24,y:2}});
 pass('dragging a large module changes position',await page.locator('#lkModules .lk-canvas-block').first().getAttribute('data-module')==='linehaul');
 await page.locator('#lkAddModule').click();
 await page.locator('#lkModuleName').fill('海外中转仓');
 await page.locator('#lkModuleCategory').selectOption('尾程');
 await page.locator('#lkModuleForm button[type="submit"]').click();
 pass('add module',await page.locator('#lkModules .lk-canvas-block').count()===6);
 await page.locator('#lkAddNode').click();
 await page.locator('#lkTitleInput').fill('自主检验');
 await page.locator('#lkActionInput').fill('核实业务动作');
 await page.locator('#lkInfoInput').fill('需核实');
 await page.locator('#lkRecordInput').fill('时间字段');
 await page.locator('#lkNodeForm button[type="submit"]').click();
 pass('add operation',await page.locator('#lkDetail h3').innerText()==='自主检验');
 await page.locator('#lkDetail button[data-action="edit-node"]').click();
 await page.locator('#lkTitleInput').fill('自主检验修订');
 await page.locator('#lkNodeForm button[type="submit"]').click();
 pass('edit operation',await page.locator('#lkDetail h3').innerText()==='自主检验修订');
 await page.locator('#lkTabData').click();
 pass('data page unchanged',await page.locator('#lkDataRows .lk-data-group').count()===6);
 await page.locator('#lkDataRows button[data-action="open-node"]').first().click();
 pass('data page links back',await page.locator('#lkProcess').isVisible());
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#lkExport').click()]);
 pass('JSON export',download.suggestedFilename().endsWith('.json'));
 const after=Object.fromEntries(await Promise.all(Object.keys(fixture).map(async k=>[k,await read(k)])));
 pass('OS project/task/review unchanged',Object.keys(before).every(k=>before[k]===after[k]));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#lkModules .lk-canvas-block').first().waitFor();
 pass('saved module order survives reload',await page.locator('.lk-canvas-block').first().getAttribute('data-module')==='linehaul');
 pass('saved custom module survives reload',await page.locator('#lkModules .lk-canvas-block').count()===6);
 await page.setViewportSize({width:390,height:844});
 pass('mobile fallback arrows visible',await page.locator('.lk-canvas-block .lk-move').first().isVisible());
 const beforeMobile=await page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')).modules.find(m=>m.id==='linehaul').nodes.map(n=>n.id));
 await page.locator('.lk-canvas-block[data-module="linehaul"] button[data-action="node-right"][data-id="vehicle-label"]').click();
 const afterMobile=await page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')).modules.find(m=>m.id==='linehaul').nodes.map(n=>n.id));
 pass('mobile arrow changes operation order',beforeMobile.indexOf('vehicle-label')===0&&afterMobile.indexOf('vehicle-label')===1);
 if(errors.length)console.log('LOGISTICS_PAGE_ERRORS',JSON.stringify(errors));
 pass('no page errors',errors.length===0);
 console.log(JSON.stringify({ok:true,checks:22}));
}finally{await browser.close();}
