import assert from 'node:assert/strict';
import {normalizeUrl,publicAddress,parseMetadata,recognize} from '../lib/link-metadata.mjs';
import handler from '../api/link-metadata.js';
for(const url of ['http://127.1','http://2130706433','http://169.254.169.254/latest/meta-data','http://[::1]','http://[::ffff:127.0.0.1]','http://192.168.1.1','http://localhost','https://x.local','https://user:password@example.com','https://example.com:8080','javascript:alert(1)'])assert.equal(normalizeUrl(url),null,url);
for(const address of ['127.0.0.1','10.1.2.3','169.254.1.1','::1','fc00::1','fe80::1','::ffff:8.8.8.8'])assert.equal(publicAddress(address),false,address);
assert.equal(publicAddress('8.8.8.8'),true);assert.equal(normalizeUrl('example.com').href,'https://example.com/');
const resolver=async host=>[{address:host==='private.example'?'10.0.0.1':'93.184.216.34',family:4}];
const html=`<html><head><script>const fake='<title>Wrong</title>'</script><title>Actual &amp; useful</title><link rel="icon" sizes="16x16" href="/tiny.ico"><link rel='apple-touch-icon' sizes='180x180' href='/large.png'><link rel="icon" type="image/svg+xml" href="/icon.svg"></head></html>`;
assert.deepEqual(parseMetadata(html,'https://example.com/path'),{title:'Actual & useful',icon:'https://example.com/icon.svg'});
const recognized=await recognize('https://example.com/path',{resolver,request:async(url,address)=>{assert.equal(address.address,'93.184.216.34');return {html}}});
assert.equal(recognized.title,'Actual & useful');
let calls=0;
await assert.rejects(recognize('https://example.com',{resolver,request:async()=>{calls++;return {redirect:'http://169.254.169.254/'}}}),/invalid_redirect/);assert.equal(calls,1);
calls=0;
await assert.rejects(recognize('https://example.com',{resolver,request:async()=>{calls++;return {redirect:'https://private.example/'}}}),/private_address/);assert.equal(calls,1);
await assert.rejects(recognize('https://example.com',{resolver:async()=>[{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}],request:()=>{throw Error('must not run')}}),/private_address/);
const noPrivateIcon=await recognize('https://example.com',{resolver,request:async()=>({html:'<title>Safe</title><link rel="icon" href="https://private.example/icon.svg">'})});assert.equal(noPrivateIcon.icon,'');
const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20);
try{await assert.rejects(recognize('https://example.com',{resolver:async()=>new Promise(()=>{}),signal:controller.signal}),/timeout/)}finally{clearTimeout(timeout)}
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(body){this.body=body;return this}}}
let res=response();await handler({method:'POST',headers:{host:'dashboard.example',origin:'https://evil.example'},body:{url:'https://example.com'}},res);assert.equal(res.code,403);
res=response();await handler({method:'POST',headers:{host:'dashboard.example',origin:'https://dashboard.example'},body:{url:'x'.repeat(2049)}},res);assert.equal(res.code,400);
console.log('PASS metadata title/icon extraction, bounded inputs, private networks, redirects, DNS changes, timeout and same-origin guard. No external requests.');
