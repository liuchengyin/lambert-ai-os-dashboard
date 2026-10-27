// Based on DeepSeek privacy draft; corrected shared storage, UUIDs and actual facade API.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../../shared-sync/private-storage.js',import.meta.url),'utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',ACTIVE='lambert_active_account_v1';
export function memory(){const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};}
function load(s,owner){if(owner)s.setItem(ACTIVE,owner);else s.removeItem(ACTIVE);const c={localStorage:s,window:{}};vm.createContext(c);vm.runInContext(source,c);return c.window.LambertPrivateStorage;}
test('DeepSeek: guest data retained, A/B private data and database names independent',()=>{
 const s=memory(),guest=load(s);guest.setItem('note','guest-secret');guest.setItem('toString','guest-prototype-key');
 const a=load(s,A);assert.equal(a.getItem('note'),null);assert.equal(a.getItem('toString'),null);a.setItem('note','A-secret');const an=a.databaseName('audio');
 const b=load(s,B);assert.equal(b.getItem('note'),null);assert.notEqual(b.databaseName('audio'),an);b.setItem('note','B-secret');
 assert.equal(load(s,A).getItem('note'),'A-secret');assert.equal(load(s).getItem('note'),'guest-secret');
});
test('DeepSeek: stale async callbacks cannot access either account after switch',()=>{
 const s=memory(),a=load(s,A);load(s,B);for(const fn of [()=>a.setItem('note','wrong'),()=>a.getItem('note'),()=>a.removeItem('note'),()=>a.databaseName('audio')])assert.throws(fn,/account_changed/);
 assert.equal(load(s,B).getItem('note'),null);
});
test('core and auth infrastructure passthrough, invalid owner fails closed',()=>{
 const s=memory(),a=load(s,A);a.setItem('tasks','[]');assert.equal(s.getItem('tasks'),'[]');a.setItem('lambert_auth_v1:test','session');assert.equal(s.getItem('lambert_auth_v1:test'),'session');
 assert.throws(()=>load(s,'invalid-owner'),/invalid_account_owner/);
});
test('cloud documents never read guest bytes and require installed account adapter',()=>{
 const s=memory();s.setItem('reading_workspace_v2','{"notes":[{"title":"guest"}]}');const a=load(s,A);assert.throws(()=>a.getItem('reading_workspace_v2'),/account_data_not_ready/);assert.equal(s.getItem('reading_workspace_v2'),'{"notes":[{"title":"guest"}]}');
});
