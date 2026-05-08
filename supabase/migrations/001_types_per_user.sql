-- ============================================================================
-- 001_types_per_user.sql
-- ----------------------------------------------------------------------------
-- Migrate node_types from per-campaign scope to per-user scope.
--
-- Why: card types (Character / Location / Faction / Item / Story plus any
-- user-created custom types) belong to a USER, not a CAMPAIGN. Per-user
-- scoping is what unlocks custom types working end-to-end, copying cards
-- between campaigns, and per-user templates (Sprint 2-3).
--
-- What this script does (in order — order matters because the old RLS
-- policies reference campaign_id, so they must be dropped before the column
-- is dropped):
--
--   1. Add a nullable `owner_id` column to node_types.
--   2. Backfill owner_id from each row's campaign owner.
--   3. Dedupe per (owner_id, key) — repoint nodes to the canonical row,
--      delete duplicates.
--   4. Mark owner_id NOT NULL.
--   5. Swap the (campaign_id, key) unique constraint for (owner_id, key).
--   6. Drop the four OLD RLS policies that reference campaign_id.
--   7. Drop the campaign_id column + its index.
--   8. Add an index on owner_id.
--   9. Create the four NEW RLS policies that scope by owner_id directly.
--
-- Idempotent: safe to run more than once. Wrapped in a transaction so it
-- either fully succeeds or fully rolls back.
--
-- BEFORE YOU RUN: take a snapshot of your Supabase project (Database →
-- Backups), or do a manual CSV export of the six tables.
-- ============================================================================

begin;

-- 1. Add owner_id (nullable for now so we can backfill).
alter table public.node_types
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- 2. Backfill owner_id from each row's campaign owner.
update public.node_types nt
set owner_id = c.owner_id
from public.campaigns c
where nt.campaign_id = c.id
  and nt.owner_id is null;

-- 3. Dedupe. For each (owner_id, key), keep the oldest row; repoint nodes
--    that reference duplicates to the canonical row; delete duplicates.
with ranked as (
  select id, owner_id, key,
         row_number() over (partition by owner_id, key order by created_at, id) as rn
  from public.node_types
),
canonical as (
  select id as canonical_id, owner_id, key
  from ranked
  where rn = 1
),
duplicates as (
  select id as duplicate_id, owner_id, key
  from ranked
  where rn > 1
)
update public.nodes
set type_id = c.canonical_id
from duplicates d
join canonical c on c.owner_id = d.owner_id and c.key = d.key
where nodes.type_id = d.duplicate_id;

delete from public.node_types
where id in (
  select id
  from (
    select id, row_number() over (partition by owner_id, key order by created_at, id) as rn
    from public.node_types
  ) t
  where rn > 1
);

-- 4. Enforce NOT NULL on owner_id.
alter table public.node_types alter column owner_id set not null;

-- 5. Swap the unique constraint.
alter table public.node_types drop constraint if exists node_types_campaign_id_key_key;
alter table public.node_types add constraint node_types_owner_id_key_key unique (owner_id, key);

-- 6. Drop the OLD RLS policies BEFORE dropping campaign_id (they reference it).
drop policy if exists "Owner can read types in their campaigns"   on public.node_types;
drop policy if exists "Owner can insert types in their campaigns" on public.node_types;
drop policy if exists "Owner can update types in their campaigns" on public.node_types;
drop policy if exists "Owner can delete types in their campaigns" on public.node_types;

-- 7. Drop the old campaign_id column + index.
drop index if exists public.node_types_campaign_id_idx;
alter table public.node_types drop column if exists campaign_id;

-- 8. Add an index on owner_id for fast per-user lookups.
create index if not exists node_types_owner_id_idx on public.node_types(owner_id);

-- 9. Create the new RLS policies that scope by owner_id directly.
create policy "Owner can read their types"
  on public.node_types for select
  using (owner_id = auth.uid());

create policy "Owner can insert their types"
  on public.node_types for insert
  with check (owner_id = auth.uid());

create policy "Owner can update their types"
  on public.node_types for update
  using (owner_id = auth.uid());

create policy "Owner can delete their types"
  on public.node_types for delete
  using (owner_id = auth.uid());

commit;
