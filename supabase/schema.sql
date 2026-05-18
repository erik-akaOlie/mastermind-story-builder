-- ============================================================================
-- MasterMind: Story Builder — Database Schema
-- ============================================================================
-- Paste this entire file into Supabase's SQL Editor and click Run.
-- Creates the schema for a fresh project: tables, helper function,
-- and RLS policies. Safe to run once on a fresh project. DO NOT run on a
-- project with existing data — it will not delete data but will error
-- if tables already exist.
--
-- Terminology note: "campaign" was renamed to "workspace" in 2026-05
-- (see ADR-0012). This file reflects the current state. Older ADRs may
-- still use the legacy term; they're historical and footer-link to 0012.
-- ============================================================================


-- ============================================================================
-- HELPER FUNCTION: auto-update `updated_at` whenever a row changes.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- TABLE: workspaces
-- One row per workspace. Owned by a user.
-- ============================================================================
create table public.workspaces (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  name              text        not null,
  description       text,
  cover_image_url   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces(owner_id);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;

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


-- ============================================================================
-- TABLE: node_types
-- Card types belong to a USER (not a workspace), so a user's "Character" type
-- is the same thing across every workspace they own. Built-in types are seeded
-- on first sign-in (see lib/workspaces.js#ensureBuiltinTypes). Users can add
-- custom types (is_system = false). Custom types are never shared across users.
-- ============================================================================
create table public.node_types (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  key         text        not null,
  label       text        not null,
  color       text        not null,
  icon_name   text        not null,
  is_system   boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  unique (owner_id, key)
);

create index node_types_owner_id_idx on public.node_types(owner_id);

alter table public.node_types enable row level security;

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


-- ============================================================================
-- TABLE: nodes
-- Cards on the canvas. Linked to a workspace and a node_type.
-- Narrative content lives in node_sections, not here.
-- ============================================================================
create table public.nodes (
  id          uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  type_id     uuid        not null references public.node_types(id),
  label       text        not null default '',
  summary     text        not null default '',
  avatar_url  text,
  position_x  numeric     not null default 0,
  position_y  numeric     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index nodes_workspace_id_idx on public.nodes(workspace_id);
create index nodes_type_id_idx on public.nodes(type_id);

create trigger nodes_set_updated_at
  before update on public.nodes
  for each row execute function public.set_updated_at();

alter table public.nodes enable row level security;

create policy "Owner can read nodes in their workspaces"
  on public.nodes for select
  using (exists (
    select 1 from public.workspaces c
    where c.id = nodes.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert nodes in their workspaces"
  on public.nodes for insert
  with check (exists (
    select 1 from public.workspaces c
    where c.id = nodes.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update nodes in their workspaces"
  on public.nodes for update
  using (exists (
    select 1 from public.workspaces c
    where c.id = nodes.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete nodes in their workspaces"
  on public.nodes for delete
  using (exists (
    select 1 from public.workspaces c
    where c.id = nodes.workspace_id and c.owner_id = auth.uid()
  ));


-- ============================================================================
-- TABLE: node_sections
-- Modular sections inside a card. Each card has zero or more sections.
-- Exists now so the UI can evolve into modular cards later without
-- schema changes.
-- ============================================================================
create table public.node_sections (
  id          uuid        primary key default gen_random_uuid(),
  node_id     uuid        not null references public.nodes(id) on delete cascade,
  kind        text        not null,
  title       text,
  content     jsonb,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index node_sections_node_id_idx on public.node_sections(node_id);

create trigger node_sections_set_updated_at
  before update on public.node_sections
  for each row execute function public.set_updated_at();

alter table public.node_sections enable row level security;

create policy "Owner can read sections in their workspaces"
  on public.node_sections for select
  using (exists (
    select 1 from public.nodes n
    join public.workspaces c on c.id = n.workspace_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert sections in their workspaces"
  on public.node_sections for insert
  with check (exists (
    select 1 from public.nodes n
    join public.workspaces c on c.id = n.workspace_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update sections in their workspaces"
  on public.node_sections for update
  using (exists (
    select 1 from public.nodes n
    join public.workspaces c on c.id = n.workspace_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete sections in their workspaces"
  on public.node_sections for delete
  using (exists (
    select 1 from public.nodes n
    join public.workspaces c on c.id = n.workspace_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));


-- ============================================================================
-- TABLE: connections
-- Lines between two cards on the canvas.
-- Relationship-type labels come in a later sprint (separate table).
-- ============================================================================
create table public.connections (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null references public.workspaces(id) on delete cascade,
  source_node_id  uuid        not null references public.nodes(id) on delete cascade,
  target_node_id  uuid        not null references public.nodes(id) on delete cascade,
  created_at      timestamptz not null default now(),
  check (source_node_id <> target_node_id)
);

create index connections_workspace_id_idx on public.connections(workspace_id);
create index connections_source_node_id_idx on public.connections(source_node_id);
create index connections_target_node_id_idx on public.connections(target_node_id);

alter table public.connections enable row level security;

create policy "Owner can read connections in their workspaces"
  on public.connections for select
  using (exists (
    select 1 from public.workspaces c
    where c.id = connections.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert connections in their workspaces"
  on public.connections for insert
  with check (exists (
    select 1 from public.workspaces c
    where c.id = connections.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update connections in their workspaces"
  on public.connections for update
  using (exists (
    select 1 from public.workspaces c
    where c.id = connections.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete connections in their workspaces"
  on public.connections for delete
  using (exists (
    select 1 from public.workspaces c
    where c.id = connections.workspace_id and c.owner_id = auth.uid()
  ));


-- ============================================================================
-- TABLE: text_nodes
-- Free-floating text annotations on the canvas (separate from cards).
-- ============================================================================
create table public.text_nodes (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references public.workspaces(id) on delete cascade,
  content_html  text        not null default '',
  position_x    numeric     not null default 0,
  position_y    numeric     not null default 0,
  width         numeric     not null default 256,
  height        numeric,
  font_size     integer     not null default 18,
  align         text        not null default 'left' check (align in ('left', 'center', 'right')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index text_nodes_workspace_id_idx on public.text_nodes(workspace_id);

create trigger text_nodes_set_updated_at
  before update on public.text_nodes
  for each row execute function public.set_updated_at();

alter table public.text_nodes enable row level security;

create policy "Owner can read text nodes in their workspaces"
  on public.text_nodes for select
  using (exists (
    select 1 from public.workspaces c
    where c.id = text_nodes.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert text nodes in their workspaces"
  on public.text_nodes for insert
  with check (exists (
    select 1 from public.workspaces c
    where c.id = text_nodes.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update text nodes in their workspaces"
  on public.text_nodes for update
  using (exists (
    select 1 from public.workspaces c
    where c.id = text_nodes.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete text nodes in their workspaces"
  on public.text_nodes for delete
  using (exists (
    select 1 from public.workspaces c
    where c.id = text_nodes.workspace_id and c.owner_id = auth.uid()
  ));
