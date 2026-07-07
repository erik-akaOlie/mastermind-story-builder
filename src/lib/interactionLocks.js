// ============================================================================
// interactionLocks — geometry lock for text blocks during an active resize
// ----------------------------------------------------------------------------
// V1 Realtime sync has no echo filter: our own saves round-trip through the
// server and re-apply ~0.5–2s later. The text_nodes UPDATE handler's no-op
// guard only skips echoes that MATCH local state — mid-resize, local geometry
// is ahead of the last saved row, so a stale echo passes the guard and snaps
// the block's position/size back for a frame (observed as "resize also moves
// the block", MB-6 verification 2026-07-06).
//
// Scope is deliberately narrow (per the approved MB-6 guardrails):
//   • only the text block currently being resized (locked by id)
//   • only geometry (position / width / height) — content and every other
//     field from a remote update still applies normally
//   • only for the duration of the active drag: locked on pointerdown,
//     released on pointerup, pointercancel, and unmount
//
// This is NOT a general echo filter — that remains an accepted V1 trade-off
// (see CLAUDE.md, Realtime sync). It closes exactly the mid-gesture window.
// ============================================================================

const lockedIds = new Set()

export function lockTextBlockGeometry(id) {
  lockedIds.add(id)
}

export function unlockTextBlockGeometry(id) {
  lockedIds.delete(id)
}

export function isTextBlockGeometryLocked(id) {
  return lockedIds.has(id)
}
