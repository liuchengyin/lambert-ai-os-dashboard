import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8780';
const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||undefined});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const user='11111111-1111-4111-8111-111111111111',collection={id:crypto.randomUUID(),title:'课程',version:1};
const wav=await readFile('/tmp/lambert-audio-fixtures/lesson.wav');
let failNotes=false,notes=0;
const tracks=[2,10].map((n,i)=>({id:crypto.randomUUID(),user_id:user,collection_id:collection.id,title:`第${n}课`,filename:`${n}.wav`,sort_order:i*1024,status:'ready',duration:45,position:0,rate:1,note:`备注${n}`,note_version:0,progress_version:0,meta_version:0,storage_path:`${user}/${collection.id}/${crypto.randomUUID()}`}));
await page.route('**/api/account-config',r=>r.fulfill({json:{configured:false}}));
await page.route('https://audio-test.supabase.co/**',async r=>{
 const url=new URL(r.request().url()),body=r.request().postDataJSON();
 if(url.pathname.includes('/object/sign/')){const range=r.request().headers()['range'];if(range){const [,a,b]=range.match(/bytes=(\d+)-(\d*)/),start=Number(a),end=b?Math.min(Number(b),wav.length-1):wav.length-1;return r.fulfill({status:206,body:wav.subarray(start,end+1),contentType:'audio/wav',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${wav.length}`,'Content-Length':String(end-start+1)}});}return r.fulfill({body:wav,contentType:'audio/wav',headers:{'Accept-Ranges':'bytes','Content-Length':String(wav.length)}});}
 if(url.pathname.includes('/object/sign/lambert-audio-private')&&r.request().method()==='POST')return;
 if(url.pathname.endsWith('/lambert_audio_collections'))return r.fulfill({json:[collection]});
 if(url.pathname.endsWith('/lambert_audio_tracks'))return r.fulfill({json:tracks});
 if(url.pathname.endsWith('/lambert_audio_note')){notes++;if(failNotes)return r.fulfill({status:503,json:{}});const t=tracks.find(t=>t.id===body.p_id);if(t.note_version!==body.p_version)return r.fulfill({json:{status:'conflict',record:t}});t.note=body.p_text;t.note_version++;return r.fulfill({json:{status:'applied',record:t}});}
 if(url.pathname.endsWith('/lambert_audio_progress')){const t=tracks.find(t=>t.id===body.p_id);t.position=body.p_position;t.rate=body.p_rate;t.progress_version++;return r.fulfill({json:{status:'applied',record:t}});}
 if(url.pathname.endsWith('/lambert_audio_title')){const t=tracks.find(t=>t.id===body.p_id);t.title=body.p_title;t.meta_version++;return r.fulfill({json:{status:'applied',record:t}});}
 if(url.pathname.endsWith('/lambert_audio_reorder')){body.p_ids.forEach((id,i)=>tracks.find(t=>t.id===id).sort_order=i*1024);collection.version++;return r.fulfill({json:{status:'applied',version:collection.version}});}
 return r.fulfill({status:404,json:{}});
});
// More specific signing route takes precedence over playback.
await page.route('https://audio-test.supabase.co/storage/v1/object/sign/lambert-audio-private',r=>{const b=r.request().postDataJSON();return r.fulfill({json:b.paths.map(path=>({signedURL:'/object/sign/lambert-audio-private/'+path+'?token=mock'}))});});
try{
 await page.goto(base+'/mobile/index.html');await page.locator('#tabs button').getByText('英语',{exact:true}).click();await page.getByRole('button',{name:'登录账户',exact:true}).waitFor();
 // Inject only a mock account accessor; existing account/task storage remains untouched.
 await page.evaluate(async({user})=>{window.LambertAccount.audioAccess=async()=>({userId:user,url:'https://audio-test.supabase.co',publishableKey:'public-test',accessToken:'test-only'});window.dispatchEvent(new Event('lambert:audio-account'));},{user});
 await page.getByRole('button',{name:'课程',exact:true}).click();await page.getByRole('button',{name:'第2课',exact:true}).click();
 const audio=page.locator('.al-player audio');await page.waitForFunction(()=>document.querySelector('.al-player audio')?.readyState>=1);
 await page.waitForFunction(()=>document.querySelector('.al-player audio').seekable.length&&document.querySelector('.al-player audio').seekable.end(0)>20);await audio.evaluate(a=>a.currentTime=20);await page.waitForFunction(()=>Math.abs(document.querySelector('.al-player audio').currentTime-20)<.1);await page.getByRole('button',{name:'回退3秒',exact:true}).click();assert.ok(Math.abs(await audio.evaluate(a=>a.currentTime)-17)<.1);
 await page.getByRole('button',{name:'回退7秒',exact:true}).click();await page.getByRole('button',{name:'回退7秒',exact:true}).click();assert.ok(Math.abs(await audio.evaluate(a=>a.currentTime)-3)<.1);assert.ok(await audio.evaluate(a=>a.paused));
 await page.getByRole('button',{name:'回退7秒',exact:true}).click();assert.equal(await audio.evaluate(a=>a.currentTime),0);
 await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.al-player audio').paused);await page.getByRole('button',{name:'回退3秒',exact:true}).click();assert.equal(await audio.evaluate(a=>a.paused),false);
 await page.getByLabel('播放倍速').selectOption('1.5');assert.equal(await audio.evaluate(a=>a.playbackRate),1.5);await page.getByLabel('播放模式').selectOption('one');assert.ok(await audio.evaluate(a=>a.loop));
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByLabel('当前音频备注').fill('第二课独立备注');await page.getByText('已保存',{exact:true}).waitFor();assert.equal(tracks[0].note,'第二课独立备注');
 await page.getByRole('button',{name:'下一条',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="当前音频备注"]').value==='备注10');
 failNotes=true;await page.getByLabel('当前音频备注').fill('断网草稿');await page.getByText('保存失败 · 本地草稿已保留',{exact:true}).waitFor();assert.equal(tracks[1].note,'备注10');
 const drafts=await page.evaluate(async()=>{const {openLibraryStore}=await import('/shared-audio/local-store.mjs');const store=await openLibraryStore();const result=await store.drafts('11111111-1111-4111-8111-111111111111');store.close();return result;});assert.equal(drafts[0].text,'断网草稿');
 failNotes=false;await page.getByRole('button',{name:'刷新',exact:true}).click();await page.getByText('已保存',{exact:true}).waitFor();assert.equal(tracks[1].note,'断网草稿');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}
 await page.evaluate(()=>window.dispatchEvent(new Event('lambert:audio-stop')));await page.getByRole('button',{name:'登录账户',exact:true}).waitFor();assert.equal(await audio.evaluate(a=>a.paused),true);assert.equal(await page.getByLabel('当前音频备注').inputValue(),'');
 assert.deepEqual(errors,[]);assert.ok(notes>=3);console.log('PASS mobile/shared library: native-independent playback, 3/7s, notes, failed draft recovery, responsive, logout isolation');
}finally{await browser.close();}
