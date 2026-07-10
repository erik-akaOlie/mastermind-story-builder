-- ============================================================================
-- Migration 015: lines — free-standing straight-line canvas annotations
-- ----------------------------------------------------------------------------
-- A line is an ORGANIZATION/ANNOTATION tool, not a relationship: it has two
-- absolute canvas anchor points (A and B) and belongs to a workspace, never
-- to nodes. Deliberately a separate table from `connections` so lines are
-- structurally incapable of becoming node relationships. Mirrors the
-- text_nodes pattern (free-floating, per-workspace, RLS via ownership).
--
-- Style columns: stroke weight + solid/dashed (+ dash length/gap). `color`
-- is stored now (single default) so a future color control needs no
-- migration; there is no color UI yet.
--
-- Run AFTER 014. Includes the Realtime setup both prior content tables
-- needed (publication membership + REPLICA IDENTITY FULL — without FULL,
-- DELETE broadcasts carry only the primary key and fail the workspace_id
-- filter; see CLAUDE.md "Realtime sync").
-- ============================================================================

create table public.lines (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  a_x           numeric     not null,
  a_y           numeric     not null,
  b_x           numeric     not null,
  b_y           numeric     not null,
  stroke_width  integer     not null default 4  check (stroke_width between 1 and 64),
  dashed        boolean     not null default false,
  dash_length   integer     not null default 12 check (dash_length between 1 and 128),
  dash_gap      integer     not null default 8  check (dash_gap between 1 and 128),
  color         text        not null default '#9CA3AF',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index lines_workspace_id_idx on public.lines(workspace_id);

create trigger lines_set_updated_at
  before update on public.lines
  for each row execute function public.set_updated_at();

alter table public.lines enable row level security;

create policy "Owner can read lines in their workspaces"
  on public.lines for select
  using (exists (
    select 1 from public.workspaces c
    where c.id = lines.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can insert lines in their workspaces"
  on public.lines for insert
  with check (exists (
    select 1 from public.workspaces c
    where c.id = lines.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can update lines in their workspaces"
  on public.lines for update
  using (exists (
    select 1 from public.workspaces c
    where c.id = lines.workspace_id and c.owner_id = auth.uid()
  ));

create policy "Owner can delete lines in their workspaces"
  on public.lines for delete
  using (exists (
    select 1 from public.workspaces c
    where c.id = lines.workspace_id and c.owner_id = auth.uid()
  ));

-- Realtime: broadcast changes to subscribed clients, with full old-row data
-- on DELETE so the workspace_id channel filter passes.
alter publication supabase_realtime add table public.lines;
alter table public.lines replica identity full;

-- ----------------------------------------------------------------------------
-- list_workspaces_with_activity: include line edits in last_activity_at so
-- the picker's "Last modified" sort counts line work as workspace activity
-- (same treatment text annotations got in migration 011).
-- ----------------------------------------------------------------------------
create or replace function public.list_workspaces_with_activity()
returns table (
  id               uuid,
  owner_id         uuid,
  name             text,
  description      text,
  cover_image_url  text,
  snapshot_path    text,
  created_at       timestamptz,
  updated_at       timestamptz,
  last_activity_at timestamptz
)
language sql
security invoker
stable
as $$
  select
    w.id, w.owner_id, w.name, w.description, w.cover_image_url, w.snapshot_path,
    w.created_at, w.updated_at,
    greatest(
      w.updated_at,
      coalesce((select max(n.updated_at) from public.nodes n
                  where n.workspace_id = w.id), w.created_at),
      coalesce((select max(s.updated_at) from public.node_sections s
                  join public.nodes n2 on n2.id = s.node_id
                  where n2.workspace_id = w.id), w.created_at),
      coalesce((select max(c.created_at) from public.connections c
                  where c.workspace_id = w.id), w.created_at),
      coalesce((select max(t.updated_at) from public.text_nodes t
                  where t.workspace_id = w.id), w.created_at),
      coalesce((select max(l.updated_at) from public.lines l
                  where l.workspace_id = w.id), w.created_at)
    ) as last_activity_at
  from public.workspaces w
  where w.owner_id = auth.uid()
  order by last_activity_at desc;
$$;
