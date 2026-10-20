// Run locally after starting: python3 -m http.server 8765
// TEST_ORIGIN=http://127.0.0.1:8765 node tests/shared-sync/startup-perf.test.mjs
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],scriptRequests=[];
let releasedSlowScript=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('.js'))scriptRequests.push(r.url());});

// The account button must work before the large dashboard's legacy scripts finish.
await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
await page.route('**/app.js',async route=>{
  await new Promise(resolve=>setTimeout(resolve,3000));
  releasedSlowScript=true;
  await route.continue();
});

try {
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.LambertAccount&&document.getElementById('lambertAccountButton').onclick,undefined,{timeout:2500});
  assert.equal(releasedSlowScript,false,'account UI should initialize before dashboard scripts finish');
  await page.locator('#lambertAccountButton').click();
  await page.getByText('邮箱登录正在准备，暂未连接账号服务。现有数据仍保存在本机。',{exact:true}).waitFor();
  assert.equal(releasedSlowScript,false,'account modal should open while dashboard is still loading');
  await page.getByRole('button',{name:'关闭账户',exact:true}).click();

  // Legacy JS execution order and globally bound dashboard state must remain intact.
  await page.waitForFunction(()=>typeof window.openView==='function'&&typeof window.LambertAI==='object',undefined,{timeout:15000});
  await page.locator('nav button[data-v="tasks"]').click();
  assert.equal(await page.locator('#tasks').isVisible(),true);
  assert.equal(await page.locator('nav button[data-v="projects"]').count(),1);
  assert.deepEqual(errors,[],'classic dashboard must not throw while loading in parallel');
  console.log(JSON.stringify({ok:true,checks:['account-starts-before-slow-dashboard','login-modal-ready-during-slow-js','dashboard-script-dependencies-preserved','other-nav-preserved'],requests:scriptRequests.length}));
}finally {
  await browser.close();
}
