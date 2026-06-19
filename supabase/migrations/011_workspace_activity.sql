-- ============================================================================
-- 011_workspace_activity.sql
-- ----------------------------------------------------------------------------
-- The CampaignPicker's "Last modified" sort needs each workspace's TRUE last
-- edit time — the newest change across its content (cards, card sections,
-- connections, text annotations), not just the workspaces row (which only moves
-- on rename / description / cover changes).
--
-- We compute this on READ via a function rather than bumping the workspace row
-- on every child edit, so the hot editing path takes zero extra write load.
-- One round trip returns every workspace the user owns, enriched with
-- last_activity_at = greatest(workspace updated_at, newest child timestamp).
--
-- SECURITY INVOKER: runs as the caller, so the existing RLS policies on every
-- table apply — a user only ever sees their own workspaces and content. The
-- explicit owner filter is belt-and-suspenders.
--
-- Connections carry only created_at (no updated_at); their deletes leave no
-- timestamp. That accuracy gap is pre-existing and accepted (see
-- getWorkspaceLastEditedAt in lib/workspaces.js).
--
-- Idempotent — safe to re-run.
-- ============================================================================

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
                  where t.workspace_id = w.id), w.created_at)
    ) as last_activity_at
  from public.workspaces w
  where w.owner_id = auth.uid()
  order by last_activity_at desc;
$$;
