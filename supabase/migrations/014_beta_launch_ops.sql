-- ============================================================================
-- 014_beta_launch_ops.sql
-- ----------------------------------------------------------------------------
-- Mox free-beta launch operations (ADR-0017). Adds everything the capped
-- signup + overflow-waitlist + attribution flow needs, in one migration:
--
--   1. public.beta_config — a single-row table holding the seat cap and the
--      open/closed flag the login screen reads BEFORE a visitor signs in.
--      Anyone (including anon) can READ it; nobody can write it through the
--      API — Erik flips beta_open / seat_limit by hand in the Supabase
--      dashboard. That is the "manual override" from ADR-0017 §1.
--
--   2. public.waitlist — overflow signups once seats are full. Anonymous
--      visitors can INSERT only (no read/update/delete via the API), so the
--      demand-signal count stays private to Erik. Unique email + an email
--      format CHECK are the spam guards; per ADR-0017 §4 there is NO Turnstile
--      yet — that is a later escalation if spam appears.
--
--   3. public.profiles gains a `how_heard` column. `display_name` already
--      exists (migration 003), so it is NOT re-added here.
--
--   4. public.handle_new_user() is extended to (a) capture display_name +
--      how_heard from signup metadata in the same transaction as the
--      auth.users INSERT (same mechanism migration 008 uses for
--      terms_accepted_at), and (b) perform the SOFT-CAP auto-flip: after the
--      profile is created, if the total profile count has reached
--      beta_config.seat_limit, set beta_open = false. This flips the flag for
--      the NEXT visitor; it never rejects the user currently signing up, so
--      simultaneous last-seat signups all get in (ADR-0017 §1).
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. beta_config — single-row launch switch.
-- ----------------------------------------------------------------------------
-- The CHECK (id = 1) pins this to exactly one row: the singleton config.
create table if not exists public.beta_config (
  id          int primary key default 1,
  seat_limit  int     not null default 50,
  beta_open   boolean not null default true,
  updated_at  timestamptz not null default now(),
  constraint beta_config_singleton check (id = 1)
);

-- Seed the single row if it isn't there yet. seat_limit 50 = the "50-ish"
-- cap including the handful of pre-existing accounts (Erik, Todd, Chris).
insert into public.beta_config (id, seat_limit, beta_open)
values (1, 50, true)
on conflict (id) do nothing;

alter table public.beta_config enable row level security;

-- READ for everyone, including unauthenticated visitors — the login screen
-- must read beta_open before the user has a session. The login fail-safe is
-- client-side: if this read fails, the client defaults to showing signup
-- (overshooting the cap is acceptable; blocking real signups is worse).
drop policy if exists "Anyone can read beta config" on public.beta_config;
create policy "Anyone can read beta config"
  on public.beta_config for select
  to anon, authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policy is created on purpose. With RLS enabled
-- and no write policy, the anon + authenticated roles cannot write this table
-- through the API at all. Writes happen only via the Supabase dashboard /
-- service_role (which bypasses RLS) — that IS the manual override.

-- ----------------------------------------------------------------------------
-- 2. waitlist — overflow signups when the beta is closed.
-- ----------------------------------------------------------------------------
create table if not exists public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  how_heard       text not null,
  how_heard_other text,
  created_at      timestamptz not null default now(),
  -- Cheap server-side email-format guard. Not RFC-perfect; just rejects
  -- obvious junk so the list stays usable. The unique constraint above is
  -- the dedupe guard.
  constraint waitlist_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

alter table public.waitlist enable row level security;

-- INSERT-only for anyone. Overflow signups happen pre-auth, so anon must be
-- able to add a row. No SELECT/UPDATE/DELETE policy → the list is invisible
-- and immutable through the API; Erik reads the demand signal in the
-- dashboard. (with check (true): any well-formed row is acceptable; the table
-- constraints — unique email, format CHECK, NOT NULL how_heard — do the real
-- gatekeeping.)
drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- ----------------------------------------------------------------------------
-- 3. profiles.how_heard — signup attribution (optional on signup).
--    display_name already exists from migration 003.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists how_heard text;

-- ----------------------------------------------------------------------------
-- 4. handle_new_user() — capture display_name + how_heard, and auto-flip the
--    soft cap. Replaces the migration-008 version; the terms_accepted_at
--    capture is preserved unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms_accepted_at timestamptz;
  v_display_name      text;
  v_how_heard         text;
  v_seat_limit        int;
  v_profile_count     int;
begin
  -- Pull signup metadata out of raw_user_meta_data (auth.signUp's
  -- options.data lands here). nullif collapses empty strings to NULL so an
  -- absent/blank field leaves the column NULL.
  v_terms_accepted_at := nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz;
  v_display_name      := nullif(new.raw_user_meta_data->>'display_name', '');
  v_how_heard         := nullif(new.raw_user_meta_data->>'how_heard', '');

  insert into public.profiles (id, terms_accepted_at, display_name, how_heard)
  values (new.id, v_terms_accepted_at, v_display_name, v_how_heard)
  on conflict (id) do nothing;

  -- Soft-cap auto-flip. Once the total profile count reaches the seat limit,
  -- close the beta for FUTURE visitors. This does NOT reject the current
  -- signup (the INSERT above already happened), so simultaneous last-seat
  -- signups all succeed. seat_limit counts ALL profiles, including the
  -- pre-existing accounts, per the "50-ish including existing users" decision.
  select seat_limit into v_seat_limit from public.beta_config where id = 1;
  if v_seat_limit is not null then
    select count(*) into v_profile_count from public.profiles;
    if v_profile_count >= v_seat_limit then
      update public.beta_config set beta_open = false, updated_at = now() where id = 1;
    end if;
  end if;

  return new;
end;
$$;

-- Re-create the trigger defensively. Idempotent. The function above is what
-- actually changed; the binding stays the same.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
