import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createDevServer} from '../scripts/codex/dev-server.mjs';

// Use the same server as npm run dev, not a separate permissive HTTP fixture.
const server=createDevServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const user='11111111-1111-4111-8111-111111111111';
try {
  for(const mode of ['guest','account']) {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/api/account-config',route=>route.fulfill({json:{configured:false,localPreview:true}}));
    await context.addInitScript(({mode,user})=>{
      if(localStorage.flow_fixture)return;
      localStorage.flow_fixture='1';
      const projects=[{id:'p',name:'流转测试项目',category:'工作',status:'进行中',start:'2026-10-20',due:'2026-10-30'}];
      const tasks=['one','two','three','four','five'].map((id,index)=>({id,title:'任务 '+id,status:'待开始',projectId:'p',project:'流转测试项目',labels:['工作'],matrix:'q2',priority:'P2',start:'2026-10-20T10:00',due:'2026-10-30T23:59',createdAt:'2026-10-20T10:00:00Z',note:'保留备注 '+id,custom:{keep:index},steps:[{id:'step-'+id,title:'保留步骤',done:false}]}));
      localStorage.projects=JSON.stringify(projects);localStorage.tasks=JSON.stringify(tasks);
      localStorage.task_center_preferences_v1=JSON.stringify({projectId:'p',view:'board'});
      if(mode==='account'){
        localStorage.lambert_active_account_v1=user;
        localStorage.setItem('lambert_private_v1:'+user+':task_center_preferences_v1',JSON.stringify({projectId:'p',view:'board'}));
        const base=projects.map(payload=>({kind:'projects',item_id:payload.id,payload,version:1,deleted_at:null}));
        base.push(...tasks.map(payload=>({kind:'tasks',item_id:payload.id,payload,version:1,deleted_at:null})));
        // A cloud tombstone and another account cache must survive every edit.
        base.push({kind:'tasks',item_id:'deleted',payload:{id:'deleted',title:'不能复活'},version:4,deleted_at:'2026-10-20'});
        localStorage.setItem('lambert_workspace_v1:'+user+':base',JSON.stringify(base));
        localStorage.setItem('lambert_workspace_v1:22222222-2222-4222-8222-222222222222:base','[]');
      }
    },{mode,user});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const saved=()=>page.evaluate(()=>LambertData.read('tasks',[]));
    const status=async(id,value)=>{
      assert.equal((await saved()).find(t=>t.id===id).status,value,mode+' persisted '+id);
      assert.equal(await page.locator(`[data-tc-task="${id}"]`).evaluate(el=>el.closest('[data-tc-status]').dataset.tcStatus),value,mode+' visible '+id);
    };
    try {
      for(const path of ['lib/task-center-model.js','lib/link-sites.js?v=fixture'])assert.equal((await context.request.get(base+'/'+path)).status(),200,path);
      await page.goto(base);await page.waitForFunction(()=>window.TaskCenter&&!document.documentElement.hasAttribute('data-lambert-boot'));
      await page.locator('nav button[data-v="tasks"]').click();
      await page.locator('[data-tc-task="one"] .tc-advance').click();await status('one','进行中');
      await page.locator('[data-tc-task="one"] .tc-advance').click();await status('one','已完成');
      assert.equal(await page.locator('[data-tc-task="one"] details').evaluate(el=>el.open),false);
      // Drag from the title, not only the 1px edge used by older tests.
      await page.locator('[data-tc-task="two"] .tc-task-title').dragTo(page.locator('[data-tc-status="进行中"] .tc-cards'));
      await status('two','进行中');
      await page.locator('[data-tc-task="two"]').dragTo(page.locator('[data-tc-status="已完成"] header'),{sourcePosition:{x:1,y:1}});await status('two','已完成');
      await page.locator('[data-tc-task="two"] .tc-task-title').dragTo(page.locator('[data-tc-status="待开始"] header'));await status('two','待开始');
      await page.reload();await page.waitForFunction(()=>window.TaskCenter);await page.locator('nav button[data-v="tasks"]').click();await status('one','已完成');await status('two','待开始');
      if(mode==='guest') {
        await page.evaluate(()=>{const write=LambertData.write;LambertData.write=function(key,value){if(key==='tasks'){LambertData.write=write;throw new DOMException('fixture','QuotaExceededError');}return write(key,value);};});
        await page.locator('[data-tc-task="two"] .tc-advance').click();await status('two','待开始');
        assert.match(await page.locator('#tcNotice').innerText(),/存储空间不足/);
        assert.equal(await page.evaluate(()=>state.tasks.find(t=>t.id==='two').status),'待开始');
        await page.locator('[data-tc-task="two"] .tc-advance').click();await status('two','进行中');
      }
      if(mode==='account') {
        // Reproduce the screenshot: three pending conflicts. The existing journal
        // deliberately rejects their edits; no live account or API is contacted.
        await page.evaluate(user=>{
          const tasks=LambertData.read('tasks',[]);
          const ops=['one','two','three'].map(id=>({kind:'tasks',itemId:id,payload:tasks.find(t=>t.id===id),expectedVersion:1,deleted:false,mutationId:'conflict-'+id,conflict:{kind:'tasks',item_id:id,payload:{...tasks.find(t=>t.id===id),note:'另一端的备注'},version:2,deleted_at:null}}));
          localStorage.setItem('lambert_workspace_v1:'+user+':batch:9999999999999999:fixture',JSON.stringify(ops));
        },user);
        const conflictsBefore=await page.evaluate(user=>localStorage.getItem('lambert_workspace_v1:'+user+':batch:9999999999999999:fixture'),user);
        await page.locator('[data-tc-task="two"] .tc-advance').click();await status('two','待开始');
        assert.match(await page.locator('#tcNotice').innerText(),/同步冲突.*未流转/);
        assert.equal(await page.evaluate(()=>state.tasks.find(t=>t.id==='two').status),'待开始','rejected click rolls back in-memory mutation');
        const beforeOrder=await page.evaluate(()=>LambertPrivateStorage.getItem('task_drag_order_v1'));
        await page.locator('[data-tc-task="three"]').dragTo(page.locator('[data-tc-status="已完成"] header'),{sourcePosition:{x:1,y:1}});await status('three','待开始');
        assert.match(await page.locator('#tcNotice').innerText(),/同步冲突.*未流转/);
        assert.equal(await page.evaluate(()=>LambertPrivateStorage.getItem('task_drag_order_v1')),beforeOrder,'rejected drop does not save order');
        // A rejected record used to poison the whole state array, blocking a
        // subsequent save even for an unrelated, conflict-free task.
        await page.locator('[data-tc-task="four"] .tc-advance').click();await status('four','进行中');
        await page.locator('[data-tc-task="five"]').dragTo(page.locator('[data-tc-status="已完成"] header'),{sourcePosition:{x:1,y:1}});await status('five','已完成');
        await page.locator('[data-tc-task="two"] .tc-task-title').click();await page.locator('#tcTitle').fill('保留未提交的输入');
        await page.locator('#tcEditorForm button[type="submit"]').click();
        assert.equal(await page.locator('#tcEditor').evaluate(el=>el.open),true);
        assert.equal(await page.locator('#tcTitle').inputValue(),'保留未提交的输入');
        assert.match(await page.locator('#tcEditorError').innerText(),/同步冲突/);
        await page.locator('#tcCancel').click();
        assert.equal((await saved()).find(t=>t.id==='two').title,'任务 two');
        assert.equal(await page.evaluate(user=>localStorage.getItem('lambert_workspace_v1:'+user+':batch:9999999999999999:fixture'),user),conflictsBefore,'conflicts preserved for explicit resolution');
        assert.equal(await page.evaluate(()=>localStorage.getItem('lambert_workspace_v1:22222222-2222-4222-8222-222222222222:base')),'[]');
        assert.ok(!((await saved()).some(t=>t.id==='deleted')));
        await page.reload();await page.waitForFunction(()=>window.TaskCenter);await page.locator('nav button[data-v="tasks"]').click();await status('two','待开始');await status('four','进行中');await status('five','已完成');
        // Resolve only in this isolated fixture via the existing account path,
        // then verify normal advancement resumes after refreshing the snapshot.
        await page.evaluate(async user=>{const {WorkspaceJournal}=await import('/shared-sync/journal.mjs');new WorkspaceJournal(localStorage,user).resolve('tasks','two','local');},user);
        await page.reload();await page.waitForFunction(()=>window.TaskCenter);await page.locator('nav button[data-v="tasks"]').click();
        await page.locator('[data-tc-task="two"] .tc-advance').click();await status('two','进行中');
      }
      for(const task of await saved()){
        assert.equal(task.note,'保留备注 '+task.id);assert.deepEqual(task.custom,{keep:['one','two','three','four','five'].indexOf(task.id)});
        assert.equal(task.steps[0].id,'step-'+task.id);assert.equal(task.projectId,'p');assert.equal(task.start,'2026-10-20T10:00');assert.equal(task.due,'2026-10-30T23:59');
      }
      assert.deepEqual(errors,[]);console.log('PASS web task flow: '+mode+' click / title and edge drag / reload / preserved data'+(mode==='account'?' / 3 conflicts rollback / independent tasks remain usable / editor draft retained':''));
    }finally{await context.close();}
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
