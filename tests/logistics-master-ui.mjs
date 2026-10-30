import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1380,height:940}});
const original={schema:1,route:'验证路线',modules:[{id:'test',name:'测试仓',category:'仓',enabled:true,stages:[{id:'scan-stage',name:'扫描',collapsed:false}],branches:[{id:'err',from:'scan',to:'issue',label:'异常',type:'exception'}],nodes:[
 {id:'scan',title:'扫码操作',stageId:'scan-stage',action:'执行真实扫描',infrastructure:{trace:{event:'PackageUp'},routing:{policy:'internal'},sources:[],metric:{},task:{}}},
 {id:'issue',title:'异常处理',stageId:'scan-stage',branchOnly:true,action:'异常归类'}
]}]};
await ctx.addInitScript(source=>localStorage.setItem('lambert_logistics_knowledge_v1',JSON.stringify(source)),original);
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(label,truth)=>{assert.ok(truth,label);console.log('PASS:',label);};
try{
 await page.goto(base+'?view=logistics');
 await page.locator('#lkTabMaster').waitFor({timeout:30000});
 check('legacy process tab remains visible',await page.locator('#lkTabProcess').isVisible());
 await page.locator('#lkTabMaster').click();
 await page.waitForFunction(()=>Boolean(window.X6?.Graph&&document.querySelector('#lmCanvas .x6-graph')));
 check('native X6 library loaded locally',await page.locator('#lmCanvas .x6-graph').count()===1);
 check('original process panel preserved and hidden while master shown',
  await page.locator('#lkProcess').isHidden()&&await page.locator('#lkMaster').isVisible());
 check('data nodes and relationships rendered',await page.locator('#lmCanvas .x6-node').count()>=3&&await page.locator('#lmCanvas .x6-edge').count()>=1);
 const old=await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1'));
 await page.locator('#lmAddNote').click();
 await page.locator('#lmSave').click();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_master_v1')));
 check('saving master only creates separate state',stored.notes.length===1);
 check('original document byte-identical',await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1'))===old);
 check('version envelope not created by master',await page.evaluate(()=>!localStorage.getItem('lambert_logistics_versions_v1')));
 await page.reload();
 await page.locator('#lkTabMaster').click();
 await page.waitForFunction(()=>document.querySelectorAll('#lmCanvas .x6-node').length>=4);
 check('master note survives reload',await page.locator('#lmCanvas .x6-node').count()>=4);
 await page.locator('#lkTabProcess').click();
 check('old canvas still works after returning',await page.locator('#lkProcess').isVisible()&&await page.locator('#lkModules .lk-module').count()>=1);
 check('no browser errors',errors.length===0);
 console.log('Master X6 browser regression passed.');
}finally{await browser.close();}
