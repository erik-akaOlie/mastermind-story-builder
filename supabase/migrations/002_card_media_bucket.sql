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
-- Why a SECURITY DEFINER helper instead of inlining the campaigns lookup
-- inside each policy: when the policy expression itself runs `select from
-- public.campaigns`, the cross-schema lookup fails silently in some Supabase
-- environments — the storage policy ends up unable to see the campaign row
-- even though the user owns it, and every upload returns "new row violates
-- row-level security policy". Wrapping the check in a SECURITY DEFINER
-- function bypasses RLS on public.campaigns when looking up the row;
-- security is preserved because the helper still uses auth.uid() internally,
-- so it only ever returns true for the calling user's own campaigns.
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

begin;

-- Create the bucket if it doesn't exist. Private bucket — clients must use
-- signed URLs to render images.
insert into storage.buckets (id, name, public)
values ('card-media', 'card-media', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Helper function: returns true if the signed-in user owns the campaign whose
-- id is the first segment of the given object path. Marked SECURITY DEFINER
-- so the lookup against public.campaigns runs with the function owner's
-- privileges instead of the caller's, sidestepping the cross-schema RLS quirk.
-- ----------------------------------------------------------------------------
create or replace function public.user_owns_card_media_path(object_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaigns
    where id::text = (storage.foldername(object_name))[1]
      and owner_id = auth.uid()
  );
$$;

grant execute on function public.user_owns_card_media_path(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Drop any existing card-media policies before re-creating, so this
-- migration is idempotent.
-- ----------------------------------------------------------------------------
drop policy if exists "Owner can read card media"   on storage.objects;
drop policy if exists "Owner can upload card media" on storage.objects;
drop policy if exists "Owner can update card media" on storage.objects;
drop policy if exists "Owner can delete card media" on storage.objects;

-- Read: only the campaign owner can list/download objects under their prefix.
create policy "Owner can read card media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'card-media'
    and public.user_owns_card_media_path(name)
  );

-- Insert: uploads must land under a campaign the user owns.
create policy "Owner can upload card media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'card-media'
    and public.user_owns_card_media_path(name)
  );

-- Update: rare for image storage, but include so renames/replacements work.
create policy "Owner can update card media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'card-media'
    and public.user_owns_card_media_path(name)
  );

-- Delete: removing variants when a card is deleted or an image is unattached.
create policy "Owner can delete card media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'card-media'
    and public.user_owns_card_media_path(name)
  );

commit;
