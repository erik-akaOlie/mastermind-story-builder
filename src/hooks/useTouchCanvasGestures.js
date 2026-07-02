// ============================================================================
// useTouchCanvasGestures
// ----------------------------------------------------------------------------
// Two-finger touch = pan + zoom together (Google-Maps style), per the touch
// interaction model Erik approved 2026-07-02 (provisional pending Checkpoint 1
// on-device feel test):
//
//   one-finger drag on empty canvas → marquee select (useCustomMarquee — its
//                                     pointer events already fire for touch)
//   two-finger drag                 → pan; pinch apart/together → zoom; one
//                                     continuous gesture can do both at once
//   drag on a node                  → moves the node (React Flow's d3-drag,
//                                     untouched)
//
// WHY THIS HOOK EXISTS: React Flow v11's zoom plumbing rejects EVERY
// touch-drag start when panOnDrag is false (verified in the installed
// package: "if (!panOnDrag && (event.type === 'mousedown' || event.type ===
// 'touchstart')) return false"). Our canvas uses panOnDrag={isPanning}
// (spacebar-held), which is always false on a phone — so RF's own pinch-zoom
// (zoomOnPinch) never actually ran on touch, and its filter is not
// configurable from outside. Rather than monkey-patch library internals,
// touch pan/zoom is implemented here with standard TouchEvents and applied
// through the public rf.setViewport() API. Mouse/wheel behavior is untouched.
//
// Analytics note: rf.setViewport() per frame still yields ONE
// onMoveEnd per gesture — RF collapses rapid viewport writes with a 150ms
// settle timer (same path the marquee's auto-pan already uses), so
// zoom_changed / pan_burst don't spam during a pinch.
//
// GESTURE MATH (pure, exported for unit tests): keep the canvas point that
// was under the fingers' midpoint at gesture start pinned under the midpoint
// as it moves, while scaling zoom by the ratio of finger distances. Panning
// falls out of the midpoint translation; zooming out of the distance ratio.
//
// Activation rules:
//   - Exactly two touches, both inside .react-flow, neither inside a node
//     (a second finger during a node drag should not hijack the viewport).
//   - A marquee in flight cancels itself when the second finger lands
//     (useCustomMarquee owns that — see its touchstart handler).
//   - Touches are tracked by identifier; if either lifts, the session ends.
//
// iOS Safari note (verification list): Safari ignores maximum-scale=1 in the
// viewport meta, so the non-passive preventDefault() on touchmove here is
// what stops Safari from page-zooming when the pinch starts on the canvas.
// ============================================================================

import { useEffect } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import { DEFAULT_MAX_ZOOM } from '../utils/altitude'

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function midpointOf(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

function distanceOf(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

// Pure: given the gesture-start session and the fingers' current midpoint +
// distance, compute the next viewport. Exported for unit tests.
//   session: { startZoom, startDist, anchorFlow: {x, y} }
//     anchorFlow = the canvas-space point that sat under the midpoint at
//     gesture start: (startMid - startViewport) / startZoom
export function computeTwoFingerViewport(session, mid, dist, minZoom, maxZoom) {
  const rawZoom = session.startZoom * (dist / session.startDist)
  const zoom = clamp(rawZoom, minZoom, maxZoom)
  return {
    x: mid.x - session.anchorFlow.x * zoom,
    y: mid.y - session.anchorFlow.y * zoom,
    zoom,
  }
}

const isCanvasTouch = (t) =>
  t.target instanceof Element &&
  t.target.closest('.react-flow') &&
  !t.target.closest('.react-flow__node')

export function useTouchCanvasGestures({ rfInstanceRef }) {
  useEffect(() => {
    // { ids: [idA, idB], startZoom, startDist, anchorFlow } while a
    // two-finger session is in flight; null otherwise.
    let session = null

    const findTracked = (touchList, ids) => {
      const a = Array.from(touchList).find((t) => t.identifier === ids[0])
      const b = Array.from(touchList).find((t) => t.identifier === ids[1])
      return a && b ? [a, b] : null
    }

    function onTouchStart(e) {
      if (session) return
      if (e.touches.length !== 2) return
      const [a, b] = [e.touches[0], e.touches[1]]
      // Both fingers must be on canvas ground (pane/edges/background) —
      // a finger on a node means a node drag may be in progress and the
      // viewport must not move underneath it.
      if (!isCanvasTouch(a) || !isCanvasTouch(b)) return
      const rf = rfInstanceRef.current
      if (!rf) return

      const vp = rf.getViewport()
      const mid = midpointOf(a, b)
      session = {
        ids: [a.identifier, b.identifier],
        startZoom: vp.zoom,
        startDist: Math.max(distanceOf(a, b), 1), // guard divide-by-zero
        anchorFlow: {
          x: (mid.x - vp.x) / vp.zoom,
          y: (mid.y - vp.y) / vp.zoom,
        },
      }
    }

    function onTouchMove(e) {
      if (!session) return
      const tracked = findTracked(e.touches, session.ids)
      if (!tracked) return
      // Non-passive preventDefault: keeps the browser from turning the
      // gesture into page scroll/zoom (the only reliable brake on iOS
      // Safari, which ignores maximum-scale in the viewport meta).
      e.preventDefault()
      const rf = rfInstanceRef.current
      if (!rf) return

      const minZoom = useCanvasUiStore.getState().dynamicMinZoom
      const next = computeTwoFingerViewport(
        session,
        midpointOf(tracked[0], tracked[1]),
        Math.max(distanceOf(tracked[0], tracked[1]), 1),
        minZoom,
        DEFAULT_MAX_ZOOM
      )
      rf.setViewport(next)
    }

    function onTouchEnd(e) {
      if (!session) return
      // Session survives only while BOTH tracked fingers are down.
      if (!findTracked(e.touches, session.ids)) session = null
    }

    // Document-level so the gesture survives fingers wandering over overlay
    // chrome mid-drag; activation is still gated to canvas-ground touches.
    // touchmove must be non-passive for preventDefault to work.
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [rfInstanceRef])
}
