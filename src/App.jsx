import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactFlow, { Background, useNodesState, useEdgesState } from 'reactflow'
import { captureGraphSnapshot } from './lib/workspaceSnapshot.js'
import { uploadWorkspaceSnapshot, deleteCardImage } from './lib/imageStorage.js'
import { getWorkspace, updateWorkspace } from './lib/workspaces.js'
import { useTypeStore } from './store/useTypeStore'
import FloatingEdge from './edges/FloatingEdge'
import ContextMenu from './components/ContextMenu'
import CanvasContextMenu from './components/CanvasContextMenu'
import Inspector from './components/Inspector'
import { LightboxProvider } from './components/Lightbox'
import CampaignNode from './nodes/CampaignNode'
import TextNode from './nodes/TextNode'
import { useWorkspace } from './lib/WorkspaceContext.jsx'
import {
  createNode as dbCreateNode,
  duplicateCard,
  updateNode as dbUpdateNode,
  deleteNode as dbDeleteNode,
  buildDeleteCardSnapshot,
} from './lib/nodes.js'
import {
  createConnection as dbCreateConnection,
  deleteConnection as dbDeleteConnection,
} from './lib/connections.js'
import {
  createTextNode as dbCreateTextNode,
  updateTextNode as dbUpdateTextNode,
  deleteTextNode as dbDeleteTextNode,
} from './lib/textNodes.js'
import { buildBatchDeleteSnapshot, deleteBatch } from './lib/batchDelete.js'
import { findNodeIdAtPoint, validateQuickConnectTarget, connectionExists } from './lib/quickConnect.js'
import QuickConnectLine from './components/QuickConnectLine.jsx'
import { useSpacebarPan } from './hooks/useSpacebarPan'
import { useWorkspaceData } from './hooks/useWorkspaceData'
import { useEdgeGeometry } from './hooks/useEdgeGeometry'
import { useNodeHoverSelection } from './hooks/useNodeHoverSelection'
import { useEdgeHoverSession } from './hooks/useEdgeHoverSession'
import { useUndoShortcuts } from './hooks/useUndoShortcuts'
import { useCustomMarquee } from './hooks/useCustomMarquee'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useArrowKeyNavigation } from './hooks/useArrowKeyNavigation'
import MarqueeRect from './components/MarqueeRect'
import AltitudeRail from './components/AltitudeRail'
import AlignmentToolbar from './components/AlignmentToolbar'
import { useUndoStore } from './store/useUndoStore'
import { useCanvasUiStore } from './store/useCanvasUiStore'
import { ACTION_TYPES } from './lib/undo/index.js'
import { CanvasOpsProvider } from './lib/CanvasOpsContext.jsx'
import { setPanToTargetImpl } from './lib/cameraOps.js'
import { track } from './lib/analytics.js'
import { toastDeleteCaptureFailed } from './lib/feedbackToasts.jsx'
import { nextAltitude, MORPH_DURATION_MS, computeMinZoom } from './utils/altitude.js'

// Analytics thresholds (per ADR-0009). pan_burst fires when the user
// completes >= THRESHOLD discrete pan gestures in WINDOW_MS, then resets.
// card_repositioned_quickly fires if a freshly-created card is dragged
// within RECENT_CREATE_WINDOW_MS of being placed. These defaults are
// starting points; tune from real tester data after the first cycle.
const PAN_BURST_WINDOW_MS = 5000
const PAN_BURST_THRESHOLD = 5
const RECENT_CREATE_WINDOW_MS = 10000

const nodeTypes = {
  campaignNode: CampaignNode,
  textNode:     TextNode,
}

const edgeTypes = {
  floating: FloatingEdge,
}

// Inspector mode memory: the next fresh open reuses the last-used mode
// (docked reopens docked; undocked reopens as today's centered modal). Only
// the mode persists — undocked always recenters, per the agreed behavior.
const INSPECTOR_MODE_KEY = 'mastermind:inspector-mode'
function readInspectorMode() {
  try { return localStorage.getItem(INSPECTOR_MODE_KEY) === 'docked' ? 'docked' : 'undocked' }
  catch { return 'undocked' }
}
function writeInspectorMode(mode) {
  try { localStorage.setItem(INSPECTOR_MODE_KEY, mode) } catch { /* private mode / quota */ }
}

export default function App() {
  const { activeWorkspaceId, registerBeforeLeave } = useWorkspace()

  // Type-id lookups live in useTypeStore (per-user, hydrated on load).
  // Read via useTypeStore.getState().idByKey inside callbacks.

  // ── Canvas state ─────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { loading, loadError } = useWorkspaceData({
    workspaceId: activeWorkspaceId,
    setNodes,
    setEdges,
  })

  const isPanning = useSpacebarPan()
  const reducedMotion = useReducedMotion()

  // When the user enters spacebar pan mode, every element on the canvas
  // becomes inert (CSS pointer-events: none on .react-flow__node and
  // .react-flow__edge while .is-panning is on the wrapper). The CSS rule
  // suppresses any new hover events while panning, but a card that was
  // already lit when the spacebar was pressed would otherwise stay glowing.
  // Drop the lit state here so pan mode starts clean.
  useEffect(() => {
    if (isPanning) {
      useCanvasUiStore.getState().clearHover()
    }
  }, [isPanning])

  const [contextMenu, setContextMenu] = useState(null)  // { nodeId, x, y }
  const [canvasMenu,  setCanvasMenu]  = useState(null)  // { x, y, flowPos }
  const rfInstanceRef = useRef(null)

  // Mirror `nodes` into a ref so the panToTarget impl (registered once below)
  // always reads the current array without stale-closure issues.
  const nodesRef = useRef(nodes)
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  // Auto-snapshot the canvas as the workspace's fallback cover. Registered as a
  // "before leave" handler so WorkspaceContext runs it (behind a "Saving
  // preview…" spinner) while the canvas is still mounted, before navigating
  // away. Captures the WHOLE graph (all nodes), uploads it to snapshot_path, and
  // cleans up the previous snapshot. Empty graphs and failures are no-ops — the
  // tile just keeps its prior snapshot or the letter placeholder.
  useEffect(() => {
    return registerBeforeLeave(async (workspaceId) => {
      if (!workspaceId) return
      // Commit the open Inspector's pending edits while we're STILL on this
      // workspace, so its flushed save + undo entries scope to the correct
      // (outgoing) workspace. Idempotent (committedRef), so the
      // activeWorkspaceId-change effect below won't re-emit it.
      inspectorCommitRef.current?.()
      const dataUrl = await captureGraphSnapshot(nodesRef.current)
      if (!dataUrl) return
      const blob = await (await fetch(dataUrl)).blob()
      let prevPath = null
      try {
        prevPath = (await getWorkspace(workspaceId))?.snapshot_path ?? null
      } catch { /* non-fatal — skip cleanup of the unknown prior snapshot */ }
      const newPath = await uploadWorkspaceSnapshot({ workspaceId, file: blob })
      await updateWorkspace(workspaceId, { snapshot_path: newPath })
      if (prevPath && prevPath !== newPath) {
        try {
          await deleteCardImage(prevPath)
        } catch (err) {
          console.error('Failed to delete old snapshot', err)
        }
      }
    })
  }, [registerBeforeLeave])
  // Edge mirror for callbacks that need fresh edges without re-binding
  // (quick-connect's window listeners read it for duplicate checks).
  const edgesRef = useRef(edges)
  useEffect(() => { edgesRef.current = edges }, [edges])

  // Register the camera-pan implementation that ChipToast click handlers
  // will invoke when the user clicks an undo/redo toast. Lives outside
  // CanvasOpsContext because the toast layer (FeedbackChipBar) is a sibling
  // of <App />, not a descendant — see lib/cameraOps.js for rationale.
  useEffect(() => {
    setPanToTargetImpl((target) => {
      const rf = rfInstanceRef.current
      if (!rf || !target) return
      const ids = Array.isArray(target.ids) ? target.ids : []
      const existingIds = ids.filter((id) => nodesRef.current.some((n) => n.id === id))
      if (existingIds.length > 0) {
        rf.fitView({
          nodes: existingIds.map((id) => ({ id })),
          duration: 500,
          // padding ≈ inverse of zoom: at p=0.5 content fills ~67% of the
          // viewport; at p=2.0 it fills ~33%. Tuned to Erik's "feels like
          // too much zoom" feedback — keeps surrounding context visible
          // instead of zooming aggressively into a single card.
          padding: 2.0,
        })
        return
      }
      // Every target node is gone (redo of a delete) — pan to where it was,
      // preserving current zoom so the user just sees the spot, not a forced
      // zoom change.
      if (target.fallbackPosition) {
        const { x, y } = target.fallbackPosition
        const zoom = rf.getViewport().zoom
        rf.setCenter(x, y, { zoom, duration: 500 })
      }
    })
    return () => setPanToTargetImpl(null)
  }, [])

  // The open inspector instance, or null. Shape:
  //   { node, connectedNodes, allOtherNodes, originRect,
  //     topicNodeId, position, isRepoint }
  // `topicNodeId` is the subject node; it's independent of canvas selection
  // (a single-click sets it, but the inspector owns it) so that supporting
  // multiple inspectors later is an array of these, not a rewrite.
  const [inspectorNode, setInspectorNode] = useState(null)
  // Lets App commit the open inspector's pending edits (flush save + undo)
  // right before a repoint swaps its topic node. Inspector assigns its
  // commitSession here while mounted.
  const inspectorCommitRef = useRef(null)
  // Lets App force the open inspector's block-editor zones to flush any pending
  // (debounced) save and await it — used before deleting the card the inspector
  // is open on, so the delete snapshot reads the latest content (ADR-0016 E1).
  const editorFlushApiRef = useRef(null)
  // Lets App push an externally-created connection (canvas quick-connect)
  // into the open inspector's Connection Manager as a chip. Inspector
  // registers { addExternalConnection } here while mounted.
  const inspectorConnsApiRef = useRef(null)
  // Mirror of inspectorNode for stable reads inside onDeleteNode (which is
  // memoized without inspectorNode in its deps).
  const inspectorNodeRef = useRef(null)
  inspectorNodeRef.current = inspectorNode
  // Card ids whose delete is mid-flight, so a double-click / repeated trigger
  // can't run the async delete pipeline twice for the same card.
  const deletingRef = useRef(null)
  if (deletingRef.current === null) deletingRef.current = new Set()

  // Close the Inspector when the active workspace changes. Without this, a
  // node editor opened in the previous workspace lingers over the new one,
  // showing (and saving against) a stale node. We commit first so any pending
  // edits flush — commitSession is idempotent (committedRef), so this is a
  // no-op when the leave-handler above already committed on the normal switch
  // path; it's the catch-all for the browser back/forward path, which bypasses
  // that handler. The prevRef gate keeps it from running on initial mount.
  const prevWorkspaceForInspectorRef = useRef(activeWorkspaceId)
  useEffect(() => {
    if (prevWorkspaceForInspectorRef.current === activeWorkspaceId) return
    prevWorkspaceForInspectorRef.current = activeWorkspaceId
    inspectorCommitRef.current?.()
    setInspectorNode(null)
  }, [activeWorkspaceId])

  useEdgeGeometry({ nodes, edges, setNodes, setEdges })

  // Custom marquee that replaces React Flow v11's selectionOnDrag — needed
  // because RF v11's marquee terminates when the cursor leaves the pane,
  // which makes auto-pan impossible. Our implementation tracks pointer
  // events at the document level so the cursor can leave the viewport
  // without breaking the in-flight selection.
  const marqueeOverlay = useCustomMarquee({
    rfInstanceRef,
    nodes,
    setNodes,
    isPanning,
  })

  // Hover / selection UI (not persisted; backed by useCanvasUiStore so a
  // hover event mutates one atomic value instead of every node's data).
  const {
    onSelectionChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
  } = useNodeHoverSelection()

  // Edge hover drives the stabilized dual-expand "session" (Part B.1): React
  // Flow activates, the session owns persistence + deactivation so the moving
  // line / a card sliding under the cursor can't end the interaction.
  const { onEdgeMouseEnter, onEdgeMouseLeave } = useEdgeHoverSession({ rfInstanceRef, edgesRef })

  // Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS, Ctrl+Y also accepted on Windows).
  // The hook captures nodes/edges/setters in a ref so the keydown listener
  // always sees fresh values without re-attaching every render.
  useUndoShortcuts({ nodes, edges, setNodes, setEdges })

  // ── Analytics scratch state (per ADR-0009) ───────────────────────────────
  // Map<cardId, createdAtMs> for card_repositioned_quickly. Entries are
  // self-cleaning after RECENT_CREATE_WINDOW_MS via setTimeout in addCardNode.
  const recentlyCreatedRef = useRef(new Map())
  // Last reported viewport for distinguishing pure pans from zoom changes
  // inside onMoveEnd. ReactFlow's onMoveEnd fires once per discrete gesture,
  // which is the granularity we want for both zoom_changed and pan_burst.
  const lastViewportRef = useRef(null)
  // Sliding window of pan-only onMoveEnd timestamps for pan_burst detection.
  const panTimestampsRef = useRef([])
  // Active morph-window timeout id. The morph runs in two phases — 'out' for
  // the first half of MORPH_DURATION_MS (edges fade to 0), then 'in' for the
  // second half (edges fade back to their resting opacity), then null. The
  // ref holds whichever timer is currently scheduled (out→in or in→null). If
  // altitude flips again before the timer fires (rare — would require crossing
  // the hysteresis dead-band in < 150ms), we clear the in-flight timer and
  // restart from phase 'out' so the next morph window is exactly
  // MORPH_DURATION_MS, not the leftover.
  const morphTimeoutRef = useRef(null)

  // ── Dynamic minZoom (Chunk F, per ADR-0010 addendum) ─────────────────────
  // React Flow's static minZoom = 0.5 is replaced with a per-campaign
  // value that lets the user zoom out until the bounding box of all nodes
  // fills ~70% of the viewport on the more binding axis. Recomputed on
  // settled events: node add, delete, drag-stop, window resize. Skipped
  // during a drag (using the existing draggingNodeId signal) so the limit
  // doesn't shift while a node is mid-flight.
  const draggingNodeIdForMinZoom = useCanvasUiStore((s) => s.draggingNodeId)
  const [viewportSize, setViewportSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth  : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // The dynamic minZoom lives in useCanvasUiStore (general navigation
  // state) so the altitude rail can read it without an additional prop.
  // App.jsx is the only writer.
  const dynamicMinZoom = useCanvasUiStore((s) => s.dynamicMinZoom)
  useEffect(() => {
    if (draggingNodeIdForMinZoom != null) return
    useCanvasUiStore.getState().setDynamicMinZoom(computeMinZoom({
      nodes,
      viewportWidth:  viewportSize.w,
      viewportHeight: viewportSize.h,
    }))
  }, [nodes, viewportSize, draggingNodeIdForMinZoom])

  // ── AltitudeRail click-to-zoom callback (Chunk: altitude rail Phase 1) ──
  // The rail UI calls this with a target zoom value (already clamped to
  // [minZoom, maxZoom] by its own normalization). We route through React
  // Flow's zoomTo, which preserves the current pan and animates over
  // 200ms — collapsed to 0ms under reduced-motion.
  const onZoomToFromRail = useCallback((targetZoom) => {
    const rf = rfInstanceRef.current
    if (!rf) return
    rf.zoomTo(targetZoom, { duration: reducedMotion ? 0 : 200 })
  }, [reducedMotion])

  // ── Per-node hover-expand morph signal (Chunk D step 6) ──────────────────
  // When a bead expands or an expanded card collapses, the connection lines
  // attached to that single node need to fade through the visual change.
  // We track it as a Map<nodeId, 'out' | 'in'> in the store (see
  // setNodeMorphPhase). This effect watches the currently-expanded node id
  // (derived from altitude + hover + single-select) and fires the two-phase
  // signal on every transition: the previously-expanded id morphs OUT-IN
  // (collapsing back to bead) AND the newly-expanded id morphs OUT-IN
  // (expanding to card). They run independently so multiple ids can be
  // in-flight at once (rare; happens when hover moves directly from one
  // bead to another).
  const altitudeForExpand     = useCanvasUiStore((s) => s.altitude)
  const hoveredNodeIdForExp   = useCanvasUiStore((s) => s.hoveredNodeId)
  const selectedNodeIdsForExp = useCanvasUiStore((s) => s.selectedNodeIds)
  const hoveredEdgeNodeIdsForExp = useCanvasUiStore((s) => s.hoveredEdgeNodeIds)
  // The SET of nodes currently expanded in Bead View. Union of three triggers,
  // mirroring CampaignNode.isExpanded exactly: hover-expand (the hovered node),
  // single-select expand (the lone selected node, only when nothing is
  // hovered), and edge-hover expand (BOTH endpoints of the dwelled connection
  // line). More than one id can be present — the dual-expand case is the two
  // endpoints of a hovered edge.
  const currentlyExpandedIds = useMemo(() => {
    const ids = new Set()
    if (altitudeForExpand === 'beadView') {
      if (hoveredNodeIdForExp) ids.add(hoveredNodeIdForExp)
      else if (selectedNodeIdsForExp.size === 1) {
        for (const id of selectedNodeIdsForExp) { ids.add(id); break }
      }
      if (hoveredEdgeNodeIdsForExp) {
        for (const id of hoveredEdgeNodeIdsForExp) ids.add(id)
      }
    }
    return ids
  }, [altitudeForExpand, hoveredNodeIdForExp, selectedNodeIdsForExp, hoveredEdgeNodeIdsForExp])
  const prevExpandedIdsRef   = useRef(new Set())
  const expandMorphTimersRef = useRef(new Map())
  const fireExpandMorph = useCallback((id) => {
    if (!id) return
    // Reduced-motion (Chunk F): the morph runs at 0 ms inside CampaignNode
    // and FloatingEdge, so the two-phase fade signal has nothing to fade.
    // Skip publishing the phase entirely — avoids ratting through 'out' →
    // 'in' → null on the same animation frame for no visible effect.
    if (reducedMotion) return
    const halfMs = MORPH_DURATION_MS / 2
    const prevTimers = expandMorphTimersRef.current.get(id)
    if (prevTimers) {
      if (prevTimers.outTimer != null) clearTimeout(prevTimers.outTimer)
      if (prevTimers.inTimer  != null) clearTimeout(prevTimers.inTimer)
    }
    const store = useCanvasUiStore.getState()
    store.setNodeMorphPhase(id, 'out')
    const outTimer = setTimeout(() => {
      useCanvasUiStore.getState().setNodeMorphPhase(id, 'in')
      const inTimer = setTimeout(() => {
        useCanvasUiStore.getState().setNodeMorphPhase(id, null)
        expandMorphTimersRef.current.delete(id)
      }, halfMs)
      const cur = expandMorphTimersRef.current.get(id) || {}
      expandMorphTimersRef.current.set(id, { ...cur, inTimer })
    }, halfMs)
    expandMorphTimersRef.current.set(id, { outTimer, inTimer: null })
  }, [reducedMotion])
  useEffect(() => {
    const prev = prevExpandedIdsRef.current
    const cur  = currentlyExpandedIds
    // Fire the two-phase line-fade morph for every id that just ENTERED or
    // LEFT the expanded set — each transition animates the lines attached to
    // that node through its bead↔card change. Independent per id, so two
    // endpoints expanding (or collapsing) together both animate cleanly.
    for (const id of cur)  { if (!prev.has(id)) fireExpandMorph(id) }
    for (const id of prev) { if (!cur.has(id))  fireExpandMorph(id) }
    prevExpandedIdsRef.current = cur
  }, [currentlyExpandedIds, fireExpandMorph])

  // ── Persist node position on drag end ────────────────────────────────────
  // Per-node start positions captured at drag start drive (a) the 4px-jitter
  // filter on the undo entry and (b) the entry's `before` snapshot. Stored
  // in a Map keyed by node id.
  //
  // RF v11 fires different events depending on how the selection was made:
  //   - shift+click multi-select drag → onNodeDragStart/Stop (the third arg
  //     `nodes` is the full dragged set; the second arg `node` is just the
  //     primary)
  //   - marquee multi-select drag     → onSelectionDragStart/Stop (the
  //     second arg `nodes` is the full dragged set)
  // Wiring both, iterating the full set in each, and de-duping via a
  // per-drag Set covers all cases — including the rare double-fire if both
  // events end up dispatching for the same drag.
  const dragStartPosRef  = useRef(new Map())
  const finalizedDragRef = useRef(new Set())

  // ── Shift-to-lock-axis drag ───────────────────────────────────────────────
  // While Shift is held during a node drag, movement is constrained to one
  // axis. Dynamic nearest-axis (Figma/Illustrator-style): the cursor moves
  // freely and the object snaps to whichever of horizontal/vertical it's
  // closer to, RE-EVALUATED every frame (not frozen on first movement). We
  // enforce this in handleNodesChange by rewriting each position change against
  // its drag-start anchor (dragStartPosRef), and — critically — re-apply the
  // same lock at drag-stop so the COMMITTED position matches the preview (RF's
  // raw drag position is unlocked). `lockedAxisRef` holds the current pinned
  // coordinate. Shift-CLICK multi-select is untouched: that produces `select`
  // changes, not `position` changes.
  const shiftHeldRef  = useRef(false)
  const lockedAxisRef = useRef(null) // null | 'x' | 'y' — current pinned coord

  const captureDragStart = useCallback((dragNodes) => {
    finalizedDragRef.current.clear()
    lockedAxisRef.current = null
    for (const n of dragNodes ?? []) {
      if (!n) continue
      dragStartPosRef.current.set(n.id, { x: n.position.x, y: n.position.y })
    }
  }, [])

  // Dead-zone (flow units) before any constraint kicks in, so a tiny initial
  // wobble doesn't snap the node. (8pt-grid value; a movement threshold, not a
  // layout measurement.)
  const AXIS_LOCK_DEADZONE = 8

  // The pinned coordinate for a given drag vector: drag mostly horizontal pins
  // y (free horizontal movement); mostly vertical pins x. Shared by the live
  // preview (handleNodesChange) and the commit (finalizeDragStop) so they can
  // never disagree.
  const pinnedAxisFor = useCallback((dx, dy) => {
    if (Math.abs(dx) < AXIS_LOCK_DEADZONE && Math.abs(dy) < AXIS_LOCK_DEADZONE) return null
    return Math.abs(dx) >= Math.abs(dy) ? 'y' : 'x'
  }, [])

  // Apply the axis lock to a raw (cursor-following) position against its anchor.
  const lockPosition = useCallback((rawPos, start, axis) => {
    if (axis === 'y') return { x: rawPos.x, y: start.y }
    if (axis === 'x') return { x: start.x, y: rawPos.y }
    return rawPos
  }, [])

  // Wraps RF's onNodesChange. When Shift is held, each drag position change is
  // clamped to the nearest axis (re-evaluated every frame); everything else
  // (and every non-Shift drag) passes through untouched.
  const handleNodesChange = useCallback((changes) => {
    if (!shiftHeldRef.current) { onNodesChange(changes); return }
    const next = changes.map((c) => {
      if (c.type !== 'position' || !c.position) return c
      const start = dragStartPosRef.current.get(c.id)
      if (!start) return c
      const axis = pinnedAxisFor(c.position.x - start.x, c.position.y - start.y)
      lockedAxisRef.current = axis
      if (!axis) return c
      return { ...c, position: lockPosition(c.position, start, axis) }
    })
    onNodesChange(next)
  }, [onNodesChange, pinnedAxisFor, lockPosition])

  // Track whether Shift is currently held so handleNodesChange (which doesn't
  // receive the originating event) can read it. Any key event refreshes the
  // flag from e.shiftKey; window blur clears it so a Shift held across an
  // alt-tab can't get stuck on.
  useEffect(() => {
    const onKey  = (e) => { shiftHeldRef.current = e.shiftKey }
    const onBlur = () => { shiftHeldRef.current = false }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const finalizeDragStop = useCallback((dragNodes) => {
    // Collect every card from this drag into one moveCard entry so Ctrl+Z
    // reverts the whole drag in a single step (vs N steps for N cards).
    // Persist promises for THESE same cards are tracked so we can roll the
    // entry back as a unit if any of the writes fail.
    const cardMoves = []
    const cardPersists = []

    // When Shift-axis-lock was active for this drag, the COMMITTED position
    // must be the locked preview position, not RF's raw (unlocked) drag
    // position — otherwise the node snaps off-axis on drop and undo reverts the
    // wrong thing. We re-apply the same lock here so persist, undo, and the
    // final render all agree with what the user saw mid-drag.
    const lockActive = shiftHeldRef.current && !!lockedAxisRef.current
    const corrected = new Map()

    for (const n of dragNodes ?? []) {
      if (!n || finalizedDragRef.current.has(n.id)) continue
      finalizedDragRef.current.add(n.id)

      const start = dragStartPosRef.current.get(n.id)
      dragStartPosRef.current.delete(n.id)

      const pos = (lockActive && start)
        ? lockPosition(n.position, start, lockedAxisRef.current)
        : n.position
      if (lockActive && start) corrected.set(n.id, pos)

      // 4px threshold filters out mouse-jitter "moves" that aren't real drags
      // (per ADR-0006 §"Action set covered" — moveCard fires only if Δ ≥ 4px).
      const movedFar =
        start &&
        Math.hypot(pos.x - start.x, pos.y - start.y) >= 4

      // card_repositioned_quickly: friction signal for "I dropped it wrong" —
      // a card created within the recent window is moved before its timer
      // expires. Fires once per such drag; the entry is cleared so a later
      // re-drag of the same card doesn't keep counting as "quickly."
      if (movedFar && n.type === 'campaignNode') {
        const createdAt = recentlyCreatedRef.current.get(n.id)
        if (createdAt) {
          track('card_repositioned_quickly', {
            msSinceCreate: Date.now() - createdAt,
          })
          recentlyCreatedRef.current.delete(n.id)
        }
      }

      if (n.type === 'campaignNode') {
        const persist = dbUpdateNode(n.id, {
          positionX: pos.x,
          positionY: pos.y,
        })
        if (movedFar) {
          cardMoves.push({
            cardId: n.id,
            before: { x: start.x, y: start.y },
            after:  { x: pos.x, y: pos.y },
          })
          cardPersists.push(persist)
        } else {
          // Sub-threshold nudge — still persist, just no undo entry.
          persist.catch(console.error)
        }
      } else if (n.type === 'textNode') {
        const persist = dbUpdateTextNode(n.id, {
          positionX: pos.x,
          positionY: pos.y,
        })
        if (movedFar) {
          // moveTextNode is one entry per text node moved (no grouping).
          // The persist failure path pops by rolling back this specific
          // entry via popLastAction inside the .catch — same shape as the
          // grouped moveCard rollback but per-node.
          useUndoStore.getState().recordAction({
            type: ACTION_TYPES.MOVE_TEXT_NODE,
            workspaceId: activeWorkspaceId,
            label: 'Move text',
            timestamp: new Date().toISOString(),
            textNodeId: n.id,
            before: { x: start.x, y: start.y },
            after:  { x: pos.x, y: pos.y },
          })
          persist.catch((err) => {
            console.error(err)
            // Best-effort rollback. Multi-node drags that mix cards and
            // text nodes can race here; in practice persists rarely fail
            // for valid writes, and the orphan entry would just refuse on
            // Ctrl+Z (canApplyInverse drift check). Acceptable.
            useUndoStore.getState().popLastAction()
          })
        } else {
          // Sub-threshold nudge — still persist, just no undo entry.
          persist.catch(console.error)
        }
      }
    }

    // Snap the rendered positions to the locked finals so there's no post-drop
    // jump from RF settling back to its unlocked internal drag position.
    if (corrected.size > 0) {
      setNodes((nds) => nds.map((nd) =>
        corrected.has(nd.id) ? { ...nd, position: corrected.get(nd.id) } : nd
      ))
    }

    if (cardMoves.length === 0) return

    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.MOVE_CARD,
      workspaceId: activeWorkspaceId,
      label: cardMoves.length === 1 ? 'Move card' : `Move ${cardMoves.length} cards`,
      timestamp: new Date().toISOString(),
      cards: cardMoves,
    })

    // Roll back the grouped entry if any of its card persists fails
    // (ADR-0006 §4). One pop is correct here — the entry is a single unit.
    Promise.allSettled(cardPersists).then((results) => {
      const failures = results.filter((r) => r.status === 'rejected')
      if (failures.length > 0) {
        failures.forEach((r) => console.error(r.reason))
        useUndoStore.getState().popLastAction()
      }
    })
  }, [activeWorkspaceId, lockPosition, setNodes])

  // Apply a batch of node moves as one logical action: optimistic setNodes,
  // a single grouped MOVE_CARD undo entry for the cards + one MOVE_TEXT_NODE
  // entry per text node, position persistence, and rollback if any write
  // fails. Shared by the arrow-key nudge and the alignment toolbar so both
  // round-trip through Ctrl+Z exactly like a drag (which has its own threshold
  // + analytics logic and stays separate). `moves` items are
  // { id, type, before:{x,y}, after:{x,y} }; no-op moves are dropped so a
  // re-align of already-aligned cards records nothing. `verb` labels the undo
  // entry ('Move', 'Align', 'Distribute').
  const commitNodeMoves = useCallback((moves, verb = 'Move') => {
    const real = moves.filter(
      (m) => m.before.x !== m.after.x || m.before.y !== m.after.y,
    )
    if (real.length === 0) return

    const cardMoves    = []  // grouped into one MOVE_CARD entry
    const cardPersists = []
    const textMoves    = []  // one MOVE_TEXT_NODE entry per text node

    for (const m of real) {
      if (m.type === 'campaignNode') {
        cardMoves.push({ cardId: m.id, before: m.before, after: m.after })
        cardPersists.push(dbUpdateNode(m.id, { positionX: m.after.x, positionY: m.after.y }))
      } else if (m.type === 'textNode') {
        const persist = dbUpdateTextNode(m.id, { positionX: m.after.x, positionY: m.after.y })
        textMoves.push({ textNodeId: m.id, before: m.before, after: m.after, persist })
      }
    }

    const afterById = new Map(real.map((m) => [m.id, m.after]))
    setNodes((nds) => nds.map((n) => {
      const a = afterById.get(n.id)
      return a ? { ...n, position: { x: a.x, y: a.y } } : n
    }))

    if (cardMoves.length > 0) {
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.MOVE_CARD,
        workspaceId: activeWorkspaceId,
        label: cardMoves.length === 1 ? `${verb} card` : `${verb} ${cardMoves.length} cards`,
        timestamp: new Date().toISOString(),
        cards: cardMoves,
      })
      Promise.allSettled(cardPersists).then((results) => {
        const failures = results.filter((r) => r.status === 'rejected')
        if (failures.length > 0) {
          failures.forEach((r) => console.error(r.reason))
          useUndoStore.getState().popLastAction()
        }
      })
    }

    textMoves.forEach(({ textNodeId, before, after, persist }) => {
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.MOVE_TEXT_NODE,
        workspaceId: activeWorkspaceId,
        label: verb === 'Move' ? 'Move text' : `${verb} text`,
        timestamp: new Date().toISOString(),
        textNodeId,
        before,
        after,
      })
      persist.catch((err) => {
        console.error(err)
        useUndoStore.getState().popLastAction()
      })
    })
  }, [setNodes, activeWorkspaceId])

  // Arrow-key nudge for selected nodes. The 4px "movedFar" threshold from the
  // drag path is intentionally skipped — keyboard input is deterministic, not
  // jitter, so every press records an entry.
  const nudgeSelectedNodes = useCallback((dx, dy) => {
    const selectedIds = useCanvasUiStore.getState().selectedNodeIds
    if (selectedIds.size === 0) return
    const moves = []
    for (const n of nodesRef.current) {
      if (!selectedIds.has(n.id)) continue
      if (n.type !== 'campaignNode' && n.type !== 'textNode') continue
      const before = { x: n.position.x, y: n.position.y }
      moves.push({ id: n.id, type: n.type, before, after: { x: before.x + dx, y: before.y + dy } })
    }
    commitNodeMoves(moves)
  }, [commitNodeMoves])

  // Align / distribute the current multi-node selection (driven by the
  // AlignmentToolbar). Reference is the selection's bounding box. Align modes
  // move one axis; distribute (needs 3+) equalizes the gaps between adjacent
  // edges along an axis, holding the two extreme nodes fixed.
  const alignSelectedNodes = useCallback((mode) => {
    const selectedIds = useCanvasUiStore.getState().selectedNodeIds
    if (selectedIds.size < 2) return

    const sel = []
    for (const n of nodesRef.current) {
      if (!selectedIds.has(n.id)) continue
      if (n.type !== 'campaignNode' && n.type !== 'textNode') continue
      const w = n.width  ?? (n.type === 'campaignNode' ? 256 : (n.data?.width  ?? 256))
      const h = n.height ?? (n.type === 'campaignNode' ? 180 : (n.data?.height ?? 96))
      sel.push({ id: n.id, type: n.type, x: n.position.x, y: n.position.y, w, h })
    }
    if (sel.length < 2) return

    if (mode === 'distribute-h' || mode === 'distribute-v') {
      if (sel.length < 3) return
      const horiz = mode === 'distribute-h'
      const sorted = [...sel].sort((a, b) => (horiz ? a.x - b.x : a.y - b.y))
      const startEdge = horiz ? sorted[0].x : sorted[0].y
      const last = sorted[sorted.length - 1]
      const endEdge = horiz ? last.x + last.w : last.y + last.h
      const sumSize = sorted.reduce((acc, s) => acc + (horiz ? s.w : s.h), 0)
      const gap = (endEdge - startEdge - sumSize) / (sorted.length - 1)
      let cursor = startEdge
      const targetById = new Map()
      for (const s of sorted) {
        targetById.set(s.id, cursor)
        cursor += (horiz ? s.w : s.h) + gap
      }
      const moves = sel.map((s) => {
        const t = targetById.get(s.id)
        const after = horiz ? { x: t, y: s.y } : { x: s.x, y: t }
        return { id: s.id, type: s.type, before: { x: s.x, y: s.y }, after }
      })
      commitNodeMoves(moves, 'Distribute')
      return
    }

    const minX = Math.min(...sel.map((s) => s.x))
    const minY = Math.min(...sel.map((s) => s.y))
    const maxX = Math.max(...sel.map((s) => s.x + s.w))
    const maxY = Math.max(...sel.map((s) => s.y + s.h))
    const cX = (minX + maxX) / 2
    const cY = (minY + maxY) / 2

    const moves = sel.map((s) => {
      let { x, y } = s
      switch (mode) {
        case 'left':     x = minX;           break
        case 'center-h': x = cX - s.w / 2;   break
        case 'right':    x = maxX - s.w;     break
        case 'top':      y = minY;           break
        case 'middle':   y = cY - s.h / 2;   break
        case 'bottom':   y = maxY - s.h;     break
        default: break
      }
      return { id: s.id, type: s.type, before: { x: s.x, y: s.y }, after: { x, y } }
    })
    commitNodeMoves(moves, 'Align')
  }, [commitNodeMoves])

  useArrowKeyNavigation({ rfInstanceRef, onNudgeSelected: nudgeSelectedNodes })

  const onNodeDragStart = useCallback((_event, node, nodes) => {
    // Fall back to [node] in case `nodes` is undefined (defensive — RF v11
    // documents the third arg, but a single-node drag may pass it as the
    // 1-element array or omit it depending on the path).
    captureDragStart(nodes?.length ? nodes : [node])
    // Chunk D step 7: announce the dragged node so the expanded-card
    // CampaignNode can freeze its clamp offset for the duration of the
    // drag. Multi-drags via shift+click never have an expanded card to
    // freeze (hover-expand is single-target by design), so we still
    // announce the primary id — the freeze logic in CampaignNode no-ops
    // for non-expanded nodes.
    useCanvasUiStore.getState().setDraggingNodeId(node?.id ?? null)
  }, [captureDragStart])

  const onNodeDragStop = useCallback((_event, node, nodes) => {
    finalizeDragStop(nodes?.length ? nodes : [node])
    // Drop signal — CampaignNode kicks off its drift from frozen clamp →
    // natural clamp over MORPH_DURATION_MS.
    useCanvasUiStore.getState().setDraggingNodeId(null)
  }, [finalizeDragStop])

  const onSelectionDragStart = useCallback((_event, nodes) => {
    captureDragStart(nodes)
  }, [captureDragStart])

  const onSelectionDragStop = useCallback((_event, nodes) => {
    finalizeDragStop(nodes)
  }, [finalizeDragStop])

  // ── Context menu plumbing ────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault()
    setCanvasMenu(null)
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY })
    track('right_click_menu_opened', { surface: 'node', nodeType: node.type })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault()
    if (!rfInstanceRef.current) return
    const flowPos = rfInstanceRef.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setContextMenu(null)
    setCanvasMenu({ x: event.clientX, y: event.clientY, flowPos })
    track('right_click_menu_opened', { surface: 'canvas' })
  }, [])

  // ── Add card (DB-backed) ─────────────────────────────────────────────────
  const addCardNode = useCallback(async (typeKey, flowPos) => {
    const typeId = useTypeStore.getState().idByKey[typeKey]
    if (!typeId) {
      console.error(`No type_id for key: ${typeKey}`)
      return
    }
    try {
      const newNode = await dbCreateNode({
        workspaceId: activeWorkspaceId,
        typeId,
        typeKey,
        label: '',
        summary: '',
        positionX: flowPos.x,
        positionY: flowPos.y,
      })
      setNodes((nds) => [...nds, newNode])

      // Analytics: card creation, plus a window for card_repositioned_quickly.
      // The Map entry self-cleans after RECENT_CREATE_WINDOW_MS so a card
      // repositioned later isn't counted as "quickly." Per ADR-0009.
      track('card_created', { typeKey })
      recentlyCreatedRef.current.set(newNode.id, Date.now())
      setTimeout(() => {
        recentlyCreatedRef.current.delete(newNode.id)
      }, RECENT_CREATE_WINDOW_MS)

      // Record the create AFTER the persist succeeds, so canApplyInverse's
      // existence check can rely on the card being in DB. dbRow captures
      // the inputs that recreate the card on redo (with explicit id).
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.CREATE_CARD,
        workspaceId: activeWorkspaceId,
        label: 'Add card',
        timestamp: new Date().toISOString(),
        cardId: newNode.id,
        dbRow: {
          typeId,
          typeKey,
          label:     '',
          summary:   '',
          avatarUrl: null,
          positionX: flowPos.x,
          positionY: flowPos.y,
        },
      })

      // Connections only apply to cards (campaignNode); filter out text nodes
      // so they don't surface as "Untitled" entries in the connections picker.
      setInspectorNode({
        node: newNode,
        connectedNodes: [],
        allOtherNodes: nodes.filter((n) => n.type === 'campaignNode'),
        originRect: null,
        topicNodeId: newNode.id,
        position: { x: 0, y: 0 },
        mode: readInspectorMode(),
        isRepoint: false,
      })
    } catch (err) {
      console.error('Failed to create card:', err)
    }
  }, [activeWorkspaceId, nodes, setNodes])

  // ── Add text (DB-backed) ─────────────────────────────────────────────────
  const addTextNode = useCallback(async (flowPos) => {
    try {
      const newTextNode = await dbCreateTextNode({
        workspaceId: activeWorkspaceId,
        contentHtml: '',
        positionX: flowPos.x,
        positionY: flowPos.y,
      })
      // Drop straight into edit mode on creation
      newTextNode.dragHandle = '.text-node-drag-handle'
      newTextNode.data = { ...newTextNode.data, editing: true }
      setNodes((nds) => [...nds, newTextNode])

      track('text_node_created')

      // Record AFTER the persist succeeds so canApplyInverse's existence
      // check can rely on the row being in DB. dbRow captures the fields
      // createTextNode writes; redo replays them via createTextNode({ id }).
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.CREATE_TEXT_NODE,
        workspaceId: activeWorkspaceId,
        label: 'Add text',
        timestamp: new Date().toISOString(),
        textNodeId: newTextNode.id,
        dbRow: {
          id:           newTextNode.id,
          workspace_id:  activeWorkspaceId,
          content_html: '',
          position_x:   flowPos.x,
          position_y:   flowPos.y,
          width:        newTextNode.data.width,
          height:       newTextNode.data.height,
          font_size:    newTextNode.data.fontSize,
          align:        newTextNode.data.align,
        },
      })
    } catch (err) {
      console.error('Failed to create text node:', err)
    }
  }, [activeWorkspaceId, setNodes])

  // ── Edit modal: building state ───────────────────────────────────────────
  const getNodeOriginRect = (nodeId) => {
    const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
    return el ? el.getBoundingClientRect() : null
  }

  const buildEditingState = useCallback((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return null
    const connectedEdges = edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    )
    const connectedNodes = connectedEdges
      .map((edge) => {
        const otherId = edge.source === nodeId ? edge.target : edge.source
        const other   = nodes.find((n) => n.id === otherId)
        if (!other) return null
        return {
          edgeId:  edge.id,
          nodeId:  otherId,
          label:   other.data.label,
          type:    other.data.type,
        }
      })
      .filter(Boolean)
    // Connections only apply to cards (campaignNode); text nodes are excluded
    // so they don't surface as "Untitled" entries in the connections picker.
    const allOtherNodes = nodes.filter(
      (n) => n.id !== nodeId && n.type === 'campaignNode'
    )
    const originRect    = getNodeOriginRect(nodeId)
    return { node, connectedNodes, allOtherNodes, originRect }
  }, [nodes, edges])

  // Mark exactly one node as the inspector's topic (clears the flag on any
  // node that previously held it). Only touches nodes whose flag actually
  // flips, so it doesn't churn the whole array.
  const setInspectorEditingFlag = useCallback((nodeId) => {
    setNodes(nds => nds.map(n => {
      const shouldEdit = n.id === nodeId
      if (!!n.data.isEditing === shouldEdit) return n
      return { ...n, data: { ...n.data, isEditing: shouldEdit } }
    }))
  }, [setNodes])

  // Open (or repoint) the inspector onto a node. `repoint` keeps the current
  // inspector's position and suppresses the grow-from-card morph; a fresh
  // open recenters and morphs.
  const openInspector = useCallback((nodeId, { repoint = false } = {}) => {
    const state = buildEditingState(nodeId)
    if (!state) return false
    setInspectorEditingFlag(nodeId)
    setInspectorNode(prev => ({
      ...state,
      topicNodeId: nodeId,
      position: repoint && prev ? prev.position : { x: 0, y: 0 },
      mode: repoint && prev ? prev.mode : readInspectorMode(),
      isRepoint: repoint,
    }))
    return true
  }, [buildEditingState, setInspectorEditingFlag])

  // Dock the open inspector to the bottom-right edge.
  const onDockInspector = useCallback(() => {
    writeInspectorMode('docked')
    setInspectorNode(prev => (prev ? { ...prev, mode: 'docked', isRepoint: false } : prev))
  }, [])

  // Detach the docked inspector back to a floating modal (Inspector drives the
  // follow-the-cursor position from here and syncs it on release).
  const onUndockInspector = useCallback(() => {
    writeInspectorMode('undocked')
    setInspectorNode(prev => (prev ? { ...prev, mode: 'undocked', isRepoint: false } : prev))
  }, [])

  const openEdit = useCallback((nodeId) => {
    if (openInspector(nodeId)) {
      const node = nodes.find((n) => n.id === nodeId)
      track('card_edit_opened', { source: 'context_menu', typeKey: node?.data?.type })
    }
  }, [openInspector, nodes])

  // Single-click repoints the open inspector onto another card. A plain click
  // only — additive multi-select gestures (Shift/Ctrl/Cmd-click) and marquee
  // selection don't repoint, so assembling a group to drag doesn't yank the
  // inspector around. Does nothing when the inspector is closed (then a click
  // just selects, today's behavior).
  const onNodeClick = useCallback((e, node) => {
    if (!inspectorNode) return
    if (node.type !== 'campaignNode') return
    if (e.shiftKey || e.metaKey || e.ctrlKey) return
    if (node.id === inspectorNode.topicNodeId) return
    inspectorCommitRef.current?.()        // commit the outgoing node first
    if (openInspector(node.id, { repoint: true })) {
      track('card_edit_opened', { source: 'repoint', typeKey: node.data?.type })
    }
  }, [inspectorNode, openInspector])

  const onNodeDoubleClick = useCallback((_, node) => {
    if (node.type === 'textNode') {
      setNodes((nds) => nds.map((n) =>
        n.id === node.id ? { ...n, draggable: true, dragHandle: '.text-node-drag-handle', data: { ...n.data, editing: true } } : n
      ))
      return
    }
    // When the inspector is already open, the preceding single-click already
    // repointed it — don't re-open (which would morph + recenter). Only act
    // if somehow targeting a different node.
    if (inspectorNode) {
      if (node.id !== inspectorNode.topicNodeId) {
        inspectorCommitRef.current?.()
        openInspector(node.id, { repoint: true })
      }
      return
    }
    if (openInspector(node.id)) {
      track('card_edit_opened', { source: 'double_click', typeKey: node.data?.type })
    }
  }, [inspectorNode, openInspector, setNodes])

  // ── Update node (DB-backed) ─────────────────────────────────────────────
  //
  // Called from Inspector as the user edits. Applies the change optimistically
  // to React state, persists to Supabase in parallel, and handles connection
  // add/remove by updating the DB edges in the background.
  //
  // Connection payloads carry the connection's id (assigned client-side in
  // ConnectionsSection at picker click). Inspector owns the `recordAction`
  // calls for connections — App.jsx just persists. This lets Inspector
  // emit all undo entries for a session in chronological order at close,
  // mixing field edits and connection clicks correctly.
  //
  // `addConnections`    - [{ id, nodeId }] connections to create.
  // `removeConnections` - [{ id, nodeId }] connections to delete.
  const onUpdateNode = useCallback((nodeId, updatedData, { addConnections = [], removeConnections = [] } = {}) => {
    // --- Optimistic React update -------------------------------------------
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n
      )
    )

    // --- Persist core node fields -----------------------------------------
    // Card content (summary / bullets / media) now lives in the block editor
    // and saves itself (saveBlockZones); the Inspector only sends the header
    // fields below. The legacy section-write path was removed at the E4
    // cutover (ADR-0016).
    const nodeField = {}
    if (updatedData.label !== undefined)   nodeField.label     = updatedData.label
    if (updatedData.avatar !== undefined)  nodeField.avatarUrl = updatedData.avatar
    if (updatedData.type !== undefined) {
      const typeId = useTypeStore.getState().idByKey[updatedData.type]
      if (typeId) nodeField.typeId = typeId
    }
    if (Object.keys(nodeField).length > 0) {
      dbUpdateNode(nodeId, nodeField).catch(console.error)
    }

    // --- Connection adds / removes -----------------------------------------
    // Inspector owns the recordAction calls (chronological ordering across
    // field edits and connection clicks). This block is purely persistence.
    if (addConnections.length === 0 && removeConnections.length === 0) return

    if (removeConnections.length > 0) {
      const removeIds = new Set(removeConnections.map((c) => c.id))
      setEdges((eds) => eds.filter((e) => !removeIds.has(e.id)))
      removeConnections.forEach(({ id }) => {
        dbDeleteConnection(id).catch(console.error)
      })
    }

    addConnections.forEach(({ id, nodeId: targetId }) => {
      // One-line-per-pair invariant: skip creates whose pair already has a
      // line (e.g. the pair was connected from the canvas while this
      // Inspector session was open). The DB's unique-pair index (migration
      // 009) backstops any race this local check can't see; dbCreateConnection
      // returns null for those, so the .then guard covers both layers.
      if (connectionExists(edgesRef.current, nodeId, targetId)) return
      dbCreateConnection({
        id,
        workspaceId: activeWorkspaceId,
        sourceNodeId: nodeId,
        targetNodeId: targetId,
      })
        .then((edge) => {
          if (!edge) return   // pair already connected (unique-pair no-op)
          setEdges((eds) => (eds.some((e) => e.id === edge.id) ? eds : [...eds, edge]))
        })
        .catch(console.error)
    })
  }, [activeWorkspaceId, setNodes, setEdges])

  // ── Duplicate (DB-backed) ───────────────────────────────────────────────
  // Build ONE duplicate node (DB-create included) without touching canvas state
  // or selection — returns the new React Flow node, or null on failure /
  // unsupported type. Copies NO connections for cards (a duplicate enters the
  // graph unconnected by design). Not undoable yet — see BACKLOG ("Undo support
  // for duplicate"). Shared by single- and multi-duplicate.
  const buildDuplicateNode = useCallback(async (source) => {
    if (!source) return null

    if (source.type === 'textNode') {
      try {
        return await dbCreateTextNode({
          workspaceId: activeWorkspaceId,
          contentHtml: source.data.text,
          positionX:   source.position.x + 40,
          positionY:   source.position.y + 40,
          width:       source.data.width,
          height:      source.data.height,
          fontSize:    source.data.fontSize,
          align:       source.data.align,
        })
      } catch (err) {
        console.error('Failed to duplicate text node:', err)
        return null
      }
    }

    if (source.type !== 'campaignNode') return null
    const typeId = useTypeStore.getState().idByKey[source.data.type]
    if (!typeId) {
      console.error(`No type_id for key: ${source.data.type}`)
      return null
    }
    try {
      // If the source card is open in the inspector with unsaved edits, flush
      // its block editors so the copy includes the latest content (mirrors E1).
      if (inspectorNodeRef.current?.topicNodeId === source.id) {
        try { await editorFlushApiRef.current?.() } catch (err) { console.error(err) }
      }
      // duplicateCard copies the new block zones (and any legacy rows) straight
      // from the DB — kind-agnostic — and copies NO connections.
      return await duplicateCard({
        sourceId:    source.id,
        workspaceId: activeWorkspaceId,
        typeId,
        typeKey:     source.data.type,
        label:       source.data.label,
        summary:     source.data.summary,
        avatarUrl:   source.data.avatar,
        positionX:   source.position.x + 40,
        positionY:   source.position.y + 40,
      })
    } catch (err) {
      console.error('Failed to duplicate card:', err)
      return null
    }
  }, [activeWorkspaceId])

  // Single-card duplicate (context menu on one node). Appends the copy; leaves
  // selection unchanged.
  const onDuplicate = useCallback(async (nodeId) => {
    const dup = await buildDuplicateNode(nodes.find((n) => n.id === nodeId))
    if (dup) setNodes((nds) => [...nds, dup])
  }, [nodes, buildDuplicateNode, setNodes])

  // Duplicate every selected card/text node at once. Each copy is offset +40/+40
  // from its own source (relative layout preserved), and the new copies BECOME
  // the selection so they can be dragged away as a group.
  const duplicateSelectedNodes = useCallback(async () => {
    const selectedIds = useCanvasUiStore.getState().selectedNodeIds
    if (selectedIds.size === 0) return
    const sources = nodesRef.current.filter(
      (n) => selectedIds.has(n.id) && (n.type === 'campaignNode' || n.type === 'textNode'),
    )
    if (sources.length === 0) return

    const dups = (await Promise.all(sources.map(buildDuplicateNode))).filter(Boolean)
    if (dups.length === 0) return

    const newIds = new Set(dups.map((d) => d.id))
    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      ...dups.map((d) => ({ ...d, selected: true })),
    ])
    // Mirror the selection into the UI store explicitly (programmatic selection
    // changes don't reliably fire RF's onSelectionChange).
    useCanvasUiStore.getState().setSelectedNodeIds(newIds)
    useCanvasUiStore.getState().setAnySelected(true)
  }, [buildDuplicateNode, setNodes])

  // Ctrl/Cmd+D — duplicate the current selection. Left to the browser (bookmark)
  // while typing in a field or when nothing is selected.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key?.toLowerCase() !== 'd' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return
      const t = e.target
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (useCanvasUiStore.getState().selectedNodeIds.size === 0) return
      e.preventDefault()
      duplicateSelectedNodes()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [duplicateSelectedNodes])

  // ── Lock toggle — in-memory only (feature scoped out of V1) ─────────────
  const onLockToggle = useCallback((nodeId) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, locked: !n.data.locked } } : n
      )
    )
  }, [setNodes])

  // Tear down the open inspector WITHOUT committing it (no flush/undo, no
  // card_edit_closed event) — used when the card it shows is being deleted, so
  // its legacy auto-save can't fire a write against the row we're removing and
  // its block editors unmount (their pending saves were already flushed above).
  const closeInspectorForDelete = useCallback(() => {
    const cur = inspectorNodeRef.current
    if (!cur) return
    setNodes((nds) => nds.map((n) =>
      n.id === cur.topicNodeId ? { ...n, data: { ...n.data, isEditing: false } } : n))
    setInspectorNode(null)
  }, [setNodes])

  // ── Delete (DB-backed, cascades to sections + connections) ──────────────
  const onDeleteNode = useCallback(async (nodeId) => {
    const target = nodes.find((n) => n.id === nodeId)
    if (!target) return

    if (target.type === 'textNode') {
      // Snapshot the full DB-shape row from current React state BEFORE the
      // optimistic removal. Text nodes have no dependent rows (no cascade),
      // so this is a single-row snapshot — much simpler than deleteCard's
      // restoreCardWithDependents path.
      const dbRow = {
        id:           target.id,
        workspace_id:  activeWorkspaceId,
        content_html: target.data.text ?? '',
        position_x:   target.position.x,
        position_y:   target.position.y,
        width:        target.data.width,
        height:       target.data.height ?? null,
        font_size:    target.data.fontSize,
        align:        target.data.align,
      }

      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))

      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.DELETE_TEXT_NODE,
        workspaceId: activeWorkspaceId,
        label: 'Delete text',
        timestamp: new Date().toISOString(),
        textNodeId: target.id,
        dbRow,
      })

      dbDeleteTextNode(nodeId).catch((err) => {
        console.error(err)
        useUndoStore.getState().popLastAction()
      })
      return
    }

    // ── Card delete (async, content-complete, fail-closed) ────────────────
    // Order is a correctness invariant (ADR-0016 Chunk E1):
    //   flush pending editor saves → fetch full snapshot from DB → remove →
    //   record undo → delete. The snapshot must be COMPLETE before recordAction
    //   (which freezes it into sessionStorage), and a capture failure must BLOCK
    //   the delete — an un-undoable delete is worse than no delete.
    if (deletingRef.current.has(nodeId)) return   // guard double-trigger
    deletingRef.current.add(nodeId)
    try {
      const isOpenCard = inspectorNodeRef.current?.topicNodeId === nodeId

      // 1. If this card is open in the inspector, force its block-editor zones
      //    to flush any pending (debounced) save so the DB has the latest
      //    content, then tear the inspector down so no late save targets the
      //    row we're about to delete. (No-op when the card isn't open.)
      if (isOpenCard) {
        try { await editorFlushApiRef.current?.() } catch (err) { console.error(err) }
        closeInspectorForDelete()
      }

      // 2. Capture the full restore snapshot. Section content (card_view /
      //    gm_only / legacy kinds) is read from the DB — the GM zone is never
      //    in canvas memory. A fetch failure fails closed: nothing is removed.
      let snapshot
      try {
        snapshot = await buildDeleteCardSnapshot(nodeId, {
          nodes,
          edges,
          workspaceId: activeWorkspaceId,
          typeIdByKey: useTypeStore.getState().idByKey,
        })
      } catch (err) {
        console.error('Delete aborted — could not capture card content', err)
        toastDeleteCaptureFailed()
        return
      }
      if (!snapshot) return   // card vanished from state between trigger and capture

      // 3. Optimistic removal.
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))

      // 4. Record undo — the snapshot is now provably complete.
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.DELETE_CARD,
        workspaceId: activeWorkspaceId,
        label: `Delete "${snapshot.dbCardRow.label || 'card'}"`,
        timestamp: new Date().toISOString(),
        dbCardRow:        snapshot.dbCardRow,
        dbSectionRows:    snapshot.dbSectionRows,
        dbConnectionRows: snapshot.dbConnectionRows,
      })

      track('card_deleted', {
        typeKey: target.data?.type,
        connectionCount: snapshot.dbConnectionRows?.length ?? 0,
      })

      // 5. Persist; rollback the undo entry if the write fails.
      dbDeleteNode(nodeId).catch((err) => {
        console.error(err)
        useUndoStore.getState().popLastAction()
      })
    } finally {
      deletingRef.current.delete(nodeId)
    }
  }, [nodes, edges, activeWorkspaceId, setNodes, setEdges, closeInspectorForDelete])

  // ── Multi-delete: remove the whole selection as ONE undo entry ───────────
  // A single-item selection routes through onDeleteNode so the existing
  // per-type labels ("Delete \"Strahd\"", "Delete text") stay intact. For 2+,
  // the batchDelete entry restores everything on one Ctrl+Z — connections
  // shared between two deleted cards are de-duplicated at capture time (see
  // lib/batchDelete.js).
  const batchDeletingRef = useRef(false)
  const deleteSelectedNodes = useCallback(async () => {
    const selectedIds = useCanvasUiStore.getState().selectedNodeIds
    if (selectedIds.size === 0) return
    if (selectedIds.size === 1) {
      for (const id of selectedIds) return onDeleteNode(id)
    }
    if (batchDeletingRef.current) return   // guard double-trigger
    batchDeletingRef.current = true
    try {
      // 1. If the open Inspector's card is in the doomed set, flush its
      //    pending editor saves and tear it down first (same invariant as
      //    single delete — ADR-0016 Chunk E1).
      const openId = inspectorNodeRef.current?.topicNodeId
      if (openId && selectedIds.has(openId)) {
        try { await editorFlushApiRef.current?.() } catch (err) { console.error(err) }
        closeInspectorForDelete()
      }

      // 2. Capture the full restore snapshot. Fails closed: if any card's
      //    section content can't be fetched, nothing is removed.
      let snapshot
      try {
        snapshot = await buildBatchDeleteSnapshot(selectedIds, {
          nodes,
          edges,
          workspaceId: activeWorkspaceId,
          typeIdByKey: useTypeStore.getState().idByKey,
        })
      } catch (err) {
        console.error('Delete aborted — could not capture content', err)
        toastDeleteCaptureFailed()
        return
      }
      if (!snapshot) return   // selection vanished between trigger and capture

      const doomed = new Set([
        ...snapshot.cards.map((c) => c.dbCardRow.id),
        ...snapshot.textNodes.map((t) => t.textNodeId),
      ])

      // 3. Optimistic removal + selection cleanup.
      setNodes((nds) => nds.filter((n) => !doomed.has(n.id)))
      setEdges((eds) => eds.filter((e) => !doomed.has(e.source) && !doomed.has(e.target)))
      useCanvasUiStore.getState().setSelectedNodeIds(new Set())
      useCanvasUiStore.getState().setAnySelected(false)

      // 4. Record undo — the snapshot is now provably complete.
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.BATCH_DELETE,
        workspaceId: activeWorkspaceId,
        label: `Delete ${doomed.size} items`,
        timestamp: new Date().toISOString(),
        cards:       snapshot.cards,
        connections: snapshot.connections,
        textNodes:   snapshot.textNodes,
      })

      track('batch_deleted', {
        cardCount:     snapshot.cards.length,
        textNodeCount: snapshot.textNodes.length,
      })

      // 5. Persist; rollback the undo entry if the write fails.
      deleteBatch({
        cardIds:     snapshot.cards.map((c) => c.dbCardRow.id),
        textNodeIds: snapshot.textNodes.map((t) => t.textNodeId),
      }).catch((err) => {
        console.error(err)
        useUndoStore.getState().popLastAction()
      })
    } finally {
      batchDeletingRef.current = false
    }
  }, [nodes, edges, activeWorkspaceId, setNodes, setEdges, onDeleteNode, closeInspectorForDelete])

  // Delete / Backspace — delete the current selection. Left alone while
  // typing in a field; no-op when nothing is selected. React Flow's own
  // built-in Backspace delete is disabled (deleteKeyCode={null} below): it
  // only removed nodes from local state — no DB delete, no undo entry — so
  // "deleted" items resurrected on refresh.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const t = e.target
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (useCanvasUiStore.getState().selectedNodeIds.size === 0) return
      e.preventDefault()
      deleteSelectedNodes()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelectedNodes])

  // ── Quick-connect: drag from a card-side button to another card ──────────
  // CampaignNode shows four per-side buttons after a hover dwell on a
  // selected card; pressing one calls beginQuickConnect (via CanvasOpsContext)
  // and the window listeners below own the rest of the gesture. Releasing
  // over a valid card creates the connection through the SAME machinery the
  // Inspector's Connection Manager uses (same dbCreateConnection shape, same
  // ADD_CONNECTION undo entry); releasing anywhere else cancels silently.
  const [quickConnect, setQuickConnect] = useState(null) // { sourceId, cursorScreen, targetId }
  const quickConnectRef = useRef(null)
  quickConnectRef.current = quickConnect

  const beginQuickConnect = useCallback((sourceId, e) => {
    track('connection_started', { via: 'quick_connect' })
    setQuickConnect({
      sourceId,
      cursorScreen: { x: e.clientX, y: e.clientY },
      targetId: null,
    })
  }, [])

  // One connection, created the canvas way: optimistic edge (geometry fills
  // in the endpoints next pass), immediate undo entry, fire-and-forget
  // persist with entry rollback on failure — then mirror a chip into the
  // open Inspector if it's showing either endpoint.
  const createQuickConnection = useCallback((sourceId, targetId) => {
    // Final one-line-per-pair gate at the moment of creation (validation also
    // ran during the drag, but this closes the window between gesture end and
    // state flush). The DB's unique-pair index (migration 009) backstops any
    // race no client check can see.
    if (connectionExists(edgesRef.current, sourceId, targetId)) return

    const id = crypto.randomUUID()
    setEdges((eds) => (connectionExists(eds, sourceId, targetId) ? eds : [
      ...eds,
      { id, source: sourceId, target: targetId, type: 'floating' },
    ]))

    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.ADD_CONNECTION,
      workspaceId: activeWorkspaceId,
      label: 'Add connection',
      timestamp: new Date().toISOString(),
      connectionId: id,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
    })

    const target = nodesRef.current.find((n) => n.id === targetId)
    track('connection_completed', { targetType: target?.data?.type, via: 'quick_connect' })

    dbCreateConnection({
      id,
      workspaceId: activeWorkspaceId,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
    }).catch((err) => {
      console.error(err)
      useUndoStore.getState().popLastAction()
    })

    // Live-update the open Inspector's Connection Manager. localConns is
    // seeded on mount, so without this the new chip would only show up on
    // the next open. The bridge pre-marks the connection as synced inside
    // the Inspector so its auto-save doesn't re-create it and its session
    // log doesn't emit a duplicate undo entry.
    const insp = inspectorNodeRef.current
    const api = inspectorConnsApiRef.current
    if (insp && api) {
      const otherId =
        insp.topicNodeId === sourceId ? targetId :
        insp.topicNodeId === targetId ? sourceId : null
      if (otherId) {
        const other = nodesRef.current.find((n) => n.id === otherId)
        if (other) {
          api.addExternalConnection({
            id,
            nodeId: otherId,
            label: other.data.label,
            type: other.data.type,
          })
        }
      }
    }
  }, [activeWorkspaceId, setEdges])

  // Window listeners for the active drag. Dep is the BOOLEAN so the
  // listeners bind once per gesture, not on every cursor move; handlers
  // read the live session from quickConnectRef.
  const quickConnectActive = quickConnect !== null
  useEffect(() => {
    if (!quickConnectActive) return

    const onPointerMove = (e) => {
      const qc = quickConnectRef.current
      if (!qc) return
      // Hit-test as we move so the line can snap to a valid target.
      const underCursor = findNodeIdAtPoint(e.clientX, e.clientY)
      const valid = validateQuickConnectTarget({
        nodes: nodesRef.current,
        edges: edgesRef.current,
        sourceId: qc.sourceId,
        targetId: underCursor,
      })
      setQuickConnect({
        ...qc,
        cursorScreen: { x: e.clientX, y: e.clientY },
        targetId: valid.ok ? underCursor : null,
      })
    }

    const onPointerUp = (e) => {
      const qc = quickConnectRef.current
      // Null the ref SYNCHRONOUSLY (not just the state): the ref is refreshed
      // at render time, so a second pointerup arriving before React re-renders
      // would otherwise see the session still live and create a second
      // connection for one gesture.
      quickConnectRef.current = null
      setQuickConnect(null)
      if (!qc) return
      const targetId = findNodeIdAtPoint(e.clientX, e.clientY)
      const valid = validateQuickConnectTarget({
        nodes: nodesRef.current,
        edges: edgesRef.current,
        sourceId: qc.sourceId,
        targetId,
      })
      if (!valid.ok) {
        track('connection_abandoned', { via: 'quick_connect' })
        return
      }
      createQuickConnection(qc.sourceId, targetId)
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        track('connection_abandoned', { via: 'quick_connect' })
        quickConnectRef.current = null   // same sync-cancel as pointerup
        setQuickConnect(null)
      }
    }

    document.body.style.cursor = 'crosshair'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [quickConnectActive, createQuickConnection])

  // ── Altitude trigger (per ADR-0010) ──────────────────────────────────────
  // onMove fires throughout pan/zoom gestures, giving Bead View an
  // immediate flip the moment the user crosses the grid-gap threshold — no
  // visible lag waiting for the gesture to end. The architecture stays
  // event-driven: this is the ONE place that reads raw zoom continuously.
  // nextAltitude() applies the hysteresis dead-band and returns the current
  // altitude unchanged whenever no transition is warranted, so setAltitude
  // is called only at actual crossings and the store fires at most one
  // update per crossing. Downstream subscribers (Chunk B's morph, Chunk C's
  // bead-perimeter math, future altitude views) react to altitude
  // transitions, never to raw zoom.
  // Single source of truth for altitude crossings. Reads current altitude
  // from the store, evaluates nextAltitude with the supplied (zoom,
  // thresholdMm), and on transition: writes the new altitude, opens the
  // two-phase morph window (FloatingEdge cross-fade; cards transition
  // via plain CSS off `altitude`), and emits the debug log. Called from
  // BOTH onMove (zoom-driven crossings) and the threshold subscription
  // below (drag-driven crossings via the altitude rail).
  const evaluateAltitude = useCallback((zoom, thresholdMm, source) => {
    const store = useCanvasUiStore.getState()
    const current = store.altitude
    const next = nextAltitude(current, zoom, thresholdMm)
    if (next === current) return
    store.setAltitude(next)
    // Reduced-motion (Chunk F): skip the two-phase fade entirely. Edges
    // stay at their resting opacity through the altitude swap; cards'
    // CSS transitions are already collapsed to 0 ms in CampaignNode via
    // useReducedMotion, so the global morph window has no work to do.
    if (!reducedMotion) {
      const halfMs = MORPH_DURATION_MS / 2
      store.setMorphPhase('out')
      if (morphTimeoutRef.current != null) clearTimeout(morphTimeoutRef.current)
      morphTimeoutRef.current = setTimeout(() => {
        useCanvasUiStore.getState().setMorphPhase('in')
        morphTimeoutRef.current = setTimeout(() => {
          useCanvasUiStore.getState().setMorphPhase(null)
          morphTimeoutRef.current = null
        }, halfMs)
      }, halfMs)
    }
  }, [reducedMotion])

  const onMove = useCallback((_event, viewport) => {
    // Keep the store's viewport mirror in sync — useEdgeGeometry (zoom for
    // bead arc-gap math) and Chunk D's hover-expand clamp (pan + zoom)
    // both read from here. Both hooks run at the App level, outside the
    // <ReactFlow> context, so they can't call useViewport themselves.
    const store = useCanvasUiStore.getState()
    store.setCurrentZoom(viewport.zoom)
    store.setCurrentPan(viewport.x, viewport.y)

    evaluateAltitude(viewport.zoom, store.thresholdGridGapMm, 'zoom')
  }, [evaluateAltitude])

  // ── Threshold-driven altitude crossings ──────────────────────────────────
  // The altitude rail (src/components/AltitudeRail.jsx) lets the user drag
  // the morph threshold up and down the zoom scale. When it changes, the
  // user's current zoom may now sit on the opposite side of the trigger,
  // which should fire a morph IMMEDIATELY — not wait for the next pan or
  // zoom event. Subscribe to thresholdGridGapMm directly so this re-eval
  // doesn't re-render App.jsx on every drag tick (rail UI already re-renders
  // because it subscribes to the same value via a selector).
  useEffect(() => {
    const unsub = useCanvasUiStore.subscribe((state, prevState) => {
      if (state.thresholdGridGapMm === prevState.thresholdGridGapMm) return
      evaluateAltitude(state.currentZoom, state.thresholdGridGapMm, 'threshold')
    })
    return unsub
  }, [evaluateAltitude])

  // ── Viewport analytics (per ADR-0009) ────────────────────────────────────
  // onMoveEnd fires once per discrete pan/zoom gesture, which is the right
  // granularity for both events. Pure pans feed the burst window; zoom
  // changes fire their own event. Zoom-with-pan counts as zoom only — we
  // don't want pan_burst inflated by user re-centering after a zoom.
  const onMoveEnd = useCallback((_event, viewport) => {
    const prev = lastViewportRef.current
    lastViewportRef.current = viewport
    if (!prev) return

    const zoomChanged = viewport.zoom !== prev.zoom
    const panned = viewport.x !== prev.x || viewport.y !== prev.y

    if (zoomChanged) {
      track('zoom_changed', { from: prev.zoom, to: viewport.zoom })
      return
    }

    if (!panned) return

    const now = Date.now()
    const arr = panTimestampsRef.current
    arr.push(now)
    while (arr.length > 0 && arr[0] < now - PAN_BURST_WINDOW_MS) arr.shift()
    if (arr.length >= PAN_BURST_THRESHOLD) {
      track('pan_burst', { panCount: arr.length, windowMs: PAN_BURST_WINDOW_MS })
      // Reset so we don't fire repeatedly inside one extended hunt.
      arr.length = 0
    }
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh' }} className="flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading campaign…</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ width: '100vw', height: '100vh' }} className="flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="text-sm font-medium text-red-700 mb-1">Couldn't load campaign</div>
          <div className="text-xs text-gray-600">{loadError}</div>
        </div>
      </div>
    )
  }

  return (
    <LightboxProvider>
    <CanvasOpsProvider value={{ onDeleteNode, beginQuickConnect }}>
    <div
      style={{ width: '100vw', height: '100vh' }}
      className={isPanning ? 'is-panning' : ''}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStart={onSelectionDragStart}
        onSelectionDragStop={onSelectionDragStop}
        onSelectionChange={onSelectionChange}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => { closeContextMenu(); setCanvasMenu(null) }}
        onPaneContextMenu={onPaneContextMenu}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onInit={(rf) => { rfInstanceRef.current = rf }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={isPanning}
        minZoom={dynamicMinZoom}
        panOnScroll={true}
        panOnScrollMode="free"
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        zoomOnPinch={true}
        // React Flow's built-in selectionOnDrag is disabled in favor of our
        // useCustomMarquee hook (which survives the cursor leaving the
        // viewport — RF v11's doesn't). selectionKeyCode is also nulled out
        // so Shift+drag on empty canvas doesn't activate React Flow's own
        // selection mode and conflict with our marquee. Shift is still the
        // multiSelectionKeyCode for additive *click* selection on nodes;
        // additive *marquee* selection is handled inside useCustomMarquee.
        selectionOnDrag={false}
        selectionKeyCode={null}
        selectionMode="partial"
        multiSelectionKeyCode="Shift"
        // RF's built-in delete (default key: Backspace) is disabled — it only
        // removes nodes from local state (no DB delete, no undo entry), so
        // they'd resurrect on refresh. Our own Delete/Backspace listener owns
        // the gesture and routes through the undoable delete paths.
        deleteKeyCode={null}
        fitView
      >
        <Background color="#1f2937" />
        {/* Screen-layer overlay (constant size) for aligning a multi-selection. */}
        <AlignmentToolbar onAlign={alignSelectedNodes} />
      </ReactFlow>

      <MarqueeRect marquee={marqueeOverlay} rfInstanceRef={rfInstanceRef} />
      <QuickConnectLine quickConnect={quickConnect} rfInstanceRef={rfInstanceRef} />
      <AltitudeRail onZoomTo={onZoomToFromRail} />

      {contextMenu && (() => {
        const node = nodes.find((n) => n.id === contextMenu.nodeId)
        if (!node) return null
        // Right-clicking a node that's part of a multi-selection targets the
        // whole selection (same rule as Duplicate); right-clicking outside
        // the selection targets just the clicked node.
        const sel = selectedNodeIdsForExp
        const targetsSelection = sel.size > 1 && sel.has(contextMenu.nodeId)
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={node}
            selectedCount={targetsSelection ? sel.size : 1}
            onEdit={() => openEdit(contextMenu.nodeId)}
            onDuplicate={() => {
              if (targetsSelection) duplicateSelectedNodes()
              else onDuplicate(contextMenu.nodeId)
            }}
            onLockToggle={() => onLockToggle(contextMenu.nodeId)}
            onDelete={() => {
              if (targetsSelection) deleteSelectedNodes()
              else onDeleteNode(contextMenu.nodeId)
            }}
            onClose={closeContextMenu}
          />
        )
      })()}

      {canvasMenu && (
        <CanvasContextMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          onAddCard={(type) => addCardNode(type, canvasMenu.flowPos)}
          onAddText={() => addTextNode(canvasMenu.flowPos)}
          onClose={() => setCanvasMenu(null)}
        />
      )}

      {inspectorNode && (
        <Inspector
          key={inspectorNode.topicNodeId}
          node={inspectorNode.node}
          connectedNodes={inspectorNode.connectedNodes}
          allOtherNodes={inspectorNode.allOtherNodes}
          originRect={inspectorNode.originRect}
          skipOpenMorph={inspectorNode.isRepoint}
          mode={inspectorNode.mode}
          position={inspectorNode.position}
          onPositionChange={(p) =>
            setInspectorNode((prev) => (prev ? { ...prev, position: p } : prev))
          }
          onDock={onDockInspector}
          onUndock={onUndockInspector}
          getCloseRect={() => getNodeOriginRect(inspectorNode.topicNodeId)}
          commitApiRef={inspectorCommitRef}
          editorFlushApiRef={editorFlushApiRef}
          connectionsApiRef={inspectorConnsApiRef}
          onUpdate={onUpdateNode}
          onClose={() => {
            track('card_edit_closed', { typeKey: inspectorNode.node.data?.type })
            setNodes(nds => nds.map(n =>
              n.id === inspectorNode.topicNodeId
                ? { ...n, data: { ...n.data, isEditing: false } }
                : n
            ))
            setInspectorNode(null)
          }}
        />
      )}
    </div>
    </CanvasOpsProvider>
    </LightboxProvider>
  )
}
