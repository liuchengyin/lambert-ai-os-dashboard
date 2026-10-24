// Fresh browser only; mock APIs so the production smoke cannot write cloud data.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const site='https://lambert-ai-os-dashboard.vercel.app';
for(const path of ['index.html','english-audio-v2.js','english-audio-store.mjs','english-audio-v2.css','english-learning.js']){
  const response=await fetch(`${site}/${path}?release=${process.env.GITHUB_SHA||'v21'}`,{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,path+' HTTP status');
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(await readFile(path)),path+' matches released source');
}
const browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'chrome',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',route=>route.fulfill({json:route.request().url().includes('/api/account-config')?{configured:false}:{ok:false,code:'release_smoke_no_cloud_calls'}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(site+'/?view=english');await page.locator('#eaFile:not([disabled])').waitFor();
  assert.equal(await page.locator('#eaAudioTab').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#eaBack').getAttribute('aria-label'),'后退3秒');
  assert.equal(await page.locator('#eaForward').getAttribute('aria-label'),'前进3秒');
  assert.equal(await page.locator('#eaSubtitleText').isVisible(),false);
  await page.locator('#eaSubtitles summary').click();assert.ok(await page.locator('#eaSubtitleText').isVisible());
  await page.locator('#eaSubtitles summary').press('Enter');assert.equal(await page.locator('#eaSubtitleText').isVisible(),false);
  await page.locator('#eaVideoTab').click();assert.ok(await page.locator('#englishVideoV1').isVisible());
  for(const view of ['home','projects','tasks','review','writing','reading','english','knowledge'])assert.equal(await page.locator(`nav button[data-v="${view}"]`).count(),1,view+' entry retained');
  await page.evaluate(()=>openView('tasks'));assert.equal(Math.round((await page.locator('.tc-project-focus').boundingBox()).height),165);
  await page.evaluate(()=>openView('english'));await page.locator('#eaAudioTab').click();await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await context.close();
  console.log('::notice title=V2.1 production verified::Live source matches release; audio-first, 3-second controls, collapsible subtitles, legacy video, navigation, 165px tasks and mobile layout passed. Cloud APIs mocked; no user data or ASR calls.');
}finally{await browser.close();}
