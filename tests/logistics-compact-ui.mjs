import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1440,height:950}});
const src={schema:1,route:'研究路线',modules:[
{id:'warehouse',name:'国内中心仓',category:'仓',enabled:true,stages:[{id:'receive',name:'收入',collapsed:false}],branches:[],nodes:[{id:'scan',title:'仓库扫码',stageId:'receive'}]},
{id:'transport',name:'陆运干线',category:'干',enabled:true,stages:[{id:'road',name:'陆运',collapsed:false}],branches:[],nodes:[{id:'depart',title:'发运',stageId:'road'}]},
{id:'customs',name:'清关',category:'关',enabled:true,stages:[],branches:[],nodes:[{id:'release',title:'放行'}]},
{id:'lastmile',name:'末端配送',category:'配',enabled:true,stages:[],branches:[],nodes:[{id:'deliver',title:'派送'}]}
]};
await ctx.addInitScript(data=>localStorage.setItem('lambert_logistics_knowledge_v1',JSON.stringify(data)),src);
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const ok=(msg,value)=>{assert.ok(value,msg);console.log('PASS:',msg);};
try{
 await page.route('**/api/account-config',route=>route.fulfill({json:{configured:false}}));
 await page.goto(url+'/?view=logistics');
 await page.locator('#lkMoreButton').waitFor({timeout:30000});
 ok('物流Draw renamed',await page.locator('nav button[data-v="logistics"]').textContent().then(x=>x.includes('物流Draw'))&&await page.locator('#logistics h2').first().textContent()==='物流Draw');
 ok('process and overview are primary visible tabs',await page.locator('#lkTabProcess').isVisible()&&await page.locator('#lkTabOverview').isVisible()&&await page.locator('#lkTabData').isHidden()&&await page.locator('#lkTabSetup').isHidden());
 ok('original route banner removed from canvas',await page.locator('#logistics .lk-toolbar').isHidden());
 ok('search, version controls and transport tools moved into more drawer',await page.evaluate(()=>['lkSearch','lkUnlock','lkSaveDraft','lkHistorySelect','lkInfrastructureBase'].every(id=>document.getElementById(id)?.closest('#lkMoreDrawer'))));
 const before=await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1'));
 await page.locator('#lkMoreButton').click();
 ok('left drawer opens and brings search/edit tools',await page.locator('#lkMoreDrawer').isVisible()&&await page.locator('#lkSearch').isVisible());
 await page.locator('#lkCategoryFilter').selectOption('仓');
 await page.locator('#lkMoreApply').click();
 ok('filter confirm closes left drawer',await page.locator('#lkMoreDrawer').isHidden());
 const filtered=await page.locator('#lkModules .lk-canvas-block:not([hidden])').evaluateAll(nodes=>nodes.map(n=>n.dataset.module));
 ok('warehouse filter only draws warehouse blocks',filtered.length===1&&filtered[0]==='warehouse');
 await page.locator('#lkMoreButton').click();
 await page.locator('#lkMoreClear').click();
 ok('reset filter preserves modules',await page.locator('#lkModules .lk-canvas-block:not([hidden])').count()>=3);
 await page.locator('#lkMoreButton').click();
 await page.locator('#lkMoreData').click();
 ok('data relationships accessible from more',await page.locator('#lkData').isVisible());
 await page.locator('#lkTabOverview').click();
 ok('overview still available',await page.locator('#lkOverview').isVisible());
 await page.locator('#lkTabProcess').click();
 ok('canvas restored',await page.locator('#lkProcess').isVisible());
 ok('original logistics key unchanged',await page.evaluate(x=>localStorage.getItem('lambert_logistics_knowledge_v1')===x,before));
 await page.reload();
 await page.locator('#lkMoreButton').waitFor();
 ok('refresh keeps drawing-first page',await page.locator('#logistics .lk-toolbar').isHidden());
 ok('no browser JS errors',errors.length===0);
 console.log('Logistics Draw compact UI passed.');
}finally{await browser.close();}
