// ============================================================================
// useCustomMarquee
// ----------------------------------------------------------------------------
// Replaces React Flow v11's built-in selectionOnDrag marquee, which has a
// structural limitation: when the cursor leaves the React Flow pane DOM,
// React Flow's `mouseleave` handler ends the selection and clears its
// internal selection rectangle. That breaks any auto-pan that needs to
// follow a cursor past the viewport edge.
//
// This hook owns the entire marquee lifecycle using DOCUMENT-level pointer
// events, which keep firing even when the cursor leaves the browser window:
//
//   pointerdown  → if landed on the React Flow pane (not a node, not while
//                  spacebar-panning), capture the canvas-coord start, clear
//                  current selection (unless Shift held), open the rect.
//   pointermove  → record the latest cursor screen position. The rectangle
//                  is computed each render from canvas-coord start +
//                  current screen position, so it tracks the cursor across
//                  viewport pans without drift.
//   RAF tick     → while active, check whether cursor is within 60px of any
//                  viewport edge. If so, pan React Flow's viewport via
//                  setViewport. The rect's anchor is in canvas coords so
//                  it grows automatically as the canvas slides under it.
//   pointerup    → compute which nodes the rect overlaps (partial mode)
//                  and apply selection via setNodes. If Shift was held at
//                  start, union with the previously-selected ids.
//
// Usage in App.jsx:
//   - Set ReactFlow's `selectionOnDrag={false}` so the built-in marquee
//     stays out of the way.
//   - const marquee = useCustomMarquee({ rfInstanceRef, nodes, setNodes, isPanning })
//   - Render <MarqueeRect marquee={marquee} rfInstanceRef={rfInstanceRef} />
//     somewhere above the canvas in the React tree.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'

const PANE_CLASS_NAME       = 'react-flow__pane'
const EDGE_THRESHOLD_PX     = 60
const MAX_SPEED_PX_PER_FRAME = 15
const MIN_DRAG_DISTANCE_PX  = 3   // below this, treat the drag as a click

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

export function useCustomMarquee({ rfInstanceRef, nodes, setNodes, isPanning }) {
  // marquee === null when no marquee in flight; otherwise an object that we
  // mutate each frame to drive the rect overlay's render.
  const [marquee, setMarquee] = useState(null)

  // Mutable per-marquee context. Lives in a ref so updating it doesn't
  // re-render the hook's consumers. Refreshed each pointerdown, cleared on up.
  const sessionRef     = useRef(null)  // { startCanvas, additive, initialSelectedIds }
  const currentRef     = useRef(null)  // { x, y } latest cursor screen coords
  const renderTickRef  = useRef(0)

  // Last selection set we wrote to setNodes — used to skip the call when the
  // computed overlap hasn't changed since the previous frame. Without this
  // we'd churn setNodes on every pointermove + RAF tick, even when no card
  // boundary was crossed.
  const lastAppliedSelectedIdsRef = useRef(new Set())

  // Keep latest props/state in refs so the document-level handlers never
  // see stale values regardless of when listeners were attached.
  const nodesRef     = useRef(nodes)
  const setNodesRef  = useRef(setNodes)
  const isPanningRef = useRef(isPanning)
  useEffect(() => { nodesRef.current     = nodes },     [nodes])
  useEffect(() => { setNodesRef.current  = setNodes },  [setNodes])
  useEffect(() => { isPanningRef.current = isPanning }, [isPanning])

  // Force a re-render — used by the RAF tick after a viewport pan so the
  // rect overlay re-derives its screen position from the canvas-coord anchor.
  const forceRender = useCallback(() => {
    renderTickRef.current += 1
    setMarquee((m) => (m ? { ...m, _tick: renderTickRef.current } : m))
  }, [])

  // ── pointerdown: detect the start of a marquee ──────────────────────────
  useEffect(() => {
    function onPointerDown(e) {
      if (e.button !== 0) return                          // left click only
      if (isPanningRef.current) return                     // spacebar-pan mode
      if (!(e.target instanceof Element)) return
      // Only initiate when the click landed on empty canvas (the pane DIV).
      // Nodes, edges, and UI overlays carry different classes, so they
      // naturally fall through.
      if (!e.target.classList.contains(PANE_CLASS_NAME)) return

      const rf = rfInstanceRef.current
      if (!rf) return

      const startScreen = { x: e.clientX, y: e.clientY }
      const startCanvas = rf.screenToFlowPosition(startScreen)

      const additive = e.shiftKey
      const initialSelectedIds = additive
        ? new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id))
        : new Set()

      sessionRef.current = { startCanvas, additive, initialSelectedIds }
      currentRef.current = startScreen
      setMarquee({ startScreen, current: startScreen, _tick: 0 })

      // Kill any stray text selection the moment the marquee opens. Without
      // this (plus the selectstart blocker below), the browser drags a native
      // text selection across the canvas and into card BlockNote editors —
      // which logs "TextSelection endpoint not pointing into a node with
      // inline content" and feeds the browser's selection pop-up menu.
      window.getSelection()?.removeAllRanges()

      // Non-additive: clear the existing selection up front so cards visibly
      // deselect the moment the marquee starts (matches React Flow's behavior).
      if (!additive) {
        setNodesRef.current((nds) =>
          nds.some((n) => n.selected)
            ? nds.map((n) => (n.selected ? { ...n, selected: false } : n))
            : nds
        )
      }

      // Seed the "last applied" cache so applyLiveSelection's no-change skip
      // works correctly from the first frame: post-pointerdown, the actual
      // selected set on canvas is empty (non-additive) or initialSelectedIds
      // (additive). Keep the cache in sync with that reality.
      lastAppliedSelectedIdsRef.current = additive
        ? new Set(initialSelectedIds)
        : new Set()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [rfInstanceRef])

  // ── Block native text selection WHILE a marquee is in flight ────────────
  // The browser's default response to a click-drag is to start a text
  // selection, sweeping it across whatever DOM lies between the drag's start
  // and end — including the BlockNote editors inside cards. That selection is
  // a pure side effect of the marquee (the user is selecting NODES, not text)
  // and it both trips a BlockNote console warning and triggers the browser's
  // selection-activated pop-up menu.
  //
  // Gated on sessionRef (set only when a drag started on the empty canvas
  // pane), so intentional text selection while EDITING a card — where the
  // pointerdown landed on a node, sessionRef stays null — is never blocked.
  useEffect(() => {
    function onSelectStart(e) {
      if (sessionRef.current) e.preventDefault()
    }
    document.addEventListener('selectstart', onSelectStart)
    return () => document.removeEventListener('selectstart', onSelectStart)
  }, [])

  // ── While a marquee is in flight: track move/up + auto-pan via RAF ──────
  // Effect dep is the boolean "is marquee active?" so we don't re-attach
  // listeners on every cursor wiggle (state updates inside the marquee mutate
  // refs and call forceRender; the listener identity stays stable).
  const marqueeActive = marquee !== null
  useEffect(() => {
    if (!marqueeActive) return

    let rafId = null

    function onPointerMove(e) {
      currentRef.current = { x: e.clientX, y: e.clientY }
      // Update rendered state so the rect resizes immediately rather than
      // waiting for the next RAF tick (which only runs at 60fps and only
      // fires forceRender when actually panning).
      setMarquee((m) => (m ? { ...m, current: currentRef.current } : m))
      // Apply selection live — every cursor frame recomputes which cards
      // overlap the rect and writes the result. The setsEqual guard inside
      // skips setNodes when nothing's actually changed.
      applyLiveSelection()
    }

    function onPointerUp(e) {
      if (e.button !== 0) return

      // Decide if this was a real drag — needed to know whether to suppress
      // the upcoming click event. Read straight from refs while they're
      // still populated.
      const session = sessionRef.current
      const current = currentRef.current
      const rf = rfInstanceRef.current
      let wasRealDrag = false
      if (session && current && rf) {
        const startScreen = rf.flowToScreenPosition(session.startCanvas)
        const dragDistance = Math.hypot(current.x - startScreen.x, current.y - startScreen.y)
        wasRealDrag = dragDistance >= MIN_DRAG_DISTANCE_PX
      }

      // No final commit() needed — applyLiveSelection has been keeping the
      // canvas in sync the whole drag, so the visible selection at this
      // instant is already correct.

      // The click event fires synchronously after pointerup (browsers
      // synthesize it from pointerdown+pointerup). React Flow's pane has an
      // onClick handler that calls resetSelectedElements() unconditionally —
      // that would wipe the selection we just applied. Stop the next click
      // in the capture phase so it never reaches React Flow's listener.
      // Only do this when the user actually dragged; a tap on empty canvas
      // SHOULD clear selection (which React Flow will happily do for us).
      if (wasRealDrag) {
        const suppressNextClick = (clickEvent) => {
          clickEvent.stopPropagation()
          clickEvent.preventDefault()
          document.removeEventListener('click', suppressNextClick, true)
        }
        document.addEventListener('click', suppressNextClick, true)
        // Belt-and-suspenders cleanup: if the click never fires (cursor
        // outside the window on release, etc.) we don't want a stale
        // listener intercepting the user's next legitimate click.
        setTimeout(() => {
          document.removeEventListener('click', suppressNextClick, true)
        }, 100)
      }

      sessionRef.current = null
      currentRef.current = null
      lastAppliedSelectedIdsRef.current = new Set()
      setMarquee(null)
    }

    // Recompute the marquee's overlap set against the current node positions
    // and write it through setNodes. Called from both pointermove and the
    // RAF auto-pan tick (since panning the viewport changes the rect's
    // canvas-coord extent even when the cursor doesn't move). Idempotent —
    // skips setNodes when the computed set matches what we last wrote.
    function applyLiveSelection() {
      const session = sessionRef.current
      const current = currentRef.current
      const rf = rfInstanceRef.current
      if (!session || !current || !rf) return

      const startScreen = rf.flowToScreenPosition(session.startCanvas)
      const dragDistance = Math.hypot(current.x - startScreen.x, current.y - startScreen.y)
      // Below the click threshold, don't apply marquee selection — let the
      // pointerdown's effect (clear for non-additive, no-op for additive)
      // stand. Crossing the threshold brings live updates in.
      if (dragDistance < MIN_DRAG_DISTANCE_PX) return

      const endCanvas = rf.screenToFlowPosition(current)
      const rect = {
        x:      Math.min(session.startCanvas.x, endCanvas.x),
        y:      Math.min(session.startCanvas.y, endCanvas.y),
        width:  Math.abs(session.startCanvas.x - endCanvas.x),
        height: Math.abs(session.startCanvas.y - endCanvas.y),
      }

      // Partial-overlap selection (matches App's selectionMode="partial").
      // node.width / node.height are populated by React Flow after layout;
      // fall back to typical card dimensions if not yet measured.
      const overlappingIds = new Set()
      for (const n of nodesRef.current) {
        const nx = n.position.x
        const ny = n.position.y
        const nw = n.width  ?? 256
        const nh = n.height ?? 100
        const overlaps = !(
          nx + nw < rect.x ||
          nx > rect.x + rect.width ||
          ny + nh < rect.y ||
          ny > rect.y + rect.height
        )
        if (overlaps) overlappingIds.add(n.id)
      }

      const finalIds = new Set([...session.initialSelectedIds, ...overlappingIds])

      // No-change skip: nothing to do if the set matches what's already on canvas.
      const last = lastAppliedSelectedIdsRef.current
      if (last.size === finalIds.size) {
        let allMatch = true
        for (const id of finalIds) {
          if (!last.has(id)) { allMatch = false; break }
        }
        if (allMatch) return
      }
      lastAppliedSelectedIdsRef.current = finalIds

      setNodesRef.current((nds) =>
        nds.map((n) => {
          const want = finalIds.has(n.id)
          return n.selected !== want ? { ...n, selected: want } : n
        })
      )
    }

    function tick() {
      const current = currentRef.current
      const rf = rfInstanceRef.current
      if (current && rf) {
        const { x, y } = current
        const w = window.innerWidth
        const h = window.innerHeight
        const left   = clamp(EDGE_THRESHOLD_PX - x,         0, EDGE_THRESHOLD_PX)
        const right  = clamp(EDGE_THRESHOLD_PX - (w - x),   0, EDGE_THRESHOLD_PX)
        const top    = clamp(EDGE_THRESHOLD_PX - y,         0, EDGE_THRESHOLD_PX)
        const bottom = clamp(EDGE_THRESHOLD_PX - (h - y),   0, EDGE_THRESHOLD_PX)
        const dx = (right  - left) / EDGE_THRESHOLD_PX * MAX_SPEED_PX_PER_FRAME
        const dy = (bottom - top)  / EDGE_THRESHOLD_PX * MAX_SPEED_PX_PER_FRAME
        if (dx !== 0 || dy !== 0) {
          const vp = rf.getViewport()
          rf.setViewport({ x: vp.x - dx, y: vp.y - dy, zoom: vp.zoom })
          // Re-render so the rect overlay re-derives its anchor from
          // canvas coords now that the viewport has changed.
          forceRender()
          // Re-apply selection: even though the cursor's screen position
          // didn't change, the rect's canvas-coord extent has — new cards
          // may have slid into (or out of) the rect.
          applyLiveSelection()
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup',   onPointerUp)
    rafId = requestAnimationFrame(tick)

    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup',   onPointerUp)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [marqueeActive, rfInstanceRef, forceRender])

  // Expose enough for the rect overlay to render itself. The overlay reads
  // the canvas-coord anchor from sessionRef and the latest cursor screen
  // position from `marquee.current`.
  return marquee ? { sessionRef, current: marquee.current } : null
}
