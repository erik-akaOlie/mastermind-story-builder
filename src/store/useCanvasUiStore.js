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
