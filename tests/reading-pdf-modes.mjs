import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1200,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8765')+'/');
 const result=await page.evaluate(async()=>{
  const {createPdfViewer}=await import('/reading-pdf-viewer.mjs');
  const shell=document.createElement('div');shell.style.cssText='position:relative;width:600px;height:500px;overflow:auto;padding:16px;box-sizing:border-box';document.body.append(shell);
  const style=document.createElement('style');style.textContent='.book-pdf-page{position:relative;margin-bottom:16px;display:flex}.book-page-canvas{display:block}';document.head.append(style);
  let seen=0;const failures=[];let delay=1;
  const fake=(count,name)=>({numPages:count,async getPage(n){return {getViewport({scale}){return {width:500*scale,height:700*scale};},render({canvasContext}){let timer,reject;canvasContext.canvas.dataset.document=name;const promise=new Promise((resolve,r)=>{reject=r;timer=setTimeout(resolve,delay);});return {promise,cancel(){clearTimeout(timer);reject(Object.assign(Error('cancelled'),{name:'RenderingCancelledException'}));}};}};}});
  const viewer=createPdfViewer({shell,onPage:n=>seen=n,onError:e=>failures.push(e.message)});
  const wait=async condition=>{for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,10));}throw Error('viewer test condition timed out');};
  await viewer.open(fake(330,'A'),120,'continuous');
  const initial={page:seen,slots:shell.children.length,canvases:shell.querySelectorAll('canvas').length};
  shell.scrollTop=shell.querySelector('[data-page="121"]').offsetTop-16;
  await wait(()=>seen===121);
  await viewer.goTo(999);const jumped=seen;
  await viewer.setMode('single');const single={page:seen,slots:shell.children.length,canvases:shell.querySelectorAll('canvas').length};
  await viewer.setMode('continuous');await viewer.goTo(17);
  shell.style.width='380px';await viewer.resize();const resized=seen;
  await viewer.goTo(25);await wait(()=>shell.querySelectorAll('canvas').length<=5);
  const bounded=shell.querySelectorAll('canvas').length<=5;
  delay=40;const stale=viewer.open(fake(330,'old'),80,'continuous');
  const fresh=viewer.open(fake(2,'new'),2,'single');await Promise.all([stale,fresh]);
  await wait(()=>shell.querySelector('canvas')?.dataset.document==='new');
  const isolated=seen===2&&shell.querySelectorAll('canvas').length===1&&shell.querySelector('canvas').dataset.document==='new';
  viewer.close();await wait(()=>shell.children.length===0);
  viewer.destroy();shell.remove();style.remove();return {initial,jumped,single,resized,bounded,isolated,failures};
 });
 assert.deepEqual(result,{initial:{page:120,slots:330,canvases:5},jumped:330,single:{page:330,slots:1,canvases:1},resized:17,bounded:true,isolated:true,failures:[]});
 assert.deepEqual(errors,[]);console.log('PASS: 330 pages, scroll tracking, bounded canvas memory, jump, resize, single/continuous, stale-document cancellation');
}finally{await browser.close();}
