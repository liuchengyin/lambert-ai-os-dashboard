import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',hasTouch:true,isMobile:true,timezoneId:'Asia/Shanghai'});
 page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-24T06:00:00Z'));
 await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 await page.addInitScript(()=>{if(localStorage.interactionSeed)return;localStorage.interactionSeed='1';localStorage.projects=JSON.stringify([{id:'p',name:'履约学习',status:'进行中'}]);localStorage.tasks=JSON.stringify([
  {id:'a',title:'今日阅读',due:'2026-10-24',status:'进行中',projectId:'p',note:'原备注',extra:'保留字段',updatedAt:'original',steps:[]},
  {id:'b',title:'练习 SQL',due:'2026-10-25',status:'进行中',projectId:'p'},
  {id:'d1',title:'最近完成',due:'2026-10-01',status:'已完成',projectId:'p',completedAt:'2026-10-24T05:00:00Z'},
  {id:'d2',title:'较早完成',due:'2026-10-30',status:'已完成',projectId:'p',completedAt:'2026-10-23T05:00:00Z'},
  {id:'d0',title:'历史无完成时间',status:'已完成',projectId:'p'},
  {id:'gone',title:'已归档数据',status:'已完成',archived:true}
 ]);});
 const base=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
 await page.goto(base+'/mobile/');await page.locator('.task-list').waitFor();
 const read=id=>page.evaluate(id=>JSON.parse(localStorage.tasks).find(t=>t.id===id),id);
 const row=id=>page.locator('[data-task-id="'+id+'"]');
 async function drag(id,dx,dy=0,cancel=false){let b=await row(id).boundingBox();let x=b.x+b.width*.45,y=b.y+b.height*.5;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});if(cancel)await row(id).dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await page.waitForTimeout(260);}
 assert.equal(await page.locator('#tabs button').count(),3);assert.equal(await page.locator('#tabs #accountButton').count(),0);assert.equal(await page.locator('#accountButton').isVisible(),false);
 // A full right drag still requires the separate completion click and opens exactly a quarter.
 const width=(await row('a').boundingBox()).width;await drag('a',width*.7);
 assert.equal((await read('a')).status,'进行中');assert.equal(await page.locator('.filter-swipe-frame').count(),0);
 assert.equal(await page.getByRole('button',{name:'今日',exact:true}).getAttribute('aria-pressed'),'true');
 assert.ok(Math.abs(await row('a').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m41)-width/4)<1);
 await mkdir('tests/screenshots',{recursive:true});await page.screenshot({path:'tests/screenshots/task-quarter-complete.png'});
 await page.getByRole('button',{name:'完成：今日阅读',exact:true}).filter({has:page.locator('svg')}).click();await page.waitForTimeout(280);assert.equal((await read('a')).status,'已完成');assert.ok((await read('a')).completedAt);
 await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('.fold').click();
 assert.deepEqual(await page.locator('.task.done').evaluateAll(ns=>ns.map(n=>n.dataset.taskId)),['a','d1','d2','d0']);
 assert.equal(await row('d1').locator('.meta-date').textContent(),'10/24');assert.equal(await row('d2').locator('.meta-date').textContent(),'10/23');assert.equal(await row('d0').locator('.meta-date').count(),0);
 // Archive is direct; short and cancelled drags never archive.
 await drag('d1',20);assert.equal((await read('d1')).archived,undefined);
 await drag('d1',width*.4,0,true);assert.equal((await read('d1')).archived,undefined);
 await drag('d1',width*.3);assert.equal((await read('d1')).archived,true);assert.equal((await read('d1')).status,'已完成');assert.equal(await row('d1').count(),0);
 await drag('b',5,55);assert.equal((await read('b')).status,'进行中');assert.equal(await page.locator('.filter-swipe-frame').count(),0);
 await drag('b',-width*.55);assert.ok(Math.abs(await row('b').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m41)+width/2)<1);assert.equal((await read('b')).deletedAt,undefined);
 await page.getByRole('button',{name:'删除：练习 SQL',exact:true}).click();await page.getByRole('button',{name:'撤销删除',exact:true}).click();assert.equal((await read('b')).deletedAt,undefined);
 // Editing persists without closing and repeated automatic saves do not conflict with themselves.
 await page.getByRole('button',{name:'编辑：今日阅读',exact:true}).click();const dlg=page.getByRole('dialog',{name:'编辑任务',exact:true});
 assert.equal(await dlg.getByRole('button',{name:'保存修改',exact:true}).count(),0);
 await dlg.getByLabel('备注',{exact:true}).fill('第一次自动保存');await page.waitForTimeout(650);assert.equal((await read('a')).note,'第一次自动保存');assert.equal(await dlg.count(),1);
 await dlg.getByLabel('备注',{exact:true}).fill('第二次自动保存');await page.waitForTimeout(650);assert.equal((await read('a')).note,'第二次自动保存');
 await dlg.getByRole('button',{name:'添加步骤',exact:true}).click();assert.equal(await dlg.locator('.mtd-add.editing').count(),1);assert.equal(await dlg.locator('.mtd-step-plus').textContent(),'');
 const step=dlg.getByLabel('新步骤',{exact:true});await step.fill('第一步');await step.press('Enter');await step.fill('第二步');await step.press('Enter');assert.equal(await step.evaluate(n=>n===document.activeElement),true);
 await dlg.getByLabel('步骤文字',{exact:true}).first().fill('第一步修改');await page.waitForTimeout(650);
 assert.deepEqual((await read('a')).steps.map(s=>s.title),['第一步修改','第二步']);
 await dlg.getByRole('button',{name:'步骤完成：第一步',exact:true}).click();await page.waitForTimeout(650);assert.equal((await read('a')).steps[0].done,true);
 // Compose events protect unfinished Chinese IME text.
 const note=dlg.getByLabel('备注',{exact:true});await note.dispatchEvent('compositionstart');await note.fill('输入中的中文');await page.waitForTimeout(650);assert.equal((await read('a')).note,'第二次自动保存');await note.dispatchEvent('compositionend');await page.waitForTimeout(650);assert.equal((await read('a')).note,'输入中的中文');
 await step.fill('失焦提交第三步');await dlg.getByRole('button',{name:'返回',exact:true}).click();assert.equal(await page.locator('.mtd-closing').count(),1);await page.waitForTimeout(220);assert.equal(await dlg.count(),0);assert.equal((await read('a')).steps.length,3);assert.equal((await read('a')).extra,'保留字段');
 await page.reload();await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('.fold').click();await page.getByRole('button',{name:'编辑：今日阅读',exact:true}).click();assert.equal(await page.getByLabel('备注',{exact:true}).inputValue(),'输入中的中文');await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForTimeout(220);
 // Failed automatic writes retain the editor, the draft, and the stored data for retry.
 await page.getByRole('button',{name:'编辑：练习 SQL',exact:true}).click();await page.evaluate(()=>{window.realWrite=MobileStore.write;MobileStore.write=()=>{throw Error('模拟存储失败');};});await page.getByLabel('备注',{exact:true}).fill('失败后重试');await page.waitForTimeout(650);await page.getByRole('button',{name:'返回',exact:true}).click();assert.equal(await page.locator('.mtd-dialog').count(),1);assert.equal((await read('b')).note,undefined);await page.evaluate(()=>{MobileStore.write=window.realWrite;});await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForTimeout(220);assert.equal((await read('b')).note,'失败后重试');
 // Concurrent updates must not be overwritten by a stale editor.
 await page.getByRole('button',{name:'编辑：练习 SQL',exact:true}).click();await page.evaluate(()=>{let ts=JSON.parse(localStorage.tasks);let t=ts.find(t=>t.id==='b');t.note='其他页面的新内容';t.updatedAt='external-edit';localStorage.tasks=JSON.stringify(ts);});await page.getByLabel('备注',{exact:true}).fill('本页旧草稿');await page.waitForTimeout(650);assert.equal((await read('b')).note,'其他页面的新内容');assert.match(await page.locator('.mtd-error').textContent(),/其他页面修改/);await page.reload();
 // Project task rows share completion, editing and direct archive semantics.
 await page.getByRole('button',{name:'项目',exact:true}).click();await page.getByRole('button',{name:'查看项目：履约学习',exact:true}).click();let pb=await row('b').boundingBox();await drag('b',pb.width*.35);assert.equal((await read('b')).status,'进行中');await page.locator('.task-swipe-complete').click();await page.waitForTimeout(260);assert.equal((await read('b')).status,'已完成');
 await page.getByRole('button',{name:'已完成',exact:true}).click();assert.deepEqual(await page.locator('.project-task-items .task').evaluateAll(ns=>ns.map(n=>n.dataset.taskId)),['a','b','d2','d0']);await drag('b',pb.width*.3);assert.equal((await read('b')).archived,true);
 await page.getByRole('button',{name:'任务',exact:true}).click();await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('.fold').click();assert.equal(await row('b').count(),0);
 await page.getByRole('button',{name:'复盘',exact:true}).click();assert.equal(await page.locator('.review-datebar #accountButton').count(),1);assert.equal(await page.locator('#accountButton').isVisible(),true);
 await page.getByLabel('复盘目标',{exact:true}).fill('日期切换保留草稿');await page.getByRole('button',{name:'明天',exact:true}).click();await page.getByRole('button',{name:'今天',exact:true}).click();assert.equal(await page.getByLabel('复盘目标',{exact:true}).inputValue(),'日期切换保留草稿');
 await page.locator('#accountButton').click();await page.locator('.lambert-account').waitFor();await page.keyboard.press('Escape');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'tests/screenshots/connected-review-'+width+'.png'});}
 assert.deepEqual(errors,[]);assert.equal((await read('gone')).archived,true);
 console.log('PASS: quarter-width explicit completion, half-width explicit deletion/undo, no filter collision, completion-time sort/date, direct archive/cancel safety, repeated autosave/IME/steps/fade/reload, write failure retry, concurrent-edit protection, project parity, account relocation, review drafts, 320/390/430 layout');
}finally{await browser.close();}
