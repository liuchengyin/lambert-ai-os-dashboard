import {chromium} from 'playwright';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';
const root=process.cwd();
// Impose latency at the HTTP server rather than browser route callbacks: preload
// cancellation and page teardown must not influence the measurement.
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');await new Promise(r=>setTimeout(r,160));
  if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"configured":false,"ok":false}');return;}
  const path=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!path.startsWith(root+sep))throw Error('invalid_path');
  let bytes=await readFile(path);if(url.pathname==='/'&&url.searchParams.get('prefetch')==='off')bytes=Buffer.from(bytes.toString().replace(/<!-- startup-prefetch-start -->[\s\S]*?<!-- startup-prefetch-end -->/,''));
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(bytes);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
async function measure(prefetch){const context=await browser.newContext();try{await context.route('https://cdn.jsdelivr.net/**',r=>r.abort());const page=await context.newPage();const start=Date.now();await page.goto(origin+'/?prefetch='+(prefetch?'on':'off'),{waitUntil:'domcontentloaded'});await page.locator('.shell').waitFor({state:'visible'});await page.waitForFunction(()=>!!window.TaskCenter);return Date.now()-start;}finally{await context.close();}}
try{const before=await measure(false),after=await measure(true);assert.ok(after<before,JSON.stringify({before,after}));console.log(JSON.stringify({ok:true,controlledLatencyMs:160,beforeMs:before,afterMs:after,improvement:Math.round((1-after/before)*100)+'%',realChinaNetwork:false}));}finally{await browser.close();await new Promise(r=>server.close(r));}
