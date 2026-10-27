-- Run after 202610190001_shared_workspace.sql, before enabling document sync.
-- Preserve all existing rows, owner RLS, versions and queued mutation IDs.
begin;
alter table public.lambert_items drop constraint lambert_items_kind_check;
alter table public.lambert_items add constraint lambert_items_kind_check
  check (kind in ('tasks','projects','reviews','documents'));
create or replace function public.lambert_apply_mutation(
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
  if p_kind='documents' and p_item_id not in ('reading_workspace_v2','reading_standalone_notes_v1','knowledge_link_library_v1','knowledge_link_personal_v1') then raise exception 'invalid_document'; end if;
  if p_mutation_id is null or p_kind is null or p_kind not in ('tasks','projects','reviews','documents')
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
commit;
