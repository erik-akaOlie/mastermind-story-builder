-- ============================================================================
-- 003_profiles_and_profile_media.sql
-- ----------------------------------------------------------------------------
-- Stand up user profile metadata and the storage bucket that backs profile
-- avatars.
--
-- WHAT THIS DOES:
--
--   1. Creates public.profiles — the canonical home for all app-level user
--      metadata (avatar_path, display_name, future bio/preferences/etc.).
--      One row per auth.users row, linked 1:1 by id.
--
--   2. Adds a trigger on auth.users INSERT so every new sign-up gets a
--      profile row automatically. Also backfills profile rows for any
--      existing users (idempotent, safe to re-run).
--
--   3. Adds an updated_at trigger so updates to a profile row keep the
--      timestamp current.
--
--   4. Creates the `profile-media` Supabase Storage bucket — separate from
--      `card-media` because profile avatars are user-scoped, not
--      campaign-scoped, so the access rules differ.
--
--   5. Sets up storage RLS policies that pin every object to its owner's
--      auth.uid() via the first path segment.
--
-- PATH CONVENTION (profile-media bucket):
--   {user_id}/avatar-{timestamp_ms}.webp
--
-- Single variant (256×256). No thumb/full split — profile avatars never
-- render larger than ~64px in real UI; one variant is sufficient.
--
-- WHY NO SECURITY DEFINER HELPER (unlike 002_card_media_bucket.sql):
-- The card-media bucket needs to look up campaign ownership across schemas
-- (storage.objects → public.campaigns) and that cross-schema query trips an
-- RLS quirk in storage policies. The profile-media check is purely
-- auth.uid() against the path prefix — same-schema, no helper needed.
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. public.profiles table
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  avatar_path  text,                                            -- null = use initial fallback
  display_name text,                                             -- null = derive from email
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Owner can read their profile"   on public.profiles;
drop policy if exists "Owner can update their profile" on public.profiles;

-- Read: a user can read their own profile row.
create policy "Owner can read their profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Update: a user can edit their own profile row.
create policy "Owner can update their profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT policy: profile rows are created by the trigger below
-- (SECURITY DEFINER), not by clients.
-- No DELETE policy: profile rows go away via the cascade on auth.users.

-- ----------------------------------------------------------------------------
-- 2. Auto-create a profile row for every new auth user.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profile rows for any existing auth users (idempotent).
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger on public.profiles
-- ----------------------------------------------------------------------------

create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();

-- ----------------------------------------------------------------------------
-- 4. profile-media storage bucket
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Storage RLS policies for profile-media
-- ----------------------------------------------------------------------------

drop policy if exists "Owner can read profile media"   on storage.objects;
drop policy if exists "Owner can upload profile media" on storage.objects;
drop policy if exists "Owner can update profile media" on storage.objects;
drop policy if exists "Owner can delete profile media" on storage.objects;

-- Read: only the user can list/download objects under their own user-id prefix.
create policy "Owner can read profile media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Insert: uploads must land under the user's own user-id prefix.
create policy "Owner can upload profile media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: included so future replacement flows can rename if needed.
create policy "Owner can update profile media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: removing an avatar (user clicks "remove") deletes the object.
create policy "Owner can delete profile media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
