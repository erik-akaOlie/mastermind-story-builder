// createCard — phase 5.
//
// createCard.dbRow holds the fields that went into the original createNode
// call, so the redo path simply replays it (with `id` so the card lands at
// its original UUID). The undo path is the obvious inverse: deleteNode.

import { createNode, deleteNode } from '../nodes.js'

export function canApplyInverse(entry, { nodes = [] } = {}) {
  // Inverse = delete the card we created, so it must still exist.
  const cardId = entry.cardId
  if (!cardId) return { ok: false, reason: 'Malformed createCard entry' }
  return nodes.some((n) => n.id === cardId)
    ? { ok: true }
    : { ok: false, reason: 'Card no longer exists' }
}

export function canApplyForward(entry, { nodes = [] } = {}) {
  // Forward (redo) = recreate the card at its original UUID, so nothing
  // should currently hold that id.
  const cardId = entry.cardId
  if (!cardId) return { ok: false, reason: 'Malformed createCard entry' }
  return nodes.some((n) => n.id === cardId)
    ? { ok: false, reason: 'A card with that id already exists' }
    : { ok: true }
}

export async function applyInverse(entry, { setNodes, setEdges } = {}) {
  const { cardId } = entry
  if (!cardId) throw new Error('[undoActions] createCard: missing cardId')

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.filter((n) => n.id !== cardId))
  }
  if (typeof setEdges === 'function') {
    setEdges((eds) => eds.filter((e) => e.source !== cardId && e.target !== cardId))
  }
  await deleteNode(cardId)
}

export async function applyForward(entry, { setNodes } = {}) {
  const { cardId, dbRow } = entry
  if (!cardId || !dbRow) throw new Error('[undoActions] createCard: missing cardId or dbRow')

  const reactNode = await createNode({
    id:         cardId,
    campaignId: entry.campaignId,
    typeId:     dbRow.typeId,
    typeKey:    dbRow.typeKey,
    label:      dbRow.label,
    summary:    dbRow.summary,
    avatarUrl:  dbRow.avatarUrl,
    positionX:  dbRow.positionX,
    positionY:  dbRow.positionY,
  })

  if (typeof setNodes === 'function') {
    setNodes((nds) => (nds.some((n) => n.id === cardId) ? nds : [...nds, reactNode]))
  }
}
