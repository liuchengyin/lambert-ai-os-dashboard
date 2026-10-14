import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8000/';
const errors=[];
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:960}});
await ctx.addInitScript(()=>{
  if(!localStorage.getItem('projects'))localStorage.setItem('projects',JSON.stringify([
    {id:'project-test',name:'项目编辑取消测试',status:'进行中',due:'2026-10-20',standard:'保留原始完成标准',createdAt:'2026-10-10T08:00:00Z'}
  ]));
  if(!localStorage.getItem('tasks'))localStorage.setItem('tasks',JSON.stringify([
    {id:'drag-a',title:'拖动测试 A',status:'待开始',project:'项目编辑取消测试',priority:'P2',matrix:'q2',due:'',note:'',createdAt:'2026-10-10T08:00:00Z'},
    {id:'drag-b',title:'拖动测试 B',status:'进行中',project:'项目编辑取消测试',priority:'P2',matrix:'q2',due:'',note:'',createdAt:'2026-10-10T08:01:00Z'},
    {id:'drag-c',title:'拖动测试 C',status:'进行中',project:'项目编辑取消测试',priority:'P2',matrix:'q2',due:'',note:'',createdAt:'2026-10-10T08:02:00Z'}
  ]));
});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(e.message));
const check=(label,condition)=>{assert.ok(condition,label);console.log('PASS:',label)};
const status=async id=>page.evaluate(id=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id===id)?.status,id);
try{
  await page.goto(BASE,{waitUntil:'load'});
  const brand=page.locator('.shell>aside .lambert-brand-icon');
  check('Selected Lambert mark is visible in sidebar',await brand.isVisible());
  check('Sidebar logo SVG has loaded',await brand.evaluate(e=>e.complete&&e.naturalWidth>0));
  check('Browser favicon points to selected mark',await page.locator('link[rel="icon"]').getAttribute('href')==='brand/logo-mark.svg?v=20261014');
  const favicon=await page.request.get(new URL('brand/logo-mark.svg',BASE).href);
  check('Favicon SVG is served correctly',favicon.ok()&&(await favicon.text()).includes('<svg'));
  const appIcon=await page.request.get(new URL('brand/app-icon.svg',BASE).href);
  check('App icon is served correctly',appIcon.ok()&&(await appIcon.text()).includes('viewBox="0 0 512 512"'));
  const manifest=await page.request.get(new URL('manifest.webmanifest',BASE).href);
  check('PWA manifest references Lambert app icon',manifest.ok()&&(await manifest.json()).icons.some(i=>i.src==='/brand/app-icon.svg'));
  await page.locator('nav button[data-v="tasks"]').click();
  await page.locator('.task-v5-card[data-task-id="drag-a"]').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.task-v5-card[data-task-id="drag-a"]')?.draggable===true);
  check('Task cards are draggable',await page.locator('[data-task-id="drag-a"]').getAttribute('draggable')==='true');
  await page.locator('[data-task-id="drag-a"]').dragTo(page.locator('.task-v5-col.doing'),{targetPosition:{x:160,y:220}});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a')?.status==='进行中');
  check('Cross-column drag persists new status',await status('drag-a')==='进行中');
  check('Dragged card moved to doing column',await page.locator('.task-v5-col.doing [data-task-id="drag-a"]').count()===1);
  await page.locator('[data-task-id="drag-a"]').dragTo(page.locator('.task-v5-col.done'),{targetPosition:{x:160,y:220}});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a')?.status==='已完成');
  check('Dragging to completed column persists',await status('drag-a')==='已完成');
  await page.reload({waitUntil:'load'});
  await page.locator('nav button[data-v="tasks"]').click();
  await page.locator('.task-v5-col.done [data-task-id="drag-a"]').waitFor({state:'visible'});
  check('Task status survives refresh',await status('drag-a')==='已完成');
  await page.locator('[data-task-id="drag-b"]').dragTo(page.locator('[data-task-id="drag-c"]'),{targetPosition:{x:120,y:5}});
  await page.waitForTimeout(250);
  const order=await page.evaluate(()=>JSON.parse(localStorage.getItem('task_drag_order_v1')));
  check('In-column reorder is saved',Array.isArray(order)&&order.includes('drag-b')&&order.includes('drag-c'));
  await page.locator('nav button[data-v="projects"]').click();
  await page.locator('.project-card-actions button').filter({hasText:'编辑'}).first().click();
  await page.locator('#projectEditDlg[open]').waitFor({state:'visible'});
  check('Project dialog has a visible X cancel',await page.locator('#projectEditClose').isVisible());
  await page.locator('#projectEditName').fill('不应该保存的修改');
  await page.locator('#projectEditClose').click();
  check('X closes project dialog',await page.locator('#projectEditDlg').evaluate(e=>!e.open));
  const projectName=await page.evaluate(()=>JSON.parse(localStorage.getItem('projects'))[0].name);
  check('X cancel leaves original project data untouched',projectName==='项目编辑取消测试');
  await page.locator('nav button[data-v="review"]').click();
  await page.locator('#rv6Goal').waitFor({state:'visible'});
  check('Daily review uses goal-result-improvement layout',await page.locator('.review-v7-steps').isVisible());
  const goalSpan=await page.locator('.review-v6-goal').evaluate(e=>getComputedStyle(e).gridColumnStart);
  check('Daily goal is full-width top section',goalSpan==='1');
  await page.locator('#rv6Goal').fill('今天完成一个清晰目标');
  await page.locator('#rv6Restart').fill('明天先做五分钟');
  await page.locator('#rv6Save').click();
  const reviews=await page.evaluate(()=>JSON.parse(localStorage.getItem('daily_reviews_v2')));
  check('Existing daily review storage still works',Object.values(reviews).some(r=>r.goal==='今天完成一个清晰目标'&&r.restart==='明天先做五分钟'));
  for(const [view,nav] of [['home','home'],['projects','projects'],['tasks','tasks'],['review','review'],['writing','writing'],['reading','reading']]){
    await page.locator('nav button[data-v="'+nav+'"]').click();
    await page.waitForTimeout(100);
    const bg=await page.locator('#'+view).evaluate(e=>getComputedStyle(e).backgroundImage);
    check(view+' uses shared pastel background',bg.includes('radial-gradient'));
  }
  check('Common links still available',await page.locator('nav button[data-v="knowledge"]').count()===1);
  // Keep reviewable visual snapshots from the same isolated demo data.
  mkdirSync('tests/screenshots',{recursive:true});
  await page.locator('nav button[data-v="home"]').click();
  await page.locator('.shell>aside').screenshot({path:'tests/screenshots/lambert-sidebar-logo.png'});
  for(const [view,name] of [['home','overview'],['projects','projects'],['tasks','tasks'],['review','review']]){
    await page.locator('nav button[data-v="'+view+'"]').click();
    await page.screenshot({path:'tests/screenshots/'+name+'-desktop.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('nav button[data-v="review"]').click();
  const mobileColumns=await page.locator('.review-v6-workspace').evaluate(e=>getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length);
  check('Review switches to one column on mobile',mobileColumns===1);
  const reviewOverflow=await page.locator('#review').evaluate(e=>e.scrollWidth-e.clientWidth);
  check('Mobile review has no horizontal overflow',reviewOverflow<=5);
  await page.screenshot({path:'tests/screenshots/review-mobile.png',fullPage:true});
  check('No uncaught JavaScript errors',errors.length===0);
  console.log('Workspace UI smoke passed.');
}catch(e){
  console.error('Workspace UI smoke failed:',e.stack);
  console.error('Browser errors:',errors);
  await page.screenshot({path:'workspace-ui-smoke-failure.png',fullPage:true}).catch(()=>{});
  process.exitCode=1;
}finally{await browser.close()}
