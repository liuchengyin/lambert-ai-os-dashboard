import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{if(localStorage.getItem('completed-fixture'))return;localStorage.clear();localStorage.setItem('completed-fixture','1');localStorage.setItem('projects',JSON.stringify([{id:'p',name:'完成项目',status:'已完成',standard:'保持标准'},{id:'q',name:'第二项目',status:'已完成'}]));localStorage.setItem('tasks',JSON.stringify([{id:'t',title:'完成任务',status:'已完成',projectId:'p',project:'完成项目',note:'保留备注',priority:'P2'},{id:'u',title:'第二任务',status:'已完成',projectId:'p',project:'完成项目',priority:'P2'}]));localStorage.setItem('task_center_preferences_v1',JSON.stringify({projectId:'p',view:'board'}));});
const ensureOpen=async detail=>{if(!await detail.evaluate(e=>e.open))await detail.locator('summary').click();};
const stored=key=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
try{
 await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.TaskCenter);
 await page.locator('nav button[data-v="projects"]').click();
 const projects=page.locator('#projectBoard details.completed-item');assert.equal(await projects.count(),2);assert.equal(await projects.locator(':scope[open]').count(),0);
 await ensureOpen(projects.first());assert.ok(await projects.first().evaluate(e=>e.open));await page.getByRole('button',{name:'全部展开',exact:true}).click();assert.equal(await projects.locator(':scope[open]').count(),2);await page.getByRole('button',{name:'全部折叠',exact:true}).click();assert.equal(await projects.locator(':scope[open]').count(),0);
 await ensureOpen(projects.first());await projects.first().getByRole('button',{name:'编辑',exact:true}).click();assert.ok(await page.locator('#projectEditDlg').isVisible());await page.keyboard.press('Escape');
 await projects.first().getByRole('button',{name:'归档',exact:true}).click();assert.equal((await stored('projects')).length,2);assert.equal((await stored('projects')).filter(p=>p.archived).length,1);await page.locator('#projectArchiveToggle').click();assert.equal(await projects.count(),1);await ensureOpen(projects.first());await projects.first().getByRole('button',{name:'取消归档'}).click();await page.locator('#projectArchiveToggle').click();
 await ensureOpen(projects.first());await projects.first().getByRole('button',{name:'重新打开'}).click();assert.equal((await stored('projects')).find(p=>p.id==='p').status,'进行中');
 await page.locator('nav button[data-v="tasks"]').click();
 const tasks=page.locator('#tcContent details.completed-item');assert.equal(await tasks.count(),2);assert.equal(await tasks.locator(':scope[open]').count(),0);
 await page.locator('[data-tc-expand]').click();assert.equal(await tasks.locator(':scope[open]').count(),2);await page.locator('[data-tc-collapse]').click();assert.equal(await tasks.locator(':scope[open]').count(),0);
 await ensureOpen(tasks.first());await tasks.first().getByRole('button',{name:'编辑',exact:true}).click();assert.ok(await page.locator('#tcEditor').isVisible());await page.locator('#tcTitle').fill('完成任务已修改');await page.locator('#tcEditorForm button[type="submit"]').click();assert.equal((await stored('tasks')).find(t=>t.id==='t').note,'保留备注');
 await page.locator('[data-tc-task="t"]').getByRole('button',{name:'归档',exact:true}).click();assert.equal((await stored('tasks')).length,2);assert.equal(await page.locator('[data-tc-task="t"]').count(),0);await page.locator('#tcArchiveToggle').click();await ensureOpen(page.locator('[data-tc-task="t"] details'));await page.locator('[data-tc-task="t"]').getByRole('button',{name:'取消归档'}).click();await page.locator('#tcArchiveToggle').click();
 await ensureOpen(page.locator('[data-tc-task="t"] details'));await page.locator('[data-tc-task="t"]').getByRole('button',{name:'重新打开'}).click();assert.equal((await stored('tasks')).find(t=>t.id==='t').status,'进行中');assert.equal(await page.locator('[data-tc-task="t"] summary').count(),0);
 await page.locator('[data-tc-task="t"]').dragTo(page.locator('[data-tc-status="已完成"] header'),{sourcePosition:{x:8,y:8}});assert.equal((await stored('tasks')).find(t=>t.id==='t').status,'已完成');assert.equal(await page.locator('[data-tc-task="t"] details').evaluate(e=>e.open),false);
 await page.reload();await page.waitForFunction(()=>window.TaskCenter);await page.locator('nav button[data-v="tasks"]').click();assert.equal(await page.locator('#tcContent details[open]').count(),0);
 await mkdir('test-artifacts/completed',{recursive:true});await page.screenshot({path:'test-artifacts/completed/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-artifacts/completed/mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS completed project/task disclosure, bulk controls, edit, reopen, archive/restore, drag, reload, mobile');
}finally{await browser.close()}
