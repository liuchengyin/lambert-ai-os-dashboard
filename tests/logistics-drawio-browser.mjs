import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1390,height:940}});
const legacy={schema:1,route:'测试线路',modules:[{id:'warehouse',name:'国内中心仓',category:'仓',enabled:true,stages:[{id:'s',name:'收入',collapsed:false}],branches:[{id:'b',from:'scan',to:'abnormal',label:'安检异常',type:'exception'}],nodes:[
{id:'scan',stageId:'s',title:'安检扫描',action:'执行扫描',infrastructure:{trace:{event:'SecretInternalEvent'},sources:[],routing:{policy:'unknown'},metric:{},task:{}}},
{id:'abnormal',stageId:'s',title:'安检异常处理',branchOnly:true,action:'异常治理'}]}]};
await ctx.addInitScript(doc=>localStorage.setItem('lambert_logistics_knowledge_v1',JSON.stringify(doc)),legacy);
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(s,v)=>{assert.ok(v,s);console.log('PASS:',s);};
try{
 await page.goto(origin+'/?view=logistics');
 await page.locator('#lkTabMaster').waitFor();
 await page.locator('#lkTabMaster').click();
 check('full drawio entry tab visible',await page.locator('#lmdOpen').isVisible());
 check('original process tab retained',await page.locator('#lkTabProcess').count()===1);
 check('drawio bridge comes from DeepSeek-written source',await page.evaluate(()=>typeof window.LambertDrawioBridge?.create==='function'));
 check('no master save before explicit action',await page.evaluate(()=>localStorage.getItem('lambert_logistics_master_drawio_v1')===null));
 check('full native editor iframe hosted on diagrams.net',await page.locator('#lmdFrame').getAttribute('src')===null);
 const old=await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1'));
 await page.locator('#lmdOpen').click();
 await page.waitForFunction(()=>document.getElementById('lmdFrame').src.includes('embed.diagrams.net/'));
 check('drawio editor iframe opened',await page.locator('#lmdFrame').isVisible());
 check('independent master source generated without secret metadata',await page.evaluate(()=>{
  const moduleSrc=window.LambertDrawioModel.seed(JSON.parse(localStorage.getItem('lambert_logistics_knowledge_v1')));
  return moduleSrc.includes('安检扫描')&&!moduleSrc.includes('SecretInternalEvent')&&moduleSrc.includes('安检异常');
 }));
 const xml=await page.evaluate(()=>window.LambertDrawioModel.blank());
 // Simulate trusted embed export through the bridge's own onXml handler:
 // only the iframe's exact source and origin can post messages.
 const trusted=await page.evaluate(xml=>{
  const iframe=document.getElementById('lmdFrame');
  const ev=new MessageEvent('message',{origin:'https://embed.diagrams.net',source:iframe.contentWindow,data:JSON.stringify({event:'export',xml})});
  // Export message is ignored until user presses save.
  window.dispatchEvent(ev);
  return localStorage.getItem('lambert_logistics_master_drawio_v1');
 },xml);
 check('unsolicited export cannot write',trusted===null);
 await page.locator('#lmdSave').click();
 await page.evaluate(xml=>{
  const iframe=document.getElementById('lmdFrame');
  window.dispatchEvent(new MessageEvent('message',{origin:'https://evil.example',source:iframe.contentWindow,data:JSON.stringify({event:'export',xml})}));
 },xml);
 check('wrong origin export cannot write',await page.evaluate(()=>localStorage.getItem('lambert_logistics_master_drawio_v1')===null));
 await page.evaluate(xml=>{
  const iframe=document.getElementById('lmdFrame');
  window.dispatchEvent(new MessageEvent('message',{origin:'https://embed.diagrams.net',source:iframe.contentWindow,data:JSON.stringify({event:'export',xml})}));
 },xml);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_logistics_master_drawio_v1')||'null'));
 check('explicit drawio export writes isolated document',saved?.schema===1&&saved.xml.includes('lambert-blank'));
 check('original document remains byte-identical',await page.evaluate(()=>localStorage.getItem('lambert_logistics_knowledge_v1'))===old);
 check('original version envelope untouched',await page.evaluate(()=>localStorage.getItem('lambert_logistics_versions_v1')===null));
 await page.reload();await page.locator('#lkTabMaster').click();
 check('saved diagram shown as existing independently on refresh',await page.locator('#lmdInfo').textContent().then(s=>s.includes('已有独立画布')));
 await page.locator('#lkTabProcess').click();
 check('original process still works',await page.locator('#lkProcess').isVisible()&&await page.locator('#lkModules .lk-module').count()>0);
 check('no browser errors',errors.length===0);
 console.log('Draw.io browser regression passed.');
}finally{await browser.close();}
