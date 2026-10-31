import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1280,height:920},serviceWorkers:'block'});
const original=[{id:'group',name:'工具',links:[{id:'present',url:'https://already.example/',title:'现在的链接'}]}];
const old=[{id:'group',name:'工具',links:[{id:'present',url:'https://already.example/',title:'旧名称'},{id:'lost',url:'https://missing.example/',title:'找回的链接',extra:'备注保留'}]}];
const oldPersonal=[{id:'personal',name:'个人',links:[{id:'personal-link',url:'https://personal.example/',title:'找回个人'}]}];
await ctx.addInitScript(data=>{
 if(!localStorage.getItem('knowledge_link_library_v1'))localStorage.setItem('knowledge_link_library_v1',JSON.stringify(data.original));
 localStorage.setItem('knowledge_link_locked_v1','true');
 const key='lambert_backup_v2:recovery-demo';
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({format:'lambert-local-backup-v2',raw:{
   knowledge_link_library_v1:JSON.stringify(data.old),
   knowledge_link_personal_v1:JSON.stringify(data.oldPersonal)
 }}));
},{original,old,oldPersonal});
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
let accept=false;
page.on('dialog',d=>accept?d.accept():d.dismiss());
const check=(label,value)=>{assert.ok(value,label);console.log('PASS:',label)};
const read=()=>page.evaluate(()=>({
 common:JSON.parse(localStorage.getItem('knowledge_link_library_v1')),
 personal:JSON.parse(localStorage.getItem('knowledge_link_personal_v1')||'null')
}));
try{
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8765/')+'?view=knowledge',{waitUntil:'domcontentloaded'});
 await page.locator('#knowledgeRecoveryOpen').click();
 await page.locator('#knowledgeRecoverLocal').waitFor({timeout:30000});
 check('restore control exists without auto-importing data',
  (await read()).common[0].links.length===1&&await page.locator('#knowledgeRecoverLocal').isVisible());
 await page.locator('#knowledgeRecoverLocal').click();
 check('cancelling preserves both current and guest snapshots',
  (await read()).common[0].links.length===1&&(await read()).personal===null);
 accept=true;await page.locator('#knowledgeRecoverLocal').click();
 const after=await read();
 check('restore merges into common and personal without deletion',
  after.common[0].links.length===2&&after.personal[0].links.length===1);
 check('restore leaves current link unchanged',
  after.common[0].links.find(l=>l.id==='present').title==='现在的链接');
 check('recovered custom metadata survives',
  after.common[0].links.find(l=>l.id==='lost').extra==='备注保留');
 check('backup written before merge',
  await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('lambert_link_recovery_backup_v1:'))));
 await page.reload();await page.locator('#knowledgeRecoveryOpen').click();await page.locator('#knowledgeRecoverLocal').waitFor();
 const reload=await read();
 check('restored links persist after reload',reload.common[0].links.length===2&&reload.personal[0].links.length===1);
 await page.locator('#knowledgeRecoverLocal').click();
 check('repeated restoration does not duplicate links',(await read()).common[0].links.length===2);
 check('no browser runtime errors',errors.length===0);
 console.log('Link recovery browser checks passed');
}finally{await browser.close();}
