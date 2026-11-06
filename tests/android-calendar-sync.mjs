import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sent=[],listeners={};
const owner='975872da-1111-4111-8111-111111111111';
let pending=0,conflicts=0;
let tasks=[
{id:'t1',title:'中心收入',due:'2026-11-07',status:'待开始'},
{id:'t2',title:'已完成的任务',due:'2026-11-07',status:'已完成'},
{id:'t3',title:'未来任务',due:'2026-11-08',status:'待开始'},
{id:'t4',title:'旧任务',due:'2026-10-01',status:'待开始'}
];
const button={type:'',id:'',className:'',textContent:'',onclick:null};
const context={
window:{
LambertCalendarSync:{postMessage:s=>sent.push(JSON.parse(s))},
LambertData:{active:owner,syncInfo:()=>({pending,conflicts})},
MobileStore:{date:()=> '2026-11-07',read:(name)=>name==='tasks'?tasks:[]},
addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)
},
document:{createElement:()=>button,querySelector:()=>({appendChild:()=>{}}),addEventListener:()=>{},body:{appendChild:()=>{}}},
localStorage:{getItem:key=>key==='lambert_active_account_v1'?owner:null},
clearTimeout:()=>{},
setTimeout:fn=>{fn();return 1;},
alert:()=>{throw Error('Unexpected alert')},Date,Set,JSON,console
};
vm.runInNewContext(fs.readFileSync('mobile/calendar-sync.js','utf8'),context);
assert.equal(button.textContent,'日历同步');
for(const fn of listeners['lambert-sync-state']||[])fn({detail:{phase:'synced'}});
assert.equal(sent.length,1);
assert.equal(sent[0].action,'sync');
assert.deepEqual(sent[0].tasks.map(t=>t.id),['t1','t3']);
button.onclick();
assert.equal(sent.length,2);
assert.equal(sent[1].action,'enable');
assert.equal(sent[1].tasks.length,2);
pending=1;
tasks=[...tasks,{id:'t5',title:'新增但待上传',due:'2026-11-09',status:'待开始'}];
for(const fn of listeners['mobile-change']||[])fn({});
assert.equal(sent.length,2,'pending mutations must not trigger calendar reconciliation');
pending=0;conflicts=1;
for(const fn of listeners['mobile-change']||[])fn({});
assert.equal(sent.length,2,'conflicts must not trigger calendar reconciliation');
console.log('PASS: calendar sync requires cloud-synced snapshot, excludes done/old, respects initial opt-in');
