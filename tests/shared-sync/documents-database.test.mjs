import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const {PGlite}=createRequire(new URL('../../shared-sync/tooling/package.json',import.meta.url))('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('document migration preserves existing task data and real PostgreSQL owner RLS',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/202610190001_shared_workspace.sql',import.meta.url),'utf8'));
 const as=async id=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);
 const put=async(kind,id,payload,mutation)=> (await db.query('select public.lambert_apply_mutation($1,$2,$3,$4::jsonb,0,false) as result',[mutation,kind,id,JSON.stringify(payload)])).rows[0].result;
 await as(A);await put('tasks','t1',{id:'t1',title:'preserve'},'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 await db.exec('reset role');await db.exec(await readFile(new URL('../../supabase/migrations/202610270001_personal_documents.sql',import.meta.url),'utf8'));
 await as(A);const r=await put('documents','reading_workspace_v2',{id:'reading_workspace_v2',value:{notes:[{title:'A-private'}]}},'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');assert.equal(r.status,'applied');assert.equal((await db.query("select payload->>'title' as title from public.lambert_items where kind='tasks'")).rows[0].title,'preserve');
 await assert.rejects(put('documents','arbitrary_setting',{value:1},'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),/invalid_document/);
 await as(B);assert.equal((await db.query('select * from public.lambert_items')).rows.length,0);
 const b=await put('documents','reading_workspace_v2',{value:{notes:[]}},'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');assert.equal(b.record.user_id,B);
 await assert.rejects(db.query("update public.lambert_items set payload='{}'"),/permission denied/);
 }finally{await db.close();}
});
