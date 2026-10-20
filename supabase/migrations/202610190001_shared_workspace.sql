-- Run once in the dedicated Supabase project SQL editor. No existing app tables are changed.
begin;
create table public.lambert_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('tasks','projects','reviews')),
  item_id text not null check (length(item_id) between 1 and 200),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null check (version > 0),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,kind,item_id)
);
create table public.lambert_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id,mutation_id)
);
alter table public.lambert_items enable row level security;
alter table public.lambert_mutations enable row level security;
revoke all on public.lambert_items, public.lambert_mutations from public, anon, authenticated;
grant select on public.lambert_items to authenticated;
create policy owner_read on public.lambert_items for select to authenticated
  using ((select auth.uid()) = user_id);
-- Direct client writes are forbidden; this RPC owns identity, version and idempotency.
create function public.lambert_apply_mutation(
  p_mutation_id uuid, p_kind text, p_item_id text, p_payload jsonb,
  p_expected_version bigint, p_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_request jsonb;
  v_old_request jsonb;
  v_response jsonb;
  v_row public.lambert_items%rowtype;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_mutation_id is null or p_kind is null or p_kind not in ('tasks','projects','reviews')
    or p_item_id is null or length(p_item_id) not between 1 and 200
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 262144
    or p_expected_version is null or p_expected_version < 0 or p_deleted is null
    then raise exception 'invalid_mutation' using errcode='22023'; end if;
  v_request := jsonb_build_object('kind',p_kind,'itemId',p_item_id,'payload',p_payload,
    'expectedVersion',p_expected_version,'deleted',p_deleted);
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_mutation_id::text,0));
  select request,response into v_old_request,v_response from public.lambert_mutations
    where user_id=v_user and mutation_id=p_mutation_id;
  if found then
    if v_request <> v_old_request then raise exception 'mutation_id_reused' using errcode='22023'; end if;
    return v_response;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_kind || ':' || p_item_id,1));
  select * into v_row from public.lambert_items
    where user_id=v_user and kind=p_kind and item_id=p_item_id for update;
  if coalesce(v_row.version,0) <> p_expected_version then
    v_response := jsonb_build_object('status','conflict','record',to_jsonb(v_row));
  else
    insert into public.lambert_items(user_id,kind,item_id,payload,version,deleted_at,updated_at)
      values(v_user,p_kind,p_item_id,p_payload,p_expected_version+1,
        case when p_deleted then clock_timestamp() else null end,clock_timestamp())
      on conflict(user_id,kind,item_id) do update set payload=excluded.payload,
        version=excluded.version,deleted_at=excluded.deleted_at,updated_at=excluded.updated_at
      returning * into v_row;
    v_response := jsonb_build_object('status','applied','record',to_jsonb(v_row));
  end if;
  insert into public.lambert_mutations(user_id,mutation_id,request,response)
    values(v_user,p_mutation_id,v_request,v_response);
  return v_response;
end;
$$;
revoke all on function public.lambert_apply_mutation(uuid,text,text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.lambert_apply_mutation(uuid,text,text,jsonb,bigint,boolean) to authenticated;
commit;
