import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1366,height:900}});
const originalTasks=[
  {id:'ai-t1',title:'梳理履约 SLA',status:'待开始',priority:'P1',matrix:'q1',due:'2026-10-20',project:'履约治理',note:'本地私密备注'},
  {id:'ai-t2',title:'学习 SQL',status:'进行中',priority:'P2',matrix:'q2',due:'',project:'学习',note:''}
];
await ctx.addInitScript(tasks=>{
  localStorage.setItem('tasks',JSON.stringify(tasks));
  localStorage.setItem('projects',JSON.stringify([{id:'p1',name:'履约治理',status:'进行中',due:'2026-10-31'}]));
  localStorage.setItem('top3_task_ids_v1',JSON.stringify(['ai-t1']));
},originalTasks);
const page=await ctx.newPage();
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/ai-analyze',async route=>{
  const body=route.request().postDataJSON();
  requests.push(body);
  if(body.action==='login')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,authenticated:true})});
  if(body.action==='analyze'){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,generatedAt:new Date().toISOString(),result:{
        summary:'今天先处理 SLA，避免分散注意力',
        focus:[{taskId:'ai-t1',why:'重要且紧急',nextAction:'先写出3个核心指标'}],
        alerts:[{taskId:'ai-t1',severity:'high',reason:'请关注截止日期'}],
        observations:['<img src=x onerror=alert(1)>']
      }
    })});
  }
  return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false})});
});
const check=(name,ok)=>{assert.ok(ok,name);console.log('PASS:',name)};
try{
  await page.goto(BASE,{waitUntil:'load'});
  await page.locator('#aiDailyCard').waitFor({state:'visible'});
  // The existing app adds createdAt/defaults during startup; compare AI behavior to that baseline.
  const baselineTasks=await page.evaluate(()=>JSON.parse(localStorage.getItem('tasks')));
  check('Existing task content survives application startup',originalTasks.every(t=>baselineTasks.some(row=>row.id===t.id&&row.title===t.title&&row.note===t.note)));
  check('AI is opt-in, no calls before consent',requests.length===0);
  await page.getByRole('button',{name:'同意发送任务摘要并启用'}).click();
  check('Masked AI login dialog appears',await page.locator('.ai-login-dialog input[type=password]').isVisible());
  await page.locator('.ai-login-dialog input').fill('fake-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.locator('#aiDailyCard .ai-summary').waitFor({state:'visible'});
  check('Consent triggers login and first analysis',requests.filter(x=>x.action==='login').length===1&&requests.filter(x=>x.action==='analyze').length===1);
  const payload=requests.find(x=>x.action==='analyze');
  check('Only whitelisted fields sent',payload.tasks.length===2&&payload.tasks.every(x=>!('note'in x)));
  check('Top 3 preserved in request',payload.top3Ids[0]==='ai-t1');
  check('DeepSeek result appears in home',await page.locator('#aiDailyCard').innerText().then(x=>x.includes('今天先处理 SLA')));
  check('AI content rendered as text (not executable HTML)',await page.locator('#aiDailyCard img').count()===0);
  check('Original tasks and notes unchanged',await page.evaluate(tasks=>JSON.stringify(JSON.parse(localStorage.getItem('tasks')))===JSON.stringify(tasks),baselineTasks));
  await page.reload({waitUntil:'load'});
  await page.locator('#aiDailyCard .ai-summary').waitFor({state:'visible'});
  check('Same-day reload uses cache without another API call',requests.filter(x=>x.action==='analyze').length===1);
  await page.locator('#aiDailyCard button').filter({hasText:'重新分析'}).click();
  await page.waitForFunction(()=>document.querySelector('#aiDailyCard .ai-summary'));
  await page.waitForTimeout(250);
  check('Manual refresh makes another request',requests.filter(x=>x.action==='analyze').length===2);
  await page.locator('nav button[data-v="tasks"]').click();
  await page.selectOption('#tcProjectSelect','p1');
  await page.locator('#aiTaskAction').waitFor({state:'visible'});
  check('Task board has AI analysis action',await page.locator('#aiTaskAction button').isVisible());
  await page.locator('#aiTaskAction button').click();
  await page.waitForTimeout(250);
  check('Task analysis displays suggestions in task board',await page.locator('#aiTaskResult').innerText().then(x=>x.includes('先写出3个核心指标')));
  check('Task analysis also calls API',requests.filter(x=>x.action==='analyze').length===3);
  check('No uncaught JavaScript errors',errors.length===0);
  console.log('DeepSeek UI smoke passed.');
}catch(e){console.error(e.stack);console.error('Errors:',errors);process.exitCode=1}
finally{await browser.close()}
