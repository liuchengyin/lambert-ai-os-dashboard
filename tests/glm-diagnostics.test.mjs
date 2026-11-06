import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {callAssist} from '../scripts/codex/model-assist.mjs';
test('HTTP diagnostics retain status and provider reason, redact key, and never retry',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'glm-http-'));let calls=0;
 await assert.rejects(callAssist('glm',{}, {directory,env:{ZHIPU_API_KEY:'fixture-secret'},fetcher:async()=>{calls++;return new Response(JSON.stringify({error:{code:'1210',message:'invalid parameter fixture-secret',type:'invalid_request'}}),{status:400});}}),/provider_http_400/);
 const text=await readFile(path.join(directory,'ledger.json'),'utf8'),record=JSON.parse(text).records[0];
 assert.equal(calls,1);assert.equal(record.httpStatus,400);assert.equal(record.provider_code,'1210');assert.match(record.provider_message,/invalid parameter/);assert.ok(!text.includes('fixture-secret'));
});
test('timeout remains distinguishable from transport errors without leaking exception text',async()=>{
 for(const [name,code,expected] of [['TimeoutError',null,'provider_timeout'],['TypeError','ENOTFOUND','provider_connection_failed']]){
  const directory=await mkdtemp(path.join(tmpdir(),'glm-network-'));let calls=0;
  await assert.rejects(callAssist('glm',{}, {directory,env:{ZHIPU_API_KEY:'fixture-secret'},fetcher:async()=>{calls++;const error=Error('fixture-secret');error.name=name;error.cause={code};throw error;}}),new RegExp(expected));
  const text=await readFile(path.join(directory,'ledger.json'),'utf8'),record=JSON.parse(text).records[0];assert.equal(calls,1);assert.equal(record.failureType,name==='TimeoutError'?'timeout':'connection');assert.ok(!text.includes('fixture-secret'));if(code)assert.equal(record.networkCode,code);
 }
});
