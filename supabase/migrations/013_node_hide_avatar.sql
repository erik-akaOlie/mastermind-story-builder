-- ============================================================================
-- 013_node_hide_avatar.sql
-- ----------------------------------------------------------------------------
-- Per-node display preference: hide the node's identity image (its thumbnail /
-- avatar) in the canvas WITHOUT deleting it. When true:
--   - the card-view header shows the title text only (no image, no type icon)
--   - the bead shows the title's first letter
-- The stored avatar_url is never touched — this is a display toggle, so turning
-- it back off restores the existing image immediately.
--
-- Default false → every existing node keeps showing its thumbnail, so this is a
-- no-op for all current data.
--
-- No RLS change: the column lives on an already-protected table.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.nodes
  add column if not exists hide_avatar boolean not null default false;
