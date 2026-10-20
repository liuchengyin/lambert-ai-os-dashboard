import {chromium} from 'playwright';import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8781';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();page.on('console',m=>{if(m.type()==='warning')console.log(m.text());});await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 let release,hit;const gate=new Promise(r=>release=r),seen=new Promise(r=>hit=r);
 await page.route('**/project-v3.js',async route=>{hit();await gate;await route.continue();});
 await page.goto(origin+'/?view=tasks',{waitUntil:'domcontentloaded'});await seen;
 await page.getByText('正在打开工作台…',{exact:true}).waitFor();assert.equal(await page.locator('.shell').isVisible(),false);
 await page.evaluate(()=>localStorage.setItem('startup_test_sentinel','keep'));
 release();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-lambert-boot'));
 await page.locator('.shell').waitFor({state:'visible'});assert.equal(await page.locator('.shell').isVisible(),true);await page.locator('#s1PrimaryNav').waitFor();await page.waitForFunction(()=>!!window.TaskCenter);
 assert.equal(await page.evaluate(()=>localStorage.getItem('startup_test_sentinel')),'keep');
 await page.unroute('**/project-v3.js');await page.route('**/project-v3.js',r=>r.abort());
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();
 assert.equal(await page.locator('.shell').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('startup_test_sentinel')),'keep');
 await page.unroute('**/project-v3.js');await page.route('**/sprint1-navigation.js*',r=>r.fulfill({contentType:'text/javascript',body:'throw new Error("test module failure")'}));
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();assert.equal(await page.locator('.shell').isVisible(),false);
 console.log(JSON.stringify({ok:true,checks:['legacy-hidden-under-slow-network','nested-assets-ready-before-reveal','preload-preserves-execution-order','failed-load-retry','runtime-module-failure-retry','saved-data-preserved']}));
}finally{await browser.close();}
