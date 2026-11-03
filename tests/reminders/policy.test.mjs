import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chinaSchedule,taskSummary,kinds} from '../../supabase/functions/feishu-reminders/policy.mjs';
const row=(id,status='待开始',extra={})=>({item_id:id,payload:{id,title:id,status,...extra},deleted_at:null});
test('three Shanghai slots, UTC conversion, two-minute delivery grace, no midnight drift',()=>{
 for(const [utc,slot] of [['03:45','11:45'],['11:00','19:00'],['13:30','21:30']])assert.deepEqual(chinaSchedule(new Date(`2026-11-03T${utc}:00Z`)),{date:'2026-11-03',slot});
 assert.equal(chinaSchedule(new Date('2026-11-03T13:32:00Z')),null);
 assert.equal(chinaSchedule(new Date('2026-11-03T16:00:00Z')),null);
 assert.throws(()=>chinaSchedule(new Date('invalid')));
});
test('today only linked ids, latest status, excludes deleted/archived and future/unlinked backlog',()=>{
 const rows=[row('done','已完成'),row('pending'),row('archived','待开始',{archived:true}),{...row('deleted'),deleted_at:'2026-11-03'},row('future'),row('legacy','已归档')];
 const s=taskSummary(['done','pending','pending','archived','deleted','legacy','missing'],rows);
 assert.deepEqual(s,{total:2,done:1,pending:[{id:'pending',title:'pending'}]});
 assert.deepEqual(kinds('11:45',s,null),['tasks']);assert.deepEqual(kinds('19:00',s,null),['tasks']);
 assert.equal(taskSummary(['pending'],[row('pending','已完成')]).pending.length,0,'new cloud status overrides stale review snapshot');
 assert.equal(taskSummary([],rows).total,0);
});
test('night reminder kinds independent; unknown receipt never means not submitted',()=>{
 const partial=taskSummary(['a'],[row('a')]),complete=taskSummary(['a'],[row('a','已完成')]);
 assert.deepEqual(kinds('21:30',partial,false),['tasks','review']);assert.deepEqual(kinds('21:30',partial,true),['tasks']);
 assert.deepEqual(kinds('21:30',complete,false),['review']);assert.deepEqual(kinds('21:30',complete,true),[]);
 assert.throws(()=>kinds('21:30',partial,null));assert.throws(()=>taskSummary('a',[]));assert.throws(()=>taskSummary([null],[]));assert.throws(()=>taskSummary(['a'],[row('a'),row('a')]));
});
