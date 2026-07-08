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

// Per-node write telemetry for setExpandedNode's oscillation circuit-breaker
// (see the comment inside setExpandedNode). id → { count, clears, firstTs }.
// Module-level on purpose: it's diagnostic bookkeeping, not UI state — no
// subscriber should ever re-render off it.
const _expandedLoopDetect = new Map()

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

  // Id of the node a SEARCH RESULT row is currently previewing (hover or
  // keyboard focus in the results drawer), or null. While set, that node is
  // promoted bead→card exactly like a hovered/selected bead — a fourth
  // expansion trigger alongside hover / single-select / edge-highlight
  // (CampaignNode.isExpanded + App's currentlyExpandedIds both include it;
  // keep the two derivations in sync). Presentation-only; cleared on row
  // leave, query change, drawer close, and search exit so it can never
  // stick a card open after search ends.
  searchFocusNodeId: null,

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

  // Expanded-node visual state (per ADR-0010 / Chunk D; generalized to a
  // keyed collection for edge-hover dual-expand, Part B). MORE THAN ONE node
  // can be expanded at once: a single-select / hover expands one, but dwelling
  // on a connection line in Bead View expands BOTH of its endpoint nodes. So
  // this is a Map<nodeId, record> rather than a single slot. Each expanded
  // CampaignNode publishes (and clears) ITS OWN entry by id, so two nodes
  // never contend for one slot. Consumed by useEdgeGeometry, which routes each
  // expanded node's edges to its card's rectangular perimeter at the CLAMPED
  // visible center instead of the bead's circular perimeter at the true center.
  //
  // Per-entry fields:
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
  expandedNodes: new Map(),

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
  // Upsert/clear ONE node's expanded record by id. rec === null removes that
  // id's entry. Always produces a NEW Map on a real change so Zustand's
  // reference-equality check notifies subscribers (useEdgeGeometry). The
  // per-entry equality guard returns {} for a no-op write (same id + same
  // visual geometry) so subscribers don't see spurious updates when
  // CampaignNode republishes its record on every render. Because each node
  // only ever touches its OWN key, clearing one expanded node can never wipe
  // another's geometry.
  setExpandedNode: (id, rec) =>
    set((state) => {
      const cur = state.expandedNodes
      if (rec == null) {
        if (!cur.has(id)) return {}
        // A rapid set→clear→set alternation is a loop too (isExpanded itself
        // flapping) — count clears so the set branch's breaker can name it.
        const dClear = _expandedLoopDetect.get(id)
        if (dClear && Date.now() - dClear.firstTs < 250) dClear.clears += 1
        const next = new Map(cur)
        next.delete(id)
        return { expandedNodes: next }
      }
      // ── Oscillation circuit-breaker (diagnostic + safety) ────────────────
      // A publish→notify→republish cycle where the record's numbers keep
      // CHANGING can nest updates until React throws a generic "maximum
      // update depth" with no clue which value flapped (2026-07-02 mobile
      // white-screen). If one id lands >40 REAL updates inside 250ms:
      // in dev, throw a descriptive error naming the flapping fields and
      // their last two values (the RootErrorBoundary renders it — the
      // device becomes the profiler); in prod, drop the write, which
      // freezes that node's published geometry for a beat but keeps the
      // app alive.
      const now = Date.now()
      const d = _expandedLoopDetect.get(id)
      const inWindow = d && now - d.firstTs < 250
      // Non-finite geometry (NaN/Infinity from a zero-zoom frame or an
      // unhydrated threshold) must never enter the map: NaN breaks every ===
      // equality guard downstream (NaN === NaN is false), which turned each
      // republish into a "real change" and looped render → publish → notify
      // until React threw "maximum update depth" — the 2026-07-02 mobile
      // white-screen. Dropping the write keeps the last good record.
      if (!Number.isFinite(rec.centerX) || !Number.isFinite(rec.centerY) ||
          !Number.isFinite(rec.width) || !Number.isFinite(rec.height) ||
          !Number.isFinite(rec.boxWidth) || !Number.isFinite(rec.boxHeight) ||
          !Number.isFinite(rec.natCenterX) || !Number.isFinite(rec.natCenterY)) {
        return {}
      }
      const prev = cur.get(id)
      // DEADBAND equality, not exact equality. The clamp + repulsion offsets
      // are coupled through re-renders, and floating-point can settle into
      // TWO answers a fraction of a pixel apart — observed on-device
      // 2026-07-02: centerX flapping by 0.31–0.63 canvas units, 41 updates
      // in ~150ms, "maximum update depth" crash. Treating sub-pixel deltas
      // as "no change" starves that loop on its first cycle while letting
      // any real movement (drag/zoom/pan moves are orders of magnitude
      // bigger per frame) through untouched.
      //
      // ε ≈ 0.4% of the published width ≈ 2.7 SCREEN px constant regardless
      // of zoom (width already carries the thresholdZoom/zoom factor).
      // Was 0.2% — an on-device flap of 0.68 canvas units beat that ε by a
      // hair (photo finish: ε computed to ~0.67 for that card), so the
      // margin doubled. Edge endpoints anchoring within ~3px of the card
      // border is imperceptible at Bead View distances. Object.is fallback
      // keeps NaN (impossible past the gate above) from ever reading as a
      // change.
      const eps = Number.isFinite(rec.width) ? Math.max(0.01, rec.width * 0.004) : 0.01
      const near = (a, b) => Object.is(a, b) || Math.abs(a - b) < eps
      if (prev &&
          near(prev.centerX, rec.centerX) && near(prev.centerY, rec.centerY) &&
          near(prev.width, rec.width) && near(prev.height, rec.height) &&
          near(prev.boxWidth, rec.boxWidth) && near(prev.boxHeight, rec.boxHeight) &&
          near(prev.natCenterX, rec.natCenterX) && near(prev.natCenterY, rec.natCenterY)) {
        return {}
      }
      // Real change confirmed — count it, and trip the breaker on a burst.
      if (inWindow) {
        d.count += 1
        if (d.count > 40) {
          const flapping = prev
            ? Object.keys(rec)
                .filter((k) => !Object.is(prev[k], rec[k]))
                .map((k) => `${k}: ${prev[k]} → ${rec[k]}`)
                .join('; ')
            : `record was CLEARED between publishes (${d.clears} clears in window) — isExpanded itself is flapping on/off`
          const msg =
            `[expandedNode oscillation] node ${id}: ${d.count} real geometry ` +
            `updates in ${now - d.firstTs}ms. Flapping → ${flapping}`
          _expandedLoopDetect.delete(id)
          if (import.meta.env.DEV) throw new Error(msg)
          console.error(msg)
          return {} // prod: freeze last good geometry instead of looping
        }
      } else {
        _expandedLoopDetect.set(id, { count: 1, clears: 0, firstTs: now })
      }
      const next = new Map(cur)
      next.set(id, rec)
      return { expandedNodes: next }
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
  setSearchFocusNodeId: (id) =>
    set((state) => state.searchFocusNodeId === id ? {} : { searchFocusNodeId: id }),
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

// Helper for edges: returns true if this edge should render "active" (full
// opacity) rather than dimmed. Active when:
//   - one of its endpoints is hovered (node hover lights all its edges), OR
//   - it IS the hovered edge — BOTH endpoints are in hoveredEdgeNodeIds, OR
//   - one of its endpoints is selected.
// The edge-hover clause requires BOTH endpoints (not either) so that hovering
// a line lights only THAT line, while the other lines coming off its two
// endpoint nodes dim. Edges subscribe to this so they only re-render when
// their own active status flips, not on every unrelated hover event.
export function selectIsEdgeActive(sourceId, targetId) {
  return (state) => {
    const { hoveredNodeId, hoveredEdgeNodeIds, selectedNodeIds } = state
    if (hoveredNodeId === sourceId || hoveredNodeId === targetId) return true
    if (hoveredEdgeNodeIds?.has(sourceId) && hoveredEdgeNodeIds?.has(targetId)) return true
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
