import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch(),errors=[];
async function page(path=''){
 const c=await browser.newContext();await c.addInitScript(()=>{window.auditObservers=[];const Native=MutationObserver;window.MutationObserver=class extends Native{constructor(callback){const stat={source:new Error().stack,calls:0};window.auditObservers.push(stat);super((records,observer)=>{stat.calls++;callback(records,observer)})}}});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});await p.locator('#rv2Save').waitFor({state:'attached'});return p;
}
try{
 for(const filter of ['', '完全不匹配']){
  const p=await page();await p.locator('nav button[data-v="projects"]').click();await p.locator('#projectComposeDetails').evaluate(e=>e.open=true);await p.locator('#projectNameInput').fill('关联项目'+filter);await p.locator('#projectTaskPicker').evaluate(e=>e.open=true);await p.locator('#projectTaskSearch').fill(filter);await p.locator('#projectCreateTaskBtn').click();await p.locator('#ptcTitle').fill('新建任务');await p.locator('#ptcSave').click();
  assert.equal(await p.locator('#projectTaskSummary').innerText(),'已选 1 个任务');await p.locator('#addProject').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.title==='新建任务').project),'关联项目'+filter);
  // Editing with a nonmatching search must retain the popup-created task too.
  await p.locator('.project-card-actions button').filter({hasText:'编辑'}).first().click();await p.locator('#projectEditTaskSearch').fill('完全不匹配');await p.locator('#projectEditCreateTaskBtn').click();await p.locator('#ptcTitle').fill('编辑新增任务');await p.locator('#ptcSave').click();await p.locator('#projectEditSave').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.title==='编辑新增任务').project),'关联项目'+filter);await p.context().close();
 }
 const p=await page('?view=reading&import=1&sourceUrl=https%3A%2F%2Fweread.qq.com%2Fweb%2Freader%2Fdemo&title=import-test');await p.waitForFunction(()=>document.getElementById('rv2Status')?.textContent==='已从浏览器侧栏导入');assert.equal(await p.locator('.reading-source-tabs button.active').getAttribute('data-mode'),'web');const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('reading_workspace_v2')));assert.ok(state.notes.some(n=>n.title==='import-test'));assert.equal(state.reader.url,'https://weread.qq.com/web/reader/demo');await p.context().close();
 const ordered=await browser.newContext(),op=await ordered.newPage();await op.route('**/daily-modules.js',async route=>{await new Promise(r=>setTimeout(r,650));await route.continue()});await op.goto(base,{waitUntil:'domcontentloaded'});await op.locator('#rv2Save').waitFor({state:'attached'});await op.waitForTimeout(800);assert.equal(await op.locator('#drHistory').count(),0);const stable=await op.locator('.reading-stable-page').count();await op.addScriptTag({content:readFileSync('daily-modules.js','utf8')});assert.equal(await op.locator('.reading-stable-page').count(),stable);assert.equal(await op.locator('#rv2Save').count(),1);await ordered.close();
 console.log('PASS delayed legacy loader cannot overwrite stable reading.');
 const q=await page();await q.locator('nav button[data-v="knowledge"]').click();await q.waitForTimeout(450);await q.evaluate(()=>window.auditObservers.forEach(s=>s.calls=0));await q.locator('#knowledgeSearch').pressSequentially('book',{delay:25});await q.waitForTimeout(100);const stats=await q.evaluate(()=>window.auditObservers.filter(s=>/ai-chat\.js|deepseek-v1\.js|writing-history-link\.js|reading-history-bridge\.js/.test(s.source)).map(s=>s.calls));assert.ok(stats.length>=3);assert.ok(stats.every(n=>n===0));await q.context().close();
 console.log('PASS no unrelated AI/writing/legacy reading observer work during link search.');
 assert.deepEqual(errors,[]);
 console.log('PASS project creation/editing with hidden filtered tasks; reading URL import preserves note and uses web mode.');
}finally{await browser.close()}
