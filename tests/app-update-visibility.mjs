import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile,mkdtemp} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {tmpdir} from 'node:os';import path from 'node:path';
const work=await mkdtemp(path.join(tmpdir(),'lambert-update-ui-')),release=1793081748437;
const m=JSON.parse(execFileSync('python3',['scripts/build-web-update.py','--output',work,'--release',String(release)],{encoding:'utf8'}));
execFileSync('python3',['-c',`import zipfile;zipfile.ZipFile(${JSON.stringify(path.join(work,m.sha256+'.zip'))}).extractall(${JSON.stringify(work+'/pages')})`]);
// Public PWA and native bundle share an exact build stamp; only native strips SW.
execFileSync('python3',['-c',`import importlib.util,tempfile,pathlib,zipfile,json
spec=importlib.util.spec_from_file_location('update_build','scripts/build-web-update.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
root=pathlib.Path(tempfile.mkdtemp());(root/'mobile').mkdir();(root/'shared-sync').mkdir()
(root/'mobile/index.html').write_text("<head></head><script>if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');</script>")
module.ROOT=root
for release in [1793081748437,1793081749437]:
 m=module.build(root/'mobile/updates',release);html=(root/'mobile/index.html').read_text();assert 'serviceWorker' in html;assert html.count('lambert-page-release')==1;assert str(release) in html
 with zipfile.ZipFile(root/'mobile/updates'/str(m['sha256']+'.zip')) as z:
  native=z.read('mobile/index.html').decode();assert 'serviceWorker' not in native;assert native.count('lambert-page-release')==1;assert str(release) in native;assert json.loads(z.read('mobile/release.json'))['release']==release
`]);
const browser=await chromium.launch();
try{
 for(const native of [true,false]){
  const origin=native?'https://appassets.androidplatform.net':'https://preview.example',prefix=native?'/assets':'',context=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block'});
  let response={checking:false,ready:false,message:'当前页面可离线使用',release},fail=false,checks=0,controls=0;
  await context.route(origin+'/**',async route=>{const u=new URL(route.request().url());
   if(u.pathname.includes('/__updates/')){controls++;if(u.pathname.endsWith('/check')){checks++;response={checking:true,ready:false,message:'正在后台下载页面更新',release:release+86400000};}return route.fulfill(fail?{status:503,body:'offline'}:{json:response});}
   if(u.pathname==='/api/account-config')return route.fulfill({json:{configured:false}});
   const file=u.pathname.slice(prefix.length+1);assert.ok(file.startsWith('mobile/')||file.startsWith('shared-sync/'));
   return route.fulfill({body:await readFile(path.join(work,'pages',file)),contentType:file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'text/html'});
  });
  await context.route('**/api/account-config',route=>route.fulfill({json:{configured:false}}));
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.tasks=JSON.stringify([{id:'t',title:'版本更新不能改变的数据',status:'进行中',custom:'keep'}]);});
  await page.goto(origin+prefix+'/mobile/index.html');await page.waitForFunction(()=>window.MobileBootReady&&window.LambertAccount);
  await page.waitForFunction(()=>document.getElementById('appVersionEntry').textContent.includes('10.27'));
  assert.equal(await page.locator('#appVersionEntry').isVisible(),true);await page.locator('#appVersionEntry').click();
  const panel=page.locator('#appUpdatePanel');await panel.waitFor();const current=await panel.locator('[data-update-version]').textContent();assert.match(current,/2026\.10\.27\./);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(native){
   await panel.getByRole('button',{name:'检查更新',exact:true}).click();await page.getByText('正在后台下载页面更新',{exact:true}).waitFor();
   assert.equal(checks,1);assert.equal(await panel.locator('[data-update-check]').isDisabled(),true);assert.equal(await panel.locator('[data-update-version]').textContent(),current,'a staged release must not masquerade as the running version');
   response={checking:false,ready:true,message:'页面更新已就绪，下次打开自动生效',release:release+86400000};await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   await page.getByText('新版本已下载，完全退出 App 后重新打开即可生效。',{exact:true}).waitFor();assert.equal(await page.locator('#appVersionEntry').textContent(),'新版本 · 待重启');
   assert.equal(await panel.locator('[data-update-version]').textContent(),current);assert.equal(page.url(),origin+prefix+'/mobile/index.html','do not fake a native restart with reload');
   fail=true;await panel.getByRole('button',{name:'检查更新',exact:true}).click();await page.getByText('暂时无法读取更新状态，请稍后重试；当前版本仍可使用。',{exact:true}).waitFor();assert.equal(await panel.locator('[data-update-check]').isDisabled(),false);
   fail=false;await panel.getByRole('button',{name:'检查更新',exact:true}).click();response={checking:false,ready:false,message:'当前页面已是最新',release};await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByText('当前页面已是最新',{exact:true}).waitFor();
  }else{assert.equal(controls,0);await panel.getByRole('button',{name:'刷新版本信息',exact:true}).click();await page.getByText('当前为移动网页版，重新打开页面可获取最新版本。',{exact:true}).waitFor();}
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.tasks)[0].custom),'keep');assert.deepEqual(errors,[]);
  await panel.getByText('本版改进',{exact:true}).click();assert.equal(await panel.locator('li').count(),3);
  await context.close();console.log('PASS '+(native?'native controls':'mobile web')+' visible version, version panel, staged/current separation, check/download/ready/retry, no reload, no data writes, 320px layout');
 }
}finally{await browser.close();}
