import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createDevServer} from '../scripts/codex/dev-server.mjs';
import '../mobile/task-model.js';
const M=globalThis.MobileTaskModel;
for(const [due,day,want] of [['2026-11-03','2026-11-05',2],['2025-12-31','2026-01-01',1],['2024-02-28','2024-03-01',2],['2026-03-08','2026-03-09',1],['2026-11-05','2026-11-05',0],['2026-11-06','2026-11-05',0],['2026-02-30','2026-11-05',0],['2026-11-03garbage','2026-11-05',0],['','2026-11-05',0],['2026-11-03T09:00:00Z','2026-11-05',2]])assert.equal(M.overdueDays({due},day),want);
for(const extra of [{status:'已完成'},{archived:true},{deletedAt:'x'}])assert.equal(M.overdueDays({due:'2026-11-03',...extra},'2026-11-05'),0);
const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-05T00:10:00Z')});
 await page.addInitScript(()=>{if(localStorage.overdueSeed)return;localStorage.overdueSeed='1';localStorage.projects=JSON.stringify([{id:'p',name:'测试项目'},{id:'q',name:'其他项目'}]);localStorage.tasks=JSON.stringify([
 {id:'old',title:'前天未完成',due:'2026-11-03',status:'待开始',projectId:'p',unknown:{keep:true}},
 {id:'doing',title:'昨天进行中',due:'2026-11-04',status:'进行中',projectId:'p'},
 {id:'today',title:'今天计划',due:'2026-11-05',status:'待开始',projectId:'p'},
 {id:'goal',title:'未来目标',due:'2026-11-10',status:'待开始',projectId:'p'},
 {id:'future',title:'未来未选',due:'2026-11-10',status:'待开始',projectId:'p'},
 {id:'other',title:'其他超期',due:'2026-11-02',status:'待开始',projectId:'q'},
 {id:'doneNow',title:'本地今天完成',due:'2026-11-01',completedAt:'2026-11-04T17:00:00Z',status:'已完成',projectId:'p'},
 {id:'doneOld',title:'昨天完成今天到期',due:'2026-11-05',completedAt:'2026-11-04T01:00:00Z',status:'已完成'},
 {id:'none',title:'无日期',due:'',status:'待开始'},
 {id:'bad',title:'无效日期',due:'2026-02-30',status:'待开始'},
 {id:'deleted',title:'删除超期',due:'2026-11-01',status:'待开始',deletedAt:'x'},
 {id:'archived',title:'归档超期',due:'2026-11-01',status:'待开始',archived:true}
 ]);localStorage.daily_reviews_v2=JSON.stringify({'2026-11-05':{taskIds:['old','goal','deleted']}});});
 await page.goto(base+'/mobile/');await page.locator('.overdue-group').waitFor();
 const stored=await page.evaluate(()=>localStorage.tasks);
 assert.equal(await page.locator('.overdue-group .task').count(),3);assert.equal(await page.locator('.today-group .task').count(),2);assert.equal(await page.locator('[data-task-id=old]').count(),1);assert.match(await page.locator('[data-task-id=old] .meta-date').innerText(),/11\/03 · 超期2天/);
 await page.getByRole('button',{name:'今日已完成 1',exact:false}).click();assert.equal(await page.locator('[data-task-id=doneNow]').count(),1);assert.equal(await page.locator('[data-task-id=doneOld]').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.tasks),stored);
 await page.getByRole('button',{name:'完成：前天未完成',exact:true}).click();assert.equal(await page.locator('.overdue-group .task').count(),2);assert.equal(await page.locator('.overdue-group [data-task-id=old]').count(),0);assert.equal(await page.locator('[data-task-id=old]').count(),1);assert.equal(await page.locator('[data-task-id=old] .over').count(),0);
 await page.getByRole('button',{name:'任务项目筛选',exact:true}).click();await page.getByRole('button',{name:'选择项目：测试项目',exact:true}).click();assert.equal(await page.locator('.overdue-group .task').count(),1);assert.equal(await page.locator('.today-group .task').count(),2);
 await page.getByRole('button',{name:'编辑：昨天进行中',exact:true}).click();await page.getByRole('button',{name:'改到今天',exact:true}).click();await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForTimeout(220);assert.equal(await page.locator('.overdue-group .task').count(),0);assert.equal(await page.locator('.today-group .task').count(),3);
 let saved=await page.evaluate(()=>JSON.parse(localStorage.tasks));assert.equal(saved.find(t=>t.id==='doing').due,'2026-11-05');assert.equal(saved.find(t=>t.id==='doing').status,'进行中');assert.equal(saved.find(t=>t.id==='old').due,'2026-11-03');assert.deepEqual(saved.find(t=>t.id==='old').unknown,{keep:true});
 await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByRole('button',{name:'任务项目筛选',exact:true}).click();await page.getByRole('button',{name:'选择项目：全部项目',exact:true}).click();assert.equal(await page.locator('[data-task-id=other] .over').count(),1);assert.equal(await page.locator('[data-task-id=bad] .over').count(),0);
 await page.getByRole('button',{name:'项目',exact:true}).click();await page.getByRole('button',{name:'查看项目：其他项目',exact:true}).click();await page.getByRole('group',{name:'项目任务状态筛选',exact:true}).getByRole('button',{name:'待开始',exact:true}).click();assert.equal(await page.locator('[data-task-id=other] .over').count(),1);
 await page.getByRole('button',{name:'任务',exact:true}).click();await page.getByRole('button',{name:'今日',exact:true}).click();
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.screenshot({path:'tests/screenshots/mobile-overdue.png',fullPage:true});
 await page.getByRole('button',{name:'编辑：今天计划',exact:true}).click();await page.getByRole('textbox',{name:'任务标题',exact:true}).fill('跨日编辑草稿');await page.clock.setSystemTime(new Date('2026-11-06T00:10:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.getByRole('textbox',{name:'任务标题',exact:true}).inputValue(),'跨日编辑草稿');await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForTimeout(220);assert.ok(await page.locator('.overdue-group [data-task-id=today]').count());
 assert.deepEqual(errors,[]);console.log('PASS: overdue groups, local-day completion, goals dedup, project filter, shared badges, manual rescheduling, preservation, widths and midnight draft safety');
}finally{await browser.close();await new Promise(r=>server.close(r));}
