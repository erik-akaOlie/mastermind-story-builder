// ============================================================================
// LinePlacementOverlay — the "draw a line" interaction mode.
// ----------------------------------------------------------------------------
// Mounted by App while the Line tool is armed (bottom toolbar or Canvas Tool
// Menu — the tool store is the single owner since Chunk 2). Reworked from the
// original full-screen pointer-owning surface to the Chunk 2 interaction
// model: the visible layer is pointer-events-none (an SVG preview only);
// document-level CAPTURE listeners intercept primary-button events targeted
// at the canvas (.react-flow__pane — nodes/edges are its DOM children).
// Consequences, all per Erik's approved corrections (2026-07-15):
//   - right-click BEFORE anchor A passes through untouched → normal canvas /
//     node context menus; the tool stays armed underneath
//   - right-click AFTER anchor A is swallowed (mid-gesture conflicting
//     inputs are ignored; Esc is the only cancel — handled by
//     useOneShotPlacement's shared Esc listener)
//   - app chrome (toolbar, rail, menus) stays clickable pre-anchor; once a
//     gesture is in flight, primary clicks on chrome are swallowed too — a
//     line can neither complete on top of the toolbar nor be thrown away by
//     a mid-gesture tool switch
//   - scroll-wheel pan/zoom flows through naturally (the flow-space preview
//     below keeps the half-line correct under any camera motion)
//
// One state machine serves both input worlds (unchanged from v1):
//   - Desktop click-move-click: click anchors A, moving previews the line,
//     a second click anchors B.
//   - Touch (and mouse) drag-draw: press anchors A, dragging previews,
//     lifting anchors B. A stationary tap (< DRAG_MIN px) falls through to
//     the click-move-click path instead of creating a zero-length line.
//   - Shift constrains the line to the four axes through A — snapped in
//     screen space against A's LIVE screen position (equivalent to flow
//     space under uniform zoom), so the preview shows exactly the commit.
//
// EDGE-PAN (new, Chunk 2): after anchor A, pushing the cursor to the window
// edge pans the camera in that direction and stops when the cursor comes
// back inside — this is the mid-gesture navigation story, since the
// spacebar is deliberately ignored once a gesture is in flight (Erik's
// resolved rule). Anchor A is stored in FLOW coords and re-projected every
// frame, so the preview stays pinned to the canvas while the camera moves.
// Same threshold/speed constants as useCustomMarquee's auto-pan for a
// consistent feel.
//
// Gesture-in-flight signal: `placementGestureActive` in useToolStore is set
// when A lands and cleared on complete/cancel/unmount. It's what makes the
// spacebar (and App's suspension logic) ignore mid-gesture input.
//
// TOUCH additions (Chunk 3, approved 2026-07-16):
//   - a SECOND finger while the first is still drag-drawing = pan/zoom
//     intent → the in-flight gesture is discarded (anchor A thrown away,
//     tool stays armed) instead of finger 2 "completing" a line it never
//     meant to draw. Known first-cut limitation: the pan attempt itself is
//     lost (finger 1's press was already swallowed), so navigating while
//     the Line tool is armed means disarming first — flagged for phone QA.
//   - mid-gesture, a press on the armed Line toolbar button (marked
//     data-placement-cancel — mobile tray only) passes through instead of
//     being swallowed: its tap disarms the tool, App unmounts this overlay,
//     and the half-drawn line is discarded. This is the phone stand-in for
//     Esc, which has no key on touch.
//   - pointercancel of the drawing finger (OS steals the touch) falls back
//     to click-move-click mode rather than leaving a stuck preview.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { LINE_DEFAULTS, snapToAxis } from '../lib/lines.js'
import { useToolStore } from '../store/useToolStore'
import { suppressNextClick } from '../hooks/useOneShotPlacement'

const DRAG_MIN = 8   // screen px separating a tap/click from a drag-draw

// Edge-pan tuning — identical to useCustomMarquee so the two auto-pans feel
// like one mechanism.
const EDGE_THRESHOLD_PX      = 60
const MAX_SPEED_PX_PER_FRAME = 15

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

// Note: there is no onCancel prop anymore — Esc (the only cancel) is owned by
// useOneShotPlacement's shared listener, which reverts the active tool to
// Pointer; App unmounts this overlay in response.
export default function LinePlacementOverlay({ rfInstanceRef, onComplete }) {
  const [aFlow, setAFlow] = useState(null)   // anchor A in FLOW coords
  const [cursor, setCursor] = useState(null) // latest pointer in screen coords
  // Bumped by the edge-pan RAF whenever the camera moves so the preview
  // re-projects aFlow → screen (the cursor itself may be stationary).
  const [, setPanTick] = useState(0)

  const pressRef = useRef(null)              // down point while deciding tap vs drag
  const stateRef = useRef({ aFlow, cursor })
  stateRef.current = { aFlow, cursor }
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // ── Gesture-in-flight flag (spacebar/right-click ignore rule) ───────────
  useEffect(() => {
    useToolStore.getState().setPlacementGestureActive(aFlow !== null)
    return () => useToolStore.getState().setPlacementGestureActive(false)
  }, [aFlow])

  // A's live screen position — recomputed every render, so edge-pan (which
  // re-renders via panTick) and wheel pan/zoom (which re-render via
  // pointermove) keep the preview pinned to the canvas.
  const rf = rfInstanceRef.current
  const aScreen = aFlow && rf ? rf.flowToScreenPosition(aFlow) : null

  // Screen point for B, honoring Shift's axis constraint relative to A's
  // CURRENT screen position.
  const bScreenFor = (e) => {
    const { aFlow: a } = stateRef.current
    const raw = { x: e.clientX, y: e.clientY }
    if (!e.shiftKey || !a) return raw
    const rfNow = rfInstanceRef.current
    return rfNow ? snapToAxis(rfNow.flowToScreenPosition(a), raw) : raw
  }

  // ── Document capture listeners — the gesture state machine ──────────────
  useEffect(() => {
    const toFlow = (x, y) => rfInstanceRef.current.screenToFlowPosition({ x, y })
    const onPane = (target) => target instanceof Element && target.closest('.react-flow__pane')

    const complete = (e) => {
      const { aFlow: a } = stateRef.current
      const b = bScreenFor(e)
      const bFlow = toFlow(b.x, b.y)
      onCompleteRef.current({ ax: a.x, ay: a.y, bx: bFlow.x, by: bFlow.y })
    }

    const cancelGesture = () => {
      setAFlow(null)
      setCursor(null)
      pressRef.current = null
    }

    const onPointerDown = (e) => {
      if (e.button !== 0) return  // secondary buttons → contextmenu handling below
      const { aFlow: a } = stateRef.current
      if (!a) {
        // Pre-anchor: only canvas-targeted presses start the gesture; chrome
        // (toolbar, menus, rail) keeps working normally.
        if (!onPane(e.target)) return
        if (!rfInstanceRef.current) return
        e.preventDefault()
        e.stopPropagation()
        suppressNextClick()
        const screen = { x: e.clientX, y: e.clientY }
        setAFlow(toFlow(screen.x, screen.y))
        setCursor(screen)
        pressRef.current = { ...screen, pointerId: e.pointerId }
        return
      }
      // Touch: a second finger while the first is still drag-drawing is a
      // pan/zoom intent, never "anchor B over there" — discard the gesture
      // (anchor A thrown away, tool stays armed). Sequential taps
      // (click-move-click on touch) have pressRef === null and fall through
      // to complete normally.
      if (
        e.pointerType === 'touch' &&
        pressRef.current &&
        e.pointerId !== pressRef.current.pointerId
      ) {
        e.preventDefault()
        e.stopPropagation()
        cancelGesture()
        return
      }
      // Mid-gesture, the armed Line button (mobile tray, data-placement-cancel)
      // is the one chrome press allowed through: its tap disarms the tool and
      // App unmounts this overlay — the phone stand-in for Esc.
      if (e.target instanceof Element && e.target.closest('[data-placement-cancel]')) return
      // Mid-gesture: every other primary press is ours. On the canvas it
      // anchors B (click-move-click mode); on chrome it's a conflicting
      // input → ignored (swallowed), so the half-drawn line survives.
      e.preventDefault()
      e.stopPropagation()
      if (!onPane(e.target)) return
      suppressNextClick()
      complete(e)
    }

    const onPointerMove = (e) => {
      if (stateRef.current.aFlow) setCursor(bScreenFor(e))
    }

    const onPointerUp = (e) => {
      const press = pressRef.current
      pressRef.current = null
      const { aFlow: a } = stateRef.current
      if (!a || !press) return
      // Drag-draw: a real drag between press and lift anchors B at the lift —
      // but only over the canvas, never on top of chrome.
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) >= DRAG_MIN) {
        if (!onPane(e.target)) return
        e.stopPropagation()
        suppressNextClick()
        complete(e)
      }
      // Otherwise: stationary tap/click — stay armed, await the second press.
    }

    // Right-click mid-gesture is a conflicting input → ignored entirely (no
    // menu, no cancel). Pre-anchor it never reaches this branch and the
    // normal contextmenu path (canvas/node menus) runs untouched.
    const onContextMenu = (e) => {
      if (!stateRef.current.aFlow) return
      e.preventDefault()
      e.stopPropagation()
    }

    // OS stole the drawing finger (rare with touch-action:none, but possible):
    // fall back to click-move-click mode — anchor A survives, the press is
    // forgotten, and the preview keeps tracking instead of freezing.
    const onPointerCancel = (e) => {
      if (pressRef.current && e.pointerId === pressRef.current.pointerId) {
        pressRef.current = null
      }
    }

    // TOUCH-DRAG REGRESSION FIX (Erik's phone QA, 2026-07-16): React Flow's
    // drag/zoom plumbing is d3-based and listens to TOUCHSTART, not pointer
    // events. Swallowing the pointerdown (above) suppresses the derived
    // MOUSE events, but a touch also fires its own touchstart — which was
    // reaching RF's node-drag handler, so drawing a line with anchor A on or
    // near an existing line GRABBED that line and dragged it with the
    // gesture. Mirror the pointerdown ownership rules for touchstart:
    // pre-anchor, canvas-targeted touches are ours (chrome stays live);
    // mid-gesture everything is ours except the armed Line button's cancel
    // tap. stopPropagation only — no preventDefault, so the browser's
    // pointer/click synthesis (which the state machine runs on) is intact.
    const onTouchStart = (e) => {
      const mine = stateRef.current.aFlow
        ? !(e.target instanceof Element && e.target.closest('[data-placement-cancel]'))
        : onPane(e.target)
      if (mine) e.stopPropagation()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerCancel, true)
    document.addEventListener('touchstart', onTouchStart, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerCancel, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [rfInstanceRef])

  // ── Edge-pan after anchor A (RAF, marquee-matched feel) ─────────────────
  const gestureActive = aFlow !== null
  useEffect(() => {
    if (!gestureActive) return
    let rafId = null
    const tick = () => {
      const { cursor: cur } = stateRef.current
      const rfNow = rfInstanceRef.current
      if (cur && rfNow) {
        const w = window.innerWidth
        const h = window.innerHeight
        const left   = clamp(EDGE_THRESHOLD_PX - cur.x,       0, EDGE_THRESHOLD_PX)
        const right  = clamp(EDGE_THRESHOLD_PX - (w - cur.x), 0, EDGE_THRESHOLD_PX)
        const top    = clamp(EDGE_THRESHOLD_PX - cur.y,       0, EDGE_THRESHOLD_PX)
        const bottom = clamp(EDGE_THRESHOLD_PX - (h - cur.y), 0, EDGE_THRESHOLD_PX)
        const dx = (right  - left) / EDGE_THRESHOLD_PX * MAX_SPEED_PX_PER_FRAME
        const dy = (bottom - top)  / EDGE_THRESHOLD_PX * MAX_SPEED_PX_PER_FRAME
        if (dx !== 0 || dy !== 0) {
          const vp = rfNow.getViewport()
          rfNow.setViewport({ x: vp.x - dx, y: vp.y - dy, zoom: vp.zoom })
          // Re-render so the preview re-projects anchor A's flow coords.
          setPanTick((t) => t + 1)
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => { if (rafId !== null) cancelAnimationFrame(rafId) }
  }, [gestureActive, rfInstanceRef])

  const zoom = rf?.getViewport()?.zoom ?? 1
  const previewWidth = Math.max(LINE_DEFAULTS.weight * zoom, 1.5)

  // Pure preview layer — pointer-events-none (the capture listeners above own
  // the interaction), below app chrome (toolbar z-40, menus 9998+) so nothing
  // is ever visually or interactively hidden behind the placement mode.
  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <svg className="w-full h-full" style={{ display: 'block' }}>
        {aScreen && cursor && (
          <line
            x1={aScreen.x} y1={aScreen.y}
            x2={cursor.x}  y2={cursor.y}
            stroke={LINE_DEFAULTS.color}
            strokeWidth={previewWidth}
            strokeLinecap="round"
            opacity={0.9}
          />
        )}
        {aScreen && (
          <circle cx={aScreen.x} cy={aScreen.y} r={4} fill={LINE_DEFAULTS.color} />
        )}
      </svg>
    </div>
  )
}
