-- ============================================================================
-- 012_workspace_last_opened.sql
-- ----------------------------------------------------------------------------
-- "Recently active" should treat OPENING a workspace as activity, not just
-- editing its content. Opening a workspace IS working on it — for most users
-- the workspace they just opened is the most recently-relevant one even before
-- they touch the graph (e.g. open B, jump straight to A: A should lead).
--
-- We can't reuse workspaces.updated_at for this. The workspaces_set_updated_at
-- trigger (migration 010) forcibly PRESERVES updated_at on any write that does
-- not change name/description/cover — specifically so auto-snapshots don't
-- count as edits. A direct updated_at bump on open would be silently reverted.
--
-- So we add a dedicated last_opened_at column the trigger does not manage, write
-- it when a workspace becomes active (client-side, fire-and-forget), and fold it
-- into list_workspaces_with_activity()'s last_activity_at. Both the picker
-- ("Recently active" sort) and the breadcrumb switcher read that one field, so
-- the ordering unifies across both surfaces automatically.
--
-- No RLS change: the column lives on an already-protected table; the existing
-- owner-scoped UPDATE policy already governs writes.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.workspaces
  add column if not exists last_opened_at timestamptz;

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
      coalesce(w.last_opened_at, w.created_at),
      coalesce((select max(n.updated_at) from public.nodes n
                  where n.workspace_id = w.id), w.created_at),
      coalesce((select max(s.updated_at) from public.node_sections s
                  join public.nodes n2 on n2.id = s.node_id
                  where n2.workspace_id = w.id), w.created_at),
      coalesce((select max(c.created_at) from public.connections c
                  where c.workspace_id = w.id), w.created_at),
      coalesce((select max(t.updated_at) from public.text_nodes t
                  where t.workspace_id = w.id), w.created_at)
    ) as last_activity_at
  from public.workspaces w
  where w.owner_id = auth.uid()
  order by last_activity_at desc;
$$;
