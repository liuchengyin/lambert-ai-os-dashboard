import {test} from 'node:test';import assert from 'node:assert/strict';import {WorkspaceJournal} from '../../shared-sync/journal.mjs';import {prepareLocalImport,planImport} from '../../shared-sync/import-plan.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
function memory(){const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};}
test('notes/bookmarks share existing durable journal, preserve unknown fields and account separation',()=>{
 const s=memory(),a=new WorkspaceJournal(s,A),b=new WorkspaceJournal(s,B);
 const value={notes:[{id:'same',title:'A',unknown:{x:1}}],reader:{url:'https://example.com'}};
 a.write('reading_workspace_v2',value);a.write('knowledge_link_personal_v1',[{id:'g',links:[]}]);
 assert.deepEqual(a.read('reading_workspace_v2',null),value);assert.deepEqual(a.read('knowledge_link_personal_v1',null),[{id:'g',links:[]}]);assert.equal(b.read('reading_workspace_v2',null),null);
 assert.equal(a.pending().length,2);assert.equal(a.pending()[0].kind,'documents');assert.equal(new WorkspaceJournal(s,A).read('reading_workspace_v2',null).notes[0].title,'A');
 b.write('reading_workspace_v2',{notes:[{id:'same',title:'B'}]});assert.equal(a.read('reading_workspace_v2',null).notes[0].title,'A');
});
test('document conflict keeps both versions and supports remote resolution; clearing is durable',()=>{
 const s=memory(),j=new WorkspaceJournal(s,A);j.write('reading_standalone_notes_v1',[{id:'n',thought:'local'}]);const batch=j.batches()[0],op=batch.ops[0];
 const remote={user_id:A,kind:'documents',item_id:'reading_standalone_notes_v1',payload:{id:'reading_standalone_notes_v1',value:[{id:'n',thought:'remote'}]},version:2,deleted_at:null};
 j.acknowledge(batch.key,op.mutationId,{status:'conflict',record:remote});assert.equal(j.conflicts().length,1);assert.throws(()=>j.write('reading_standalone_notes_v1',[]),/冲突/);
 j.resolve('documents','reading_standalone_notes_v1','remote');assert.equal(j.read('reading_standalone_notes_v1',[])[0].thought,'remote');j.write('reading_standalone_notes_v1',null);assert.equal(j.read('reading_standalone_notes_v1',[]),null);
});
test('explicit import includes only supplied personal documents and never replaces cloud contents',()=>{
 const value={notes:[],unknown:3};const records=prepareLocalImport({reading_workspace_v2:value});assert.deepEqual(records,[{kind:'documents',itemId:'reading_workspace_v2',payload:{id:'reading_workspace_v2',value}}]);
 const plan=planImport(records,[{kind:'documents',itemId:'reading_workspace_v2',payload:{id:'reading_workspace_v2',value:{notes:[{title:'cloud'}]}}}]);assert.equal(plan.create.length,0);assert.equal(plan.conflicts.length,1);
 assert.throws(()=>prepareLocalImport({knowledge_link_library_v1:{}}),/格式错误/);
});
