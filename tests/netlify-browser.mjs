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
 assert.ok(await page.locator('.shell').isVisible());assert.ok(await page.locator('#s1PrimaryNav').isVisible());
 const saved=await page.evaluate(()=>({task:JSON.parse(localStorage.tasks).find(t=>t.id==='netlify-preserved'),sentinel:localStorage.mirror_sentinel}));for(const [key,value] of Object.entries(sentinel))assert.deepEqual(saved.task[key],value);assert.equal(saved.sentinel,'keep');
 for(const view of ['tasks','reading','writing','english','knowledge']){const nav=page.locator(`nav button[data-v="${view}"]`).first();if(await nav.count()){await nav.click();await page.waitForTimeout(150);}}
 await page.reload();await page.waitForFunction(()=>!!window.TaskCenter&&!document.documentElement.hasAttribute('data-lambert-boot'));assert.equal(await page.evaluate(()=>localStorage.mirror_sentinel),'keep');
 for(const path of ['/lib/link-recovery.js','/vendor/pdfjs/pdf.mjs','/vendor/pdfjs/pdf.worker.mjs','/mobile/update-notes.json'])assert.equal((await context.request.get(base+path)).status(),200,path);
 for(const path of ['/api/ai-analyze','/tests/netlify-browser.mjs','/.env','/lib/feishu-review.js','/does-not-exist.js']){const response=await context.request.get(base+path);assert.equal(response.status(),404,path);assert.ok(!(await response.text()).includes('<title>Lambert'),path);}
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(base+'/mobile/');await page.locator('#tabs button').first().waitFor();
 assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,checks:['no-white-screen','local-assets','missing-assets-404','server-code-not-public','saved-data-preserved','mobile-startup','CDN-failure-does-not-block-workspace'],externalBlocked:[...external],hostedAPIsTested:false}));
}finally{await browser.close();}
