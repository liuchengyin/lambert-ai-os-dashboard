import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:8793';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
const errors=[],missing=[],external=new Set();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(new URL(r.url()).origin===base&&r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/'))missing.push(new URL(r.url()).pathname);});
// Model mainland CDN failure explicitly; local workspace must still become ready.
await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base){external.add(url.origin);return route.abort();}return route.continue();});
const sentinel={id:'netlify-preserved',title:'测试任务',status:'进行中',unknown:{keep:true}};
try{
 await page.addInitScript(value=>{if(!localStorage.getItem('netlify_seed')){localStorage.setItem('netlify_seed','1');localStorage.setItem('tasks',JSON.stringify([value]));localStorage.setItem('mirror_sentinel','keep');}},sentinel);
 await page.goto(base);await page.waitForFunction(()=>!!window.TaskCenter&&!document.documentElement.hasAttribute('data-lambert-boot'));
 await page.locator('.shell').waitFor({state:'visible'});assert.ok(await page.locator('.shell').isVisible());assert.ok(await page.locator('#s1PrimaryNav').isVisible());
 const saved=await page.evaluate(()=>({task:JSON.parse(localStorage.tasks).find(t=>t.id==='netlify-preserved'),sentinel:localStorage.mirror_sentinel}));for(const [key,value] of Object.entries(sentinel))assert.deepEqual(saved.task[key],value);assert.equal(saved.sentinel,'keep');
 await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('mirror_preservation_probe',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>{const db=r.result,t=db.transaction('records','readwrite');t.objectStore('records').put({keep:true},'original');t.oncomplete=()=>{db.close();resolve();};t.onabort=()=>reject(t.error);};r.onerror=()=>reject(r.error);}));
 for(const view of ['tasks','reading','writing','english','knowledge']){const nav=page.locator(`nav button[data-v="${view}"]`).first();if(await nav.count()){await nav.click();await page.waitForTimeout(150);}}
 await page.reload();await page.waitForFunction(()=>!!window.TaskCenter&&!document.documentElement.hasAttribute('data-lambert-boot'));assert.equal(await page.evaluate(()=>localStorage.mirror_sentinel),'keep');assert.deepEqual(await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('mirror_preservation_probe',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('records');t.objectStore('records').get('original').onsuccess=e=>{resolve(e.target.result);db.close();};};})),{keep:true});
 for(const path of ['/lib/link-recovery.js','/vendor/pdfjs/pdf.mjs','/vendor/pdfjs/pdf.worker.mjs','/mobile/update-notes.json'])assert.equal((await context.request.get(base+path)).status(),200,path);
 for(const path of ['/api/ai-analyze','/tests/netlify-browser.mjs','/.env','/lib/feishu-review.js','/does-not-exist.js']){const response=await context.request.get(base+path);assert.equal(response.status(),404,path);assert.ok(!(await response.text()).includes('<title>Lambert'),path);}
 await page.route('**/lib/link-recovery.js*',r=>r.abort());await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.mirror_sentinel),'keep');await page.unroute('**/lib/link-recovery.js*');await page.reload();await page.waitForFunction(()=>!!window.TaskCenter&&!document.documentElement.hasAttribute('data-lambert-boot'));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(base+'/mobile/');await page.locator('#tabs button').first().waitFor();
 await page.route(url=>url.origin===base&&url.pathname==='/api/account-config',r=>r.fulfill({status:404,json:{configured:false,error:'mirror_backend_unavailable'}}));
 await page.route('**/.netlify/functions/account-config',r=>r.fulfill({json:{configured:true,url:'https://diagnostic-fixture.supabase.co',publishableKey:'sb_publishable_diagnostic_marker',siteUrl:'https://lambert-ai-os-cn-test.netlify.app'}}));
 await page.goto(base+'/account-diagnostics.html');await page.locator('#copy:enabled').waitFor();const diagnostic=await page.locator('#result').textContent();const rows=JSON.parse(diagnostic).results;assert.equal(rows[0].status,404);assert.equal(rows[1].configured,true);assert.equal(rows[1].validPublicKey,true);assert.ok(!diagnostic.includes('sb_publishable_diagnostic_marker'));assert.ok(!diagnostic.includes('diagnostic-fixture.supabase.co'));
 assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,checks:['no-white-screen','missing-link-recovery-reproduced-and-restored','local-assets','missing-assets-404','server-code-not-public','saved-data-preserved','mobile-startup','CDN-failure-does-not-block-workspace'],externalBlocked:[...external],hostedAPIsTested:false}));
}finally{await browser.close();}
