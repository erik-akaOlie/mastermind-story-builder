// deleteCard — phase 5. The hard one.
//
// deleteCard.{dbCardRow, dbSectionRows, dbConnectionRows} is the snapshot
// captured by buildDeleteCardSnapshot before the original delete persisted.
// The undo path optimistically rebuilds React state from the snapshot, then
// calls restoreCardWithDependents to put rows back in Supabase. The redo
// path is deleteNode + optimistic filter (mirrors the original delete).

import {
  deleteNode,
  restoreCardWithDependents,
  dbNodeToReactFlow,
} from '../nodes.js'
import { buildNodeTypesById } from './_cardHelpers.js'

export function canApplyInverse(entry, { nodes = [] } = {}) {
  // Inverse = restore the deleted card, so nothing with that id should
  // exist currently. If it does, something else recreated it; refuse.
  const cardId = entry.dbCardRow?.id
  if (!cardId) return { ok: false, reason: 'Malformed deleteCard entry' }
  return nodes.some((n) => n.id === cardId)
    ? { ok: false, reason: 'A card with that id already exists' }
    : { ok: true }
}

export function canApplyForward(entry, { nodes = [] } = {}) {
  // Forward (redo) = delete the card again, so it must still exist.
  const cardId = entry.dbCardRow?.id
  if (!cardId) return { ok: false, reason: 'Malformed deleteCard entry' }
  return nodes.some((n) => n.id === cardId)
    ? { ok: true }
    : { ok: false, reason: 'Card no longer exists' }
}

export async function applyInverse(entry, { setNodes, setEdges } = {}) {
  const { dbCardRow, dbSectionRows = [], dbConnectionRows = [] } = entry
  if (!dbCardRow?.id) throw new Error('[undoActions] deleteCard: missing dbCardRow.id')

  // Reconstruct React shape from the DB snapshot for the optimistic update.
  const sectionsByKind = {}
  for (const s of dbSectionRows) sectionsByKind[s.kind] = s.content
  const reactNode = dbNodeToReactFlow(dbCardRow, sectionsByKind, buildNodeTypesById())

  const reactEdges = dbConnectionRows.map((r) => ({
    id:     r.id,
    source: r.source_node_id,
    target: r.target_node_id,
    type:   'floating',
  }))

  if (typeof setNodes === 'function') {
    setNodes((nds) => (nds.some((n) => n.id === reactNode.id) ? nds : [...nds, reactNode]))
  }
  if (typeof setEdges === 'function') {
    setEdges((eds) => {
      const have = new Set(eds.map((e) => e.id))
      const additions = reactEdges.filter((e) => !have.has(e.id))
      return additions.length === 0 ? eds : [...eds, ...additions]
    })
  }

  await restoreCardWithDependents({ dbCardRow, dbSectionRows, dbConnectionRows })
}

export async function applyForward(entry, { setNodes, setEdges } = {}) {
  const cardId = entry.dbCardRow?.id
  if (!cardId) throw new Error('[undoActions] deleteCard: missing dbCardRow.id')

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.filter((n) => n.id !== cardId))
  }
  if (typeof setEdges === 'function') {
    setEdges((eds) => eds.filter((e) => e.source !== cardId && e.target !== cardId))
  }
  await deleteNode(cardId)
}
