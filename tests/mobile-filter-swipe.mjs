import {chromium} from 'playwright';import {mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',hasTouch:true,isMobile:true});page.setDefaultTimeout(8000);
 await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
 await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 await page.addInitScript(()=>{if(localStorage.swipeSeed)return;localStorage.swipeSeed='1';localStorage.projects=JSON.stringify([{id:'p1',name:'阅读计划',status:'进行中'},{id:'p2',name:'未来项目',status:'待开始'}]);localStorage.tasks=JSON.stringify([{id:'t1',title:'今日阅读',due:'2026-10-21',projectId:'p1',status:'进行中'},{id:'t2',title:'明日整理',due:'2026-10-22',projectId:'p1',status:'待开始'}]);});
 await page.goto((process.env.TEST_ORIGIN||'http://127.0.0.1:8765')+'/mobile/');
 await page.locator('.task-list').waitFor();
 async function swipe(selector,dx=-130,dy=0){const b=await page.locator(selector).first().boundingBox();const x=b.x+b.width*.5+(dx<0?60:-60),y=b.y+Math.min(b.height*.5,24);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:12});await page.mouse.up();await page.waitForTimeout(380);}
 const pressed=async name=>assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
 // A held drag must physically track the pointer and show the real next page.
 const area=await page.locator('.task-scopes').boundingBox();const sy=area.y+20;
 const beforeDrag=await page.evaluate(()=>localStorage.tasks);
 await page.mouse.move(280,sy);await page.mouse.down();await page.mouse.move(235,sy,{steps:8});await page.waitForTimeout(40);
 assert.equal(await page.locator('.filter-swipe-page').count(),2);
 assert.ok(await page.locator('.filter-swipe-page').first().evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m41)<-35);
 assert.ok(await page.locator('.filter-swipe-page').nth(1).textContent().then(s=>s.includes('明日整理')));
 const originalY=(await page.locator('.task-list').first().locator('.task').first().boundingBox()).y;
 const snapshotY=(await page.locator('.filter-swipe-page').first().locator('.task').first().boundingBox()).y;assert.ok(Math.abs(originalY-snapshotY)<1);
 await mkdir('tests/screenshots',{recursive:true});await page.screenshot({path:'tests/screenshots/fluid-swipe-drag.png'});
 await pressed('今日');assert.equal(await page.evaluate(()=>localStorage.tasks),beforeDrag);
 await page.waitForTimeout(120);await page.mouse.up();assert.equal(await page.locator('.filter-swipe-frame').getAttribute('data-phase'),'rebound');
 await page.waitForTimeout(350);assert.equal(await page.locator('.filter-swipe-frame').count(),0);await pressed('今日');
 // Cancellation and navigation cannot leave an overlay or commit a stale filter.
 await page.mouse.move(280,sy);await page.mouse.down();await page.mouse.move(150,sy,{steps:8});await page.locator('#app').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await page.waitForTimeout(380);
 assert.equal(await page.locator('.filter-swipe-frame').count(),0);await pressed('今日');
 await page.mouse.move(280,sy);await page.mouse.down();await page.mouse.move(150,sy,{steps:8});await page.mouse.up();await page.getByRole('button',{name:'项目',exact:true}).click();await page.waitForTimeout(380);
 assert.equal(await page.locator('.filter-swipe-frame').count(),0);await page.getByRole('button',{name:'查看项目：阅读计划',exact:true}).waitFor();
 await page.getByRole('button',{name:'任务',exact:true}).click();await pressed('今日');
 // The outer boundary resists movement and springs back without inventing a page.
 await page.mouse.move(120,sy);await page.mouse.down();await page.mouse.move(240,sy,{steps:8});await page.waitForTimeout(40);
 assert.equal(await page.locator('.filter-swipe-page').count(),1);
 const resistance=await page.locator('.filter-swipe-page').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m41);assert.ok(resistance>0&&resistance<40);
 await page.mouse.up();await page.waitForTimeout(350);await pressed('今日');
 const touch=await page.context().newCDPSession(page);const box=await page.locator('.task-scopes').boundingBox();const ty=box.y+20;await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:280,y:ty}]});for(let x=270;x>=120;x-=10)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:ty}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(380);await pressed('全部');assert.equal(await page.locator('.task').count(),2);
 await swipe('.task-scopes');await pressed('全部'); // At the end: no wrap.
 await swipe('.task-scopes',130);await pressed('今日');assert.equal(await page.locator('.task').count(),1);
 await swipe('.task-scopes',5,70);await pressed('今日');
 await swipe('.task-swipe-front');await pressed('今日');assert.equal(await page.getByRole('button',{name:'删除：今日阅读',exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'编辑：今日阅读',exact:true}).count(),1);
 await page.getByRole('button',{name:'项目',exact:true}).click();await swipe('.project-status-filter');await pressed('待开始');await page.getByRole('button',{name:'查看项目：未来项目',exact:true}).waitFor();
 await swipe('.project-status-filter',130);await pressed('进行中');await page.getByRole('button',{name:'查看项目：阅读计划',exact:true}).click();
 // Project tasks are ordered 待开始 / 进行中 / 已完成.
 await swipe('.project-status-filter');await pressed('已完成');await swipe('.project-status-filter',130);await pressed('进行中');
 await page.getByRole('button',{name:'复盘',exact:true}).click();await page.getByLabel('复盘目标',{exact:true}).fill('切换日期不能丢');
 const reviewBefore=await page.evaluate(()=>localStorage.daily_reviews_v2);const rb=await page.locator('.review-day-scopes').boundingBox();
 await page.mouse.move(250,rb.y+20);await page.mouse.down();await page.mouse.move(130,rb.y+20,{steps:10});await page.waitForTimeout(40);
 assert.equal(await page.locator('.filter-swipe-frame [data-k]').count(),0);assert.equal(await page.evaluate(()=>localStorage.daily_reviews_v2),reviewBefore);
 await page.mouse.up();await page.waitForTimeout(380);await pressed('明天');await swipe('.review-day-scopes',130);await pressed('今天');assert.equal(await page.getByLabel('复盘目标',{exact:true}).inputValue(),'切换日期不能丢');
 await swipe('.review-day-scopes',130);await pressed('昨天');await swipe('.review-day-scopes',130);await pressed('昨天');assert.equal(await page.locator('.review-selected-date').count(),0);
 await swipe('.review-day-scopes');await pressed('今天');
 await page.getByRole('button',{name:'今天',exact:true}).click();await swipe('textarea');await pressed('今天');assert.equal(await page.getByLabel('复盘目标',{exact:true}).inputValue(),'切换日期不能丢');
 await page.reload();await page.getByRole('button',{name:'复盘',exact:true}).click();assert.equal(await page.getByLabel('复盘目标',{exact:true}).inputValue(),'切换日期不能丢');
 await page.getByRole('button',{name:'任务',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await swipe('.task-scopes');await pressed('全部');assert.equal(await page.locator('.filter-swipe-frame').count(),0);
 console.log('PASS: live transform, adjacent content, inert snapshots, no preview writes, rebound, boundary resistance, task/project/project-detail/review swipe, boundaries, vertical scroll, row-delete isolation, draft save, custom date, input isolation');
}finally{await browser.close();}
