# DrawMaster cloud snapshots (preview only)

This change is a **manual opt-in cloud backup and recovery path**, not a finished live multi-device collaborative editor. Existing IndexedDB records, local trash and revisions are never deleted or overwritten.

## Server setup, after PR review only

1. In the existing Supabase project's **Storage** dashboard create a **private** bucket named `lambert-master-files` with a maximum file size of 5 MB. Allow `application/json` only. Verify quota and billing before activation. This bucket is separate from `lambert-books`.
2. Review and apply the owner-scoped policies below **only after the user approves the production database change**. Policies allow authenticated SELECT and INSERT only; no UPDATE or DELETE for cloud snapshots.
3. Deploy the feature after a representative test drawing is exported as .drawio and test in two browsers using the same account; verify a different account has no read/write access.
4. Keep the source device unchanged and do not clear its browser data. If a cloud version conflicts with a local version, both snapshots remain available; the UI reports a conflict without replacing either.

```sql
create policy "master_snapshots_select_owner"
on storage.objects for select to authenticated
using (
 bucket_id = 'lambert-master-files'
 and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "master_snapshots_insert_owner"
on storage.objects for insert to authenticated
with check (
 bucket_id = 'lambert-master-files'
 and (storage.foldername(name))[1] = (select auth.uid()::text)
);
```

Do not run these statements in production until the exact bucket and policies have been inspected. No `service_role` or bucket public access is needed.

## Limitations

- Uploads are immutable and versioned by content hash. Local deletions are not propagated to cloud; trash entries are never resurrected locally by sync.
- Conflicts are detected and reported, not automatically merged or resolved. Cloud snapshots are retained until a separately authorized deletion mechanism is built.
- This first step is for a small personal DrawMaster library. It deliberately fails closed after 200 cloud snapshots rather than silently importing a partial library.
- A lost local browser cannot restore files that were never explicitly synced.
- Availability and transfer speed depend on Supabase connectivity in mainland China. For reliable domestic access, later test private file storage and API performance before switching to a China-accessible provider.
