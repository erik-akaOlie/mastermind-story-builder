-- ============================================================================
-- Migration 009: one connection per node pair — DB-level invariant
-- ----------------------------------------------------------------------------
-- Product rule (Erik, 2026-06-11): the graph draws ONE line between two
-- cards no matter how many relationships exist between them — relationship
-- multiplicity lives in card content, never as parallel lines. The client
-- guards every creation path (Connection Manager picker filter, quick-connect
-- validation, pre-create pair checks), but client checks can race: two tabs,
-- a stale local cache, or a double-fired gesture can each slip a second row
-- in. This index makes the invariant a database fact.
--
-- The pair is UNORDERED: A→B and B→A are the same connection. least/greatest
-- normalize the two uuids so the index sees both directions as one key.
--
-- Step 1 deletes any duplicate rows that already exist (keeping the OLDEST
-- row per pair, so existing undo entries / chips referencing the original id
-- stay valid). Step 2 adds the unique index. Order matters — the index
-- creation fails if duplicates remain.
--
-- Client handling: src/lib/connections.js treats a unique-violation insert
-- (Postgres error 23505) as a benign no-op, because the desired end state —
-- "these two cards are connected" — already holds.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================================

-- 1. Remove existing duplicates, keeping the oldest row of each unordered pair.
delete from public.connections
where id in (
  select id from (
    select id,
           row_number() over (
             partition by least(source_node_id, target_node_id),
                          greatest(source_node_id, target_node_id)
             order by created_at asc, id asc
           ) as rn
    from public.connections
  ) ranked
  where rn > 1
);

-- 2. Enforce the invariant going forward. workspace_id is intentionally not
--    part of the key: a node pair already implies one workspace (both FKs
--    point at nodes, and nodes belong to exactly one workspace).
create unique index connections_unique_pair_idx
  on public.connections (
    (least(source_node_id, target_node_id)),
    (greatest(source_node_id, target_node_id))
  );
