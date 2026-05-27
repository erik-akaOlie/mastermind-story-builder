-- ============================================================================
-- 008_profiles_terms_acceptance.sql
-- ----------------------------------------------------------------------------
-- Adds an auditable record of when a user agreed to the Terms of Service and
-- Privacy Policy at signup.
--
-- WHAT THIS DOES:
--
--   1. Adds a `terms_accepted_at` timestamptz column to public.profiles.
--      Null for users that pre-date the new signup flow (Erik, Todd, Chris,
--      anyone else from before the legal docs shipped). Populated for every
--      future signup that flows through the in-app agreement checkbox.
--
--   2. Updates the public.handle_new_user() trigger so that when a client
--      passes a `terms_accepted_at` field in the signup metadata
--      (auth.signUp options.data.terms_accepted_at), the trigger captures
--      it into public.profiles transactionally — same transaction as the
--      auth.users INSERT. This eliminates the race between "user account
--      created" and "agreement recorded" that a client-side post-signup
--      update would have.
--
-- HOW THE CLIENT WIRES IT:
--   await supabase.auth.signUp({
--     email, password,
--     options: { data: { terms_accepted_at: new Date().toISOString() } },
--   })
--
-- The trigger reads new.raw_user_meta_data->>'terms_accepted_at' and casts
-- it to timestamptz. Null/empty -> the column stays null (audit signal that
-- this user did NOT pass through the clickwrap flow).
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Add the terms_accepted_at column.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. Replace the auto-create-profile trigger function so it captures the
--    timestamp from signup metadata in the same transaction.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms_accepted_at timestamptz;
begin
  -- Pulls the timestamp out of the signup metadata (auth.signUp's
  -- options.data lands here as raw_user_meta_data). nullif handles the
  -- empty-string case; ::timestamptz parses the ISO string the client
  -- sent. Null when the field is absent — fine, the column stays null
  -- and signals "this user did not pass through the clickwrap flow."
  v_terms_accepted_at := nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz;

  insert into public.profiles (id, terms_accepted_at)
  values (new.id, v_terms_accepted_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Re-create the trigger defensively. Idempotent. The function above is the
-- thing that actually changed; the trigger binding stays the same.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
