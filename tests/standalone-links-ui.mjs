import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1200,height:860}});
const original=[{id:'g_saved',name:'日常',links:[{id:'l_saved',title:'已有链接',url:'https://example.com/',desc:'保留原内容'}]}];
await context.addInitScript(data=>{
  localStorage.setItem('knowledge_link_library_v1',JSON.stringify(data));
  localStorage.setItem('knowledge_link_personal_v1',JSON.stringify([{id:'g_secret',name:'私人',links:[{id:'l_secret',title:'绝不公开',url:'https://example.net/'}]}]));
  localStorage.setItem('knowledge_active_tab_v1',JSON.stringify('personal'));
  localStorage.setItem('knowledge_link_locked_v1','true');
},original);
const page=await context.newPage();
const fetched=[];const errors=[];
page.on('request',req=>fetched.push(new URL(req.url()).pathname));
page.on('pageerror',err=>errors.push(err.message));
try{
  await page.goto(new URL('links.html',base).href);
  await page.locator('#knowledgeGroups .knowledge-group').first().waitFor();
  assert.equal(await page.title(),'Links · 常用链接');
  assert.equal(await page.locator('#knowledgeLibraryTag').innerText(),'常用');
  assert.equal(await page.locator('#knowledgeTabSwitch').isVisible(),false);
  assert.equal(await page.getByText('已有链接').count(),1);
  assert.equal(await page.getByText('绝不公开').count(),0);
  assert.equal(await page.locator('nav, #tasks, #projects, #review').count(),0);
  assert.equal(await page.locator('#knowledgeQuickAdd').isVisible(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('knowledge_link_library_v1')),JSON.stringify(original));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('knowledge_active_tab_v1'))),'personal');
  assert.ok(!fetched.includes('/dashboard-v5.js'),'must not load dashboard enhancements');
  assert.ok(!fetched.includes('/app.js'),'must not load main workspace');
  assert.equal(errors.length,0,'browser errors: '+errors.join('; '));
  console.log('PASS: isolated standalone links use existing common data without exposing personal/workspace UI');
}finally{await browser.close();}
