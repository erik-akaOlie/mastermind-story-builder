-- ============================================================================
-- 010_workspace_snapshot.sql
-- ----------------------------------------------------------------------------
-- Adds an auto-generated canvas-snapshot path to workspaces, stored SEPARATELY
-- from the user-supplied custom cover (cover_image_url). The CampaignPicker
-- renders covers with the precedence:
--
--     cover_image_url  →  snapshot_path  →  letter placeholder
--
-- so removing a custom cover falls back to the latest auto-snapshot on its own.
-- The snapshot is captured client-side from the React Flow canvas when the user
-- leaves a workspace, then uploaded to workspace-media under
-- `{workspaceId}/snapshot/` (display .full path stored here, like cover_image_url).
--
-- The snapshot regenerates on every (content-bearing) leave, so it must NOT
-- count as a user "modification" — otherwise the picker's "Last modified" sort
-- would really mean "last visited." We give workspaces a dedicated updated_at
-- trigger that bumps the timestamp only when a user-facing field actually
-- changes (name / description / cover), and preserves it for snapshot-only
-- writes. The shared set_updated_at() stays in place for every other table.
--
-- No RLS change: the column lives on an already-protected table.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.workspaces
  add column if not exists snapshot_path text;

create or replace function public.workspaces_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.name            is distinct from old.name
     or new.description     is distinct from old.description
     or new.cover_image_url is distinct from old.cover_image_url then
    new.updated_at = now();
  else
    -- snapshot-only (or no user-facing change): keep the prior modified time.
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.workspaces_set_updated_at();
