import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1360,height:900}});
const errors=[],dialogs=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
page.route('https://embed.diagrams.net/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>mock-editor</title>'}));
function check(name,ok){assert.ok(ok,name);console.log('PASS:',name)}
async function post(event,xml,originValue='https://embed.diagrams.net'){
 await page.evaluate(({event,xml,originValue})=>{
  const f=document.getElementById('mpDrawFrame');
  window.dispatchEvent(new MessageEvent('message',{origin:originValue,source:f.contentWindow,data:JSON.stringify(xml?{event,xml}:{event})}));
 },{event,xml,originValue});
}
async function savedFile(){return page.evaluate(async()=>{const docs=await window.LambertMasterLibrary.list();return docs[0]||null;});}
async function latestXml(tag){return page.evaluate(tag=>window.LambertDrawioModel.blank().replace('自由画布',tag),tag);}
async function ready(){
 await page.waitForFunction(()=>document.getElementById('mpDrawFrame')?.src.includes('embed.diagrams.net'));
 await post('load');
 await page.waitForFunction(()=>document.getElementById('mpSaveStatus')?.textContent.includes('就绪'));
}
try{
 await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 await page.goto(origin+'/?view=master');
 await page.locator('#mpNew').waitFor();
 await page.locator('#mpNew').click();
 await ready();
 check('opening a new diagram is not falsely marked dirty',await page.locator('#mpSaveStatus').textContent()==='编辑器已就绪');
 // draw.io's own top-left save should persist even without the host save button.
 const nativeXml=await latestXml('原生保存已生效');
 await post('save',nativeXml);
 await page.waitForFunction(async()=>{const x=(await window.LambertMasterLibrary.list())[0];return x?.xml.includes('原生保存已生效');});
 check('native draw.io save event persists XML', (await savedFile()).xml.includes('原生保存已生效'));
 check('native draw.io save does not navigate away',await page.locator('#masterEditor').isVisible());
 // Modified state must reflect editing, not initial loading.
 await post('autosave');
 check('actual edit marks diagram dirty',await page.locator('#mpSaveStatus').textContent()==='有未保存的修改');
 await page.locator('#mpSave').click();
 check('Save and return stays in the editor until XML is received',await page.locator('#masterEditor').isVisible());
 const hostXml=await latestXml('Lambert保存并返回成功');
 await post('export',hostXml,'https://malicious.example');
 check('untrusted postMessage is ignored',!(await savedFile()).xml.includes('Lambert保存并返回成功'));
 await post('export',hostXml);
 await page.waitForFunction(()=>document.getElementById('masterLibrary')?.hidden===false);
 check('clicking Save returns to files without confirmation',await page.locator('#masterLibrary').isVisible()&&dialogs.length===0);
 check('Save and return actually persisted XML',(await savedFile()).xml.includes('Lambert保存并返回成功'));
 const card=page.locator('.mp-file-card').first();
 await card.getByRole('button',{name:'重命名'}).click();
 check('Rename opens inline input instead of browser prompt',await card.getByRole('textbox',{name:'修改图纸名称'}).isVisible()&&dialogs.length===0);
 await card.getByRole('textbox',{name:'修改图纸名称'}).fill('中心操作全流程');
 await card.getByRole('textbox',{name:'修改图纸名称'}).press('Enter');
 await page.waitForFunction(()=>document.querySelector('.mp-file-name')?.textContent==='中心操作全流程');
 check('inline rename persists to document title',(await savedFile()).title==='中心操作全流程');
 // Refresh and reopen, verify latest saved drawing and renamed title.
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('.mp-file-name')?.textContent==='中心操作全流程');
 await page.locator('.mp-file-name').first().click();
 await ready();
 check('refresh and reopen keep saved XML',(await savedFile()).xml.includes('Lambert保存并返回成功'));
 // Back must export the freshest revision before returning.
 await page.locator('#mpBack').click();
 check('Back waits for editor export',await page.locator('#masterEditor').isVisible());
 const finalXml=await latestXml('返回时保存的最终版本');
 await post('export',finalXml);
 await page.waitForFunction(()=>document.getElementById('masterLibrary')?.hidden===false);
 check('Back returns only after successful save',await page.locator('#masterLibrary').isVisible());
 check('Back preserves last changes',(await savedFile()).xml.includes('返回时保存的最终版本'));
 check('no native prompts or confirms appeared',dialogs.length===0);
 await page.locator('.mp-file-name').first().click();
 await ready();
 // Do not lose edits if outbound save cannot be obtained. No popup and no unexpected exit.
 await page.locator('#mpSave').click();
 await post('export','<script>invalid</script>');
 check('invalid save leaves editor open and preserves original version',
  await page.locator('#masterEditor').isVisible()&&(await savedFile()).xml.includes('返回时保存的最终版本'));
 check('no browser JS errors',errors.length===0);
 console.log('Draw.io real save and back regression passed.');
}finally{await browser.close();}
