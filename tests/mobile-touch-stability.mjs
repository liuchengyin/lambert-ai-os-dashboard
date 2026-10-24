import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',timezoneId:'Asia/Shanghai'});
 page.setDefaultTimeout(8000);await page.clock.setFixedTime(new Date('2026-10-24T06:00:00Z'));
 await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 await page.addInitScript(()=>{localStorage.tasks=JSON.stringify([{id:'t',title:'触屏滑动任务',due:'2026-10-24',status:'进行中',projectId:'p'}]);localStorage.projects=JSON.stringify([{id:'p',name:'触屏项目',status:'进行中'}]);});
 await page.goto((process.env.TEST_ORIGIN||'http://127.0.0.1:8765')+'/mobile/');await page.locator('[data-task-id=t]').waitFor();
 const cdp=await page.context().newCDPSession(page);
 await page.evaluate(()=>{window.touchTrace=[];for(const kind of ['pointerdown','gotpointercapture','lostpointercapture','pointercancel','pointerup'])document.addEventListener(kind,e=>window.touchTrace.push({kind,target:e.target.className,fromTaskButton:!!e.target.closest('.task-edit,.chk'),pointer:e.pointerId}),true);});
 const transform=()=>page.locator('[data-task-id=t]').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m41);
 async function touch(selector,dx,dy=0,held){const b=await page.locator(selector).first().boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/12,y:y+dy*i/12}]});await page.waitForTimeout(12);}if(held)await held();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(380);}
 async function checkRows(){
  const width=(await page.locator('[data-task-id=t]').boundingBox()).width;
  // Real touch starts on a child button: WebView/Chrome gives that button implicit capture.
  // Transferring capture to its row must not interpret the child's lost-capture event as cancellation.
  await touch('[data-task-id=t] .task-edit',-width*.4,0,async()=>{assert.ok(await transform()<-width*.3,JSON.stringify(await page.evaluate(()=>touchTrace)));});
  assert.ok(Math.abs(await transform()+width/2)<1);assert.equal(await page.locator('.task-swipe-delete').isVisible(),true);
  await page.waitForTimeout(500);assert.ok(Math.abs(await transform()+width/2)<1);
  // A tap on the exposed card closes the action; the next gesture can reopen in the other direction.
  await page.locator('[data-task-id=t] .task-edit').tap();await page.waitForTimeout(240);assert.equal(await transform(),0);
  await touch('[data-task-id=t] .task-edit',width*.32,0,async()=>{assert.ok(await transform()>width*.2,JSON.stringify(await page.evaluate(()=>touchTrace)));});
  assert.ok(Math.abs(await transform()-width/4)<1);assert.equal(await page.locator('.task-swipe-complete').isVisible(),true);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.tasks)[0].status),'进行中');
  await page.locator('[data-task-id=t] .task-edit').tap();await page.waitForTimeout(240);
  assert.equal(await transform(),0);await touch('[data-task-id=t] .chk',width*.32);assert.ok(Math.abs(await transform()-width/4)<1,JSON.stringify({offset:await transform(),width,trace:await page.evaluate(()=>touchTrace),task:await page.evaluate(()=>JSON.parse(localStorage.tasks)[0])}));
  await page.locator('[data-task-id=t] .task-edit').tap();await page.waitForTimeout(240);
 }
 await checkRows();await page.getByRole('button',{name:'项目',exact:true}).click();await page.getByRole('button',{name:'查看项目：触屏项目',exact:true}).click();await checkRows();
 await page.getByRole('button',{name:'复盘',exact:true}).click();await page.getByLabel('复盘目标',{exact:true}).fill('三页范围内保存草稿');
 const selected=async label=>assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
 const scopes='.review-day-scopes';await touch(scopes,-120);await selected('明天');
 for(let i=0;i<4;i++){await touch(scopes,-120);await selected('明天');assert.equal(await page.locator('.review-day-scopes button').count(),3);assert.equal(await page.locator('.review-selected-date').count(),0);assert.equal(await page.locator('.filter-swipe-frame').count(),0);}
 await touch(scopes,120);await selected('今天');assert.equal(await page.getByLabel('复盘目标',{exact:true}).inputValue(),'三页范围内保存草稿');await touch(scopes,120);await selected('昨天');
 for(let i=0;i<4;i++){await touch(scopes,120);await selected('昨天');assert.equal(await page.locator('.review-selected-date').count(),0);}
 // Explicit calendar selection remains available, but cannot create an unbounded swipe carousel.
 await page.getByRole('button',{name:'选择复盘日期',exact:true}).click();await page.getByRole('button',{name:'2026-10-20',exact:true}).click();await page.getByRole('button',{name:'确认日期',exact:true}).click();assert.equal(await page.locator('.review-selected-date').textContent(),'2026/10/20');
 await touch(scopes,-120);assert.equal(await page.locator('.review-selected-date').textContent(),'2026/10/20');
 await page.getByRole('button',{name:'今天',exact:true}).click();await selected('今天');assert.equal(await page.getByLabel('复盘目标',{exact:true}).inputValue(),'三页范围内保存草稿');
 assert.ok(await page.evaluate(()=>touchTrace.some(e=>e.kind==='lostpointercapture'&&e.fromTaskButton)),'Real touch must cover transfer away from the child button');
 await mkdir('tests/screenshots',{recursive:true});await page.screenshot({path:'tests/screenshots/review-bounded-touch.png'});
 console.log('PASS: real touch capture transfer from task buttons, stable left/right action reveal in task/project, explicit completion preserved, exactly three review swipe dates, repeated boundary resistance, calendar-only custom dates, review draft retention');
}finally{await browser.close();}
