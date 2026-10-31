import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:8813';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({serviceWorkers:'block'}),requests=[];
try{
 await context.addCookies([{name:'mirror_preview_access_fixture',value:'authorized',url:base,httpOnly:true,sameSite:'Lax'}]);
 await context.route(url=>url.origin===base&&url.pathname==='/api/account-config',route=>{
  const authorized=(route.request().headers().cookie||'').includes('mirror_preview_access_fixture=authorized');requests.push(authorized);
  return route.fulfill(authorized?{json:{configured:true,url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture',siteUrl:'https://lambert-ai-os-cn-test.netlify.app'}}:{status:401,json:{error:'preview_protected'}});
 });
 await context.route('https://fixture.supabase.co/**',route=>route.abort());
 const page=await context.newPage();await page.goto(base+'/account.html');
 if(process.env.EXPECT_ORIGINAL==='1'){
  await page.getByText('邮箱登录正在准备，暂未连接账号服务。现有数据仍保存在本机。',{exact:true}).waitFor();assert.deepEqual(requests,[false]);
  console.log('REPRODUCED: original omit mode loses same-origin preview cookie, API401 becomes unconfigured login');
 }else{
  await page.getByLabel('邮箱',{exact:true}).waitFor();await page.getByLabel('密码',{exact:true}).waitFor();assert.deepEqual(requests,[true]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('lambert_active_account_v1')),null);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('lambert_auth_v1:'))),false);
  console.log('PASS: protected preview config gets same-origin access cookie, login form opens, no session or data auto-imported');
 }
}finally{await browser.close();}
