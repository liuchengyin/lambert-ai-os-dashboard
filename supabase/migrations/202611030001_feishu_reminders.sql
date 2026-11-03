-- Additive private reminder state only. No cron is installed or enabled here.
begin;
create schema reminder_private;
revoke all on schema reminder_private from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_roles where rolname='lambert_reminder_worker') then raise exception 'worker_role_exists_review_permissions';else
  create role lambert_reminder_worker nologin noinherit nobypassrls;
 end if;
end$$;
create table reminder_private.recipients(
 user_id uuid primary key,
 receive_id text not null unique check(receive_id ~ '^ou_[A-Za-z0-9_-]{1,125}$'),
 enabled boolean not null default false
);
create table reminder_private.deliveries(
 user_id uuid not null, day date not null, slot text not null check(slot in('11:45','19:00','21:30')),
 kind text not null check(kind in('tasks','review','test')), message_uuid uuid not null unique, claim_uuid uuid not null,
 state text not null check(state in('sending','sent','rejected','unknown')),
 retryable boolean not null default false, attempts integer not null default 1,
 provider_code text, message_id text, updated_at timestamptz not null default now(),
 primary key(user_id,day,slot,kind)
);
create table reminder_private.checks(
 id bigint generated always as identity primary key, user_id uuid not null, day date not null, slot text not null,
 outcome text not null, total integer not null default 0, pending integer not null default 0, created_at timestamptz not null default now()
);
alter table reminder_private.recipients enable row level security;
alter table reminder_private.deliveries enable row level security;
alter table reminder_private.checks enable row level security;
revoke all on all tables in schema reminder_private from public,anon,authenticated,lambert_reminder_worker;
revoke all on all sequences in schema reminder_private from public,anon,authenticated,lambert_reminder_worker;

create function reminder_private.bindings() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('userId',r.user_id,'receiveId',r.receive_id) order by r.user_id),'[]'::jsonb)
 from reminder_private.recipients r where r.enabled and exists(select 1 from auth.users u where u.id=r.user_id)
$$;
create function reminder_private.snapshot(p_user uuid,p_day date) returns jsonb language plpgsql security definer set search_path='' as $$
declare review jsonb; ids jsonb; rows jsonb;
begin
 if not exists(select 1 from reminder_private.recipients r join auth.users u on u.id=r.user_id where r.user_id=p_user and r.enabled) then raise exception 'binding_unavailable';end if;
 select payload into review from public.lambert_items where user_id=p_user and kind='reviews' and item_id=p_day::text and deleted_at is null;
 ids=coalesce(review->'taskIds','[]'::jsonb);
 if jsonb_typeof(ids)<>'array' then raise exception 'invalid_task_ids';end if;
 if jsonb_array_length(ids)>500 or exists(select 1 from jsonb_array_elements(ids) v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 200) then raise exception 'invalid_task_ids';end if;
 select coalesce(jsonb_agg(jsonb_build_object('item_id',item_id,'payload',jsonb_build_object('title',payload->'title','name',payload->'name','status',payload->'status','deletedAt',payload->'deletedAt','archived',payload->'archived'),'deleted_at',deleted_at)),'[]'::jsonb) into rows
 from public.lambert_items where user_id=p_user and kind='tasks' and item_id in(select jsonb_array_elements_text(ids));
 return jsonb_build_object('taskIds',ids,'records',rows);
end$$;
create function reminder_private.claim(p_user uuid,p_day date,p_slot text,p_kind text,p_message uuid,p_claim uuid,p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r reminder_private.deliveries%rowtype;
begin
 if not exists(select 1 from reminder_private.recipients where user_id=p_user and enabled) then raise exception 'binding_unavailable';end if;
 insert into reminder_private.deliveries(user_id,day,slot,kind,message_uuid,claim_uuid,state)
 values(p_user,p_day,p_slot,p_kind,p_message,p_claim,'sending') on conflict(user_id,day,slot,kind) do nothing returning * into r;
 if found then return to_jsonb(r);end if;
 select * into r from reminder_private.deliveries where user_id=p_user and day=p_day and slot=p_slot and kind=p_kind for update;
 if p_retry and r.state='rejected' and r.retryable then
  update reminder_private.deliveries set state='sending',retryable=false,claim_uuid=p_claim,attempts=attempts+1,updated_at=now()
  where user_id=p_user and day=p_day and slot=p_slot and kind=p_kind returning * into r;
  return to_jsonb(r);
 end if;
 return null;
end$$;
create function reminder_private.finish(p_user uuid,p_day date,p_slot text,p_kind text,p_claim uuid,p_state text,p_retryable boolean,p_code text,p_message_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_state not in('sent','rejected','unknown') or length(coalesce(p_code,''))>64 or length(coalesce(p_message_id,''))>200 or (p_state='sent' and coalesce(p_message_id,'')='') or (p_state<>'rejected' and p_retryable) then raise exception 'invalid_result';end if;
 update reminder_private.deliveries set state=p_state,retryable=p_retryable,provider_code=p_code,message_id=p_message_id,updated_at=now()
 where user_id=p_user and day=p_day and slot=p_slot and kind=p_kind and claim_uuid=p_claim and state='sending';
 if not found then raise exception 'claim_changed';end if;return true;
end$$;
create function reminder_private.log_check(p_user uuid,p_day date,p_slot text,p_outcome text,p_total integer,p_pending integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from reminder_private.recipients where user_id=p_user) or p_outcome not in('dry_run','checked','query_failed','receipt_unknown','duplicate','delivery_record_uncertain') or p_total<0 or p_pending<0 or p_pending>p_total then raise exception 'invalid_check';end if;
 insert into reminder_private.checks(user_id,day,slot,outcome,total,pending) values(p_user,p_day,p_slot,p_outcome,p_total,p_pending);
end$$;
revoke all on all functions in schema reminder_private from public,anon,authenticated;
grant usage on schema reminder_private to lambert_reminder_worker;
grant execute on all functions in schema reminder_private to lambert_reminder_worker;
-- Administrator later configures LOGIN/password via secure settings. Never grant
-- this role direct SELECT/UPDATE on business tables, BYPASSRLS, or service_role.
commit;
