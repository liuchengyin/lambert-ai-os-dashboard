import {chromium} from 'playwright';import assert from 'node:assert/strict';
import {createDevServer} from '../scripts/codex/dev-server.mjs';
const server=createDevServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const browser=await chromium.launch({headless:true});const ctx=await browser.newContext({serviceWorkers:'block'});const page=await ctx.newPage();
try{
 await page.goto(base+'/account.html');
 await page.evaluate(()=>{localStorage.setItem('reading_workspace_v2',JSON.stringify({notes:[{title:'guest-only'}]}));localStorage.setItem('english_learning_v1',JSON.stringify({secret:'guest'}));});
 async function open(owner){await page.evaluate(owner=>{localStorage.setItem('lambert_active_account_v1',owner);},owner);await page.goto(base+'/account.html');await page.addScriptTag({url:base+'/shared-sync/private-storage.js'});await page.addScriptTag({url:base+'/shared-sync/storage-bridge.js'});await page.evaluate(async owner=>{const {WorkspaceJournal}=await import('/shared-sync/journal.mjs');window.LambertData.install(new WorkspaceJournal(localStorage,owner));},owner);}
 await open(A);
 assert.deepEqual(await page.evaluate(()=>[LambertPrivateStorage.getItem('reading_workspace_v2'),LambertPrivateStorage.getItem('english_learning_v1')]),[null,null]);
 await page.evaluate(async()=>{LambertPrivateStorage.setItem('reading_workspace_v2',JSON.stringify({notes:[{id:'n',title:'A-only'}]}));LambertPrivateStorage.setItem('english_learning_v1',JSON.stringify({secret:'A'}));window.audio=await import('/english-audio-store.mjs');window.audioDB=await audio.openAudioDatabase();await audio.addTrack(audioDB,{id:'track-A',title:'A-only',createdAt:new Date().toISOString()},new Blob(['private-audio-A'],{type:'audio/wav'}));});
 assert.equal(await page.evaluate(async()=>String(await (await audio.readBlob(audioDB,'track-A')).text())),'private-audio-A');
 // Stale in-page callback must fail before opening a transaction under another owner.
 assert.equal(await page.evaluate(async B=>{localStorage.setItem('lambert_active_account_v1',B);try{await audio.checkpoint(audioDB,'track-A',99,1,100);return 'wrong';}catch(e){return e.message;}},B),'account_changed');
 await open(B);assert.equal(await page.evaluate(()=>LambertPrivateStorage.getItem('reading_workspace_v2')),null);
 assert.equal(await page.evaluate(async()=>{const audio=await import('/english-audio-store.mjs');const db=await audio.openAudioDatabase();const tracks=await audio.listTracks(db);db.close();return tracks.tracks.length;}),0);
 await page.evaluate(()=>LambertPrivateStorage.setItem('reading_workspace_v2',JSON.stringify({notes:[{id:'n',title:'B-only'}]})));
 await open(A);assert.equal(await page.evaluate(()=>JSON.parse(LambertPrivateStorage.getItem('reading_workspace_v2')).notes[0].title),'A-only');
 assert.equal(await page.evaluate(async()=>{const audio=await import('/english-audio-store.mjs');const db=await audio.openAudioDatabase();const r=await audio.listTracks(db);db.close();return r.tracks[0].title;}),'A-only');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('reading_workspace_v2')).notes[0].title),'guest-only');
 console.log('PASS: browser A/B notes, progress, audio Blob separation; stale checkpoint rejected; guest data retained.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
