import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
try{
  await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:8000/');
  await page.locator('#homeAiRow #aiChatPanel').waitFor();
  await page.waitForFunction(()=>window.LambertAccount);
  const data=()=>page.evaluate(()=>Object.fromEntries(['projects','tasks','daily_reviews_v2','reading_workspace_v2'].map(k=>[k,localStorage.getItem(k)])));
  const before=await data();
  assert.equal(await page.locator('header #lambertAccountButton').count(),0);
  assert.equal(await page.locator('.shell > aside > .web-sidebar-account #lambertAccountButton').count(),1);
  assert.equal(await page.locator('#lambertCloudStatus').textContent(),'未登录 · 本地模式');
  assert.ok(await page.locator('#lambertAccountButton').evaluate(e=>getComputedStyle(e,'::before').backgroundImage.includes('svg')));
  const account=await page.locator('.web-sidebar-account').boundingBox();assert.ok(Math.abs(account.y+account.height-1000)<40);
  const left=await page.locator('#aiDailyCard').boundingBox(),right=await page.locator('#aiChatPanel').boundingBox();
  assert.ok(Math.abs(left.y-right.y)<1);assert.ok(Math.abs(left.width/right.width-1.5)<.01);assert.equal(left.height,280);assert.equal(right.height,280);
  assert.equal(await page.locator('#aiChatPanel > .ai-note').count(),0);
  const send=page.locator('#aiChatPanel .ai-chat-form button');const sendBox=await send.boundingBox();assert.ok(sendBox.y+sendBox.height<=right.y+right.height,'send is visible without panel scrolling');
  await page.getByRole('button',{name:'创建一个任务：明晚练习 SQL，先做 10 分钟',exact:true}).click();
  const message=await page.locator('#aiChatInput').inputValue();assert.ok(message.includes('SQL'));
  await page.evaluate(()=>renderHome());await page.locator('#homeAiRow #aiChatPanel').waitFor();
  assert.equal(await page.locator('#homeAiRow').count(),1);assert.equal(await page.locator('#aiChatInput').inputValue(),message);
  await page.locator('#lambertAccountButton').click();await page.getByRole('button',{name:'关闭账户',exact:true}).click();
  await page.locator('#s1SidebarToggle').click();await page.locator('#lambertAccountButton').click();await page.getByRole('button',{name:'关闭账户',exact:true}).click();
  await page.locator('#s1SidebarToggle').click();
  await page.locator('nav button[data-v=tasks]').click();await page.locator('.tc-overview-row').waitFor();
  assert.equal(Math.round((await page.locator('.tc-project-focus').boundingBox()).height),165);
  await page.locator('nav button[data-v=home]').click();
  for(const width of [1000,768,700,390,320]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow at '+width);
    if(width<=700){const a=await page.locator('#aiDailyCard').boundingBox(),b=await page.locator('#aiChatPanel').boundingBox();assert.ok(b.y>=a.y+a.height);}
  }
  await page.locator('.s1-mobile-nav-toggle').click();assert.ok(await page.locator('#lambertAccountButton').isVisible());
  await page.locator('#lambertAccountButton').click();await page.getByRole('button',{name:'关闭账户',exact:true}).click();
  assert.deepEqual(await data(),before);assert.deepEqual(errors,[]);
  console.log('PASS home 60/40, 280px, visible send, rerender retains draft, sidebar account/rail/mobile, 165px task layout, unchanged business storage');
}finally{await browser.close();}
