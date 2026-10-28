import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true,serviceWorkers:'block'});
const fixture={tasks:[{id:'t-1',title:'保留原任务'}],projects:[{id:'p-1',name:'保留原项目'}],daily_reviews_v2:{'2026-10-28':{notes:'保留原复盘'}}};
await context.addInitScript(seed=>{if(!sessionStorage.getItem('__logisticsFlowTestSeeded')){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('__logisticsFlowTestSeeded','1');}},fixture);
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')));
const check=(name,v)=>{assert.ok(v,name);console.log('PASS:',name)};
try{
 await page.goto(base+'/?view=logistics',{waitUntil:'domcontentloaded'});
 await page.locator('.lk-flow-main').first().waitFor({timeout:28000});
 await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-lambert-boot'),null,{timeout:28000});
 const baseData=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixture));
 const head=page.locator('.lk-canvas-block[data-module="head"]');
 const receipt=head.locator('.lk-substage[data-stage-id="receiving"]');
 check('default preview remains unpersisted until edit',await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1')===null));
 check('process arrows separate main nodes',await receipt.locator('.lk-flow-arrow').count()===2);
 check('exception appears below scanner as a branch, not ordinary next step',await receipt.locator('.lk-branch-edge .lk-step[data-drag-node="security-exception"]').count()===1 && await receipt.locator('.lk-flow-main > .lk-flow-item').count()===3);
 check('branch condition label visible',(await receipt.locator('.lk-branch-condition').first().innerText())==='安检异常');
 check('category palette applied',await head.evaluate(e=>getComputedStyle(e).getPropertyValue('--lk-module-accent').trim())==='#477DBD');
 // Custom category color persists for only the chosen module.
 const modulePicker=head.locator('input[data-color-module="head"]:not([data-color-stage])');
 await modulePicker.fill('#21a6ae');
 const data1=await current();
 check('custom module color saved',data1.modules[0].color==='#21A6AE');
 check('unmodified module has no custom color',data1.modules[1].color===undefined);
 const stagePicker=head.locator('input[data-color-module="head"][data-color-stage="receiving"]');
 await stagePicker.fill('#e2723f');
 check('stage override color saved independently',(await current()).modules[0].stages.find(x=>x.id==='receiving').color==='#E2723F');
 check('stage override visible',await receipt.evaluate(e=>getComputedStyle(e).getPropertyValue('--lk-stage-accent').trim())==='#E2723F');
 await receipt.locator('button[data-action="color-reset-stage"]').click();
 check('stage resets to module palette',(await current()).modules[0].stages.find(x=>x.id==='receiving').color===undefined);
 check('restored stage inherits custom module color',await receipt.evaluate(e=>getComputedStyle(e).getPropertyValue('--lk-stage-accent').trim())==='#21A6AE');

 // Add a custom edge and remove it without touching the target's business details.
 const batch=head.locator('button[data-action="select-node"][data-id="batch-create"]');
 await batch.click();
 await page.locator('#lkDetail button[data-action="branch-add"]').click();
 await page.locator('#lkBranchLabel').fill('批次异常');
 await page.locator('#lkBranchTarget').selectOption('batch-bind');
 await page.locator('#lkBranchForm button[type="submit"]').click();
 check('custom condition branch saved',(await current()).modules[0].branches.some(x=>x.from==='batch-create'&&x.to==='batch-bind'&&x.label==='批次异常'));
 check('custom branch label rendered',await head.locator('.lk-substage[data-stage-id="sorting"] .lk-branch-condition').filter({hasText:'批次异常'}).count()===1);
 const beforeData=(await current()).modules[0].nodes.find(x=>x.id==='batch-bind');
 await page.locator('#lkDetail button[data-action="branch-remove"]').click();
 check('branch removed and the original operation unchanged', (await current()).modules[0].nodes.find(x=>x.id==='batch-bind').title===beforeData.title && !(await current()).modules[0].branches.some(x=>x.from==='batch-create'));

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.lk-flow-main').first().waitFor();
 check('module color stays after refresh',(await current()).modules[0].color==='#21A6AE');
 check('default condition branch survives refresh',await page.locator('.lk-branch-edge .lk-branch-condition').filter({hasText:'安检异常'}).count()===1);
 await page.locator('.lk-canvas-block[data-module="head"] button[data-action="color-reset-module"]').click();
 check('reset returns to warehouse default',(await current()).modules[0].color===undefined);
 check('visual reset applied',await head.evaluate(e=>getComputedStyle(e).getPropertyValue('--lk-module-accent').trim())==='#477DBD');
 const changed=await page.evaluate(snapshot=>Object.fromEntries(Object.keys(snapshot).filter(k=>localStorage.getItem(k)!==snapshot[k]).map(k=>[k,{before:snapshot[k],after:localStorage.getItem(k)}])),baseData);
 if(Object.keys(changed).length)console.log('OS_DATA_DIFF',JSON.stringify(changed).slice(0,3000));
 check('OS data untouched',Object.keys(changed).length===0);
 await page.setViewportSize({width:390,height:844});
 check('mobile still shows arrows and color selector',await head.locator('input[data-color-module="head"]:not([data-color-stage])').isVisible() && await head.locator('.lk-flow-arrow').count()>0);
 if(errors.length)console.log('PAGE_ERRORS',JSON.stringify(errors));
 check('no runtime errors',errors.length===0);
 console.log('Flow and color browser checks passed.');
}finally{await browser.close();}
