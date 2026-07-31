// ============================================================================
// useEdgeHoverSession
// ----------------------------------------------------------------------------
// Owns the "edge-hover session" that stabilizes Bead View dual-expand
// (Part B.1). The problem it solves: expanding both endpoint cards re-routes
// the hovered connection line, which moves React Flow's invisible edge
// hit-path out from under the cursor — so React Flow fires mouseleave, the
// cards collapse, the line snaps back, mouseenter fires again: flicker. A card
// sliding under the cursor produces the same class of bug from the node side.
// In both cases the hovered thing changes shape/position BECAUSE it's hovered,
// so the input target invalidates itself.
//
// Fix: separate the ACTIVATION source from session PERSISTENCE.
//   - Activation: React Flow's native onEdgeMouseEnter (after a dwell) starts
//     the first session. Kept pluggable — beginEdgeSession() takes plain data,
//     not a React Flow event, so a future custom nearest-edge picker (Pass 2)
//     can call it without touching any persistence logic here.
//   - Persistence: once active, THIS hook decides when the session ends, by
//     its own screen-space hit-test against geometry — it ignores React
//     Flow's leave event entirely. The session stays alive while the cursor
//     is within a UNION of regions (tested independently, no contiguity
//     assumed). Because expanding tall cards re-routes the line well below
//     where the user grabbed it, the region deliberately spans BOTH line
//     positions so the highlight survives while the user moves their mouse
//     from where the line WAS to where it now IS:
//       - the frozen original (bead-to-bead) corridor,
//       - the live re-routed line (card-to-card), read from edgesRef,
//       - the band BETWEEN those two lines (the quad of their 4 endpoints),
//       - either expanded card rectangle.
//     It exits only after the cursor leaves that whole union for a short
//     grace period.
//
// While a session holds two cards open, those cards are rendered click-through
// (pointer-events:none, in CampaignNode) so they can't steal pointer-hover and
// collapse their partner. That pointer-events change is scoped to session
// expansion only — selection / direct node-hover expansion are untouched.
// ============================================================================

import { useCallback, useEffect, useRef } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import {
  EDGE_ACTIVATION_DWELL_MS,
  EDGE_SESSION_HIT_WIDTH_PX,
  EDGE_SESSION_CARD_PAD_PX,
  EDGE_SESSION_EXIT_GRACE_MS,
} from '../utils/altitude'

// Squared distance from point P to segment AB, all in screen px. Squared to
// skip a sqrt in the per-pointermove hot path; the caller compares against
// width².
function distSqToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  const ex = px - cx
  const ey = py - cy
  return ex * ex + ey * ey
}

// Is point P inside triangle ABC? Barycentric sign test. Used to fill the
// band between the original and re-routed line: the quad [origA, origB, newB,
// newA] is covered by two triangles so the test is robust even if the quad is
// slightly non-convex (cards at very different heights).
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  // Inside when all cross-products share a sign (allowing zeros on edges).
  return !(hasNeg && hasPos)
}

export function useEdgeHoverSession({ rfInstanceRef, edgesRef }) {
  // Active session record (refs, not state — the pointermove hot path reads
  // them without forcing a re-render). null when no session is active:
  //   { edgeId, sourceId, targetId, aFlow: {x,y}, bFlow: {x,y} }
  // aFlow/bFlow are the line's two endpoints in CANVAS coords, frozen at
  // activation (when both nodes are still beads), so the corridor is immune to
  // the line later re-routing to the expanded cards, and tracks the graph
  // through pans/zooms. edgeId looks up the LIVE re-routed line in edgesRef.
  const sessionRef    = useRef(null)
  const dwellTimerRef = useRef(null)
  const graceTimerRef = useRef(null)

  const setHoveredEdgeNodeIds = useCanvasUiStore((s) => s.setHoveredEdgeNodeIds)

  const clearGrace = () => {
    if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null }
  }

  const endSession = useCallback(() => {
    clearGrace()
    if (!sessionRef.current) return
    sessionRef.current = null
    setHoveredEdgeNodeIds(null)
  }, [setHoveredEdgeNodeIds])

  // Activation entry point — plain data in, pluggable by design.
  const beginEdgeSession = useCallback((edge) => {
    // Pass 1: no handoff / arbitration. If a session is already active, ignore
    // a fresh activation — the current session owns the interaction until its
    // own exit. THIS single guard is the entire "ignore other edges while a
    // session is active" decision; Pass 2 replaces it with nearest-edge
    // arbitration without touching the rest of the session.
    if (sessionRef.current) return
    const aFlow = edge?.data?.sourcePoint
    const bFlow = edge?.data?.targetPoint
    if (!aFlow || !bFlow) return
    sessionRef.current = {
      edgeId: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      aFlow: { x: aFlow.x, y: aFlow.y },
      bFlow: { x: bFlow.x, y: bFlow.y },
    }
    setHoveredEdgeNodeIds(new Set([edge.source, edge.target]))
  }, [setHoveredEdgeNodeIds])

  // Is the cursor (screen px) within the session's alive region? UNION of
  // regions tested independently (no contiguity assumed). The region spans
  // BOTH line positions plus the band between them, so the highlight survives
  // while the user chases the line from where it was (high) to where the
  // expanded cards re-routed it (low):
  //   1. frozen original corridor (bead-to-bead),
  //   2. live re-routed line (card-to-card), from edgesRef,
  //   3. the band between those two lines (quad of their 4 endpoints),
  //   4. either expanded card rectangle.
  const isCursorAlive = useCallback((clientX, clientY) => {
    const s = sessionRef.current
    const rf = rfInstanceRef.current
    if (!s || !rf || !rf.flowToScreenPosition) return false
    const w = EDGE_SESSION_HIT_WIDTH_PX

    // 1. Frozen original corridor (where the line was when grabbed).
    const oa = rf.flowToScreenPosition(s.aFlow)
    const ob = rf.flowToScreenPosition(s.bFlow)
    if (distSqToSegment(clientX, clientY, oa.x, oa.y, ob.x, ob.y) <= w * w) return true

    // 2 + 3. Live re-routed line (where the line is now) and the band between
    //        it and the original. The live endpoints come from the active
    //        edge's current routing geometry in edgesRef.
    const liveEdge = edgesRef?.current?.find((e) => e.id === s.edgeId)
    const na = liveEdge?.data?.sourcePoint
    const nb = liveEdge?.data?.targetPoint
    if (na && nb) {
      const sa = rf.flowToScreenPosition(na)
      const sb = rf.flowToScreenPosition(nb)
      // 2. the new line itself.
      if (distSqToSegment(clientX, clientY, sa.x, sa.y, sb.x, sb.y) <= w * w) return true
      // 3. band between old and new line = quad [oa, ob, sb, sa], covered by
      //    two triangles so it's robust to a non-convex quad.
      if (pointInTriangle(clientX, clientY, oa.x, oa.y, ob.x, ob.y, sb.x, sb.y)) return true
      if (pointInTriangle(clientX, clientY, oa.x, oa.y, sb.x, sb.y, sa.x, sa.y)) return true
    }

    // 4. Either expanded card rectangle (live from the store; clamp/repel may
    //    have moved it). Project center to screen; half-extents are canvas-
    //    units × zoom, padded so a card's edge isn't a hair-trigger exit.
    const { expandedNodes, currentZoom: zoom } = useCanvasUiStore.getState()
    const pad = EDGE_SESSION_CARD_PAD_PX
    for (const id of [s.sourceId, s.targetId]) {
      const rec = expandedNodes.get(id)
      if (!rec) continue
      const c = rf.flowToScreenPosition({ x: rec.centerX, y: rec.centerY })
      const halfW = (rec.width  * zoom) / 2 + pad
      const halfH = (rec.height * zoom) / 2 + pad
      if (Math.abs(clientX - c.x) <= halfW && Math.abs(clientY - c.y) <= halfH) return true
    }
    return false
  }, [rfInstanceRef, edgesRef])

  // Persistent pointermove listener; a cheap no-op when no session is active.
  useEffect(() => {
    const onPointerMove = (e) => {
      if (!sessionRef.current) return
      if (isCursorAlive(e.clientX, e.clientY)) {
        clearGrace() // back inside the region — cancel any pending exit
      } else if (!graceTimerRef.current) {
        graceTimerRef.current = setTimeout(() => {
          graceTimerRef.current = null
          endSession()
        }, EDGE_SESSION_EXIT_GRACE_MS)
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [isCursorAlive, endSession])

  // Sessions are altitude-agnostic (2026-07-31 — Erik's equal-emphasis rule
  // retired the old "expansion is moot in Card View" assumption and its
  // force-end on leaving Bead View). A mid-session threshold crossing just
  // re-derives each endpoint's form (bead-peek ⇄ card-emphasis) while the
  // session keeps its normal exit path: the cursor hit-test + grace timer.

  // React Flow activation handlers (the pluggable feeder for Pass 1).
  const onEdgeMouseEnter = useCallback((_event, edge) => {
    // If a session is already active, don't even arm a dwell — the active
    // session owns the interaction (see beginEdgeSession's guard).
    if (sessionRef.current) return
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current)
    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null
      beginEdgeSession(edge)
    }, EDGE_ACTIVATION_DWELL_MS)
  }, [beginEdgeSession])

  const onEdgeMouseLeave = useCallback(() => {
    // Cancels only a PENDING activation. An ACTIVE session ignores React
    // Flow's leave entirely — it exits on its own hit-test + grace timer.
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
  }, [])

  // Cleanup on unmount: clear timers and don't leave a dangling hover signal.
  useEffect(() => () => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current)
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current)
    if (sessionRef.current) {
      sessionRef.current = null
      useCanvasUiStore.getState().setHoveredEdgeNodeIds(null)
    }
  }, [])

  return { onEdgeMouseEnter, onEdgeMouseLeave, beginEdgeSession, endSession }
}
