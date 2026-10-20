import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const uid='11111111-1111-4111-8111-111111111111';
const user={id:uid,email:'tester@example.com',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fake';
const session={access_token:token,refresh_token:'fake-refresh-token',expires_in:3600,token_type:'bearer',user};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let context,desktopContext;
try{
 context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const errors=[],requests=[],rows=new Map(),receipts=new Map();let configured=false,failLogin=false;
 async function routes(ctx){await ctx.route('**/api/account-config',route=>route.fulfill({json:configured?{configured:true,url:'https://testproject.supabase.co',publishableKey:'sb_publishable_test',siteUrl:origin.replace('http:','https:')}:{configured:false}}));
 await ctx.route('**/api/feishu-review',async route=>{const request=route.request(),body=request.postDataJSON();assert.equal(request.headers().authorization,'Bearer '+token);const review=rows.get(body.date);assert.equal(review.payload.goal,'手机与网页复盘归档');requests.push({path:'/api/feishu-review',body});return route.fulfill({json:{ok:true,url:'https://my.feishu.cn/wiki/ReviewSnapshot1234',archivedAt:'2026-10-20T00:00:00Z',reviewVersion:review.version,locationName:'每日记录'}});});
 await ctx.route('https://testproject.supabase.co/**',async route=>{const r=route.request(),url=new URL(r.url());requests.push({path:url.pathname,body:r.postDataJSON()});const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};if(r.method()==='OPTIONS')return route.fulfill({status:200,headers});
  if(url.pathname==='/auth/v1/token')return route.fulfill(failLogin?{status:400,json:{code:'invalid_credentials',error_code:'invalid_credentials',msg:'Invalid login credentials'},headers}:{json:session,headers});
  if(url.pathname==='/auth/v1/verify')return route.fulfill(r.postDataJSON().token==='123456'?{json:session,headers}:{status:403,json:{code:'otp_expired',error_code:'otp_expired',msg:'Token expired'},headers});
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:user,headers});
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers});
  if(['/auth/v1/signup','/auth/v1/recover','/auth/v1/resend'].includes(url.pathname))return route.fulfill({json:{},headers});
  if(url.pathname==='/rest/v1/lambert_items')return route.fulfill({json:[...rows.values()],headers});
  if(url.pathname==='/rest/v1/rpc/lambert_apply_mutation'){const p=r.postDataJSON();let data=receipts.get(p.p_mutation_id);if(!data){const old=rows.get(p.p_item_id);if((old?.version||0)!==p.p_expected_version)data={status:'conflict',record:old};else{const record={user_id:uid,kind:p.p_kind,item_id:p.p_item_id,payload:p.p_payload,version:(old?.version||0)+1,deleted_at:p.p_deleted?'2026-10-19':null};rows.set(p.p_item_id,record);data={status:'applied',record};}receipts.set(p.p_mutation_id,data);}return route.fulfill({json:data,headers});}
  throw Error('unexpected API '+url.pathname);
 });
 }await routes(context);
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/mobile/');await page.locator('#tabs button').first().waitFor();await page.waitForFunction(()=>window.LambertAccount);await page.locator('#accountButton').click();await page.getByText('邮箱登录正在准备，暂未连接账号服务。现有数据仍保存在本机。',{exact:true}).waitFor();assert.equal(await page.locator('.lambert-account input').count(),0);await page.getByRole('button',{name:'关闭账户',exact:true}).click();
 configured=true;await page.goto(origin+'/account.html');await page.getByLabel('邮箱',{exact:true}).waitFor();
 await page.evaluate(()=>{localStorage.setItem('tasks',JSON.stringify([{id:'guest',title:'本机原始任务',status:'进行中'}]));localStorage.setItem('daily_reviews_v1',JSON.stringify({'2026-10-18':{goal:'不能串入账号'}}));});
 await page.getByLabel('邮箱',{exact:true}).fill(user.email);await page.getByLabel('密码',{exact:true}).fill('test-password');await page.locator('.lambert-account button[type=submit]').click();await page.getByRole('button',{name:'使用云端工作台',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('lambert_active_account_v1')),null);assert.equal(requests.filter(r=>r.path.includes('lambert_apply_mutation')).length,0);
 await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.getByRole('button',{name:'使用云端工作台',exact:true}).click()]);await page.goto(origin+'/mobile/');await page.locator('#tabs button').first().waitFor();assert.equal(await page.getByText('本机原始任务',{exact:true}).count(),0);
 await page.getByRole('button',{name:'新增任务',exact:true}).click();await page.getByLabel('任务标题',{exact:true}).fill('手机同步任务');await page.getByRole('button',{name:'创建任务',exact:true}).click();await page.waitForFunction(()=>window.LambertAccount&&window.LambertAccount.status().includes('已同步'),null,{timeout:15000});assert.equal([...rows.values()].find(r=>r.payload.title==='手机同步任务')?.version,1);
 desktopContext=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await routes(desktopContext);const desktop=await desktopContext.newPage();await desktop.goto(origin+'/account.html');await desktop.getByLabel('邮箱',{exact:true}).fill(user.email);await desktop.getByLabel('密码',{exact:true}).fill('test-password');await desktop.locator('.lambert-account button[type=submit]').click();await Promise.all([desktop.waitForNavigation({waitUntil:'load'}),desktop.getByRole('button',{name:'使用云端工作台',exact:true}).click()]);desktop.on('pageerror',e=>errors.push(e.message));await desktop.goto(origin+'/');await desktop.waitForFunction(()=>typeof state!=='undefined'&&state.tasks.some(t=>t.title==='手机同步任务'));assert.equal(await desktop.evaluate(()=>state.reviews['2026-10-18']),undefined);
 await desktop.evaluate(()=>{state.tasks.find(t=>t.title==='手机同步任务').status='已完成';persistTasks();});await desktop.waitForFunction(()=>window.LambertAccount?.status().includes('已同步'),null,{timeout:15000});assert.equal([...rows.values()].find(r=>r.payload.title==='手机同步任务').payload.status,'已完成');
 await desktop.waitForFunction(()=>document.getElementById('rv6Goal'));await desktop.evaluate(()=>openView('review'));await desktop.locator('#rv6Goal').fill('手机与网页复盘归档');await desktop.getByRole('button',{name:'归档到飞书',exact:true}).click();await desktop.getByText('已归档飞书 · 每日记录',{exact:true}).waitFor();assert.equal(await desktop.locator('#rv6FeishuOpen').getAttribute('href'),'https://my.feishu.cn/wiki/ReviewSnapshot1234');

 await desktop.waitForFunction(()=>window.LambertAccount?.status().startsWith('已同步'));// Archive metadata must finish uploading before the next preview.
 // Import remains available after cloud activation; the original guest bytes stay intact.
 await page.locator('#accountButton').click();await page.getByRole('button',{name:'检查并导入本机数据',exact:true}).click();
 await page.getByText(/将新增 1 条，相同 0 条，冲突 0 条/).waitFor();

 // A remote edit while the preview is open must invalidate the preview.
 rows.set('race-other',{user_id:uid,kind:'tasks',item_id:'race-other',payload:{id:'race-other',title:'另一端新任务',status:'进行中'},version:1,deleted_at:null});
 await page.locator('.lambert-account input[type=checkbox]').check();
 await page.getByRole('button',{name:'确认导入并启用同步',exact:true}).click();
 await page.getByText('数据已变化，请返回并重新检查导入。',{exact:true}).waitFor();
 assert.equal(rows.has('guest'),false);
 await page.getByRole('button',{name:'返回',exact:true}).click();
 await page.getByRole('button',{name:'检查并导入本机数据',exact:true}).click();
 await page.getByText(/将新增 1 条，相同 0 条，冲突 0 条/).waitFor();
 await page.locator('.lambert-account input[type=checkbox]').check();
 await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.getByRole('button',{name:'确认导入并启用同步',exact:true}).click()]);
 await page.waitForFunction(()=>window.LambertAccount?.status().includes('已同步'));
 assert.equal([...rows.values()].filter(r=>r.item_id==='guest').length,1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tasks'))[0].id),'guest');
 await page.locator('#accountButton').click();await page.getByRole('button',{name:'检查并导入本机数据',exact:true}).click();
 await page.getByText(/将新增 0 条，相同 1 条，冲突 0 条/).waitFor();await page.getByRole('button',{name:'返回',exact:true}).click();await page.getByRole('button',{name:'关闭账户',exact:true}).click();
 // Offline writes include projects and reviews; reconnect uploads without re-entering content.
 await context.setOffline(true);
 await page.evaluate(()=>{window.LambertData.writeMany({projects:[{id:'offline-project',name:'离线项目',status:'进行中'}],daily_reviews_v2:{...window.LambertData.read('daily_reviews_v2',{}),'2026-10-21':{goal:'离线复盘',taskIds:[]}}});});
 assert.equal(rows.has('offline-project'),false);
 await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>window.LambertAccount?.status().includes('已同步'));
 assert.equal(rows.get('offline-project').payload.name,'离线项目');assert.equal(rows.get('2026-10-21').payload.goal,'离线复盘');
 await desktop.reload();await desktop.getByRole('button',{name:'云端数据已更新，点击刷新',exact:true}).click();
 await desktop.waitForFunction(()=>window.LambertData?.read('projects',[]).some(p=>p.id==='offline-project'));
 assert.equal(await desktop.evaluate(()=>window.LambertData.read('daily_reviews_v2',{})['2026-10-21'].goal),'离线复盘');
 await page.reload();await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('.fold').click();await page.getByRole('button',{name:'重开：手机同步任务',exact:true}).waitFor();
 await page.locator('#accountButton').click();await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.getByRole('button',{name:'退出登录',exact:true}).click()]);await page.reload();await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByRole('button',{name:'编辑：本机原始任务',exact:true}).waitFor();assert.equal(await page.getByText('手机同步任务',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);await mkdir('tests/screenshots',{recursive:true});await page.waitForFunction(()=>window.LambertAccount);await page.locator('#accountButton').click();await page.getByLabel('邮箱',{exact:true}).waitFor();await page.screenshot({path:'tests/screenshots/email-login.png'});
 failLogin=true;await page.getByLabel('邮箱',{exact:true}).fill(user.email);await page.getByLabel('密码',{exact:true}).fill('wrong-password');await page.locator('.lambert-account button[type=submit]').click();await page.getByText('邮箱或密码不正确，请重试。',{exact:true}).waitFor();assert.equal(await page.getByLabel('密码',{exact:true}).inputValue(),'');failLogin=false;
 await page.getByRole('button',{name:'忘记密码',exact:true}).click();await page.getByLabel('邮箱',{exact:true}).fill(user.email);await page.getByRole('button',{name:'发送重置邮件',exact:true}).click();await page.getByText('如果该邮箱已注册，我们会发送重置密码邮件，请检查收件箱。',{exact:true}).waitFor();
 await page.getByRole('button',{name:'返回登录',exact:true}).click();await page.getByRole('button',{name:'注册账号',exact:true}).click();await page.getByLabel('邮箱',{exact:true}).fill(user.email);assert.equal(await page.getByLabel('密码',{exact:true}).count(),0);await page.getByRole('button',{name:'发送验证码',exact:true}).click();await page.getByLabel('邮箱验证码',{exact:true}).waitFor();await page.getByLabel('邮箱验证码',{exact:true}).fill('000000');await page.getByLabel('设置密码',{exact:true}).fill('test-password');await page.getByRole('button',{name:'完成注册',exact:true}).click();await page.getByText('验证码或验证链接无效、已过期，请重新获取。',{exact:true}).waitFor();assert.equal(await page.getByLabel('设置密码',{exact:true}).inputValue(),'test-password');await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByRole('button',{name:'完成注册',exact:true}).click();await page.getByText('注册成功，请用邮箱和密码登录。',{exact:true}).waitFor();assert.equal(await page.getByLabel('密码',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('邮箱',{exact:true}).inputValue(),user.email);assert.equal(await page.evaluate(()=>localStorage.getItem('lambert_active_account_v1')),null);assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('registration_memory'))),false);await page.getByLabel('密码',{exact:true}).fill('test-password');await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('button',{name:'使用云端工作台',exact:true}).waitFor();await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.getByRole('button',{name:'退出登录',exact:true}).click()]);
 await page.goto(origin+'/account.html#access_token='+token+'&refresh_token=fake-refresh-token&expires_in=3600&token_type=bearer&type=recovery');await page.getByLabel('新密码',{exact:true}).fill('new-test-password');await page.getByRole('button',{name:'保存新密码',exact:true}).click();await page.getByText('密码已更新。手机端可使用新密码登录。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>location.hash),'');
 console.log(JSON.stringify({ok:true,checks:['unconfigured-local-mode','email-login-real-sdk-mocked-service','no-auto-import','mobile-create-upload','desktop-read-complete','mobile-read-completion','logout-guest-restored','legacy-review-isolation','invalid-password','password-not-retained','reset-email','signup-confirmation','password-recovery-callback','review-sync-before-feishu-archive','import-preview-remote-race-blocked','import-after-activation','repeat-import-no-duplicates','offline-project-review-reconnect','desktop-reads-offline-project-review'],apiCalls:requests.length,hostedService:false}));
}catch(e){for(const p of context?.pages()||[]){console.error('PAGE_DIAGNOSTIC',JSON.stringify(await p.evaluate(()=>({url:location.pathname,status:window.LambertAccount?.status(),active:localStorage.getItem('lambert_active_account_v1'),hidden:document.hidden,dialog:document.querySelector('.lambert-account')?.innerText,pending:Object.keys(localStorage).filter(k=>k.includes('batch:')).map(k=>JSON.parse(localStorage[k])),data:window.LambertData?.read('tasks',[])})).catch(()=>({navigationInProgress:true}))));}throw e;}finally{await context?.close();await desktopContext?.close();await browser.close();}
