-- ============================================================================
-- 006_rename_campaigns_to_workspaces.sql
-- ----------------------------------------------------------------------------
-- Foundational architectural rename: the top-level container is renamed
-- from "campaign" (a domain-specific term carried over from the product's
-- D&D-first audience) to "workspace" (a generic bounded container for
-- entities, relationships, assets, and context).
--
-- Rationale: see ADR-0012. The product currently targets DMs but the
-- top-level model is positioned to support broader use cases over time
-- (organizational mapping, user journeys, knowledge systems, etc.).
-- Architecture names move with purpose; user-facing copy that references
-- D&D-flavored content stays.
--
-- WHAT THIS DOES:
--
--   1. Rename table `campaigns` → `workspaces`.
--   2. Rename FK columns `campaign_id` → `workspace_id` on nodes,
--      connections, and text_nodes.
--   3. Rename FK constraints and indexes for consistency.
--   4. Rename the updated_at trigger on the renamed table.
--   5. Drop old-named RLS policies (which migrated with the renamed table
--      but kept their old names) and create new-named policies referencing
--      `workspaces` and `workspace_id`.
--   6. Update the body of `user_owns_card_media_path` to query workspaces.
--      The function name itself is renamed in migration 007 alongside the
--      card-media → workspace-media bucket rename.
--
-- WHAT THIS DOES NOT TOUCH:
--   - storage.buckets — bucket rename ships in 007 so each change has its
--     own rollback window.
--   - public.node_types — types are user-scoped, not workspace-scoped;
--     no campaign_id column to rename.
--   - public.profiles — independent of the workspace model.
--
-- Idempotent. Safe to run more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Rename the campaigns table to workspaces.
--    Indexes, triggers, policies, and FK constraints follow the table object
--    automatically — they remain attached but keep their old names until
--    explicitly renamed below.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'campaigns'
  ) then
    alter table public.campaigns rename to workspaces;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Rename campaign_id columns on the three child tables.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nodes' and column_name = 'campaign_id'
  ) then
    alter table public.nodes rename column campaign_id to workspace_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'connections' and column_name = 'campaign_id'
  ) then
    alter table public.connections rename column campaign_id to workspace_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'text_nodes' and column_name = 'campaign_id'
  ) then
    alter table public.text_nodes rename column campaign_id to workspace_id;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Rename FK constraints for consistency. Postgres does not auto-rename
--    constraints when a column is renamed.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'nodes'
      and constraint_name = 'nodes_campaign_id_fkey'
  ) then
    alter table public.nodes
      rename constraint nodes_campaign_id_fkey to nodes_workspace_id_fkey;
  end if;

  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'connections'
      and constraint_name = 'connections_campaign_id_fkey'
  ) then
    alter table public.connections
      rename constraint connections_campaign_id_fkey to connections_workspace_id_fkey;
  end if;

  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'text_nodes'
      and constraint_name = 'text_nodes_campaign_id_fkey'
  ) then
    alter table public.text_nodes
      rename constraint text_nodes_campaign_id_fkey to text_nodes_workspace_id_fkey;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Rename indexes for consistency. `alter index if exists` is a no-op
--    when the old name is absent, so re-running this block is safe.
-- ----------------------------------------------------------------------------
alter index if exists campaigns_owner_id_idx     rename to workspaces_owner_id_idx;
alter index if exists nodes_campaign_id_idx       rename to nodes_workspace_id_idx;
alter index if exists connections_campaign_id_idx rename to connections_workspace_id_idx;
alter index if exists text_nodes_campaign_id_idx  rename to text_nodes_workspace_id_idx;

-- ----------------------------------------------------------------------------
-- 5. Rename the updated_at trigger on the renamed table.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'workspaces'
      and trigger_name = 'campaigns_set_updated_at'
  ) then
    alter trigger campaigns_set_updated_at on public.workspaces
      rename to workspaces_set_updated_at;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6. RLS policies — drop old-named policies (which traveled with the
--    renamed table but kept their original names) and create new-named
--    policies referencing `workspaces` / `workspace_id`.
--
--    Each block drops BOTH the old name and the new name (in case of
--    re-run) before creating, so the script is idempotent.
-- ----------------------------------------------------------------------------

-- workspaces table (was campaigns)
drop policy if exists "Owner can read their campaigns"   on public.workspaces;
drop policy if exists "Owner can insert their campaigns" on public.workspaces;
drop policy if exists "Owner can update their campaigns" on public.workspaces;
drop policy if exists "Owner can delete their campaigns" on public.workspaces;

drop policy if exists "Owner can read their workspaces"   on public.workspaces;
drop policy if exists "Owner can insert their workspaces" on public.workspaces;
drop policy if exists "Owner can update their workspaces" on public.workspaces;
drop policy if exists "Owner can delete their workspaces" on public.workspaces;

create policy "Owner can read their workspaces"
  on public.workspaces for select
  using (auth.uid() = owner_id);

create policy "Owner can insert their workspaces"
  on public.workspaces for insert
  with check (auth.uid() = owner_id);

create policy "Owner can update their workspaces"
  on public.workspaces for update
  using (auth.uid() = owner_id);

create policy "Owner can delete their workspaces"
  on public.workspaces for delete
  using (auth.uid() = owner_id);

-- nodes table (references workspaces via workspace_id)
drop policy if exists "Owner can read nodes in their campaigns"   on public.nodes;
drop policy if exists "Owner can insert nodes in their campaigns" on public.nodes;
drop policy if exists "Owner can update nodes in their campaigns" on public.nodes;
drop policy if exists "Owner can delete nodes in their campaigns" on public.nodes;

drop policy if exists "Owner can read nodes in their workspaces"   on public.nodes;
drop policy if exists "Owner can insert nodes in their workspaces" on public.nodes;
drop policy if exists "Owner can update nodes in their workspaces" on public.nodes;
drop policy if exists "Owner can delete nodes in their workspaces" on public.nodes;

create policy "Owner can read nodes in their workspaces"
  on public.nodes for select
  using (exists (
    select 1 from public.workspaces w
    where w.id = nodes.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can insert nodes in their workspaces"
  on public.nodes for insert
  with check (exists (
    select 1 from public.workspaces w
    where w.id = nodes.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can update nodes in their workspaces"
  on public.nodes for update
  using (exists (
    select 1 from public.workspaces w
    where w.id = nodes.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can delete nodes in their workspaces"
  on public.nodes for delete
  using (exists (
    select 1 from public.workspaces w
    where w.id = nodes.workspace_id and w.owner_id = auth.uid()
  ));

-- node_sections table (joins via nodes → workspaces)
drop policy if exists "Owner can read sections in their campaigns"   on public.node_sections;
drop policy if exists "Owner can insert sections in their campaigns" on public.node_sections;
drop policy if exists "Owner can update sections in their campaigns" on public.node_sections;
drop policy if exists "Owner can delete sections in their campaigns" on public.node_sections;

drop policy if exists "Owner can read sections in their workspaces"   on public.node_sections;
drop policy if exists "Owner can insert sections in their workspaces" on public.node_sections;
drop policy if exists "Owner can update sections in their workspaces" on public.node_sections;
drop policy if exists "Owner can delete sections in their workspaces" on public.node_sections;

create policy "Owner can read sections in their workspaces"
  on public.node_sections for select
  using (exists (
    select 1 from public.nodes n
    join public.workspaces w on w.id = n.workspace_id
    where n.id = node_sections.node_id and w.owner_id = auth.uid()
  ));

create policy "Owner can insert sections in their workspaces"
  on public.node_sections for insert
  with check (exists (
    select 1 from public.nodes n
    join public.workspaces w on w.id = n.workspace_id
    where n.id = node_sections.node_id and w.owner_id = auth.uid()
  ));

create policy "Owner can update sections in their workspaces"
  on public.node_sections for update
  using (exists (
    select 1 from public.nodes n
    join public.workspaces w on w.id = n.workspace_id
    where n.id = node_sections.node_id and w.owner_id = auth.uid()
  ));

create policy "Owner can delete sections in their workspaces"
  on public.node_sections for delete
  using (exists (
    select 1 from public.nodes n
    join public.workspaces w on w.id = n.workspace_id
    where n.id = node_sections.node_id and w.owner_id = auth.uid()
  ));

-- connections table
drop policy if exists "Owner can read connections in their campaigns"   on public.connections;
drop policy if exists "Owner can insert connections in their campaigns" on public.connections;
drop policy if exists "Owner can update connections in their campaigns" on public.connections;
drop policy if exists "Owner can delete connections in their campaigns" on public.connections;

drop policy if exists "Owner can read connections in their workspaces"   on public.connections;
drop policy if exists "Owner can insert connections in their workspaces" on public.connections;
drop policy if exists "Owner can update connections in their workspaces" on public.connections;
drop policy if exists "Owner can delete connections in their workspaces" on public.connections;

create policy "Owner can read connections in their workspaces"
  on public.connections for select
  using (exists (
    select 1 from public.workspaces w
    where w.id = connections.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can insert connections in their workspaces"
  on public.connections for insert
  with check (exists (
    select 1 from public.workspaces w
    where w.id = connections.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can update connections in their workspaces"
  on public.connections for update
  using (exists (
    select 1 from public.workspaces w
    where w.id = connections.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can delete connections in their workspaces"
  on public.connections for delete
  using (exists (
    select 1 from public.workspaces w
    where w.id = connections.workspace_id and w.owner_id = auth.uid()
  ));

-- text_nodes table
drop policy if exists "Owner can read text nodes in their campaigns"   on public.text_nodes;
drop policy if exists "Owner can insert text nodes in their campaigns" on public.text_nodes;
drop policy if exists "Owner can update text nodes in their campaigns" on public.text_nodes;
drop policy if exists "Owner can delete text nodes in their campaigns" on public.text_nodes;

drop policy if exists "Owner can read text nodes in their workspaces"   on public.text_nodes;
drop policy if exists "Owner can insert text nodes in their workspaces" on public.text_nodes;
drop policy if exists "Owner can update text nodes in their workspaces" on public.text_nodes;
drop policy if exists "Owner can delete text nodes in their workspaces" on public.text_nodes;

create policy "Owner can read text nodes in their workspaces"
  on public.text_nodes for select
  using (exists (
    select 1 from public.workspaces w
    where w.id = text_nodes.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can insert text nodes in their workspaces"
  on public.text_nodes for insert
  with check (exists (
    select 1 from public.workspaces w
    where w.id = text_nodes.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can update text nodes in their workspaces"
  on public.text_nodes for update
  using (exists (
    select 1 from public.workspaces w
    where w.id = text_nodes.workspace_id and w.owner_id = auth.uid()
  ));

create policy "Owner can delete text nodes in their workspaces"
  on public.text_nodes for delete
  using (exists (
    select 1 from public.workspaces w
    where w.id = text_nodes.workspace_id and w.owner_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- 7. Update the body of user_owns_card_media_path to query `workspaces`.
--    The function NAME stays as-is here; it is renamed to
--    user_owns_workspace_media_path in migration 007 alongside the
--    card-media → workspace-media bucket rename. Splitting the rename
--    across two migrations keeps each step's rollback window isolated.
-- ----------------------------------------------------------------------------
create or replace function public.user_owns_card_media_path(object_name text)
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

commit;
