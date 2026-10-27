import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceBackup,retainWorkspaceBackup} from '../../shared-sync/backup.mjs';
import {WorkspaceJournal} from '../../shared-sync/journal.mjs';
const uid='11111111-1111-4111-8111-111111111111';
function storage(){const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
test('完整备份包含原始损坏字节、账号云端快照、待上传队列与冲突双方，不包含登录令牌',()=>{
 const s=storage();s.setItem('tasks','{broken');s.setItem('session','secret');
 const j=new WorkspaceJournal(s,uid);j.read('projects',[]);
 j.mergeRemote([{user_id:uid,kind:'projects',item_id:'p',payload:{id:'p',name:'remote'},version:1,deleted_at:null}]);
 j.write('tasks',[{id:'t',title:'offline'}]);const batch=j.batches()[0];j.acknowledge(batch.key,batch.ops[0].mutationId,{status:'conflict',record:{version:2,payload:{title:'remote task'}}});
 const b=createWorkspaceBackup(s,j,new Date(),{includeGuest:true});assert.equal(b.raw.tasks,'{broken');assert.equal(b.account.snapshot.projects[0].name,'remote');assert.equal(b.account.snapshot.tasks[0].title,'offline');assert.equal(b.account.batches[0].ops[0].conflict.payload.title,'remote task');assert.ok(!JSON.stringify(b).includes('secret'));assert.equal(s.getItem('tasks'),'{broken');
 const key=retainWorkspaceBackup(s,j);assert.equal(JSON.parse(s.getItem(key)).account.userId,uid);
});
test('备份写入空间不足时失败，不改原始数据或清除队列',()=>{
 const s=storage();const j=new WorkspaceJournal(s,uid);j.write('tasks',[{id:'t'}]);s.setItem=()=>{throw Error('quota');};assert.throws(()=>retainWorkspaceBackup(s,j),/quota/);assert.equal(j.pending().length,1);
});
test('损坏的账号缓存也能导出原始字节用于恢复',()=>{
 const s=storage(),j=new WorkspaceJournal(s,uid);s.setItem(j.prefix+'base','{broken account');
 const backup=createWorkspaceBackup(s,j);assert.ok(backup.account.parseError);assert.equal(backup.account.rawStorage[j.prefix+'base'],'{broken account');
});

test('账号默认备份不泄露访客及其他账号资料',()=>{const s=storage(),j=new WorkspaceJournal(s,uid);s.setItem('reading_workspace_v2','guest-secret');s.setItem('lambert_private_v1:'+uid+':english_learning_v1','own-progress');s.setItem('lambert_private_v1:22222222-2222-4222-8222-222222222222:note','other-secret');const b=createWorkspaceBackup(s,j);assert.deepEqual(b.raw,{});assert.ok(!JSON.stringify(b).includes('guest-secret'));assert.ok(!JSON.stringify(b).includes('other-secret'));assert.ok(JSON.stringify(b).includes('own-progress'));});
