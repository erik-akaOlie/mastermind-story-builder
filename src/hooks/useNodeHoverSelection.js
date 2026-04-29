// ============================================================================
// useNodeHoverSelection
// ----------------------------------------------------------------------------
// Returns the four ReactFlow event handlers that drive transient hover /
// selection UI: which card is hovered, which edge is hovered, and whether
// anything is selected. State lives in useCanvasUiStore so a hover event
// mutates one atomic value rather than rewriting every node's data field.
//
// Edge hover ALSO bumps the edge's stroke style — that part still requires
// touching the edges array, but it only loops when an edge is hovered or
// un-hovered (rare events), not on every card hover.
// ============================================================================

import { useCallback } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'

export function useNodeHoverSelection({ setEdges }) {
  const setAnySelected = useCanvasUiStore((s) => s.setAnySelected)
  const setAnyHovered  = useCanvasUiStore((s) => s.setAnyHovered)
  const setHoveredEdgeNodeIds = useCanvasUiStore((s) => s.setHoveredEdgeNodeIds)

  const onSelectionChange = useCallback(({ nodes: selected }) => {
    setAnySelected(selected.length > 0)
  }, [setAnySelected])

  const onNodeMouseEnter = useCallback(() => {
    setAnyHovered(true)
  }, [setAnyHovered])

  const onNodeMouseLeave = useCallback(() => {
    setAnyHovered(false)
  }, [setAnyHovered])

  const onEdgeMouseEnter = useCallback((_, edge) => {
    setHoveredEdgeNodeIds(new Set([edge.source, edge.target]))
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edge.id
          ? { ...e, style: { ...e.style, opacity: 1, strokeWidth: 2 } }
          : e
      )
    )
  }, [setEdges, setHoveredEdgeNodeIds])

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeNodeIds(null)
    setEdges((eds) =>
      eds.map((e) => ({ ...e, style: { ...e.style, opacity: undefined, strokeWidth: undefined } }))
    )
  }, [setEdges, setHoveredEdgeNodeIds])

  return {
    onSelectionChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  }
}
