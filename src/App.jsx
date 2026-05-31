import { useEffect, useRef, useState, useCallback } from 'react'
import ReactFlow, { Background, useNodesState, useEdgesState } from 'reactflow'
import { useTypeStore } from './store/useTypeStore'
import FloatingEdge from './edges/FloatingEdge'
import ContextMenu from './components/ContextMenu'
import CanvasContextMenu from './components/CanvasContextMenu'
import EditModal from './components/EditModal'
import { LightboxProvider } from './components/Lightbox'
import CampaignNode from './nodes/CampaignNode'
import TextNode from './nodes/TextNode'
import { useWorkspace } from './lib/WorkspaceContext.jsx'
import {
  createNode as dbCreateNode,
  updateNode as dbUpdateNode,
  updateNodeSections as dbUpdateNodeSections,
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
import { useSpacebarPan } from './hooks/useSpacebarPan'
import { useWorkspaceData } from './hooks/useWorkspaceData'
import { useEdgeGeometry } from './hooks/useEdgeGeometry'
import { useNodeHoverSelection } from './hooks/useNodeHoverSelection'
import { useUndoShortcuts } from './hooks/useUndoShortcuts'
import { useCustomMarquee } from './hooks/useCustomMarquee'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useArrowKeyNavigation } from './hooks/useArrowKeyNavigation'
import MarqueeRect from './components/MarqueeRect'
import AltitudeRail from './components/AltitudeRail'
import { useUndoStore } from './store/useUndoStore'
import { useCanvasUiStore } from './store/useCanvasUiStore'
import { ACTION_TYPES } from './lib/undo/index.js'
import { CanvasOpsProvider } from './lib/CanvasOpsContext.jsx'
import { setPanToTargetImpl } from './lib/cameraOps.js'
import { track } from './lib/analytics.js'
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

export default function App() {
  const { activeWorkspaceId } = useWorkspace()

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
  const [editingNode, setEditingNode] = useState(null)
  // Lets App commit the open inspector's pending edits (flush save + undo)
  // right before a repoint swaps its topic node. EditModal assigns its
  // commitSession here while mounted.
  const inspectorCommitRef = useRef(null)

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
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  } = useNodeHoverSelection()

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
  const altitudeForExpand    = useCanvasUiStore((s) => s.altitude)
  const hoveredNodeIdForExp  = useCanvasUiStore((s) => s.hoveredNodeId)
  const selectedNodeIdsForExp = useCanvasUiStore((s) => s.selectedNodeIds)
  let currentlyExpandedId = null
  if (altitudeForExpand === 'beadView') {
    if (hoveredNodeIdForExp) currentlyExpandedId = hoveredNodeIdForExp
    else if (selectedNodeIdsForExp.size === 1) {
      // Single-select case: grab the lone id without mutating
      for (const id of selectedNodeIdsForExp) { currentlyExpandedId = id; break }
    }
  }
  const prevExpandedIdRef    = useRef(null)
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
    const prev = prevExpandedIdRef.current
    const cur  = currentlyExpandedId
    if (prev === cur) return
    prevExpandedIdRef.current = cur
    if (prev) fireExpandMorph(prev)
    if (cur)  fireExpandMorph(cur)
  }, [currentlyExpandedId, fireExpandMorph])

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

  const captureDragStart = useCallback((dragNodes) => {
    finalizedDragRef.current.clear()
    for (const n of dragNodes ?? []) {
      if (!n) continue
      dragStartPosRef.current.set(n.id, { x: n.position.x, y: n.position.y })
    }
  }, [])

  const finalizeDragStop = useCallback((dragNodes) => {
    // Collect every card from this drag into one moveCard entry so Ctrl+Z
    // reverts the whole drag in a single step (vs N steps for N cards).
    // Persist promises for THESE same cards are tracked so we can roll the
    // entry back as a unit if any of the writes fail.
    const cardMoves = []
    const cardPersists = []

    for (const n of dragNodes ?? []) {
      if (!n || finalizedDragRef.current.has(n.id)) continue
      finalizedDragRef.current.add(n.id)

      const start = dragStartPosRef.current.get(n.id)
      dragStartPosRef.current.delete(n.id)

      // 4px threshold filters out mouse-jitter "moves" that aren't real drags
      // (per ADR-0006 §"Action set covered" — moveCard fires only if Δ ≥ 4px).
      const movedFar =
        start &&
        Math.hypot(n.position.x - start.x, n.position.y - start.y) >= 4

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
          positionX: n.position.x,
          positionY: n.position.y,
        })
        if (movedFar) {
          cardMoves.push({
            cardId: n.id,
            before: { x: start.x, y: start.y },
            after:  { x: n.position.x, y: n.position.y },
          })
          cardPersists.push(persist)
        } else {
          // Sub-threshold nudge — still persist, just no undo entry.
          persist.catch(console.error)
        }
      } else if (n.type === 'textNode') {
        const persist = dbUpdateTextNode(n.id, {
          positionX: n.position.x,
          positionY: n.position.y,
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
            after:  { x: n.position.x, y: n.position.y },
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
  }, [activeWorkspaceId])

  // Arrow-key nudge for selected nodes. Mirrors finalizeDragStop's persist +
  // undo shape so a keyboard nudge round-trips through Ctrl+Z the same way a
  // drag does. The 4px "movedFar" threshold from the drag path is intentionally
  // skipped — keyboard input is deterministic, not jitter, so every press
  // records an entry.
  const nudgeSelectedNodes = useCallback((dx, dy) => {
    const selectedIds = useCanvasUiStore.getState().selectedNodeIds
    if (selectedIds.size === 0) return

    const cardMoves    = []  // grouped into one MOVE_CARD entry per press
    const cardPersists = []
    const textMoves    = []  // one MOVE_TEXT_NODE entry per text node

    for (const n of nodesRef.current) {
      if (!selectedIds.has(n.id)) continue
      const before = { x: n.position.x, y: n.position.y }
      const after  = { x: before.x + dx, y: before.y + dy }
      if (n.type === 'campaignNode') {
        cardMoves.push({ cardId: n.id, before, after })
        cardPersists.push(dbUpdateNode(n.id, { positionX: after.x, positionY: after.y }))
      } else if (n.type === 'textNode') {
        const persist = dbUpdateTextNode(n.id, { positionX: after.x, positionY: after.y })
        textMoves.push({ textNodeId: n.id, before, after, persist })
      }
    }

    if (cardMoves.length === 0 && textMoves.length === 0) return

    setNodes((nds) => nds.map((n) => {
      if (!selectedIds.has(n.id)) return n
      if (n.type !== 'campaignNode' && n.type !== 'textNode') return n
      return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
    }))

    if (cardMoves.length > 0) {
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.MOVE_CARD,
        workspaceId: activeWorkspaceId,
        label: cardMoves.length === 1 ? 'Move card' : `Move ${cardMoves.length} cards`,
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
        label: 'Move text',
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
      setEditingNode({
        node: newNode,
        connectedNodes: [],
        allOtherNodes: nodes.filter((n) => n.type === 'campaignNode'),
        originRect: null,
        topicNodeId: newNode.id,
        position: { x: 0, y: 0 },
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
    setEditingNode(prev => ({
      ...state,
      topicNodeId: nodeId,
      position: repoint && prev ? prev.position : { x: 0, y: 0 },
      isRepoint: repoint,
    }))
    return true
  }, [buildEditingState, setInspectorEditingFlag])

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
    if (!editingNode) return
    if (node.type !== 'campaignNode') return
    if (e.shiftKey || e.metaKey || e.ctrlKey) return
    if (node.id === editingNode.topicNodeId) return
    inspectorCommitRef.current?.()        // commit the outgoing node first
    if (openInspector(node.id, { repoint: true })) {
      track('card_edit_opened', { source: 'repoint', typeKey: node.data?.type })
    }
  }, [editingNode, openInspector])

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
    if (editingNode) {
      if (node.id !== editingNode.topicNodeId) {
        inspectorCommitRef.current?.()
        openInspector(node.id, { repoint: true })
      }
      return
    }
    if (openInspector(node.id)) {
      track('card_edit_opened', { source: 'double_click', typeKey: node.data?.type })
    }
  }, [editingNode, openInspector, setNodes])

  // ── Update node (DB-backed) ─────────────────────────────────────────────
  //
  // Called from EditModal as the user edits. Applies the change optimistically
  // to React state, persists to Supabase in parallel, and handles connection
  // add/remove by updating the DB edges in the background.
  //
  // Connection payloads carry the connection's id (assigned client-side in
  // ConnectionsSection at picker click). EditModal owns the `recordAction`
  // calls for connections — App.jsx just persists. This lets EditModal
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

    // --- Persist core node fields + sections -------------------------------
    const nodeField = {}
    if (updatedData.label !== undefined)   nodeField.label     = updatedData.label
    if (updatedData.summary !== undefined) nodeField.summary   = updatedData.summary
    if (updatedData.avatar !== undefined)  nodeField.avatarUrl = updatedData.avatar
    if (updatedData.type !== undefined) {
      const typeId = useTypeStore.getState().idByKey[updatedData.type]
      if (typeId) nodeField.typeId = typeId
    }
    if (Object.keys(nodeField).length > 0) {
      dbUpdateNode(nodeId, nodeField).catch(console.error)
    }

    const sectionsPatch = {}
    if (updatedData.storyNotes !== undefined) sectionsPatch.storyNotes = updatedData.storyNotes
    if (updatedData.hiddenLore !== undefined) sectionsPatch.hiddenLore = updatedData.hiddenLore
    if (updatedData.dmNotes    !== undefined) sectionsPatch.dmNotes    = updatedData.dmNotes
    if (updatedData.media      !== undefined) sectionsPatch.media      = updatedData.media
    if (Object.keys(sectionsPatch).length > 0) {
      // Sections API replaces all four; fill in any unspecified from current state.
      const current = nodes.find((n) => n.id === nodeId)
      const merged = {
        storyNotes: sectionsPatch.storyNotes ?? current?.data?.storyNotes ?? [],
        hiddenLore: sectionsPatch.hiddenLore ?? current?.data?.hiddenLore ?? [],
        dmNotes:    sectionsPatch.dmNotes    ?? current?.data?.dmNotes    ?? [],
        media:      sectionsPatch.media      ?? current?.data?.media      ?? [],
      }
      dbUpdateNodeSections(nodeId, merged).catch(console.error)
    }

    // --- Connection adds / removes -----------------------------------------
    // EditModal owns the recordAction calls (chronological ordering across
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
      dbCreateConnection({
        id,
        workspaceId: activeWorkspaceId,
        sourceNodeId: nodeId,
        targetNodeId: targetId,
      })
        .then((edge) => {
          setEdges((eds) => (eds.some((e) => e.id === edge.id) ? eds : [...eds, edge]))
        })
        .catch(console.error)
    })
  }, [nodes, edges, activeWorkspaceId, setNodes, setEdges])

  // ── Duplicate (DB-backed) ───────────────────────────────────────────────
  const onDuplicate = useCallback(async (nodeId) => {
    const source = nodes.find((n) => n.id === nodeId)
    if (!source) return

    if (source.type === 'textNode') {
      try {
        const duplicate = await dbCreateTextNode({
          workspaceId:  activeWorkspaceId,
          contentHtml: source.data.text,
          positionX:   source.position.x + 40,
          positionY:   source.position.y + 40,
          width:       source.data.width,
          height:      source.data.height,
          fontSize:    source.data.fontSize,
          align:       source.data.align,
        })
        setNodes((nds) => [...nds, duplicate])
      } catch (err) {
        console.error('Failed to duplicate text node:', err)
      }
      return
    }

    if (source.type !== 'campaignNode') return
    const typeId = useTypeStore.getState().idByKey[source.data.type]
    if (!typeId) {
      console.error(`No type_id for key: ${source.data.type}`)
      return
    }
    try {
      const duplicate = await dbCreateNode({
        workspaceId: activeWorkspaceId,
        typeId,
        typeKey: source.data.type,
        label: source.data.label,
        summary: source.data.summary,
        avatarUrl: source.data.avatar,
        positionX: source.position.x + 40,
        positionY: source.position.y + 40,
        storyNotes: source.data.storyNotes ?? [],
        hiddenLore: source.data.hiddenLore ?? [],
        dmNotes:    source.data.dmNotes    ?? [],
        media:      source.data.media      ?? [],
      })
      setNodes((nds) => [...nds, duplicate])
    } catch (err) {
      console.error('Failed to duplicate card:', err)
    }
  }, [activeWorkspaceId, nodes, setNodes])

  // ── Lock toggle — in-memory only (feature scoped out of V1) ─────────────
  const onLockToggle = useCallback((nodeId) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, locked: !n.data.locked } } : n
      )
    )
  }, [setNodes])

  // ── Delete (DB-backed, cascades to sections + connections) ──────────────
  const onDeleteNode = useCallback((nodeId) => {
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

    // Card delete: snapshot dependents BEFORE the optimistic removal so the
    // inverse can rebuild card + sections + connections (per ADR-0006 §8).
    const snapshot = buildDeleteCardSnapshot(nodeId, {
      nodes,
      edges,
      workspaceId: activeWorkspaceId,
      typeIdByKey: useTypeStore.getState().idByKey,
    })

    // Optimistic removal
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))

    if (snapshot) {
      useUndoStore.getState().recordAction({
        type: ACTION_TYPES.DELETE_CARD,
        workspaceId: activeWorkspaceId,
        label: `Delete "${snapshot.dbCardRow.label || 'card'}"`,
        timestamp: new Date().toISOString(),
        dbCardRow:        snapshot.dbCardRow,
        dbSectionRows:    snapshot.dbSectionRows,
        dbConnectionRows: snapshot.dbConnectionRows,
      })
    }

    track('card_deleted', {
      typeKey: target.data?.type,
      connectionCount: snapshot?.dbConnectionRows?.length ?? 0,
    })

    // Persist; rollback the undo entry if the write fails.
    dbDeleteNode(nodeId).catch((err) => {
      console.error(err)
      if (snapshot) useUndoStore.getState().popLastAction()
    })
  }, [nodes, edges, activeWorkspaceId, setNodes, setEdges])

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
    <CanvasOpsProvider value={{ onDeleteNode }}>
    <div
      style={{ width: '100vw', height: '100vh' }}
      className={isPanning ? 'is-panning' : ''}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
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
        fitView
      >
        <Background color="#1f2937" />
      </ReactFlow>

      <MarqueeRect marquee={marqueeOverlay} rfInstanceRef={rfInstanceRef} />
      <AltitudeRail onZoomTo={onZoomToFromRail} />

      {contextMenu && (() => {
        const node = nodes.find((n) => n.id === contextMenu.nodeId)
        return node ? (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={node}
            onEdit={() => openEdit(contextMenu.nodeId)}
            onDuplicate={() => onDuplicate(contextMenu.nodeId)}
            onLockToggle={() => onLockToggle(contextMenu.nodeId)}
            onDelete={() => onDeleteNode(contextMenu.nodeId)}
            onClose={closeContextMenu}
          />
        ) : null
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

      {editingNode && (
        <EditModal
          key={editingNode.topicNodeId}
          node={editingNode.node}
          connectedNodes={editingNode.connectedNodes}
          allOtherNodes={editingNode.allOtherNodes}
          originRect={editingNode.originRect}
          skipOpenMorph={editingNode.isRepoint}
          position={editingNode.position}
          onPositionChange={(p) =>
            setEditingNode((prev) => (prev ? { ...prev, position: p } : prev))
          }
          commitApiRef={inspectorCommitRef}
          onUpdate={onUpdateNode}
          onClose={() => {
            track('card_edit_closed', { typeKey: editingNode.node.data?.type })
            setNodes(nds => nds.map(n =>
              n.id === editingNode.topicNodeId
                ? { ...n, data: { ...n.data, isEditing: false } }
                : n
            ))
            setEditingNode(null)
          }}
        />
      )}
    </div>
    </CanvasOpsProvider>
    </LightboxProvider>
  )
}
