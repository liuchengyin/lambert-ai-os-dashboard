begin;
create table public.lambert_books (
 user_id uuid not null references auth.users(id),
 id uuid not null,
 slot smallint not null check (slot between 0 and 6),
 title text not null check (char_length(title) between 1 and 200),
 page integer not null default 1 check (page > 0),
 object_path text not null,
 file_ready boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(user_id,id), unique(user_id,slot),
 check (object_path = user_id::text || '/' || id::text || '.pdf')
);
alter table public.lambert_books enable row level security;
grant select,insert,update,delete on public.lambert_books to authenticated;
create policy books_owner on public.lambert_books for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('lambert-books','lambert-books',false,52428800,array['application/pdf']) on conflict(id) do nothing;
create policy books_files_read on storage.objects for select to authenticated
 using(bucket_id='lambert-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy books_files_insert on storage.objects for insert to authenticated
 with check(bucket_id='lambert-books' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.lambert_books b where b.user_id=(select auth.uid()) and b.object_path=name));
create policy books_files_delete on storage.objects for delete to authenticated
 using(bucket_id='lambert-books' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
