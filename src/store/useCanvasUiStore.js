// ============================================================================
// useCanvasUiStore
// ----------------------------------------------------------------------------
// Tiny Zustand store for transient canvas UI flags that every card and edge
// reads but never writes directly:
//
//   - anySelected        — is anything in the canvas currently selected?
//   - anyHovered         — is the user hovering any card right now?
//   - hoveredNodeId      — which specific card is hovered (null when none)?
//   - hoveredEdgeNodeIds — which two node ids are at the ends of the
//                          currently-hovered edge (or null when no edge is
//                          hovered)?
//   - selectedNodeIds    — the set of currently-selected node ids; mirrors
//                          React Flow's selection so edges can know whether
//                          one of their endpoints is selected without
//                          subscribing to the full nodes array.
//   - altitude           — current canvas altitude (Card View vs Bead View
//                          per ADR-0010). Discrete value; transitions are
//                          event-driven (the trigger in App.jsx writes only
//                          on actual mode changes, never on every zoom tick).
//                          Future altitude visualizations plug in as
//                          additional values.
//   - morphPhase         — null | 'out' | 'in'. Two-phase signal for the
//                          connection-line fade across the card↔bead morph:
//                          App.jsx flips to 'out' at altitude transition
//                          (edges fade to 0 over half the morph window),
//                          then to 'in' at half-time (edges fade back to
//                          their resting opacity over the other half), then
//                          to null. Cards don't read this — they react to
//                          `altitude` directly via plain CSS transitions.
//                          App.jsx is the only writer.
//
// Why a store instead of pushing these into each node's `data`: the previous
// approach called setNodes((nds) => nds.map(...)) on every hover event, which
// rewrote every card's data object and forced React Flow to re-render every
// card on every hover. Tolerable at 10 cards, unusable at 500. With this
// store, a hover event mutates one atomic value and only cards/edges whose
// computed derived value actually changes re-render.
// ============================================================================

import { create } from 'zustand'

const EMPTY_SET = new Set()

export const useCanvasUiStore = create((set) => ({
  anySelected: false,
  anyHovered:  false,
  hoveredNodeId: null,
  // Set of node ids — null when no edge is hovered. Using a Set means callers
  // can do O(1) `has(id)` lookups inside their selectors.
  hoveredEdgeNodeIds: null,
  // Set of selected node ids; updated from React Flow's onSelectionChange.
  // Empty Set when nothing is selected (not null — keeps `.has(id)` calls safe).
  selectedNodeIds: EMPTY_SET,

  // Canvas altitude. 'cardView' at normal zoom; 'beadView' below the grid-gap
  // threshold (see src/utils/altitude.js). Discrete by design — never holds
  // the raw zoom value. The trigger in App.jsx's onMove handler computes the
  // next altitude and calls setAltitude only on actual transitions, so
  // subscribers re-render exactly at altitude changes.
  altitude: 'cardView',

  // Connection-line fade phase across the card↔bead morph: 'out' during the
  // first half of MORPH_DURATION_MS, 'in' during the second half, null at
  // rest. FloatingEdge reads this; cards do not.
  morphPhase: null,

  // Per-node morph phase map for Chunk D's hover-expand transitions. Keyed
  // by node id, value is 'out' | 'in'. App.jsx writes here when expansion
  // changes (a new node expands or an old one collapses); FloatingEdge
  // reads to fade only the edges whose endpoints are mid-morph. Distinct
  // from the global morphPhase so a local hover-expand doesn't ripple
  // unrelated lines across the whole canvas. Always a NEW Map instance on
  // any update — Zustand uses reference equality to detect change.
  nodeMorphPhases: new Map(),

  // Id of the node currently being dragged, or null. Set by App.jsx in
  // onNodeDragStart, cleared in onNodeDragStop. CampaignNode subscribes so
  // it can freeze its hover-expand clamp offset for the duration of the
  // drag — preserves cursor attachment to the visible expanded card while
  // RF moves the bead's true canvas position underneath. The clamp offset
  // is never written into node.position; it remains a presentation-layer-
  // only translate.
  draggingNodeId: null,

  // Grid-dot spacing (in mm of on-screen distance) at which the Card↔Bead
  // morph triggers. Per ADR-0010 (2026-05-12 addendum) the production
  // default is 2.65mm ≈ zoom 0.5. Lives in state — not as a const —
  // because the eventual altitude rail (BACKLOG) lets the user drag the
  // semantic boundary along the navigable zoom spectrum. App.jsx's onMove
  // and CampaignNode read this value; both currentThresholdZoom() and
  // nextAltitude() accept it as a parameter so a future test or rail
  // gesture can drive them without touching the constant in altitude.js.
  thresholdGridGapMm: 2.65,

  // Dynamic React Flow minZoom value, derived from the bounding box of
  // all canvas content (see computeMinZoom). Lives in the store because
  // it's general navigation state — multiple consumers read it:
  //   - App.jsx passes it to <ReactFlow> as the minZoom prop.
  //   - AltitudeRail uses it for the rail's lower bound when normalizing
  //     positions for the current-zoom + threshold markers.
  // Default = DEFAULT_MIN_ZOOM (0.5) until the first computeMinZoom run.
  dynamicMinZoom: 0.5,

  // Expanded-node visual state (per ADR-0010 / Chunk D). Only one node can be
  // expanded at a time (hover or single-select in Bead View), so a single
  // record suffices instead of a Map. Published by the expanded CampaignNode
  // each render; consumed by useEdgeGeometry to route the expanded node's
  // edges to the card's rectangular perimeter at its CLAMPED visible center
  // instead of the bead's circular perimeter at the true canvas center.
  //
  // Fields:
  //   id                 — the node's id, or null when nothing is expanded
  //   centerX/Y          — canvas-units. The bead's true center plus the
  //                        canvas-unit equivalent of the screen-px clamp
  //                        offset (clampDx/zoom, clampDy/zoom). Pure visual
  //                        position; never reflects node.position.
  //   width/height       — canvas-units. The expanded card's effective
  //                        on-canvas visible size, = (cardWidth ×
  //                        thresholdZoom / zoom, contentHeight ×
  //                        thresholdZoom / zoom). useEdgeGeometry routes
  //                        edges against this rectangle.
  //   boxWidth/boxHeight — canvas-units. The container's CSS layout-box
  //                        size BEFORE the counter-scale transform. Equal
  //                        to (cardWidth, contentHeight). useEdgeGeometry
  //                        needs both the visible size AND the box size to
  //                        invert the container's transform when computing
  //                        dot CSS local positions.
  expandedNode: null,

  // Current React Flow viewport state — written by App.jsx's onMove handler
  // (the same one that drives the altitude trigger). Stored here because
  // useEdgeGeometry and hover-expanded CampaignNodes both need to read
  // viewport state at the App-component level, which lives OUTSIDE the
  // <ReactFlow> context — React Flow's own viewport hooks fail there and
  // crash the render.
  //
  // currentZoom feeds:
  //   - useEdgeGeometry's bead-mode min-arc-gap conversion (screen-px →
  //     canvas-px)
  //   - the counter-scale that hover-expanded cards apply in Bead View
  //     (Chunk D)
  //
  // currentPanX / currentPanY feed:
  //   - the viewport-clamp computation for hover-expanded cards near the
  //     edges of the visible area (Chunk D)
  currentZoom: 1,
  currentPanX: 0,
  currentPanY: 0,

  setAnySelected: (v) => set({ anySelected: v }),
  setAnyHovered:  (v) => set({ anyHovered: v }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
  setHoveredEdgeNodeIds: (ids) => set({ hoveredEdgeNodeIds: ids }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids ?? EMPTY_SET }),
  // Equality guard: a no-op write returns {} which Zustand treats as no
  // change, so subscribers don't see a spurious update if a caller hands us
  // the same value we already hold.
  setAltitude: (altitude) =>
    set((state) => state.altitude === altitude ? {} : { altitude }),
  setMorphPhase: (morphPhase) =>
    set((state) => state.morphPhase === morphPhase ? {} : { morphPhase }),
  setCurrentZoom: (currentZoom) =>
    set((state) => state.currentZoom === currentZoom ? {} : { currentZoom }),
  // Atomic pan update; equality guard skips the set() when neither axis
  // moved (e.g., a pure zoom gesture that didn't shift the viewport).
  setCurrentPan: (x, y) =>
    set((state) =>
      state.currentPanX === x && state.currentPanY === y
        ? {}
        : { currentPanX: x, currentPanY: y }
    ),
  // Equality guard compares each field — a no-op write (same id + same
  // visual position) returns {} so subscribers don't see spurious updates
  // when CampaignNode publishes the expanded record on every render.
  setExpandedNode: (rec) =>
    set((state) => {
      const cur = state.expandedNode
      if (rec === null && cur === null) return {}
      if (rec && cur &&
          cur.id === rec.id &&
          cur.centerX === rec.centerX && cur.centerY === rec.centerY &&
          cur.width === rec.width && cur.height === rec.height &&
          cur.boxWidth === rec.boxWidth && cur.boxHeight === rec.boxHeight) {
        return {}
      }
      return { expandedNode: rec }
    }),
  // Per-node morph signal API.
  //   setNodeMorphPhase(id, phase) — phase is 'out' | 'in' | null
  // Always creates a new Map so Zustand subscribers see the change.
  // Equality guard skips the write when the requested value is already
  // present (covers the common no-op case during repeated effect runs).
  setNodeMorphPhase: (id, phase) =>
    set((state) => {
      const cur = state.nodeMorphPhases
      const has = cur.has(id)
      if (phase == null) {
        if (!has) return {}
        const next = new Map(cur)
        next.delete(id)
        return { nodeMorphPhases: next }
      }
      if (cur.get(id) === phase) return {}
      const next = new Map(cur)
      next.set(id, phase)
      return { nodeMorphPhases: next }
    }),
  setDraggingNodeId: (id) =>
    set((state) => state.draggingNodeId === id ? {} : { draggingNodeId: id }),
  setThresholdGridGapMm: (mm) =>
    set((state) => state.thresholdGridGapMm === mm ? {} : { thresholdGridGapMm: mm }),
  setDynamicMinZoom: (z) =>
    set((state) => state.dynamicMinZoom === z ? {} : { dynamicMinZoom: z }),

  // Clear all hover-derived state in one shot. Called when the user enters
  // spacebar pan mode so a card that happens to be lit up underneath the
  // cursor doesn't stay glowing while the camera pans around it.
  clearHover: () => set({ anyHovered: false, hoveredNodeId: null, hoveredEdgeNodeIds: null }),
}))

// Helper: returns true if the given node id is one of the two endpoints of
// the currently-hovered edge. Cards subscribe to this for their highlight
// state, and the selector only triggers a re-render when the boolean flips.
export function selectIsEdgeHighlighted(nodeId) {
  return (state) => state.hoveredEdgeNodeIds?.has(nodeId) ?? false
}

// Helper for edges: returns true if either of the edge's endpoints is
// currently "active" — hovered, selected, or part of a hovered edge.
// Edges subscribe to this so they only re-render when their own active
// status flips, not on every unrelated hover event.
export function selectIsEdgeActive(sourceId, targetId) {
  return (state) => {
    const { hoveredNodeId, hoveredEdgeNodeIds, selectedNodeIds } = state
    if (hoveredNodeId === sourceId || hoveredNodeId === targetId) return true
    if (hoveredEdgeNodeIds?.has(sourceId) || hoveredEdgeNodeIds?.has(targetId)) return true
    if (selectedNodeIds?.has(sourceId) || selectedNodeIds?.has(targetId)) return true
    return false
  }
}

// True when SOMETHING on the canvas is currently active (hovered, edge-hovered,
// or selected). Used by edges to decide between "rest" (full opacity) and
// "dim" (faded because something else is the focus).
export function selectAnythingActive(state) {
  return (
    state.hoveredNodeId !== null ||
    state.hoveredEdgeNodeIds !== null ||
    (state.selectedNodeIds?.size ?? 0) > 0
  )
}

export { EMPTY_SET }
