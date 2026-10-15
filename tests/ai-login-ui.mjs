import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),ctx=await browser.newContext();
await ctx.addInitScript(()=>localStorage.setItem('tasks',JSON.stringify([{id:'login-task',title:'登录验证任务',status:'待开始',priority:'P2',due:'',project:'',note:'私人备注',createdAt:'2026-10-10T00:00:00Z'}])));
const page=await ctx.newPage();let mode='wrong',loginCount=0,analysisCount=0;const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/ai-analyze',async route=>{
  const body=route.request().postDataJSON();
  if(body.action==='login'){
    loginCount++;
    if(mode==='network')return route.abort();
    if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,500));
    const data=mode==='wrong'?{ok:false,code:'wrong_password'}:mode==='redis'?{ok:false,code:'rate_store_unavailable'}:{ok:true,authenticated:true};
    return route.fulfill({status:mode==='wrong'?401:mode==='redis'?503:200,json:data});
  }
  analysisCount++;return route.fulfill({json:{ok:true,result:{summary:'真实任务分析成功',focus:[],alerts:[]}}});
});
const check=(label,value)=>{assert.ok(value,label);console.log('PASS:',label)};
try{
  await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:8000/');
  await page.getByRole('button',{name:'同意发送任务摘要并启用'}).click();
  // Password inputs do not have an implicit textbox role.
  const input=page.locator('.ai-login-dialog input');
  await input.press('Enter');check('Empty password does not call API',loginCount===0);
  await input.fill('incorrect');await input.press('Enter');
  await page.locator('.ai-login-error').filter({hasText:'401'}).waitFor();
  check('Wrong password stays in dialog for retry',await input.isVisible());
  check('Password remains masked',await input.getAttribute('type')==='password');
  check('Wrong password does not call paid provider',analysisCount===0);
  mode='redis';await input.fill('correct');await input.press('Enter');
  await page.locator('.ai-login-error').filter({hasText:'Upstash'}).waitFor();
  check('Redis failure shows the specific dependency',await input.isVisible()&&analysisCount===0);
  mode='network';await input.press('Enter');
  await page.locator('.ai-login-error').filter({hasText:'连接失败'}).waitFor();
  check('Network failure permits retry in same dialog',await page.locator('.ai-login-actions button').filter({hasText:'登录'}).isEnabled());
  mode='slow';await input.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.ai-login-actions .ai-primary')?.disabled===true);
  const countBefore=loginCount;await input.press('Enter');
  await page.locator('.ai-login-dialog').waitFor({state:'detached'});
  await page.locator('#aiDailyCard .ai-summary').waitFor();
  check('Repeated Enter while logging in does not duplicate login',loginCount===countBefore);
  check('Successful login resumes analysis once',analysisCount===1);
  check('No uncaught errors after failed login and retries',errors.length===0);
  console.log('AI login UI regression passed.');
}finally{await browser.close()}
