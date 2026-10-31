import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8765';
function pdf(){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Contents 4 0 R >>'];let s='%PDF-1.4\n',offset=[0];objects.forEach((o,i)=>{offset.push(s.length);s+=`${i+1} 0 obj\n${o}\nendobj\n`;});const start=s.length;s+=`xref\n0 6\n0000000000 65535 f \n`+offset.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(s);}
await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
try{
 await page.goto(base);await page.locator('nav button[data-v=reading]').click();await page.locator('#readingShelf').waitFor();
 await page.locator('#bookShelfFile').setInputFiles({name:'我的第一本书.pdf',mimeType:'application/pdf',buffer:pdf()});
 await page.getByRole('button',{name:'我的第一本书 第 1 页'}).waitFor();
 await page.reload();await page.locator('nav button[data-v=reading]').click();await page.locator('#readingShelf').waitFor();
 assert.equal(await page.locator('#bookCount').textContent(),'1 / 7');
 await page.locator('#bookShelfSlots [data-open]').first().click();await page.locator('#bookPages').getByText('2',{exact:true}).waitFor();
 await page.locator('#bookNext').click();await page.waitForFunction(()=>document.querySelector('#bookPage').value==='2');
 await page.reload();await page.locator('nav button[data-v=reading]').click();await page.locator('#bookShelfSlots [data-open]').first().click();
 await page.waitForFunction(()=>document.querySelector('#bookPage').value==='2'&&document.querySelector('#bookPages').textContent==='2');
 await page.locator('#bookBack').click();
 for(let i=2;i<=7;i++){await page.locator('#bookShelfFile').setInputFiles({name:`Book ${i}.pdf`,mimeType:'application/pdf',buffer:pdf()});await page.waitForFunction(n=>document.querySelector('#bookCount').textContent===`${n} / 7`,i);}
 assert.equal(await page.locator('.book-cover').count(),7);assert.equal(await page.locator('#bookImport').isDisabled(),true);
 await mkdir('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/reading-bookshelf-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-artifacts/reading-bookshelf-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 page.on('dialog',d=>d.accept());await page.locator('#bookShelfSlots [data-remove]').first().click();await page.waitForFunction(()=>document.querySelector('#bookCount').textContent==='6 / 7');
 // A real IndexedDB cache with an injected cloud boundary tests failure/retry,
 // new-device downloads, offline checkpoints and owner isolation without user data.
 const result=await page.evaluate(async()=>{
  const {createBookStore}=await import('/shared-sync/book-store.mjs');
  const previous=window.LambertPrivateStorage;let changed=false;
  const owner={owner:'11111111-1111-4111-8111-111111111111',databaseName:n=>n+'_test',assertOwner(){if(changed)throw Error('account_changed');}};
  window.LambertPrivateStorage=owner;const records=[],files=new Map();let fail=true,downloads=0;
  const client={from(){let action='select',payload,filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},insert(p){action='insert';payload=p;return q;},update(p){action='update';payload=p;return q;},delete(){action='delete';return q;},then(resolve){const matches=r=>filters.every(([k,v])=>r[k]===v);if(action==='insert'){if(records.some(r=>r.slot===payload.slot))return resolve({error:Error('slot occupied')});records.push({...payload});}if(action==='update')records.filter(matches).forEach(r=>Object.assign(r,payload));if(action==='delete')for(let i=records.length-1;i>=0;i--)if(matches(records[i]))records.splice(i,1);return resolve({data:records.filter(matches).map(r=>({...r}))});}};return q;},storage:{from(){return {async upload(path,blob){if(fail)return {error:Error('offline')};files.set(path,blob);return {data:{}};},async download(path){downloads++;return files.has(path)?{data:files.get(path)}:{error:Error('not found')};},async remove(paths){paths.forEach(p=>files.delete(p));return {data:{}};}};}}};
  const cloud=async()=>({userId:owner.owner,client});const store=createBookStore({owner,cloud});
  const file=new File(['%PDF-1.4\nfixture'],'Cloud.pdf',{type:'application/pdf'});const row=await store.add(file);
  let failed=false;try{await store.upload(row.id);}catch{failed=true;}const saved=(await store.get(row.id)).blob.size===file.size;
  fail=false;await store.upload(row.id);await store.checkpoint(row.id,12);
  const owner2={...owner,databaseName:n=>n+'_device2'};window.LambertPrivateStorage=owner2;
  const device2=createBookStore({owner:owner2,cloud});await device2.refresh();const restored=await device2.list();await device2.blob(row.id);const calls=downloads;await device2.blob(row.id);
  changed=true;let blocked=false;try{await device2.list();}catch{blocked=true;}
  window.LambertPrivateStorage=previous;
  return {failed,saved,restoredPage:restored[0].page,restoredTitle:restored[0].title,cacheHit:calls===downloads,blocked,rows:records.length};
 });
 assert.deepEqual(result,{failed:true,saved:true,restoredPage:12,restoredTitle:'Cloud',cacheHit:true,blocked:true,rows:1});
 assert.deepEqual(errors,[]);console.log('PASS: refresh persistence, PDF resume, seven books, remove, responsive shelf, cloud retry/new-device/cache/account guard');
}finally{await browser.close();}
