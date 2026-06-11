// batchDelete — one undo entry for deleting a whole multi-selection (cards +
// text nodes) at once. One Ctrl+Z restores everything; one Ctrl+Shift+Z
// deletes it all again.
//
// Entry shape (built by App.deleteSelectedNodes via buildBatchDeleteSnapshot):
//   { type: 'batchDelete', workspaceId, label: 'Delete N items', timestamp,
//     cards:       [{ dbCardRow, dbSectionRows }, ...],
//     connections: [dbConnectionRow, ...],     // de-duplicated at capture time
//     textNodes:   [{ textNodeId, dbRow }, ...] }
//
// Connections live in ONE top-level deduped list — not inside the per-card
// snapshots — so a connection between two deleted cards is restored exactly
// once (see lib/batchDelete.js header for the FK ordering invariant).

import { restoreBatchDelete, deleteBatch } from '../batchDelete.js'
import { dbNodeToReactFlow } from '../nodes.js'
import { dbTextNodeToReactFlow } from '../textNodes.js'
import { buildNodeTypesById } from './_cardHelpers.js'

function entryIds(entry) {
  return [
    ...(entry.cards ?? []).map((c) => c.dbCardRow?.id),
    ...(entry.textNodes ?? []).map((t) => t.textNodeId),
  ].filter(Boolean)
}

function isMalformed(entry) {
  const cardsOk = (entry.cards ?? []).every((c) => c.dbCardRow?.id)
  const textsOk = (entry.textNodes ?? []).every((t) => t.textNodeId && t.dbRow)
  const nonEmpty = (entry.cards?.length ?? 0) + (entry.textNodes?.length ?? 0) > 0
  return !cardsOk || !textsOk || !nonEmpty
}

export function canApplyInverse(entry, { nodes = [] } = {}) {
  // Inverse = restore everything, so none of the ids may currently exist.
  // All-or-nothing: if another tab recreated even one of them, refuse rather
  // than attempt a partial restore.
  if (isMalformed(entry)) return { ok: false, reason: 'Malformed batchDelete entry' }
  const present = new Set(nodes.map((n) => n.id))
  return entryIds(entry).some((id) => present.has(id))
    ? { ok: false, reason: 'Something with one of those ids already exists' }
    : { ok: true }
}

export function canApplyForward(entry, { nodes = [] } = {}) {
  // Forward (redo) = delete everything again, so all ids must still exist.
  if (isMalformed(entry)) return { ok: false, reason: 'Malformed batchDelete entry' }
  const present = new Set(nodes.map((n) => n.id))
  return entryIds(entry).every((id) => present.has(id))
    ? { ok: true }
    : { ok: false, reason: 'Some of those items no longer exist' }
}

export async function applyInverse(entry, { setNodes, setEdges } = {}) {
  if (isMalformed(entry)) throw new Error('[undoActions] batchDelete: malformed entry')
  const { cards = [], connections = [], textNodes = [] } = entry

  // Rebuild React shapes from the DB snapshots for the optimistic update.
  const nodeTypesById = buildNodeTypesById()
  const reactNodes = [
    ...cards.map((c) => {
      const sectionsByKind = {}
      for (const s of c.dbSectionRows ?? []) sectionsByKind[s.kind] = s.content
      return dbNodeToReactFlow(c.dbCardRow, sectionsByKind, nodeTypesById)
    }),
    ...textNodes.map((t) => dbTextNodeToReactFlow(t.dbRow)),
  ]
  const reactEdges = connections.map((r) => ({
    id:     r.id,
    source: r.source_node_id,
    target: r.target_node_id,
    type:   'floating',
  }))

  if (typeof setNodes === 'function') {
    setNodes((nds) => {
      const have = new Set(nds.map((n) => n.id))
      const additions = reactNodes.filter((n) => !have.has(n.id))
      return additions.length === 0 ? nds : [...nds, ...additions]
    })
  }
  if (typeof setEdges === 'function') {
    setEdges((eds) => {
      const have = new Set(eds.map((e) => e.id))
      const additions = reactEdges.filter((e) => !have.has(e.id))
      return additions.length === 0 ? eds : [...eds, ...additions]
    })
  }

  await restoreBatchDelete({ cards, connections, textNodes })
}

export async function applyForward(entry, { setNodes, setEdges } = {}) {
  if (isMalformed(entry)) throw new Error('[undoActions] batchDelete: malformed entry')
  const ids = new Set(entryIds(entry))

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.filter((n) => !ids.has(n.id)))
  }
  if (typeof setEdges === 'function') {
    setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)))
  }

  await deleteBatch({
    cardIds:     (entry.cards ?? []).map((c) => c.dbCardRow.id),
    textNodeIds: (entry.textNodes ?? []).map((t) => t.textNodeId),
  })
}
