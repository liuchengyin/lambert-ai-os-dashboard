import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8780')+'/shared-audio/video/index.html');
 const result=await page.evaluate(async()=>{
  const {openLibraryStore}=await import('/shared-audio/local-store.mjs'),store=await openLibraryStore();
  const a={userId:'alice',trackId:'lesson',text:'旧草稿',mutationId:'first',baseVersion:0,changedAt:1},b={...a,text:'较新草稿',mutationId:'second',changedAt:2};
  await store.saveDraft(a);await store.saveDraft(b);await store.clearDraft('alice','lesson','first');
  const preserved=await store.drafts('alice'),other=await store.drafts('bob');
  const original=IDBDatabase.prototype.transaction;let fallback;
  try{IDBDatabase.prototype.transaction=function(){throw Error('QuotaExceededError');};fallback=await store.saveDraft({...b,mutationId:'third',text:'应急草稿',changedAt:3});}finally{IDBDatabase.prototype.transaction=original;}
  const emergency=await store.drafts('alice');await store.clearDraft('alice','lesson','second');const newer=await store.drafts('alice');await store.clearDraft('alice','lesson','third');
  const after=await store.drafts('alice');store.close();return {preserved,other,fallback,emergency,newer,after};
 });
 assert.equal(result.preserved[0].text,'较新草稿');assert.deepEqual(result.other,[]);assert.equal(result.fallback.emergency,true);assert.equal(result.emergency[0].text,'应急草稿');assert.equal(result.newer[0].mutationId,'third');assert.deepEqual(result.after,[]);
 console.log('PASS IDB: owner scope, newer draft survives old acknowledgement, quota emergency fallback and exact mutation cleanup');
}finally{await browser.close();}
