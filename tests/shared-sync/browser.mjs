import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const uid='11111111-1111-4111-8111-111111111111';
const user={id:uid,email:'tester@example.com',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fake';
const session={access_token:token,refresh_token:'fake-refresh-token',expires_in:3600,token_type:'bearer',user};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let context;
try{
 context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const errors=[],requests=[],rows=new Map(),receipts=new Map();let configured=false;
 await context.route('**/api/account-config',route=>route.fulfill({json:configured?{configured:true,url:'https://testproject.supabase.co',publishableKey:'sb_publishable_test',siteUrl:origin.replace('http:','https:')}:{configured:false}}));
 await context.route('https://testproject.supabase.co/**',async route=>{const r=route.request(),url=new URL(r.url());requests.push({path:url.pathname,body:r.postDataJSON()});const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};if(r.method()==='OPTIONS')return route.fulfill({status:200,headers});
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:session,headers});
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:user,headers});
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers});
  if(['/auth/v1/signup','/auth/v1/recover','/auth/v1/resend'].includes(url.pathname))return route.fulfill({json:{},headers});
  if(url.pathname==='/rest/v1/lambert_items')return route.fulfill({json:[...rows.values()],headers});
  if(url.pathname==='/rest/v1/rpc/lambert_apply_mutation'){const p=r.postDataJSON();let data=receipts.get(p.p_mutation_id);if(!data){const old=rows.get(p.p_item_id);if((old?.version||0)!==p.p_expected_version)data={status:'conflict',record:old};else{const record={user_id:uid,kind:p.p_kind,item_id:p.p_item_id,payload:p.p_payload,version:(old?.version||0)+1,deleted_at:p.p_deleted?'2026-10-19':null};rows.set(p.p_item_id,record);data={status:'applied',record};}receipts.set(p.p_mutation_id,data);}return route.fulfill({json:data,headers});}
  throw Error('unexpected API '+url.pathname);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/mobile/');await page.locator('#tabs button').first().waitFor();await page.locator('#accountButton').click();await page.getByText('邮箱登录正在准备，暂未连接账号服务。现有数据仍保存在本机。',{exact:true}).waitFor();assert.equal(await page.locator('.lambert-account input').count(),0);await page.getByRole('button',{name:'关闭账户',exact:true}).click();
 configured=true;await page.goto(origin+'/account.html');await page.getByLabel('邮箱',{exact:true}).waitFor();
 await page.evaluate(()=>{localStorage.setItem('tasks',JSON.stringify([{id:'guest',title:'本机原始任务',status:'进行中'}]));localStorage.setItem('daily_reviews_v1',JSON.stringify({'2026-10-18':{goal:'不能串入账号'}}));});
 await page.getByLabel('邮箱',{exact:true}).fill(user.email);await page.getByLabel('密码',{exact:true}).fill('test-password');await page.locator('.lambert-account button[type=submit]').click();await page.getByRole('button',{name:'使用云端工作台',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('lambert_active_account_v1')),null);assert.equal(requests.filter(r=>r.path.includes('lambert_apply_mutation')).length,0);
 await page.getByRole('button',{name:'使用云端工作台',exact:true}).click();await page.waitForFunction(()=>localStorage.getItem('lambert_active_account_v1'));await page.goto(origin+'/mobile/');await page.locator('#tabs button').first().waitFor();assert.equal(await page.getByText('本机原始任务',{exact:true}).count(),0);
 await page.getByRole('button',{name:'添加任务',exact:true}).click();await page.getByLabel('任务标题',{exact:true}).fill('手机同步任务');await page.getByRole('button',{name:'创建任务',exact:true}).click();await page.waitForFunction(()=>window.LambertAccount&&window.LambertAccount.status().includes('已同步'),null,{timeout:15000});assert.equal([...rows.values()].find(r=>r.payload.title==='手机同步任务')?.version,1);
 const desktop=await context.newPage();desktop.on('pageerror',e=>errors.push(e.message));await desktop.goto(origin+'/');await desktop.waitForFunction(()=>typeof state!=='undefined'&&state.tasks.some(t=>t.title==='手机同步任务'));assert.equal(await desktop.evaluate(()=>state.reviews['2026-10-18']),undefined);
 await desktop.evaluate(()=>{state.tasks.find(t=>t.title==='手机同步任务').status='已完成';persistTasks();});await desktop.waitForFunction(()=>window.LambertAccount?.status().includes('已同步'),null,{timeout:15000});assert.equal([...rows.values()].find(r=>r.payload.title==='手机同步任务').payload.status,'已完成');
 await page.reload();await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('.fold').click();await page.getByRole('button',{name:'重开：手机同步任务',exact:true}).waitFor();
 await page.locator('#accountButton').click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.waitForFunction(()=>!localStorage.getItem('lambert_active_account_v1'));await page.reload();await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByRole('button',{name:'编辑：本机原始任务',exact:true}).waitFor();assert.equal(await page.getByText('手机同步任务',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);await mkdir('tests/screenshots',{recursive:true});await page.locator('#accountButton').click();await page.getByLabel('邮箱',{exact:true}).waitFor();await page.screenshot({path:'tests/screenshots/email-login.png'});
 console.log(JSON.stringify({ok:true,checks:['unconfigured-local-mode','email-login-real-sdk-mocked-service','no-auto-import','mobile-create-upload','desktop-read-complete','mobile-read-completion','logout-guest-restored','legacy-review-isolation'],apiCalls:requests.length,hostedService:false}));
}finally{await context?.close();await browser.close();}
