// ============================================================================
// batchDelete — data layer for deleting a multi-selection in one undoable step
// ----------------------------------------------------------------------------
// Snapshot / delete / restore for a mixed set of cards + text nodes, so one
// Ctrl+Z brings the whole selection back (BATCH_DELETE undo entry).
//
// THE connected-pair subtlety this module exists to solve: when two cards in
// the selection are connected to each other, the shared connection appears in
// BOTH cards' per-card snapshots (buildDeleteCardSnapshot captures every edge
// touching its card). A naive "restore each card with its dependents" would
// insert that connection twice — the second insert fails on the primary key
// and aborts the restore midway. buildBatchDeleteSnapshot therefore LIFTS
// connections out of the per-card snapshots into one de-duplicated top-level
// list at capture time, so the entry stored in the undo stack is structurally
// incapable of double-insertion.
//
// Restore order is a foreign-key invariant: all card rows first, then all
// section rows (FK → nodes), then connections (FK → nodes on both ends), then
// text nodes (independent). Per ADR-0006 the restore is non-transactional;
// if partial-restore failure is ever observed in practice, swap for a
// Postgres RPC — same call sites, transactional underneath.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'
import { buildDeleteCardSnapshot } from './nodes.js'
import { buildLineDbRow } from './lines.js'

// React text node → DB-shape row (the inverse of dbTextNodeToReactFlow).
// Mirrors the single-delete snapshot App.jsx builds; exported so both paths
// can share it eventually.
export function buildTextNodeDbRow(node, workspaceId) {
  return {
    id:           node.id,
    workspace_id: workspaceId,
    content_html: node.data.text ?? '',
    position_x:   node.position.x,
    position_y:   node.position.y,
    width:        node.data.width,
    height:       node.data.height ?? null,
    font_size:    node.data.fontSize,
    align:        node.data.align,
  }
}

// ----------------------------------------------------------------------------
// Build the full DB-shape snapshot for a batch delete. `ids` may mix card and
// text-node ids; each is classified by its React node's `type`.
//
// Like buildDeleteCardSnapshot (which this calls per card), a section-fetch
// failure THROWS rather than returning a partial snapshot — the caller must
// FAIL CLOSED and abort the delete. An un-undoable delete is worse than no
// delete.
//
// Returns:
//   {
//     cards:       [{ dbCardRow, dbSectionRows }, ...],   // connections lifted out
//     connections: [dbConnectionRow, ...],                // de-duplicated by id
//     textNodes:   [{ textNodeId, dbRow }, ...],
//     lines:       [{ lineId, dbRow }, ...],
//   }
// Ids not found in local state are skipped (parallels the single-delete null
// return); returns null if nothing in `ids` resolved to a deletable node.
// ----------------------------------------------------------------------------
export async function buildBatchDeleteSnapshot(ids, { nodes, edges, workspaceId, typeIdByKey }) {
  const idSet = ids instanceof Set ? ids : new Set(ids)

  const cardNodes = []
  const textNodes = []
  const lineNodes = []
  for (const n of nodes) {
    if (!idSet.has(n.id)) continue
    if (n.type === 'campaignNode') cardNodes.push(n)
    else if (n.type === 'textNode') textNodes.push(n)
    else if (n.type === 'lineNode') lineNodes.push(n)
  }
  if (cardNodes.length === 0 && textNodes.length === 0 && lineNodes.length === 0) return null

  // Per-card snapshots (sections come from the DB — throws on fetch failure).
  const cardSnapshots = await Promise.all(
    cardNodes.map((n) =>
      buildDeleteCardSnapshot(n.id, { nodes, edges, workspaceId, typeIdByKey })
    )
  )

  // Lift + de-duplicate connections across all per-card snapshots. A
  // connection between two selected cards shows up in both snapshots with
  // the same id; the Map keeps the first occurrence only.
  const connectionsById = new Map()
  const cards = []
  for (const snap of cardSnapshots) {
    if (!snap) continue   // card vanished between trigger and capture
    cards.push({ dbCardRow: snap.dbCardRow, dbSectionRows: snap.dbSectionRows })
    for (const c of snap.dbConnectionRows) {
      if (!connectionsById.has(c.id)) connectionsById.set(c.id, c)
    }
  }

  const textSnapshots = textNodes.map((n) => ({
    textNodeId: n.id,
    dbRow: buildTextNodeDbRow(n, workspaceId),
  }))

  const lineSnapshots = lineNodes.map((n) => ({
    lineId: n.id,
    dbRow: buildLineDbRow(n, workspaceId),
  }))

  if (cards.length === 0 && textSnapshots.length === 0 && lineSnapshots.length === 0) return null
  return {
    cards,
    connections: [...connectionsById.values()],
    textNodes: textSnapshots,
    lines: lineSnapshots,
  }
}

// ----------------------------------------------------------------------------
// Delete every card + text node in one pass (two .in() statements). Card
// sections and connections cascade at the DB level, same as single deleteNode.
// One persistWrite wrapper so a transient failure retries the whole batch.
// ----------------------------------------------------------------------------
export async function deleteBatch({ cardIds = [], textNodeIds = [], lineIds = [] }) {
  return persistWrite(async () => {
    if (cardIds.length) {
      const { error } = await supabase.from('nodes').delete().in('id', cardIds)
      if (error) throw error
    }
    if (textNodeIds.length) {
      const { error } = await supabase.from('text_nodes').delete().in('id', textNodeIds)
      if (error) throw error
    }
    if (lineIds.length) {
      const { error } = await supabase.from('lines').delete().in('id', lineIds)
      if (error) throw error
    }
  }, 'this deletion')
}

// ----------------------------------------------------------------------------
// Inverse of a batch delete. Insert order is the FK invariant documented in
// the header: cards → sections → connections → text nodes. Connections are
// already de-duplicated (capture-time lift), so this never double-inserts.
//
// Realtime echoes these INSERTs back to this tab, but useWorkspaceData's
// handlers are idempotent (skip rows whose ids already exist locally), so
// the dispatcher's optimistic update isn't double-applied.
// ----------------------------------------------------------------------------
export async function restoreBatchDelete({ cards = [], connections = [], textNodes = [], lines = [] }) {
  return persistWrite(async () => {
    if (cards.length) {
      const { error } = await supabase
        .from('nodes')
        .insert(cards.map((c) => c.dbCardRow))
      if (error) throw error

      const sectionRows = cards.flatMap((c) => c.dbSectionRows ?? [])
      if (sectionRows.length) {
        const { error: secErr } = await supabase.from('node_sections').insert(sectionRows)
        if (secErr) throw secErr
      }
    }

    if (connections.length) {
      const { error } = await supabase.from('connections').insert(connections)
      if (error) throw error
    }

    if (textNodes.length) {
      const { error } = await supabase
        .from('text_nodes')
        .insert(textNodes.map((t) => t.dbRow))
      if (error) throw error
    }

    if (lines.length) {
      const { error } = await supabase
        .from('lines')
        .insert(lines.map((l) => l.dbRow))
      if (error) throw error
    }
  }, 'this restore')
}
