import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createDevServer} from '../scripts/codex/dev-server.mjs';
const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 await context.addInitScript(()=>{if(localStorage.reliableFixture)return;localStorage.reliableFixture='1';const d=new Date(),day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.tasks=JSON.stringify([{id:'t',title:'撤销测试',status:'进行中',due:day,note:'原备注',steps:[{id:'s',title:'原步骤',done:false}],extra:'保留'}]);localStorage.projects='[]';});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/mobile/');await page.waitForFunction(()=>window.MobileBootReady&&window.LambertAccount);
 await page.getByRole('button',{name:'完成：撤销测试',exact:true}).tap();await page.getByRole('button',{name:'撤销',exact:true}).waitFor();
 await page.evaluate(()=>{const rows=MobileStore.read('tasks',[]);rows[0].note='完成后修改的备注';rows[0].steps[0].title='完成后修改的步骤';MobileStore.write('tasks',rows);});
 await page.getByRole('button',{name:'撤销',exact:true}).tap();
 let task=await page.evaluate(()=>MobileStore.read('tasks',[])[0]);assert.equal(task.status,'进行中');assert.equal(task.note,'完成后修改的备注');assert.equal(task.steps[0].title,'完成后修改的步骤');assert.equal(task.extra,'保留');
 await page.reload();await page.waitForFunction(()=>window.MobileBootReady&&window.LambertAccount);assert.equal(await page.getByRole('button',{name:'完成：撤销测试',exact:true}).count(),1);
 // Real touch archive from the completed title, then the visible undo button.
 await page.getByRole('button',{name:'完成：撤销测试',exact:true}).tap();await page.locator('.fold').tap();
 const target=page.locator('[data-task-id="t"] .task-edit'),box=await target.boundingBox(),cdp=await context.newCDPSession(page);
 const dx=(await page.locator('[data-task-id="t"]').boundingBox()).width*.32,x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/12,y}]});await page.waitForTimeout(12);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>MobileStore.read('tasks',[])[0].archived===true);
 await page.waitForTimeout(350);await page.getByRole('button',{name:'撤销',exact:true}).tap();await page.waitForFunction(()=>!MobileStore.read('tasks',[])[0].archived,{},{timeout:4000});
 await page.waitForTimeout(250);await page.getByRole('button',{name:'重开：撤销测试',exact:true}).tap();
 // Pure operation receipts exercise repeat creation, stale status, identity and expiry guards.
 await page.evaluate(()=>{
  const check=(v,m)=>{if(!v)throw Error(m);},throws=(fn,m)=>{let failed=false;try{fn();}catch{failed=true;}check(failed,m);};
  let rows=MobileStore.read('tasks',[]);rows[0].repeat='daily';MobileStore.write('tasks',rows);
  const receipt=MobileTaskActions.perform('t','toggle');check(MobileStore.read('tasks',[]).length===2,'repeat created');MobileTaskActions.undo(receipt);check(MobileStore.read('tasks',[]).length===1,'unchanged generated occurrence removed');
  const edited=MobileTaskActions.perform('t','toggle');rows=MobileStore.read('tasks',[]);rows[1].note='已经编辑的后续任务';MobileStore.write('tasks',rows);throws(()=>MobileTaskActions.undo(edited),'must not remove edited occurrence');
  const archived=MobileTaskActions.perform('t','archive');rows=MobileStore.read('tasks',[]);rows[0].note='归档后备注';MobileStore.write('tasks',rows);MobileTaskActions.undo(archived);check(!MobileStore.read('tasks',[])[0].archived,'archive undo');check(MobileStore.read('tasks',[])[0].note==='归档后备注','preserve later fields');
  const stale=MobileTaskActions.perform('t','toggle');MobileTaskActions.perform('t','toggle');throws(()=>MobileTaskActions.undo(stale),'later state protected');
  const expired=MobileTaskActions.perform('t','archive');expired.expires=Date.now()-1;throws(()=>MobileTaskActions.undo(expired),'expiry');
  const switched={...expired,expires:Date.now()+5000};localStorage.lambert_active_account_v1='22222222-2222-4222-8222-222222222222';throws(()=>MobileTaskActions.undo(switched),'identity');localStorage.removeItem('lambert_active_account_v1');
 });
 assert.match(await page.locator('#workspaceSyncState').innerText(),/本地模式/);
 await context.setOffline(true);await page.waitForFunction(()=>document.getElementById('workspaceSyncState').textContent.includes('离线'));assert.match(await page.locator('#workspaceSyncState').innerText(),/离线/);
 await context.setOffline(false);await page.waitForFunction(()=>!document.getElementById('workspaceSyncState').textContent.includes('离线'));
 await page.evaluate(()=>{const write=LambertData.write;LambertData.write=function(){throw new DOMException('fixture','QuotaExceededError');};window.restoreWrite=()=>LambertData.write=write;try{LambertData.write('tasks',[]);}catch{};window.dispatchEvent(new CustomEvent('lambert-save-state',{detail:{phase:'failed'}}));});
 assert.match(await page.locator('#workspaceSyncState').innerText(),/修改未保存/);await page.evaluate(()=>window.restoreWrite());
 assert.deepEqual(errors,[]);await context.close();
 // Desktop's five UI entry families are exercised by existing task-center UI suites.
 const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
 await desktop.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 const web=await desktop.newPage();await web.goto(origin);await web.waitForFunction(()=>window.TaskCenter&&window.LambertAccount);
 assert.equal(await web.locator('#workspaceSyncState').isVisible(),true);
 await web.evaluate(()=>{window.LambertData.install({pending:()=>[],conflicts:()=>[]});});
 assert.equal(await web.locator('#workspaceSyncState').count(),1);
 await desktop.close();console.log('PASS reliability: mobile completion/undo/reload, selective restoration, repeat safety, stale/expiry/account guards, online/offline/error states, shared web status');
}finally{await browser.close();await new Promise(r=>server.close(r));}
