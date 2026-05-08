// Connection-family helpers — used by addConnection and removeConnection.
//
// addConnection / removeConnection are a symmetric pair: each side's forward
// action is the other's inverse. The two implementations below
// (`removeConnectionImpl` and `restoreConnectionImpl`) cover both action
// types depending on which direction we're going.
//
//   addConnection.applyInverse    → removeConnectionImpl   (delete)
//   addConnection.applyForward    → restoreConnectionImpl  (recreate)
//   removeConnection.applyInverse → restoreConnectionImpl  (recreate)
//   removeConnection.applyForward → removeConnectionImpl   (delete)

import { createConnection, deleteConnection } from '../connections.js'

export function checkConnectionPresent(entry, { edges = [] } = {}) {
  const { connectionId } = entry
  if (!connectionId) return { ok: false, reason: 'Malformed connection entry' }
  return edges.some((e) => e.id === connectionId)
    ? { ok: true }
    : { ok: false, reason: 'Connection no longer exists' }
}

export function checkConnectionRestorable(entry, { nodes = [], edges = [] } = {}) {
  const { connectionId, sourceNodeId, targetNodeId } = entry
  if (!connectionId || !sourceNodeId || !targetNodeId) {
    return { ok: false, reason: 'Malformed connection entry' }
  }
  if (edges.some((e) => e.id === connectionId)) {
    return { ok: false, reason: 'A connection with that id already exists' }
  }
  if (!nodes.some((n) => n.id === sourceNodeId)) {
    return { ok: false, reason: 'Source card no longer exists' }
  }
  if (!nodes.some((n) => n.id === targetNodeId)) {
    return { ok: false, reason: 'Target card no longer exists' }
  }
  return { ok: true }
}

export async function removeConnectionImpl(entry, { setEdges } = {}) {
  const { connectionId } = entry
  if (!connectionId) throw new Error('[undoActions] connection: missing connectionId')

  if (typeof setEdges === 'function') {
    setEdges((eds) => eds.filter((e) => e.id !== connectionId))
  }
  await deleteConnection(connectionId)
}

export async function restoreConnectionImpl(entry, { setEdges } = {}) {
  const { connectionId, sourceNodeId, targetNodeId, campaignId } = entry
  if (!connectionId || !sourceNodeId || !targetNodeId) {
    throw new Error('[undoActions] connection: missing id / source / target')
  }

  // Persist with the original id so any later undo entry referring to this
  // connection still finds it. createConnection returns the React Flow edge.
  const edge = await createConnection({
    id: connectionId,
    campaignId,
    sourceNodeId,
    targetNodeId,
  })

  if (typeof setEdges === 'function') {
    setEdges((eds) => (eds.some((e) => e.id === connectionId) ? eds : [...eds, edge]))
  }
}
