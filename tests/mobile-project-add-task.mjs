import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createDevServer} from '../scripts/codex/dev-server.mjs';
const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(localStorage.projectAddSeed)return;localStorage.projectAddSeed='1';localStorage.projects=JSON.stringify([{id:'p1',name:'国际物流履约体系V1',status:'进行中',extra:'keep project'},{id:'p2',name:'其他项目',status:'进行中'}]);localStorage.tasks=JSON.stringify([{id:'existing',title:'其他项目任务',projectId:'p2',status:'进行中',unknown:'keep task'}]);});
 await page.goto(base+'/mobile/');await page.getByRole('button',{name:'项目',exact:true}).click();await page.getByRole('button',{name:'查看项目：国际物流履约体系V1',exact:true}).click();
 for(const status of ['待开始','进行中','已完成']){
  await page.getByRole('group',{name:'项目任务状态筛选',exact:true}).getByRole('button',{name:status,exact:true}).click();
  await page.getByRole('button',{name:'新增项目任务',exact:true}).click();await page.getByLabel('任务标题',{exact:true}).fill('从'+status+'创建');await page.getByRole('button',{name:'创建任务',exact:true}).click();
  await page.getByRole('button',{name:'编辑：从'+status+'创建',exact:true}).waitFor();assert.equal(await page.locator('.project-task-items').getAttribute('data-task-status'),'待开始');
  const row=await page.evaluate(title=>JSON.parse(localStorage.tasks).find(t=>t.title===title),'从'+status+'创建');assert.equal(row.projectId,'p1');assert.equal(row.project,'国际物流履约体系V1');assert.equal(row.status,'待开始');
 }
 assert.equal(await page.locator('.stat-total .project-stat-num').textContent(),'3');assert.equal(await page.locator('.project-task-items .task-edit').count(),3);
 await page.getByRole('group',{name:'项目任务状态筛选',exact:true}).getByRole('button',{name:'进行中',exact:true}).click();await page.getByRole('button',{name:'新增项目任务',exact:true}).click();await page.getByLabel('任务标题',{exact:true}).fill('取消草稿');await page.keyboard.press('Escape');assert.equal(await page.locator('.project-task-items').getAttribute('data-task-status'),'进行中');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.tasks).length),4);
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const add=page.getByRole('button',{name:'新增项目任务',exact:true});assert.ok(await add.evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n;}));}
 await page.getByRole('button',{name:'任务',exact:true}).click();await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByRole('button',{name:'编辑：从进行中创建',exact:true}).waitFor();await page.reload();const data=await page.evaluate(()=>({tasks:JSON.parse(localStorage.tasks),projects:JSON.parse(localStorage.projects)}));assert.equal(data.tasks.length,4);assert.equal(data.tasks.find(t=>t.id==='existing').unknown,'keep task');assert.equal(data.projects[0].extra,'keep project');assert.equal(data.tasks.filter(t=>t.projectId==='p1').length,3);assert.deepEqual(errors,[]);
 console.log('PASS: + in all project task states; defaults pending/current project; stays in detail and reveals new task; counters, cancel, total task list, persistence, unrelated fields and 320/390/768 widths');
}finally{await browser.close();await new Promise(r=>server.close(r));}
