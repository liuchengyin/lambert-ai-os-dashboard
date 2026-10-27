import assert from 'node:assert/strict';import {chromium} from 'playwright';import {createDevServer} from '../scripts/codex/dev-server.mjs';
const server=createDevServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
const user='11111111-1111-4111-8111-111111111111';
try{for(const mobile of [false,true]){
 const ctx=await browser.newContext({viewport:{width:mobile?390:1440,height:900},serviceWorkers:'block'});
 await ctx.route('**/api/account-config',r=>r.fulfill({json:{configured:true,url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture',siteUrl:'https://fixture.example'}}));
 // State-machine fixture only. The real SDK/two-client flow is tested separately.
 await ctx.route('**/shared-sync/vendor/supabase-2.118.0.mjs',r=>r.fulfill({contentType:'text/javascript',body:`export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{id:'${user}',email:'fixture@example.com'}}}}),getUser:async()=>({data:{user:{id:'${user}'}}}),onAuthStateChange:()=>({})},from:()=>({select(){return this},order(){return this},range(){return this},setHeader:async()=>({data:[]})}),rpc:(name,p)=>({setHeader:async()=>({data:{status:'applied',record:{user_id:'${user}',kind:p.p_kind,item_id:p.p_item_id,payload:p.p_payload,version:p.p_expected_version+1,deleted_at:null}}})})};}`}));
 await ctx.addInitScript(user=>{if(localStorage.statusFixture)return;localStorage.statusFixture='1';localStorage.lambert_active_account_v1=user;const now=new Date(),due=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');const payload={id:'t',title:'冲突定位测试',status:'进行中',project:'',priority:'P2',due:due+'T23:59',note:'本机备注',labels:[],matrix:'q2',createdAt:'2026-10-20T01:00:00Z'};localStorage.setItem('lambert_workspace_v1:'+user+':base',JSON.stringify([{user_id:user,kind:'tasks',item_id:'t',payload,version:1,deleted_at:null}]));},user);
 const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+(mobile?'/mobile/':'/'));await p.waitForFunction(()=>window.LambertAccount&&(!document.getElementById('app')||window.MobileBootReady));
 await p.waitForFunction(()=>LambertAccount.statusDetail().phase==='synced');assert.match(await p.locator('#workspaceSyncState').innerText(),/已同步/);
 await ctx.setOffline(true);await p.waitForFunction(()=>LambertAccount.statusDetail().phase==='offline');
 await p.evaluate(()=>{const tasks=LambertData.read('tasks',[]);tasks[0].note='离线修改';LambertData.write('tasks',tasks);});
 assert.match(await p.locator('#workspaceSyncState').innerText(),/离线/);
 await ctx.setOffline(false);await p.evaluate(()=>window.dispatchEvent(new Event('online')));await p.waitForFunction(()=>LambertAccount.statusDetail().phase==='synced');
 await p.evaluate(user=>{const payload=LambertData.read('tasks',[])[0],record={user_id:user,kind:'tasks',item_id:'t',payload:{...payload,status:'已完成',note:'云端备注'},version:10,deleted_at:null};localStorage.setItem('lambert_workspace_v1:'+user+':batch:9999999999999999:fixture',JSON.stringify([{kind:'tasks',itemId:'t',payload,expectedVersion:1,deleted:false,mutationId:'fixture-conflict',conflict:record}]));},user);
 if(mobile){p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'完成：冲突定位测试',exact:true}).click();}
 else{await p.locator('nav button[data-v="tasks"]').click();await p.locator('.tc-advance').click();}
 await p.waitForFunction(()=>LambertAccount.statusDetail().phase==='error');await p.locator('#workspaceSyncState').click();
 const card=p.locator('[data-conflict-id="t"]');await card.waitFor();assert.equal(await card.locator('details').evaluate(e=>e.open),true);
 await card.getByRole('button',{name:'保留云端',exact:true}).click();await p.waitForFunction(()=>LambertData.read('tasks',[])[0].note==='云端备注');
 assert.equal(await p.evaluate(()=>LambertData.read('tasks',[])[0].status),'已完成');
 await p.getByRole('button',{name:'关闭账户',exact:true}).click();
 if(mobile){await p.locator('.fold').click();assert.equal(await p.getByRole('button',{name:'重开：冲突定位测试',exact:true}).count(),1);}
 else assert.equal(await p.locator('[data-tc-status="已完成"] [data-tc-task="t"]').count(),1);
 // Selecting a remote review must replace that date's old draft, on both ends.
 if(mobile)await p.getByRole('button',{name:'复盘',exact:true}).click();else await p.locator('nav button[data-v="review"]').click();
 const reviewField=mobile?p.getByLabel('复盘目标',{exact:true}):p.locator('#rv6Goal');
 await reviewField.fill('仍在界面中的旧草稿');
 await p.evaluate(({user,mobile})=>{
  const now=new Date(),day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-'),payload={goal:'本机复盘',taskIds:[],completion:'0'};
  const remote={user_id:user,kind:'reviews',item_id:day,payload:{...payload,goal:'明确选择的云端复盘'},version:20,deleted_at:null};
  localStorage.setItem('lambert_workspace_v1:'+user+':batch:9999999999999999:review',JSON.stringify([{kind:'reviews',itemId:day,payload,expectedVersion:1,deleted:false,mutationId:'review-conflict',conflict:remote}]));
  try{LambertData.write('daily_reviews_v2',{...LambertData.read('daily_reviews_v2',{}),[day]:{...payload,goal:'试图覆盖'}});}catch{}
 },{user,mobile});
 await p.locator('#workspaceSyncState').click();const reviewCard=p.locator('[data-conflict-kind="reviews"]');await reviewCard.getByRole('button',{name:'保留云端',exact:true}).click();
 await p.waitForFunction(()=>Object.values(LambertData.read('daily_reviews_v2',{})).some(r=>r.goal==='明确选择的云端复盘'));
 assert.equal(await reviewField.inputValue(),'明确选择的云端复盘');await p.getByRole('button',{name:'关闭账户',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS '+(mobile?'App':'Web')+' sync status / offline-reconnect / conflict deep link / explicit remote resolution / live view refresh');await ctx.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));}
