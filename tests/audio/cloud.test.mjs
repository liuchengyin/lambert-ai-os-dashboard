import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioCloud} from '../../shared-audio/cloud.mjs';
const access=async()=>({userId:'owner',url:'https://example.supabase.co',publishableKey:'public',accessToken:'mock'});
test('cloud context is pinned to the authenticated owner',async()=>{
 const cloud=new AudioCloud(access);await assert.rejects(cloud.read('other'),/account_mismatch/);
});
test('upload success requires confirmed object size and ready RPC response; retries keep reservation',async()=>{
 const oldDocument=globalThis.document,oldXHR=globalThis.XMLHttpRequest;
 const trace=[];let uploaded=false,wrongSize=false,ready=true;
 globalThis.document={createElement(){const a={duration:45,removeAttribute(){},load(){},set src(value){queueMicrotask(()=>a.onloadedmetadata?.());}};return a;}};
 globalThis.XMLHttpRequest=class{upload={};open(){trace.push('upload');}setRequestHeader(){}send(){uploaded=true;this.status=200;queueMicrotask(()=>this.onload());}};
 const cloud=new AudioCloud(access),job={id:'job',userId:'owner',collectionId:'set',hash:'digest',name:'original.wav'};
 cloud.onReserved=async j=>{assert.equal(j.reserved,true);trace.push('durable-reservation');};
 cloud.request=async(ctx,path,options)=>{
  if(path.endsWith('lambert_audio_reserve')){trace.push('reserve');assert.equal(options.body.p_title,'original.wav');return {id:'track',status:'reserved',storage_path:'owner/set/track'};}
  if(path.includes('/info/')){trace.push('verify');if(!uploaded)throw Object.assign(Error('missing'),{status:404});return {size:wrongSize?999:3};}
  if(path.endsWith('lambert_audio_confirm')){trace.push('confirm');return {id:'track',status:ready?'ready':'reserved'};}
  throw Error('unexpected');
 };
 try{
  const file=new File(['abc'],'replacement.wav',{type:'audio/wav'});
  assert.deepEqual(await cloud.upload(job,file,()=>{}),{ready:true,trackId:'track'});
  assert.deepEqual(trace,['reserve','durable-reservation','verify','upload','verify','confirm']);
  trace.length=0;await cloud.upload(job,file,()=>{});assert.equal(trace.includes('upload'),false,'retry verifies an existing file instead of overwriting it');
  wrongSize=true;await assert.rejects(cloud.upload(job,file,()=>{}),/object_not_confirmed/);
  wrongSize=false;ready=false;await assert.rejects(cloud.upload(job,file,()=>{}),/object_not_confirmed/);
 }finally{globalThis.document=oldDocument;globalThis.XMLHttpRequest=oldXHR;}
});
