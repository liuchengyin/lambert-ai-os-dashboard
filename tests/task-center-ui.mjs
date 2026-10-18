import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base=process.env.TC_BASE_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai'});
await context.addInitScript(()=>{
 if(localStorage.getItem('tc-fixture'))return;
 localStorage.setItem('tc-fixture','1');
 localStorage.setItem('projects',JSON.stringify([{id:'a',name:'网络阅读',category:'个人',status:'进行中',start:'2026-10-18',due:'2026-11-01',standard:'读完并输出流程图',extraField:'keep'},{id:'b',name:'求职准备',status:'待开始',due:'',standard:'完成两个案例'}]));
 localStorage.setItem('tasks',JSON.stringify([{id:'ta',title:'阅读第一章',project:'网络阅读',status:'待开始',priority:'P2',matrix:'q2',start:'2026-10-18T09:00',due:'2026-10-20T20:00',note:'保留笔记',labels:['个人'],custom:'keep'},{id:'tb',title:'准备案例',project:'求职准备',status:'进行中',priority:'P1',matrix:'q1',due:'',note:''},{id:'tu',title:'旧项目任务',project:'已不存在的项目',status:'待开始',priority:'P2',matrix:'q2'},{id:'tx',title:'未排期任务',project:'网络阅读',status:'待开始',priority:'P2',matrix:'q2'}]));
 localStorage.setItem('task_center_preferences_v1',JSON.stringify({projectId:'a',view:'board'}));
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const tasks=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tasks')));
const nav=()=>page.locator('nav button[data-v="tasks"]').click();
const tab=name=>page.getByRole('tab',{name,exact:false}).click();
try{
 await page.goto(base);await page.waitForFunction(()=>!!window.TaskCenter);await nav();
 assert.equal(await page.locator('#tcProjectTitle').innerText(),'网络阅读');
 assert.equal(await page.locator('.tc-task').count(),2);assert.ok(!(await page.locator('#tcContent').innerText()).includes('准备案例'));
 let saved=await tasks();assert.equal(saved.find(t=>t.id==='ta').projectId,'a');assert.equal(saved.find(t=>t.id==='ta').custom,'keep');
 assert.equal(saved.find(t=>t.id==='tu').project,'已不存在的项目');
 await tab('表格');assert.equal(await page.locator('[data-tc-row]').count(),2);
 const row=page.locator('[data-tc-row="ta"]');await row.locator('[data-field="status"]').selectOption('进行中');
 await page.locator('[data-tc-row="ta"] [data-field="due"]').fill('2026-10-22T20:00');await page.locator('[data-tc-row="ta"] [data-field="due"]').press('Tab');
 saved=await tasks();assert.equal(saved.find(t=>t.id==='ta').due,'2026-10-22T20:00');
 await tab('甘特图');assert.equal(await page.locator('[data-tc-gantt="ta"]').count(),1);assert.equal(await page.locator('.tc-gantt-bar').count(),1);assert.ok((await page.locator('.tc-unplanned').innerText()).includes('未排期任务'));
 await page.locator('#tcFilterStatus').selectOption('进行中');assert.equal(await page.locator('.tc-gantt-bar').count(),1);await tab('看板');assert.equal(await page.locator('.tc-task').count(),1);
 await page.locator('#tcClear').click();
 await page.locator('#tcNewTask').click();await page.locator('#tcTitle').fill('每日阅读任务');await page.locator('#tcStart').fill('2026-10-24T10:00');await page.locator('#tcDue').fill('2026-10-23T10:00');await page.locator('#tcEditorForm button[type="submit"]').click();assert.ok((await page.locator('#tcEditorError').innerText()).includes('不能晚于'));assert.ok(await page.locator('#tcEditor').isVisible());
 await page.locator('#tcDue').fill('2026-10-25T10:00');await page.locator('#tcEditorForm button[type="submit"]').click();
 saved=await tasks();const added=saved.find(t=>t.title==='每日阅读任务');assert.equal(added.projectId,'a');assert.deepEqual(added.labels,['个人']);
 // Actual drag event flow moves status and retains project; selectors are the new engine only.
 await page.locator(`[data-tc-task="${added.id}"]`).dragTo(page.locator('[data-tc-status="已完成"] .tc-cards'),{sourcePosition:{x:8,y:8}});
 assert.equal((await tasks()).find(t=>t.id===added.id).status,'已完成');
 await tab('表格');await page.locator(`[data-tc-row="${added.id}"] [data-field="projectId"]`).selectOption('inbox');assert.equal((await tasks()).find(t=>t.id===added.id).projectId,'');
 await page.locator('#tcProjectSelect').selectOption('inbox');assert.equal(await page.locator('[data-tc-row]').count(),2);
 await page.locator('#tcProjectSelect').selectOption('b');await page.reload();await page.waitForFunction(()=>!!window.TaskCenter);await nav();assert.equal(await page.locator('#tcProjectSelect').inputValue(),'b');assert.equal(await page.getByRole('tab',{name:'▥ 表格'}).getAttribute('aria-selected'),'true');
 // Project card drilldown and rename retain stable identity.
 await page.locator('nav button[data-v="projects"]').click();const project=page.getByRole('button',{name:'打开项目 网络阅读',exact:true});await project.click();assert.equal(await page.locator('#tcProjectTitle').innerText(),'网络阅读');
 await page.locator('#tcBackProjects').click();await page.getByRole('button',{name:'打开项目 网络阅读',exact:true}).getByRole('button',{name:'编辑',exact:true}).click();
 await page.locator('#projectEditName').fill('网络阅读新版');await page.locator('#projectEditSave').click();
 saved=await tasks();assert.equal(saved.find(t=>t.id==='ta').projectId,'a');assert.equal(saved.find(t=>t.id==='ta').project,'网络阅读新版');
 await nav();assert.equal(await page.locator('#tcProjectTitle').innerText(),'网络阅读新版');
 // Search escaping and view consistency.
 await page.locator('#tcNewTask').click();await page.locator('#tcTitle').fill('<img src=x onerror=alert(1)>');await page.locator('#tcEditorForm button[type="submit"]').click();assert.equal(await page.locator('#tcContent img').count(),0);
 for(const name of ['每日记录','每日阅读','英语学习'])assert.ok(await page.getByRole('button',{name,exact:true}).count());
 await mkdir('test-artifacts/task-center',{recursive:true});await tab('看板');await page.screenshot({path:'test-artifacts/task-center/desktop-board.png',fullPage:true});
 await tab('甘特图');await page.screenshot({path:'test-artifacts/task-center/desktop-gantt.png',fullPage:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:900});for(const name of ['看板','甘特图','表格']){await tab(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`page overflow at ${width} / ${name}`);} }
 await page.screenshot({path:'test-artifacts/task-center/mobile-table.png',fullPage:true});
 const before=await page.evaluate(()=>TaskCenter.getState().renderCount);await page.waitForTimeout(350);const after=await page.evaluate(()=>TaskCenter.getState().renderCount);assert.equal(after,before,'idle must not rerender in a loop');
 assert.deepEqual(errors,[]);console.log('PASS: project focus, three shared views, editing, real drag, inbox/move, last view/project, rename, escaping, 320/390 layout, idle and navigation.');
}catch(error){await mkdir('test-artifacts/task-center',{recursive:true});await page.screenshot({path:'test-artifacts/task-center/failure.png',fullPage:true});throw error;}finally{await browser.close();}
