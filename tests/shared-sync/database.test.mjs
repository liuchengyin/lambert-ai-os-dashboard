import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../shared-sync/tooling/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('PostgreSQL：RLS、禁止直接写、版本冲突、删除标记、幂等与账号隔离',async()=>{
 const db=new PGlite();await db.waitReady;
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/202610190001_shared_workspace.sql',import.meta.url),'utf8'));
 async function as(id,role='authenticated'){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id||''}',false);set role ${role};`);}
 async function mutate(id,payload,version,deleted=false,kind='tasks'){return (await db.query('select public.lambert_apply_mutation($1,$2,$3,$4::jsonb,$5,$6) as result',[id,kind,'t1',JSON.stringify(payload),version,deleted])).rows[0].result;}
 await as(A);const mid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const created=await mutate(mid,{id:'t1',title:'A',unknown:{x:1}},0);assert.equal(created.status,'applied');assert.equal(created.record.version,1);
 assert.deepEqual(await mutate(mid,{id:'t1',title:'A',unknown:{x:1}},0),created);
 await assert.rejects(mutate(mid,{title:'different'},0),/mutation_id_reused/);
 await assert.rejects(db.query(`update public.lambert_items set payload='{}'`),/permission denied/);
 const conflict=await mutate('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{title:'stale'},0);assert.equal(conflict.status,'conflict');assert.equal(conflict.record.payload.title,'A');
 const deleted=await mutate('cccccccc-cccc-4ccc-8ccc-cccccccccccc',{id:'t1'},1,true);assert.ok(deleted.record.deleted_at);assert.equal(deleted.record.version,2);
 const stale=await mutate('dddddddd-dddd-4ddd-8ddd-dddddddddddd',{title:'revive'},1);assert.equal(stale.status,'conflict');assert.ok(stale.record.deleted_at);
 await as(B);assert.equal((await db.query('select * from public.lambert_items')).rows.length,0);const b=await mutate(mid,{id:'t1',title:'B'},0);assert.equal(b.record.user_id,B);assert.equal(b.record.version,1);
 await assert.rejects(db.query('select * from public.lambert_mutations'),/permission denied/);
 await as(null,'anon');await assert.rejects(db.query('select * from public.lambert_items'),/permission denied/);await assert.rejects(mutate(mid,{},0),/permission denied/);
 await as(null);await assert.rejects(mutate(mid,{},0),/authentication_required/);
 await as(A);await assert.rejects(mutate('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',[],2),/invalid_mutation/);
 await db.close();
});
