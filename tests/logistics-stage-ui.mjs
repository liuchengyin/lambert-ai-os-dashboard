import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const context=await browser.newContext({viewport:{width:1360,height:900},serviceWorkers:'block'});
const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const data=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')));
const check=(name,condition)=>{assert.ok(condition,name);console.log('PASS:',name)};
try{
 await page.goto(origin+'/?view=logistics',{waitUntil:'domcontentloaded'});
 await page.locator('.lk-substage').first().waitFor({timeout:28000});
 await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-lambert-boot'),null,{timeout:28000});
 const head=page.locator('.lk-canvas-block[data-module="head"]');
 check('domestic warehouse is a module under warehouse category',await head.locator('button.lk-module-main').innerText().then(t=>t.includes('国内中心仓')));
 check('four editable flow stages',await head.locator('.lk-substage').count()===4);
 const labels=await head.locator('.lk-substage-title').allInnerTexts().catch(()=>[]);
 const stages=await head.locator('button.lk-stage-title').allInnerTexts();
 check('arrival receiving sorting dispatch ordered',stages.join(',')==='到车,收入,分拣,发出');
 check('warehouse has actual operation cards',await head.locator('.lk-substage[data-stage-id="sorting"] .lk-step').count()===6);
 check('initial demo has not been written',await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1')===null));

 await head.locator('button[data-action="stage-collapse"][data-stage="receiving"]').click();
 check('stage collapse hides contents',await head.locator('.lk-substage[data-stage-id="receiving"] .lk-step').count()===0);
 await head.locator('button[data-action="stage-collapse"][data-stage="receiving"]').click();
 check('stage expansion restores contents',await head.locator('.lk-substage[data-stage-id="receiving"] .lk-step').count()===4);

 await head.locator('button[data-action="stage-right"][data-stage="receiving"]').click();
 check('moving substage persists stage ordering',(await data()).modules[0].stages[2].id==='receiving');
 await head.locator('button[data-action="stage-rename"][data-stage="receiving"]').click();
 await page.locator('#lkStageName').fill('收入作业');
 await page.locator('#lkStageForm button[type="submit"]').click();
 check('substage can be renamed',await head.locator('.lk-substage[data-stage-id="receiving"] button.lk-stage-title').innerText()==='收入作业');

 await head.locator('button[data-action="stage-add"][data-module="head"]').click();
 await page.locator('#lkStageName').fill('出口交接');
 await page.locator('#lkStageForm button[type="submit"]').click();
 check('add child stage',await head.locator('.lk-substage').count()===5);
 const lastStage=(await data()).modules[0].stages.at(-1).id;

 const receiving=head.locator('.lk-substage[data-stage-id="receiving"]');
 await receiving.locator('button[data-action="select-node"][data-id="receiving-op"]').click();
 await page.locator('#lkDetail select[data-move-node="receiving-op"]').selectOption('head::'+lastStage);
 check('move operation to another substage',(await data()).modules[0].nodes.find(n=>n.id==='receiving-op').stageId===lastStage);
 check('source stage loses just moved operation',await receiving.locator('.lk-step').count()===3);

 await head.locator('button[data-action="stage-add-node"][data-stage="'+lastStage+'"]').click();
 await page.locator('#lkTitleInput').fill('新的出库核验');
 await page.locator('#lkActionInput').fill('到目的地前核验包裹');
 await page.locator('#lkInfoInput').fill('待核实系统事件');
 await page.locator('#lkRecordInput').fill('原始业务数据');
 await page.locator('#lkNodeForm button[type="submit"]').click();
 check('new operation is assigned to selected stage',(await data()).modules[0].nodes.some(n=>n.title==='新的出库核验'&&n.stageId===lastStage));

 const beforeDrag=(await data()).modules[0].stages.map(s=>s.id);
 await page.evaluate(()=>{
  window.__lkStageTrace=[];
  const root=document.getElementById('logistics');
  for(const type of ['dragstart','dragover','drop','dragend'])root.addEventListener(type,e=>{
   if(window.__lkStageTrace.length<30)window.__lkStageTrace.push({type,tag:e.target?.tagName,cls:e.target?.className,stage:e.target?.dataset?.stageId,drag:e.target?.dataset?.dragStage,prevented:e.defaultPrevented});
  },true);
 });
 const dragSource=head.locator('.lk-substage[data-stage-id="receiving"] .lk-substage-head');
 const dragTarget=head.locator('.lk-substage[data-stage-id="sorting"] .lk-substage-head');
 console.log('DRAG_SOURCE',JSON.stringify(await dragSource.evaluate(el=>({draggable:el.draggable,box:el.getBoundingClientRect().toJSON()}))));
 await dragSource.dragTo(dragTarget,{targetPosition:{x:27,y:9}});
 const afterDrag=(await data()).modules[0].stages.map(s=>s.id);
 console.log('STAGE_DRAG_DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>window.__lkStageTrace)),JSON.stringify({beforeDrag,afterDrag}));
 check('drag child stage reorders list',beforeDrag.indexOf('receiving')>beforeDrag.indexOf('sorting')&&afterDrag.indexOf('receiving')<afterDrag.indexOf('sorting'));

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.lk-substage').first().waitFor();
 check('stage title survives reload',await page.locator('.lk-substage[data-stage-id="receiving"] button.lk-stage-title').innerText()==='收入作业');
 check('stage reorder survives reload',(await data()).modules[0].stages.map(s=>s.id).indexOf('receiving')<(await data()).modules[0].stages.map(s=>s.id).indexOf('sorting'));

 const old=await context.newPage();
 await old.goto(origin+'/?view=logistics',{waitUntil:'domcontentloaded'});
 await old.evaluate(()=>{
  localStorage.setItem('lambert_logistics_knowledge_v1',JSON.stringify({schema:1,route:'old route',modules:[{id:'old',name:'老中心',category:'仓',enabled:true,nodes:[{id:'oldop',title:'原来的业务节点',information:'历史接口资料',data:'历史数据字段'}]}]}));
 });
 await old.reload({waitUntil:'domcontentloaded'});
 await old.locator('.lk-substage').first().waitFor();
 check('old v1 nodes render in a legacy stage',await old.locator('.lk-substage[data-stage-id="general"] .lk-step').count()===1);
 check('legacy opening does not rewrite old data',await old.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')).modules[0].stages===undefined));
 await old.close();

 await page.setViewportSize({width:390,height:840});
 check('stage buttons usable on narrow viewport',await page.locator('button[data-action="stage-left"]').first().isVisible());
 if(errors.length)console.log('PAGE_ERRORS',JSON.stringify(errors));
 check('no uncaught runtime errors',errors.length===0);
 console.log('Nested warehouse substage browser regression passed.');
}finally{await browser.close();}
