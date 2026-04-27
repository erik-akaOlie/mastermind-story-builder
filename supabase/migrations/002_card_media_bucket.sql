-- ============================================================================
-- 002_card_media_bucket.sql
-- ----------------------------------------------------------------------------
-- Create the `card-media` Supabase Storage bucket and the RLS policies that
-- gate access to its objects.
--
-- Path convention (per ADR-0005):
--   {campaign_id}/{card_id}/{section}-{timestamp_ms}-{slug}.{variant}.webp
--
-- Access model: the first path segment (campaign_id) is joined back to
-- public.campaigns to find the owner. Only that owner can read/write/delete
-- objects under their own campaign's prefix.
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

begin;

-- Create the bucket if it doesn't exist. Private bucket — clients must use
-- signed URLs to render images.
insert into storage.buckets (id, name, public)
values ('card-media', 'card-media', false)
on conflict (id) do nothing;

-- Drop any existing card-media policies before re-creating, so this
-- migration is idempotent.
drop policy if exists "Owner can read card media"   on storage.objects;
drop policy if exists "Owner can upload card media" on storage.objects;
drop policy if exists "Owner can update card media" on storage.objects;
drop policy if exists "Owner can delete card media" on storage.objects;

-- Read: only the campaign owner can list/download objects under their prefix.
create policy "Owner can read card media"
  on storage.objects for select
  using (
    bucket_id = 'card-media' and
    exists (
      select 1 from public.campaigns
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- Insert: uploads must land under a campaign the user owns.
create policy "Owner can upload card media"
  on storage.objects for insert
  with check (
    bucket_id = 'card-media' and
    exists (
      select 1 from public.campaigns
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- Update: rare for image storage, but include so renames/replacements work.
create policy "Owner can update card media"
  on storage.objects for update
  using (
    bucket_id = 'card-media' and
    exists (
      select 1 from public.campaigns
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

-- Delete: removing variants when a card is deleted or an image is unattached.
create policy "Owner can delete card media"
  on storage.objects for delete
  using (
    bucket_id = 'card-media' and
    exists (
      select 1 from public.campaigns
      where id::text = (storage.foldername(name))[1]
        and owner_id = auth.uid()
    )
  );

commit;
