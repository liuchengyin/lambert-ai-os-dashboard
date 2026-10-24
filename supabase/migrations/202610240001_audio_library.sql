-- Additive audio schema only. Apply in the existing project's SQL editor after review.
-- Initial limits: 200 reserved/ready tracks per set, 25 MiB/file, 500 MiB/user.
begin;
create table public.lambert_audio_collections (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null, title text not null check(length(title) between 1 and 200),
 version bigint not null default 1, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), primary key(user_id,id)
);
create table public.lambert_audio_tracks (
 user_id uuid not null, id uuid not null, collection_id uuid not null,
 title text not null check(length(title) between 1 and 200), filename text not null,
 mime text not null, bytes bigint not null check(bytes between 1 and 26214400),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), storage_path text not null,
 status text not null default 'reserved' check(status in ('reserved','ready')),
 sort_order bigint not null, duration double precision not null default 0,
 note text not null default '' check(octet_length(note)<=65536), note_version bigint not null default 0,
 position double precision not null default 0, rate double precision not null default 1,
 progress_version bigint not null default 0, last_played_at timestamptz,
 meta_version bigint not null default 1, created_at timestamptz not null default now(),
 primary key(user_id,id), unique(user_id,collection_id,sha256), unique(storage_path),
 foreign key(user_id,collection_id) references public.lambert_audio_collections(user_id,id)
);
create table public.lambert_audio_note_revisions (
 user_id uuid not null, id uuid not null, track_id uuid not null,
 base_version bigint not null, text text not null check(octet_length(text)<=65536),
 response jsonb not null, created_at timestamptz not null default now(),
 primary key(user_id,id), foreign key(user_id,track_id) references public.lambert_audio_tracks(user_id,id)
);
alter table public.lambert_audio_collections enable row level security;
alter table public.lambert_audio_tracks enable row level security;
alter table public.lambert_audio_note_revisions enable row level security;
revoke all on public.lambert_audio_collections,public.lambert_audio_tracks,public.lambert_audio_note_revisions from public,anon,authenticated;
grant select on public.lambert_audio_collections,public.lambert_audio_tracks,public.lambert_audio_note_revisions to authenticated;
create policy audio_collection_owner on public.lambert_audio_collections for select to authenticated using(user_id=(select auth.uid()));
create policy audio_track_owner on public.lambert_audio_tracks for select to authenticated using(user_id=(select auth.uid()));
create policy audio_note_owner on public.lambert_audio_note_revisions for select to authenticated using(user_id=(select auth.uid()));

create function public.lambert_audio_collection(p_id uuid,p_title text,p_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.lambert_audio_collections%rowtype;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_id is null or p_version is null or p_version<0 or p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'invalid_collection'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':audio',0));
 select * into r from public.lambert_audio_collections where user_id=u and id=p_id for update;
 if found then
  if r.title=trim(p_title) then return jsonb_build_object('status','applied','record',to_jsonb(r)); end if;
  if r.version<>p_version then return jsonb_build_object('status','conflict','record',to_jsonb(r)); end if;
  update public.lambert_audio_collections set title=trim(p_title),version=version+1,updated_at=now() where user_id=u and id=p_id returning * into r;
 else
  if p_version<>0 then raise exception 'collection_not_found'; end if;
  insert into public.lambert_audio_collections(user_id,id,title) values(u,p_id,trim(p_title)) returning * into r;
 end if;
 return jsonb_build_object('status','applied','record',to_jsonb(r));
end $$;

create function public.lambert_audio_reserve(p_id uuid,p_collection uuid,p_title text,p_filename text,p_mime text,p_bytes bigint,p_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.lambert_audio_tracks%rowtype; n bigint; total bigint; seq bigint;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_id is null or p_collection is null or p_title is null or length(trim(p_title)) not between 1 and 200
  or p_filename is null or length(p_filename)>500 or p_bytes is null or p_bytes not between 1 and 26214400
  or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
  or p_mime is null or p_mime not in ('audio/mpeg','audio/mp4','audio/wav','audio/x-wav') then raise exception 'invalid_audio'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':audio',0));
 if not exists(select 1 from public.lambert_audio_collections where user_id=u and id=p_collection) then raise exception 'collection_not_found'; end if;
 select * into r from public.lambert_audio_tracks where user_id=u and collection_id=p_collection and sha256=p_sha256;
 if found then return to_jsonb(r); end if;
 select count(*),coalesce(max(sort_order),0)+1024 into n,seq from public.lambert_audio_tracks where user_id=u and collection_id=p_collection;
 if n>=200 then raise exception 'collection_full'; end if;
 select coalesce(sum(bytes),0) into total from public.lambert_audio_tracks where user_id=u;
 if total+p_bytes>524288000 then raise exception 'audio_quota_exceeded'; end if;
 insert into public.lambert_audio_tracks(user_id,id,collection_id,title,filename,mime,bytes,sha256,storage_path,sort_order)
 values(u,p_id,p_collection,trim(p_title),p_filename,p_mime,p_bytes,p_sha256,u::text||'/'||p_collection::text||'/'||p_id::text,seq) returning * into r;
 update public.lambert_audio_collections set version=version+1,updated_at=now() where user_id=u and id=p_collection;
 return to_jsonb(r);
end $$;

create function public.lambert_audio_confirm(p_id uuid,p_duration double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r public.lambert_audio_tracks%rowtype;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_duration is null or p_duration<0 or p_duration='Infinity'::float8 or p_duration='NaN'::float8 then raise exception 'invalid_duration'; end if;
 select * into r from public.lambert_audio_tracks where user_id=u and id=p_id for update;
 if not found then raise exception 'track_not_found'; end if;
 if not exists(select 1 from storage.objects where bucket_id='lambert-audio-private' and name=r.storage_path and (metadata->>'size')::bigint=r.bytes) then raise exception 'object_not_confirmed'; end if;
 update public.lambert_audio_tracks set status='ready',duration=greatest(duration,p_duration) where user_id=u and id=p_id returning * into r;
 return to_jsonb(r);
end $$;

create function public.lambert_audio_title(p_id uuid,p_title text,p_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r public.lambert_audio_tracks%rowtype;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 200 or p_version is null then raise exception 'invalid_title'; end if;
 select * into r from public.lambert_audio_tracks where user_id=u and id=p_id for update;
 if not found then raise exception 'track_not_found'; end if;
 if r.meta_version<>p_version then return jsonb_build_object('status','conflict','record',to_jsonb(r)); end if;
 update public.lambert_audio_tracks set title=trim(p_title),meta_version=meta_version+1 where user_id=u and id=p_id returning * into r;
 return jsonb_build_object('status','applied','record',to_jsonb(r));
end $$;

create function public.lambert_audio_reorder(p_collection uuid,p_ids uuid[],p_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v bigint;n integer;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':audio',0));
 select version into v from public.lambert_audio_collections where user_id=u and id=p_collection for update;
 if not found then raise exception 'collection_not_found'; end if;
 if p_version is null or v<>p_version then return jsonb_build_object('status','conflict'); end if;
 select count(*) into n from public.lambert_audio_tracks where user_id=u and collection_id=p_collection;
 if p_ids is null or cardinality(p_ids)<>n or (select count(distinct x) from unnest(p_ids) x)<>n or
  exists(select 1 from unnest(p_ids) x where x is null or not exists(select 1 from public.lambert_audio_tracks where user_id=u and collection_id=p_collection and id=x)) then raise exception 'invalid_track_order'; end if;
 update public.lambert_audio_tracks t set sort_order=o.ordinality*1024 from unnest(p_ids) with ordinality o(id,ordinality) where t.user_id=u and t.collection_id=p_collection and t.id=o.id;
 update public.lambert_audio_collections set version=version+1,updated_at=now() where user_id=u and id=p_collection returning version into v;
 return jsonb_build_object('status','applied','version',v);
end $$;

create function public.lambert_audio_note(p_mutation uuid,p_id uuid,p_text text,p_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r public.lambert_audio_tracks%rowtype;receipt public.lambert_audio_note_revisions%rowtype;answer jsonb;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_mutation is null or p_text is null or octet_length(p_text)>65536 or p_version is null or p_version<0 then raise exception 'invalid_note'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':audio-note:'||p_mutation::text,0));
 select * into receipt from public.lambert_audio_note_revisions where user_id=u and id=p_mutation;
 if found then
  if receipt.track_id<>p_id or receipt.text<>p_text or receipt.base_version<>p_version then raise exception 'mutation_id_reused'; end if;
  return receipt.response;
 end if;
 select * into r from public.lambert_audio_tracks where user_id=u and id=p_id for update;
 if not found then raise exception 'track_not_found'; end if;
 if r.note_version=p_version then
  update public.lambert_audio_tracks set note=p_text,note_version=note_version+1 where user_id=u and id=p_id returning * into r;
  answer=jsonb_build_object('status','applied','record',to_jsonb(r));
 else answer=jsonb_build_object('status','conflict','record',to_jsonb(r),'recoverableDraftId',p_mutation); end if;
 insert into public.lambert_audio_note_revisions(user_id,id,track_id,base_version,text,response) values(u,p_mutation,p_id,p_version,p_text,answer);
 return answer;
end $$;

create function public.lambert_audio_progress(p_id uuid,p_position double precision,p_rate double precision,p_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r public.lambert_audio_tracks%rowtype;
begin
 if u is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_position is null or p_position<0 or p_position='Infinity'::float8 or p_position='NaN'::float8 or p_rate is null or p_rate not in (0.75,1,1.25,1.5,2) or p_version is null then raise exception 'invalid_progress'; end if;
 select * into r from public.lambert_audio_tracks where user_id=u and id=p_id for update;
 if not found then raise exception 'track_not_found'; end if;
 if r.progress_version<>p_version then return jsonb_build_object('status','conflict','record',to_jsonb(r)); end if;
 update public.lambert_audio_tracks set position=case when duration>0 then least(p_position,duration) else p_position end,rate=p_rate,last_played_at=now(),progress_version=progress_version+1 where user_id=u and id=p_id returning * into r;
 return jsonb_build_object('status','applied','record',to_jsonb(r));
end $$;

revoke all on function public.lambert_audio_collection(uuid,text,bigint),public.lambert_audio_reserve(uuid,uuid,text,text,text,bigint,text),public.lambert_audio_confirm(uuid,double precision),public.lambert_audio_title(uuid,text,bigint),public.lambert_audio_reorder(uuid,uuid[],bigint),public.lambert_audio_note(uuid,uuid,text,bigint),public.lambert_audio_progress(uuid,double precision,double precision,bigint) from public,anon;
grant execute on function public.lambert_audio_collection(uuid,text,bigint),public.lambert_audio_reserve(uuid,uuid,text,text,text,bigint,text),public.lambert_audio_confirm(uuid,double precision),public.lambert_audio_title(uuid,text,bigint),public.lambert_audio_reorder(uuid,uuid[],bigint),public.lambert_audio_note(uuid,uuid,text,bigint),public.lambert_audio_progress(uuid,double precision,double precision,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('lambert-audio-private','lambert-audio-private',false,26214400,array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav']);
create policy audio_private_read on storage.objects for select to authenticated using(bucket_id='lambert-audio-private' and exists(select 1 from public.lambert_audio_tracks t where t.user_id=(select auth.uid()) and t.storage_path=name));
create policy audio_private_upload on storage.objects for insert to authenticated with check(bucket_id='lambert-audio-private' and exists(select 1 from public.lambert_audio_tracks t where t.user_id=(select auth.uid()) and t.storage_path=name and t.status='reserved' and t.bytes=(metadata->>'size')::bigint));
-- No public bucket, upsert/update/delete policy, or modifications to task/review tables.
commit;
