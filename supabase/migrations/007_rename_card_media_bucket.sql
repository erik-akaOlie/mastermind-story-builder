-- ============================================================================
-- 007_rename_card_media_bucket.sql
-- ----------------------------------------------------------------------------
-- Renames the Storage bucket that holds workspace-content media:
--   `card-media` -> `workspace-media`
--
-- Why: the existing bucket already holds node-scoped images (avatars +
-- inspiration) AND was about to receive container-scoped assets
-- (thumbnails, future background images). "card-media" was a name
-- inherited from the bucket's first use case, not what the bucket
-- actually holds. The rename ships alongside the campaign -> workspace
-- architectural rename per ADR-0012.
--
-- WHAT THIS DOES:
--
--   1. Create the new `workspace-media` bucket (private).
--   2. Create a new SECURITY DEFINER helper
--      `user_owns_workspace_media_path` with the same body as the
--      existing `user_owns_card_media_path` (which migration 006 already
--      updated to query `public.workspaces`). The new helper is what the
--      new bucket's policies reference.
--   3. Create read/insert/update/delete RLS policies on the new bucket
--      using the new helper.
--   4. Drop the old policies on `card-media`. The bucket itself + its
--      old helper stay in place until the post-verification destructive
--      cleanup (a follow-up migration, NOT this one).
--
-- ORDER OF OPERATIONS (rollout sequence — see ADR-0012):
--
--   a. Apply migration 006 (table + columns + RLS + helper body).
--   b. Apply this migration (creates the new bucket + new policies).
--   c. Run scripts/copy-card-media-to-workspace-media.mjs against your
--      Supabase project. This copies every object from `card-media` to
--      `workspace-media` while leaving the originals in place.
--   d. Deploy the code (Workspace rename commits 1-6). The code now
--      reads/writes against `workspace-media`.
--   e. Verify renders work end-to-end against the new bucket.
--   f. Apply the destructive cleanup migration (drops `card-media` and
--      drops `user_owns_card_media_path`). Filed as a separate follow-up.
--
-- WHY NOT DROP THE OLD BUCKET HERE: keeping both buckets co-existing
-- during the cut-over gives a clean rollback window. If anything goes
-- wrong with the new bucket, the old objects are still where the old
-- code expected them.
--
-- Idempotent. Safe to run more than once (the helper is `create or
-- replace`; the bucket insert is `on conflict do nothing`; policy drops
-- and creates are guarded).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Create the new bucket (private).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('workspace-media', 'workspace-media', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. New helper function — same shape as user_owns_card_media_path, just
--    renamed. SECURITY DEFINER bypasses RLS on public.workspaces so the
--    cross-schema lookup from storage.objects works (see migration 002 for
--    the original rationale; same trick, renamed table).
-- ----------------------------------------------------------------------------
create or replace function public.user_owns_workspace_media_path(object_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces
    where id::text = (storage.foldername(object_name))[1]
      and owner_id = auth.uid()
  );
$$;

grant execute on function public.user_owns_workspace_media_path(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS policies on the new bucket, using the new helper.
-- ----------------------------------------------------------------------------
drop policy if exists "Owner can read workspace media"   on storage.objects;
drop policy if exists "Owner can upload workspace media" on storage.objects;
drop policy if exists "Owner can update workspace media" on storage.objects;
drop policy if exists "Owner can delete workspace media" on storage.objects;

create policy "Owner can read workspace media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workspace-media'
    and public.user_owns_workspace_media_path(name)
  );

create policy "Owner can upload workspace media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workspace-media'
    and public.user_owns_workspace_media_path(name)
  );

create policy "Owner can update workspace media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'workspace-media'
    and public.user_owns_workspace_media_path(name)
  );

create policy "Owner can delete workspace media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workspace-media'
    and public.user_owns_workspace_media_path(name)
  );

-- ----------------------------------------------------------------------------
-- 4. Drop the old policies on `card-media`. The bucket itself + the old
--    helper stay until the destructive cleanup migration; without these
--    policies, no client can read/write `card-media` anymore — which is
--    fine, because by the time this migration applies, the code is
--    pointing at `workspace-media` exclusively.
-- ----------------------------------------------------------------------------
drop policy if exists "Owner can read card media"   on storage.objects;
drop policy if exists "Owner can upload card media" on storage.objects;
drop policy if exists "Owner can update card media" on storage.objects;
drop policy if exists "Owner can delete card media" on storage.objects;

commit;
