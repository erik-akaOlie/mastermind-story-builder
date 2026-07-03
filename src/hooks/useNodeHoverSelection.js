// ============================================================================
// useNodeHoverSelection
// ----------------------------------------------------------------------------
// Returns the four ReactFlow event handlers that drive transient hover /
// selection UI: which card is hovered, which edge is hovered, and whether
// anything is selected. State lives in useCanvasUiStore so a hover event
// mutates one atomic value rather than rewriting every node's data field.
//
// The visual bumps that used to be applied via setEdges (opacity + stroke
// width on hover) are now derived inside FloatingEdge from the same store
// state, so the hover handlers don't need to mutate the edges array at all.
// That fixes a subtle bug where setting style.opacity=undefined on every
// edge during onEdgeMouseLeave silently overrode FloatingEdge's computed
// opacity through the React props spread, and edges stopped dimming after
// the user had hovered any edge once.
//
// NOTE: EDGE hover (onEdgeMouseEnter/Leave) moved OUT of this hook into
// useEdgeHoverSession — edge hover now drives a stabilized "session" rather
// than a raw store write, and that logic belongs in one place. This hook now
// owns node hover + selection only.
// ============================================================================

import { useCallback } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import { useTouchPrimary } from './useTouchPrimary'

export function useNodeHoverSelection() {
  const setAnySelected = useCanvasUiStore((s) => s.setAnySelected)
  const setAnyHovered  = useCanvasUiStore((s) => s.setAnyHovered)
  const setHoveredNodeId = useCanvasUiStore((s) => s.setHoveredNodeId)
  const setSelectedNodeIds = useCanvasUiStore((s) => s.setSelectedNodeIds)
  // A phone has no hover — but taps SYNTHESIZE mouseenter/leave events, and
  // the browser re-dispatches them whenever an element MOVES under the last
  // touch point. A bead near the viewport edge expands → the clamp shifts
  // the card away from the tap point → "hover" flips to whatever is under
  // it now → expansion churns → geometry republish loop (the 2026-07-02
  // mobile "maximum update depth" crash, root cause identified by Erik:
  // near-edge beads + fast taps). On touch-primary devices hover writes are
  // no-ops; bead expansion is driven by SELECTION alone, which taps set
  // deterministically.
  const touchPrimary = useTouchPrimary()

  const onSelectionChange = useCallback(({ nodes: selected }) => {
    setAnySelected(selected.length > 0)
    setSelectedNodeIds(new Set(selected.map((n) => n.id)))
  }, [setAnySelected, setSelectedNodeIds])

  const onNodeMouseEnter = useCallback((_event, node) => {
    if (touchPrimary) return
    setAnyHovered(true)
    setHoveredNodeId(node?.id ?? null)
  }, [setAnyHovered, setHoveredNodeId, touchPrimary])

  const onNodeMouseLeave = useCallback(() => {
    if (touchPrimary) return
    setAnyHovered(false)
    setHoveredNodeId(null)
  }, [setAnyHovered, setHoveredNodeId, touchPrimary])

  return {
    onSelectionChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
  }
}
