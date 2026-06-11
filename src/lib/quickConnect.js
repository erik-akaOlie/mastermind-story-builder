// ============================================================================
// quickConnect — pure helpers for the canvas quick-connect gesture
// ----------------------------------------------------------------------------
// The drag interaction itself lives in App.jsx (window pointer listeners) and
// the buttons in QuickConnectButtons.jsx. This module owns the decisions:
// what's under the cursor, and whether it's a legal drop target.
// ============================================================================

// The React Flow node wrapper under a screen point, resolved to its node id.
// RF v11 renders every node inside `.react-flow__node` with a `data-id`
// attribute. Returns null when the point is over empty canvas / other UI.
export function findNodeIdAtPoint(x, y, doc = document) {
  const el = doc.elementFromPoint?.(x, y)
  if (!el) return null
  const wrapper = el.closest?.('.react-flow__node')
  return wrapper?.getAttribute('data-id') ?? null
}

// Is there already a connection between these two nodes, in either direction?
export function connectionExists(edges, a, b) {
  return edges.some(
    (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a)
  )
}

// Can a quick-connect drag that started on `sourceId` legally complete on
// `targetId`? Returns { ok, reason? } — reasons are for tests/debugging, the
// UI just cancels silently (per spec: release anywhere invalid = no-op).
//
// Rules: target must be a card (connections never attach to text blocks),
// must not be the source itself, and must not already be connected to the
// source (the Connection Manager has the same no-duplicates invariant).
export function validateQuickConnectTarget({ nodes, edges, sourceId, targetId }) {
  if (!targetId) return { ok: false, reason: 'No target under cursor' }
  if (targetId === sourceId) return { ok: false, reason: 'Cannot connect a card to itself' }
  const target = nodes.find((n) => n.id === targetId)
  if (!target) return { ok: false, reason: 'Target not found' }
  if (target.type !== 'campaignNode') {
    return { ok: false, reason: 'Connections only attach to cards' }
  }
  if (connectionExists(edges, sourceId, targetId)) {
    return { ok: false, reason: 'Already connected' }
  }
  return { ok: true }
}
