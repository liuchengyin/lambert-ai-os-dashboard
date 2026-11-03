import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1420,height:920}});
const errors=[],dialogs=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
await page.route('https://embed.diagrams.net/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body>draw.io testing frame<script>window.received=[];window.addEventListener("message",e=>{try{window.received.push(JSON.parse(e.data));}catch{}});</script></body></html>'}));
function check(name,ok){assert.ok(ok,name);console.log('PASS:',name)}
async function send(event,xml,sourceOrigin='https://embed.diagrams.net'){
 await page.evaluate(({event,xml,sourceOrigin})=>{
  const frame=document.getElementById('mpDrawFrame');
  window.dispatchEvent(new MessageEvent('message',{origin:sourceOrigin,source:frame.contentWindow,data:JSON.stringify(xml?{event,xml}:{event})}));
 },{event,xml,sourceOrigin});
}
async function savedFile(){return page.evaluate(async()=> (await window.LambertMasterLibrary.list())[0]||null);}
async function xml(label){return page.evaluate(s=>window.LambertDrawioModel.blank().replace('自由画布',s),label);}
async function enter(){
 await page.locator('#mpNew').waitFor({timeout:30000});
 await page.locator('#mpNew').click();
 await page.waitForFunction(()=>document.getElementById('mpDrawFrame')?.src.includes('embed.diagrams.net'));
 await page.frameLocator('#mpDrawFrame').locator('body').waitFor();
 await send('load');
 await page.waitForFunction(()=>document.getElementById('mpSaveStatus')?.textContent.includes('已保存'));
}
try{
 await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
 await page.goto(origin+'/?view=master');
 await enter();
 check('autosave badge replaces Save button',await page.locator('#mpSave').count()===0&&await page.locator('#mpSaveStatus').textContent().then(x=>x.startsWith('已保存')));
 check('back and undo/redo controls available',await page.locator('#mpBack').isVisible()&&await page.locator('#mpUndo').isVisible()&&await page.locator('#mpRedo').isVisible());
 const original=(await savedFile()).xml;
 const first=await xml('仓库收入自动保存');
 await send('autosave',first,'https://evil.example');
 check('spoofed autosave ignored',(await savedFile()).xml===original);
 await send('autosave',first);
 check('pending state shows actual saving',await page.locator('#mpSaveStatus').textContent().then(s=>s.includes('保存中')));
 await page.waitForFunction(async()=>{const x=(await window.LambertMasterLibrary.list())[0];return x?.xml.includes('仓库收入自动保存');});
 check('autosave persists without click',(await savedFile()).xml.includes('仓库收入自动保存'));
 check('status reports saved after IndexedDB confirmation',await page.locator('#mpSaveStatus').textContent().then(s=>s.includes('已保存')));
 await send('autosave',await xml('旧版本即将被覆盖'));
 await send('autosave',await xml('最后一次自动保存'));
 await page.waitForFunction(async()=>{const x=(await window.LambertMasterLibrary.list())[0];return x?.xml.includes('最后一次自动保存');});
 check('rapid edits persist newest XML',(await savedFile()).xml.includes('最后一次自动保存'));
 await page.locator('#mpUndo').click();
 await page.locator('#mpRedo').click();
 const actions=await page.frameLocator('#mpDrawFrame').locator('body').evaluate(()=>window.received.filter(m=>m.action==='invokeAction').map(m=>m.actionName));
 check('Undo and Redo invoke native editor',actions.includes('undo')&&actions.includes('redo'));
 const savedBeforeInvalid=(await savedFile()).xml;
 await send('autosave','<script>bad</script>');
 check('invalid autosave does not overwrite and reports failure',
  (await page.locator('#mpSaveStatus').textContent()).includes('失败') && (await savedFile()).xml===savedBeforeInvalid);
 const repaired=await xml('恢复后的正确自动保存');
 await send('autosave',repaired);
 await page.waitForFunction(async()=>{const x=(await window.LambertMasterLibrary.list())[0];return x?.xml.includes('恢复后的正确自动保存');});
 check('valid autosave recovers after failure',(await savedFile()).xml.includes('恢复后的正确自动保存'));
 await page.locator('#mpBack').click();
 check('back waits for final export',await page.locator('#masterEditor').isVisible());
 const final=await xml('返回前最终版本');
 await send('export',final);
 await page.waitForFunction(()=>document.getElementById('masterLibrary')?.hidden===false);
 check('back returns only after XML is stored',(await savedFile()).xml.includes('返回前最终版本'));
 check('no native confirmation dialog',dialogs.length===0);
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('.mp-file-card').length===1);
 await page.locator('.mp-file-name').first().click();
 await page.frameLocator('#mpDrawFrame').locator('body').waitFor();
 await send('load');
 check('saved data survives reload',(await savedFile()).xml.includes('返回前最终版本'));
 await page.locator('#mpBack').click();
 await send('export','<script>bad</script>');
 check('invalid return export keeps editing',await page.locator('#masterEditor').isVisible()&&(await savedFile()).xml.includes('返回前最终版本'));
 check('no uncaught JS errors',errors.length===0);
 console.log('Draw.io auto-save and undo/back regression passed.');
}finally{await browser.close();}
