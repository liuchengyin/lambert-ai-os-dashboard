import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true,serviceWorkers:'block'});
const initial={tasks:[{id:'t1',title:'旧任务',status:'待开始',extra:'保留字段'}],projects:[{id:'p1',name:'旧项目',extra:'保留字段'}],daily_reviews_v2:{'2026-10-27':{goal:'原复盘'}}};
await ctx.addInitScript(fixture=>{for(const [key,value] of Object.entries(fixture))localStorage.setItem(key,JSON.stringify(value));},initial);
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const raw=key=>page.evaluate(key=>localStorage.getItem(key),key);
function pass(label,yes){assert.ok(yes,label);console.log('PASS:',label)}
try{
  await page.goto(origin+'/?view=logistics',{waitUntil:'domcontentloaded'});
  await page.locator('#lkModules .lk-module').first().waitFor();
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-lambert-boot'),null,{timeout:25000});
  pass('Tool navigation exists',await page.locator('.s1-nav-group[data-group="tools"] button[data-v="logistics"]').count()===1);
  pass('Direct logistics navigation works',await page.locator('#logistics').isVisible());
  pass('Default five modules',await page.locator('#lkModules .lk-module').count()===5);
  pass('Opening read-only demo does not create storage',await raw('lambert_logistics_knowledge_v1')===null);

  const previous=Object.fromEntries(await Promise.all(Object.keys(initial).map(async k=>[k,await raw(k)])));
  await page.locator('#lkModules .lk-module').nth(2).locator('button[data-action="select-module"]').click();
  pass('Land transport contains five operations',await page.locator('#lkNodes .lk-node').count()===5);
  await page.locator('#lkNodes .lk-node').filter({hasText:'创建批次'}).click();
  pass('Batch node details distinguish three flows',await page.locator('#lkDetail .lk-detail-field').count()===4);
  await page.locator('#lkTabData').click();
  pass('Separate data view exists',await page.locator('#lkData').isVisible()&&await page.locator('#lkDataRows .lk-data-group').count()===5);
  await page.locator('#lkDataRows button[data-action="open-node"]').first().click();
  pass('Data records link back to operation',await page.locator('#lkProcess').isVisible());
  await page.locator('#lkAddNode').click();
  await page.locator('#lkTitleInput').fill('自定义陆运操作');
  await page.locator('#lkActionInput').fill('装车前登记');
  await page.locator('#lkInfoInput').fill('待核实的接口');
  await page.locator('#lkRecordInput').fill('车次号、登记时间');
  await page.locator('#lkNodeForm button[type="submit"]').click();
  pass('Custom node is stored only in knowledge key',await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1'));
    return d.modules.some(m=>m.nodes.some(n=>n.title==='自定义陆运操作'));
  }));
  const saved=await raw('lambert_logistics_knowledge_v1');
  await page.locator('#lkDetail button[data-action="edit-node"]').click();
  await page.locator('#lkTitleInput').fill('已编辑陆运操作');
  await page.locator('#lkNodeForm button[type="submit"]').click();
  pass('Editing does not duplicate an operation',await page.evaluate(()=>{
    const a=JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')).modules.flatMap(m=>m.nodes);
    return a.filter(x=>x.title==='已编辑陆运操作').length===1&&!a.some(x=>x.title==='自定义陆运操作');
  }));
  await page.locator('#lkAddModule').click();
  await page.locator('#lkModuleName').fill('海外转运');
  await page.locator('#lkModuleCategory').selectOption('尾程');
  await page.locator('#lkModuleForm button[type="submit"]').click();
  pass('Custom module added',await page.locator('#lkModules .lk-module').count()===6);
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#lkExport').click()]);
  pass('Backup exports knowledge JSON',dl.suggestedFilename().endsWith('.json'));
  const unchanged=Object.fromEntries(await Promise.all(Object.keys(initial).map(async k=>[k,await raw(k)])));
  pass('Old OS data unchanged',Object.keys(previous).every(k=>previous[k]===unchanged[k]));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#lkModules .lk-module').first().waitFor();
  pass('Custom module persists after refresh',await page.locator('#lkModules .lk-module').count()===6);
  await page.setViewportSize({width:390,height:844});
  pass('Mobile viewport maintains tabs',await page.locator('#lkTabData').isVisible());
  pass('No runtime page errors',errors.length===0);
  console.log('Logistics knowledge V1 browser regression passed.');
}finally{await browser.close();}
