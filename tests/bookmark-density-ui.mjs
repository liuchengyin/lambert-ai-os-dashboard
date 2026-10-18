import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('knowledge_link_locked_v1','true');localStorage.setItem('knowledge_link_library_v1',JSON.stringify([{id:'dense',name:'三百个书签',links:Array.from({length:300},(_,i)=>({id:'dense-'+i,title:'完整书签标题 '+i+' · 这是一段需要省略但悬停时完整显示的长标题',url:'https://chatgpt.com/?item='+i,desc:'完整的说明内容，列表中只显示一行'}))}]))});
await page.route('https://**/*',route=>route.abort());
try{await page.goto('http://127.0.0.1:8000/');await page.locator('nav button[data-v="knowledge"]').click();
 const cards=page.locator('#knowledge .knowledge-link-card');assert.equal(await cards.count(),300);const box=await cards.first().boundingBox();assert.ok(box.width<=222&&box.height<=100,JSON.stringify(box));
 const link=cards.first().locator('a');const title=await link.getAttribute('aria-label');assert.equal(await link.getAttribute('data-tooltip'),title);assert.equal(await link.getAttribute('title'),null);
 await link.hover();await page.waitForTimeout(200);assert.equal(await link.evaluate(el=>getComputedStyle(el,'::after').opacity),'1');assert.equal(await link.evaluate(el=>getComputedStyle(el,'::after').content),JSON.stringify(title));
 await page.mouse.move(0,0);await link.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await page.waitForTimeout(200);assert.equal(await link.evaluate(el=>getComputedStyle(el,'::after').opacity),'1');
 await mkdir('tests/screenshots',{recursive:true});await page.screenshot({path:'tests/screenshots/bookmark-density-tooltip.png'});
 await page.locator('#knowledgeLock').click();await cards.first().getByRole('button',{name:'编辑',exact:true}).click();assert.ok(await page.locator('#kTitle').isEditable());await page.locator('#kCancel').click();
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);const b=await cards.first().boundingBox();assert.ok(b.width<=width-32);}
 await page.screenshot({path:'tests/screenshots/bookmark-density-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS: 300 compact bookmarks, full hover/focus title, edit controls and mobile no overflow');
}finally{await browser.close()}