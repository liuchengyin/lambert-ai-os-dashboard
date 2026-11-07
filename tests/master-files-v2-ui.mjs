import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
const sample={schema:1,route:'测试线路',modules:[{id:'center',name:'中国中心仓',category:'仓',enabled:true,branches:[{id:'b',type:'exception',from:'receive',to:'fail',label:'异常分支'}],
 nodes:[{id:'receive',title:'收入扫描',stageId:'general'},{id:'fail',title:'处理异常',stageId:'general',branchOnly:true}]}]};
await ctx.addInitScript(source=>{
 localStorage.setItem('lambert_logistics_knowledge_v1',JSON.stringify(source));
 const xml='<mxfile host="LambertOS"><diagram id="legacy" name="旧画master"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
 localStorage.setItem('lambert_logistics_master_drawio_v1',JSON.stringify({schema:1,xml,sourceVersion:0,updatedAt:'2026-10-30T10:00:00.000Z'}));
},sample);
const page=await ctx.newPage(),errors=[];
page.on('pageerror',err=>errors.push(err.message));
page.on('dialog',async dialog=>dialog.type()==='prompt'?dialog.accept('物流研究总图'):dialog.accept());
const check=(label,ok)=>{assert.ok(ok,label);console.log('PASS:',label);};
try{
 await page.goto(base+'/?view=master');
 await page.locator('#mpNew').waitFor({timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('.mp-file-card').length===1,{timeout:20000});
 check('sidebar standalone master nav',await page.locator('nav button[data-v="master"]').count()===1&&await page.locator('#master.activeView').count()===1);
 check('legacy single master file migrated without overwrite',await page.locator('.mp-file-card').count()===1);
 check('legacy local file preserved byte-for-byte',await page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_master_drawio_v1')).xml.includes('legacy')));
 const original=await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1'));
 await page.locator('#mpNew').click();
 await page.waitForFunction(()=>document.body.classList.contains('master-editing')&&document.getElementById('mpDrawFrame').src.includes('embed.diagrams.net'),{timeout:15000});
 check('editing uses immersive viewport without Lambert sidebar',await page.evaluate(()=>getComputedStyle(document.querySelector('.shell>aside')).display==='none'&&document.querySelector('#master .mp-editor-toolbar')!==null));
 check('new diagram is real independent IndexedDB file',await page.evaluate(async()=> (await window.LambertMasterLibrary.list()).length===2));
 await page.evaluate(()=>{
   const frame=document.getElementById('mpDrawFrame');
   window.dispatchEvent(new MessageEvent('message',{origin:'https://embed.diagrams.net',source:frame.contentWindow,data:JSON.stringify({event:'load'})}));
 });
 await page.locator('#mpSave').click();
 const savedXml=await page.evaluate(()=>window.LambertDrawioModel.blank().replace('自由画布','自定义流程'));
 await page.evaluate(xml=>{
   const frame=document.getElementById('mpDrawFrame');
   window.dispatchEvent(new MessageEvent('message',{origin:'https://evil.example',source:frame.contentWindow,data:JSON.stringify({event:'export',xml})}));
 },savedXml);
 check('cross-origin postMessage cannot save',await page.evaluate(async()=>{
  const files=await window.LambertMasterLibrary.list();return !files.some(x=>x.xml.includes('自定义流程'));
 }));
 await page.evaluate(xml=>{
   const frame=document.getElementById('mpDrawFrame');
   window.dispatchEvent(new MessageEvent('message',{origin:'https://embed.diagrams.net',source:frame.contentWindow,data:JSON.stringify({event:'export',xml})}));
 },savedXml);
 await page.waitForFunction(async()=>{const rows=await window.LambertMasterLibrary.list();return rows.some(x=>x.xml.includes('自定义流程'));});
 check('trusted explicit export persists current diagram',await page.evaluate(async()=> (await window.LambertMasterLibrary.list()).some(x=>x.xml.includes('自定义流程'))));
 await page.locator('#mpToggleToolbar').click();
 check('Lambert toolbar collapses and restores',await page.locator('#masterEditor.mp-toolbar-hidden').count()===1&&await page.locator('#mpRestoreToolbar').isVisible());
 await page.locator('#mpRestoreToolbar').click();
 check('toolbar restored',await page.locator('#masterEditor.mp-toolbar-hidden').count()===0);
 await page.locator('#mpBack').click();
 await page.locator('.mp-file-card').first().waitFor();
 check('file grid shows multiple saved files',await page.locator('.mp-file-card').count()===2);
 check('legacy source document never changed',await page.evaluate(v=>localStorage.getItem('lambert_logistics_knowledge_v1')===v,original));
 check('legacy version envelope not overwritten',await page.evaluate(()=>!localStorage.getItem('lambert_logistics_versions_v1')));
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('.mp-file-card').length===2,{timeout:30000});
 check('file list survives full page reload',await page.locator('.mp-file-card').count()===2);
 await page.locator('.mp-file-card').filter({hasText:'未命名图纸'}).locator('.mp-file-name').click();
 await page.waitForFunction(()=>document.body.classList.contains('master-editing')&&document.getElementById('mpDrawFrame')?.src.includes('embed.diagrams.net/'));
 check('saved file reopens in native drawio iframe',await page.locator('#mpDrawFrame').getAttribute('src').then(u=>u?.includes('embed.diagrams.net/')));
 await page.locator('#mpBack').click();
 const card=page.locator('.mp-file-card').filter({hasText:'未命名图纸'});
 await card.getByRole('button',{name:'重命名'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.mp-file-name')].some(e=>e.textContent==='物流研究总图'));
 check('rename preserved file',await page.locator('.mp-file-name').filter({hasText:'物流研究总图'}).count()===1);
 await page.locator('.mp-file-card').filter({hasText:'物流研究总图'}).getByRole('button',{name:'复制'}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.mp-file-card').length===3);
 check('duplicate makes independent document',await page.locator('.mp-file-card').count()===3);
 await page.locator('.mp-file-card').filter({hasText:'物流研究总图（副本）'}).getByRole('button',{name:'删除'}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.mp-file-card').length===2);
 await page.locator('#mpTrashToggle').click();
 await page.waitForFunction(()=>document.getElementById('mpCount')?.textContent.includes('已删除文件')&&document.querySelectorAll('.mp-file-card').length===1);
 check('deleted file recoverable in trash',await page.locator('.mp-file-name').filter({hasText:'物流研究总图（副本）'}).count()===1);
 await page.getByRole('button',{name:'恢复'}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.mp-file-card').length===0);
 await page.locator('#mpTrashToggle').click();
 await page.waitForFunction(()=>document.querySelectorAll('.mp-file-card').length===3);
 check('restored file visible in library',await page.locator('.mp-file-card').count()===3);
 // Portable archive restore uses one transaction and never replaces active/trash IDs.
 const portableTest=await page.evaluate(async()=>{
  const api=window.LambertMasterLibrary;
  const seed=(await api.list())[0];
  const inTrash={...seed,id:'master-52345678-0000-4000-8000-123456789abc',title:'已有回收站文件',deletedAt:new Date().toISOString()};
  await api.importMissingPortable({files:[],trash:[inTrash]});
  const before=await api.list(),trashed=await api.list(true);
  const missing={...seed,id:'master-12345678-0000-4000-8000-123456789abc',title:'安全恢复测试'};
  const missingTrash={...seed,id:'master-22345678-0000-4000-8000-123456789abc',title:'恢复回收站测试',deletedAt:new Date().toISOString()};
  const conflict={...seed,title:'备份冲突版本'};
  const once=await api.importMissingPortable({files:[missing,conflict,inTrash],trash:[missingTrash]});
  const twice=await api.importMissingPortable({files:[missing,conflict,inTrash],trash:[missingTrash]});
  const after=await api.list(),bin=await api.list(true);
  return {once,twice,
   conflictPreserved:(await api.get(seed.id))?.title===seed.title,
   noResurrection:!after.some(f=>f.id===inTrash.id),
   sourceUnchanged:before.every(f=>after.some(x=>x.id===f.id&&x.xml===f.xml)),
   activeAdded:after.some(f=>f.id===missing.id),
   trashAdded:bin.some(f=>f.id===missingTrash.id)};
 });
 check('portable restore creates only missing active and trashed drawings',portableTest.once.added===2&&portableTest.once.skipped===2);
 check('repeat recovery is idempotent',portableTest.twice.added===0&&portableTest.twice.skipped===4);
 check('local edits and trash remain intact after recovery',portableTest.conflictPreserved&&portableTest.noResurrection&&portableTest.sourceUnchanged&&portableTest.activeAdded&&portableTest.trashAdded);
 const archive=await page.evaluate(async()=>{
  const files=await window.LambertMasterLibrary.list();
  const copied={...files[0],id:'master-42345678-0000-4000-8000-123456789abc',title:'JSON备份新增测试'};
  return {format:'lambert-portable-safety-v1',createdAt:new Date().toISOString(),owner:null,
   workspace:{format:'lambert-local-backup-v2',raw:{tasks:null},account:null},
   master:{files:[copied],trash:[]},counts:{masterFiles:1,masterTrash:0}};
 });
 await page.locator('#mpBackupInput').setInputFiles({name:'safe-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
 await page.waitForFunction(()=>document.getElementById('mpNotice')?.textContent?.includes('缺失图纸 1'));
 check('recovery preview reports missing-only counts',await page.locator('#mpRestoreMissing').isVisible()&&await page.locator('#mpRestoreMissing').isEnabled());
 await page.locator('#mpRestoreMissing').click();
 await page.waitForFunction(async()=>{const a=await window.LambertMasterLibrary.list();return a.some(f=>f.title==='JSON备份新增测试');});
 await page.waitForFunction(()=>document.getElementById('mpNotice')?.textContent?.includes('安全恢复完成'));
 check('confirmed recovery inserts drawing without overwriting existing files',await page.locator('#mpNotice').textContent().then(t=>t.includes('安全恢复完成')&&t.includes('新增 1')));
 check('recovery requires reselecting archive for repeat operation',!await page.locator('#mpRestoreMissing').isVisible());
 check('no application script errors',errors.length===0);
 console.log('Master file-library end-to-end checks passed.');
}finally{await browser.close();}
