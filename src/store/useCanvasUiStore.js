// ============================================================================
// useCanvasUiStore
// ----------------------------------------------------------------------------
// Tiny Zustand store for transient canvas UI flags that every card reads but
// no card writes:
//
//   - anySelected      — is anything in the canvas currently selected?
//   - anyHovered       — is the user hovering any card right now?
//   - hoveredEdgeNodeIds — which two node ids are at the ends of the
//                          currently-hovered edge (or null when no edge is
//                          hovered)?
//
// Why a store instead of pushing these into each node's `data`: the previous
// approach called setNodes((nds) => nds.map(...)) on every hover event, which
// rewrote every card's data object and forced React Flow to re-render every
// card on every hover. Tolerable at 10 cards, unusable at 500. With this
// store, a hover event mutates one atomic value and only cards whose computed
// derived value actually changes re-render.
// ============================================================================

import { create } from 'zustand'

const EMPTY_SET = new Set()

export const useCanvasUiStore = create((set) => ({
  anySelected: false,
  anyHovered:  false,
  // Set of node ids — null when no edge is hovered. Using a Set means callers
  // can do O(1) `has(id)` lookups inside their selectors.
  hoveredEdgeNodeIds: null,

  setAnySelected: (v) => set({ anySelected: v }),
  setAnyHovered:  (v) => set({ anyHovered: v }),
  setHoveredEdgeNodeIds: (ids) => set({ hoveredEdgeNodeIds: ids }),
}))

// Helper: returns true if the given node id is one of the two endpoints of
// the currently-hovered edge. Cards subscribe to this for their highlight
// state, and the selector only triggers a re-render when the boolean flips.
export function selectIsEdgeHighlighted(nodeId) {
  return (state) => state.hoveredEdgeNodeIds?.has(nodeId) ?? false
}

export { EMPTY_SET }
