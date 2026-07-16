// ============================================================================
// useOneShotPlacement — bottom-toolbar Chunk 2 (approved plan, 2026-07-15)
// ----------------------------------------------------------------------------
// Owns the one-shot placement interaction for the single-click creation
// tools (Node, Text Block) plus Esc-to-cancel for ALL creation tools
// (including Line, whose click/drag gesture lives in LinePlacementOverlay).
//
// Interaction model — "the placement layer only captures the left click":
// there is NO full-screen overlay. A document-level CAPTURE-phase
// pointerdown listener intercepts primary clicks whose target is inside
// .react-flow__pane (the canvas surface — nodes and edges are DOM children
// of the pane, so a click over a card still places). Everything else flows
// normally while armed:
//   - right-click → React Flow's normal contextmenu path (canvas menu on
//     empty space, node menu on a card) — per Erik's correction, right-click
//     is NOT a cancel; the tool stays armed under the menu
//   - app chrome (bottom toolbar, altitude rail, menus) never matches the
//     pane filter, so it stays fully clickable — clicking another tool
//     switches, clicking Pointer/Hand disarms; nothing can be placed
//     "behind" the toolbar because that click hits the toolbar
//   - scroll-wheel pan/zoom is untouched
//
// Spacebar suspension: while the spacebar temporarily flips the effective
// tool to Hand (pre-gesture only — see effectiveTool), the pointer listener
// detaches entirely, so the click that pans can never also place. Esc stays
// live through suspension so the tool can always be cancelled.
//
// One-shot: after a successful placement the creators themselves revert the
// active tool to Pointer (Erik: ALWAYS return to Pointer after placing). The
// `placedRef` latch guards the render gap between the revert and this
// effect's cleanup so a fast double-click can't place twice.
// ============================================================================

import { useEffect, useRef } from 'react'
import { useToolStore, effectiveTool } from '../store/useToolStore'

const CREATION_TOOLS = ['node', 'text', 'line']

// Swallow the click the browser synthesizes right after our intercepted
// pointerdown, so React Flow's pane onClick (which clears selection) never
// sees it. Same belt-and-suspenders pattern as useCustomMarquee.
export function suppressNextClick() {
  const suppress = (e) => {
    e.stopPropagation()
    e.preventDefault()
    document.removeEventListener('click', suppress, true)
  }
  document.addEventListener('click', suppress, true)
  setTimeout(() => document.removeEventListener('click', suppress, true), 100)
}

export function useOneShotPlacement({ rfInstanceRef, onPlaceNode, onPlaceText }) {
  const activeTool = useToolStore((s) => s.activeTool)
  const spacebarHeld = useToolStore((s) => s.spacebarHeld)
  const placementGestureActive = useToolStore((s) => s.placementGestureActive)

  // Latest callbacks in refs so the document listeners never go stale.
  const onPlaceNodeRef = useRef(onPlaceNode)
  const onPlaceTextRef = useRef(onPlaceText)
  useEffect(() => { onPlaceNodeRef.current = onPlaceNode }, [onPlaceNode])
  useEffect(() => { onPlaceTextRef.current = onPlaceText }, [onPlaceText])

  // ── Esc cancels any armed creation tool (the ONLY explicit cancel) ──────
  // Attached whenever a creation tool is armed — including during spacebar
  // suspension and mid-line-gesture. Plain bubble listener (no propagation
  // games), matching the shipped line overlay's Esc behavior.
  const creationArmed = CREATION_TOOLS.includes(activeTool)
  useEffect(() => {
    if (!creationArmed) return
    const onKey = (e) => {
      if (e.key === 'Escape') useToolStore.getState().setActiveTool('pointer')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [creationArmed])

  // ── Single-click placement for Node / Text Block ────────────────────────
  // Armed = the tool is selected AND not spacebar-suspended (during
  // suspension the effective tool is Hand and the click should pan).
  const placementTool =
    (activeTool === 'node' || activeTool === 'text') &&
    effectiveTool(activeTool, spacebarHeld, placementGestureActive) === activeTool
      ? activeTool
      : null

  useEffect(() => {
    if (!placementTool) return
    const placedRef = { current: false }

    const onPointerDown = (e) => {
      if (e.button !== 0) return                            // primary only
      if (!(e.target instanceof Element)) return
      if (!e.target.closest('.react-flow__pane')) return    // chrome stays live
      if (placedRef.current) return                         // one-shot latch
      const rf = rfInstanceRef.current
      if (!rf) return
      placedRef.current = true
      // Stop the event in the capture phase: React Flow (drag/select) and
      // useCustomMarquee (document bubble) never see this pointerdown.
      e.preventDefault()
      e.stopPropagation()
      suppressNextClick()
      const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const place = placementTool === 'node' ? onPlaceNodeRef.current : onPlaceTextRef.current
      place(flowPos)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [placementTool, rfInstanceRef])
}
