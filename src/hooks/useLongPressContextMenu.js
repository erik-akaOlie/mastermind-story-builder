// ============================================================================
// useLongPressContextMenu
// ----------------------------------------------------------------------------
// iOS long-press parity for the two context menus (iPhone QA Finding A,
// 2026-07-07). Both the Canvas Tool Menu (empty canvas) and the node menu
// open via the browser's `contextmenu` event — App.jsx's onPaneContextMenu /
// onNodeContextMenu. Android Chrome synthesizes that event on touch
// long-press; iOS Safari never does, so on iPhone both menus were
// unreachable (and with no delete control in the Inspector, so was card
// delete). This hook adds the missing trigger: a ~500ms stationary touch
// hold opens the same menus through the same App-level open functions.
//
// Why a stationary hold is free to claim: the custom marquee
// (useCustomMarquee) starts a session on pane pointerdown but only applies
// selection past a 3px movement threshold, and two-finger pan/zoom
// (useTouchCanvasGestures) needs a second finger. A finger that lands and
// doesn't move belongs to nobody — until now.
//
// Lifecycle:
//   pointerdown (touch/pen, primary) → classify the target: a node
//                 (.react-flow__node, id from data-id), the empty pane
//                 (.react-flow__pane), or neither (ignore). Targets inside
//                 contenteditable/input/textarea are ignored so text-block
//                 inline editing and BlockNote editors keep native behavior.
//                 Start the 500ms timer.
//   pointermove   > 10px from the start point (iOS's standard allowable
//                 movement) → cancel; the gesture is a drag (marquee, node
//                 move, text-block resize), not a hold.
//   touchstart    with a second finger → cancel; the gesture is pan/zoom.
//   timer fires   → invoke the pane/node callback with the press point.
//   pointerup     after firing → swallow the next click in the capture
//                 phase; the browser synthesizes a click on release, which
//                 would otherwise hit onPaneClick (closing the menu we just
//                 opened) or land on whichever menu row rendered under the
//                 finger.
//
// Android dedupe (both directions): Chrome's native long-press contextmenu
// races our timer at ~the same delay. A document-capture contextmenu
// listener arbitrates — if our timer is still pending, the native event
// wins (cancel the timer, let React Flow's handlers run as they do today);
// if our timer already fired, the native event is swallowed so the menu
// doesn't double-open.
// ============================================================================

import { useEffect, useRef } from 'react'

const PANE_CLASS_NAME = 'react-flow__pane'
export const LONG_PRESS_MS = 500
export const MOVE_SLOP_PX = 10
// How long after our synthetic open a native contextmenu is treated as the
// same gesture. Long enough to cover the Android race, far shorter than any
// real second gesture.
export const NATIVE_DEDUPE_MS = 700
const CLICK_SUPPRESS_MS = 150

export function useLongPressContextMenu({ onLongPressPane, onLongPressNode }) {
  // Callbacks live in refs so the document listeners attach once and never
  // see stale closures (same pattern as useCustomMarquee).
  const paneCbRef = useRef(onLongPressPane)
  const nodeCbRef = useRef(onLongPressNode)
  useEffect(() => { paneCbRef.current = onLongPressPane }, [onLongPressPane])
  useEffect(() => { nodeCbRef.current = onLongPressNode }, [onLongPressNode])

  const sessionRef = useRef(null)  // { pointerId, startX, startY, timerId, fired }
  const lastFiredAtRef = useRef(0)

  useEffect(() => {
    function clearSession() {
      if (sessionRef.current) clearTimeout(sessionRef.current.timerId)
      sessionRef.current = null
    }

    function suppressNextClick() {
      const suppress = (clickEvent) => {
        clickEvent.stopPropagation()
        clickEvent.preventDefault()
        document.removeEventListener('click', suppress, true)
      }
      document.addEventListener('click', suppress, true)
      // If no click materializes (browser variance on post-long-press
      // release), don't leave a trap for the user's next legitimate tap.
      setTimeout(() => {
        document.removeEventListener('click', suppress, true)
      }, CLICK_SUPPRESS_MS)
    }

    function onPointerDown(e) {
      // Touch and pen only — mouse users have real right-click.
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
      if (e.isPrimary === false) return
      if (!(e.target instanceof Element)) return
      // Active text editing owns every gesture on its surface.
      if (e.target.closest('[contenteditable="true"], input, textarea')) return

      let target = null
      const nodeEl = e.target.closest('.react-flow__node')
      if (nodeEl) {
        const nodeId = nodeEl.getAttribute('data-id')
        if (nodeId) target = { kind: 'node', nodeId }
      } else if (e.target.classList.contains(PANE_CLASS_NAME)) {
        target = { kind: 'pane' }
      }
      if (!target) return

      clearSession()
      const startX = e.clientX
      const startY = e.clientY
      const timerId = setTimeout(() => {
        const s = sessionRef.current
        if (!s || s.timerId !== timerId) return
        s.fired = true
        lastFiredAtRef.current = Date.now()
        if (target.kind === 'node') {
          nodeCbRef.current?.(target.nodeId, { x: startX, y: startY })
        } else {
          paneCbRef.current?.({ x: startX, y: startY })
        }
      }, LONG_PRESS_MS)
      sessionRef.current = { pointerId: e.pointerId, startX, startY, timerId, fired: false }
    }

    function onPointerMove(e) {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId || s.fired) return
      if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) > MOVE_SLOP_PX) {
        clearSession()
      }
    }

    function onPointerEnd(e) {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      if (s.fired) suppressNextClick()
      clearSession()
    }

    function onTouchStart(e) {
      if (e.touches.length >= 2) clearSession()
    }

    function onContextMenu(e) {
      const s = sessionRef.current
      if (s && !s.fired) {
        // Native long-press event arrived first (Android / touch-screen
        // desktops) — it owns this gesture; stand down.
        clearSession()
        return
      }
      if (Date.now() - lastFiredAtRef.current < NATIVE_DEDUPE_MS) {
        // We already opened the menu for this gesture — swallow the native
        // event before it reaches React Flow's handlers and re-opens it.
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerEnd)
    document.addEventListener('pointercancel', onPointerEnd)
    document.addEventListener('touchstart', onTouchStart)
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerEnd)
      document.removeEventListener('pointercancel', onPointerEnd)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('contextmenu', onContextMenu, true)
      clearSession()
    }
  }, [])
}
