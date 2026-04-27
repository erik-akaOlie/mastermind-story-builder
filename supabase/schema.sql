-- ============================================================================
-- MasterMind: Story Builder — Database Schema (Sprint 1)
-- ============================================================================
-- Paste this entire file into Supabase's SQL Editor and click Run.
-- Creates: 6 tables, 1 helper function, RLS policies on every table.
-- Safe to run once on a fresh project. DO NOT run on a project with data
-- unless you know what you're doing — it will not delete existing data but
-- will error if tables already exist.
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
-- TABLE: campaigns
-- One row per campaign. Owned by a user.
-- ============================================================================
create table public.campaigns (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  name              text        not null,
  description       text,
  cover_image_url   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index campaigns_owner_id_idx on public.campaigns(owner_id);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;

create policy "Owner can read their campaigns"
  on public.campaigns for select
  using (auth.uid() = owner_id);

create policy "Owner can insert their campaigns"
  on public.campaigns for insert
  with check (auth.uid() = owner_id);

create policy "Owner can update their campaigns"
  on public.campaigns for update
  using (auth.uid() = owner_id);

create policy "Owner can delete their campaigns"
  on public.campaigns for delete
  using (auth.uid() = owner_id);


-- ============================================================================
-- TABLE: node_types
-- Card types belong to a USER (not a campaign), so a user's "Character" type
-- is the same thing across every campaign they own. Built-in types are seeded
-- on first sign-in (see lib/campaigns.js#ensureBuiltinTypes). Users can add
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
-- Cards on the canvas. Linked to a campaign and a node_type.
-- Narrative content lives in node_sections, not here.
-- ============================================================================
create table public.nodes (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  type_id     uuid        not null references public.node_types(id),
  label       text        not null default '',
  summary     text        not null default '',
  avatar_url  text,
  position_x  numeric     not null default 0,
  position_y  numeric     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index nodes_campaign_id_idx on public.nodes(campaign_id);
create index nodes_type_id_idx on public.nodes(type_id);

create trigger nodes_set_updated_at
  before update on public.nodes
  for each row execute function public.set_updated_at();

alter table public.nodes enable row level security;

create policy "Owner can read nodes in their campaigns"
  on public.nodes for select
  using (exists (
    select 1 from public.campaigns c
    where c.id = nodes.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert nodes in their campaigns"
  on public.nodes for insert
  with check (exists (
    select 1 from public.campaigns c
    where c.id = nodes.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update nodes in their campaigns"
  on public.nodes for update
  using (exists (
    select 1 from public.campaigns c
    where c.id = nodes.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete nodes in their campaigns"
  on public.nodes for delete
  using (exists (
    select 1 from public.campaigns c
    where c.id = nodes.campaign_id and c.owner_id = auth.uid()
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

create policy "Owner can read sections in their campaigns"
  on public.node_sections for select
  using (exists (
    select 1 from public.nodes n
    join public.campaigns c on c.id = n.campaign_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert sections in their campaigns"
  on public.node_sections for insert
  with check (exists (
    select 1 from public.nodes n
    join public.campaigns c on c.id = n.campaign_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update sections in their campaigns"
  on public.node_sections for update
  using (exists (
    select 1 from public.nodes n
    join public.campaigns c on c.id = n.campaign_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete sections in their campaigns"
  on public.node_sections for delete
  using (exists (
    select 1 from public.nodes n
    join public.campaigns c on c.id = n.campaign_id
    where n.id = node_sections.node_id and c.owner_id = auth.uid()
  ));


-- ============================================================================
-- TABLE: connections
-- Lines between two cards on the canvas.
-- Relationship-type labels come in a later sprint (separate table).
-- ============================================================================
create table public.connections (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references public.campaigns(id) on delete cascade,
  source_node_id  uuid        not null references public.nodes(id) on delete cascade,
  target_node_id  uuid        not null references public.nodes(id) on delete cascade,
  created_at      timestamptz not null default now(),
  check (source_node_id <> target_node_id)
);

create index connections_campaign_id_idx on public.connections(campaign_id);
create index connections_source_node_id_idx on public.connections(source_node_id);
create index connections_target_node_id_idx on public.connections(target_node_id);

alter table public.connections enable row level security;

create policy "Owner can read connections in their campaigns"
  on public.connections for select
  using (exists (
    select 1 from public.campaigns c
    where c.id = connections.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert connections in their campaigns"
  on public.connections for insert
  with check (exists (
    select 1 from public.campaigns c
    where c.id = connections.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update connections in their campaigns"
  on public.connections for update
  using (exists (
    select 1 from public.campaigns c
    where c.id = connections.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete connections in their campaigns"
  on public.connections for delete
  using (exists (
    select 1 from public.campaigns c
    where c.id = connections.campaign_id and c.owner_id = auth.uid()
  ));


-- ============================================================================
-- TABLE: text_nodes
-- Free-floating text annotations on the canvas (separate from cards).
-- ============================================================================
create table public.text_nodes (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references public.campaigns(id) on delete cascade,
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

create index text_nodes_campaign_id_idx on public.text_nodes(campaign_id);

create trigger text_nodes_set_updated_at
  before update on public.text_nodes
  for each row execute function public.set_updated_at();

alter table public.text_nodes enable row level security;

create policy "Owner can read text nodes in their campaigns"
  on public.text_nodes for select
  using (exists (
    select 1 from public.campaigns c
    where c.id = text_nodes.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert text nodes in their campaigns"
  on public.text_nodes for insert
  with check (exists (
    select 1 from public.campaigns c
    where c.id = text_nodes.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update text nodes in their campaigns"
  on public.text_nodes for update
  using (exists (
    select 1 from public.campaigns c
    where c.id = text_nodes.campaign_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete text nodes in their campaigns"
  on public.text_nodes for delete
  using (exists (
    select 1 from public.campaigns c
    where c.id = text_nodes.campaign_id and c.owner_id = auth.uid()
  ));
