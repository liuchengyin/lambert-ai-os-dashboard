import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
const errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8000/'))external.push(r.url())});
const state=()=>page.evaluate(()=>window.FlowAtlas.getState());
const click=selector=>page.locator(selector).click();
const settle=()=>page.waitForTimeout(100);
try{
 await page.goto('http://127.0.0.1:8000/flow-atlas/');await page.waitForFunction(()=>!!window.FlowAtlas);await settle();
 assert.equal(await page.locator('.node').count(),11);assert.equal(await page.locator('.expanded').count(),0);assert.equal((await state()).running,false);
 const initial=await state();await page.waitForTimeout(300);assert.deepEqual(await state(),initial,'idle must not render or tick');
 const catalog=await page.evaluate(()=>window.NETWORK_ATLAS.nodes.map(n=>({id:n.id,steps:n.l2.map(s=>({id:s.id,label:s.label,what:s.what}))})));
 let count=0;
 for(const n of catalog){
   await click(`[data-node="${n.id}"]`);
   assert.equal(await page.locator('.expanded').count(),1);assert.equal(await page.locator('.node[aria-expanded=true]').count(),1);
   for(const s of n.steps){await click(`[data-step="${s.id}"]`);assert.equal(await page.locator('#concept-title').innerText(),s.label);assert.equal(await page.locator('.concept-section p').first().innerText(),s.what);count++;}
 }
 assert.equal(count,48);assert.equal(await page.locator('.node').count(),11);
 await click('[data-node="server"]');await click('[data-node="server"]');assert.equal(await page.locator('.expanded').count(),0);
 await page.locator('#concept-search').fill('TCP 三次握手');await page.locator('#concept-search').press('Enter');assert.equal((await state()).selected,'tcp-2');
 await page.locator('#concept-search').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('#search-results img').count(),0);await page.locator('#concept-search').press('Escape');
 await page.locator('#concept-search').fill('');
 const reading=(await state()).selected;
 await click('#play');await page.waitForTimeout(220);assert.equal((await state()).running,true);assert.equal(await page.locator('#packet').getAttribute('hidden'),null);
 assert.equal((await state()).selected,reading);await click('#play');await settle();
 const stopped=await state();await page.waitForTimeout(300);assert.deepEqual(await state(),stopped,'paused must not schedule loops');
 await click('#reset');
 const returnNodes=[];
 for(let i=0;i<18;i++){await click('#step');const s=await state();if(s.phase==='response')returnNodes.push(await page.locator('.node.current').getAttribute('data-node'));}
 assert.equal((await state()).complete,true);assert.equal((await state()).running,false);assert.ok(!returnNodes.includes('dns'));assert.ok(!returnNodes.includes('url'));assert.equal((await state()).selected,reading);
 await click('#direction');assert.equal((await state()).phase,'request');assert.equal((await state()).selected,reading);
 await click('#play');await click('#play');await settle();assert.equal((await state()).animationScheduled,false);
 await page.locator('[data-node="tcp"]').focus();await page.keyboard.press('Enter');assert.equal((await state()).opened,null);await page.keyboard.press('Enter');assert.equal((await state()).opened,'tcp');
 await click('[data-step="tcp-2"]');await settle();
 await mkdir('/tmp/flow-atlas-qa',{recursive:true});await page.screenshot({path:'/tmp/flow-atlas-qa/desktop.png',fullPage:true});
 for(const width of [1000,820,700,390,320]){
   await page.setViewportSize({width,height:900});await settle();
   assert.equal((await state()).selected,'tcp-2');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
   const boxes=await page.locator('.node').evaluateAll(nodes=>nodes.map(n=>({x:n.offsetLeft,y:n.offsetTop,w:n.offsetWidth,h:n.offsetHeight})));
   for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=boxes[a],y=boxes[b];assert.ok(!(x.x<y.x+y.w&&x.x+x.w>y.x&&x.y<y.y+y.h&&x.y+x.h>y.y),'nodes overlap');}
 }
 await page.setViewportSize({width:390,height:844});await settle();await click('[data-step="tcp-2"]');await page.waitForTimeout(500);await page.screenshot({path:'/tmp/flow-atlas-qa/mobile-concept.png'});
 await page.locator('.map-toolbar').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/flow-atlas-qa/mobile-map.png'});
 await page.goto('http://127.0.0.1:8000/flow-atlas/#ip/ip-3');await page.waitForFunction(()=>window.FlowAtlas?.getState().selected==='ip-3');assert.equal(await page.locator('.step[aria-pressed=true]').count(),1);
 await page.emulateMedia({reducedMotion:'reduce'});await click('#play');await settle();assert.notEqual(await page.locator('#packet').getAttribute('hidden'),null);await click('#play');
 await page.evaluate(()=>window.FlowAtlas.destroy());await settle();const dead=await state();await page.waitForTimeout(200);assert.deepEqual(await state(),dead,'destroy leaves no callbacks');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({ok:true,nodes:11,concepts:count,widths:[1440,1000,820,700,390,320],checks:['expand/collapse','independent L3','search/deep link','reading/playback isolation','return skips DNS','completion stops','idle/pause/destroy stable','keyboard','responsive/no overlap','reduced motion','no external requests']}));
}finally{await browser.close()}
