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
// ============================================================================

import { useCallback } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'

export function useNodeHoverSelection() {
  const setAnySelected = useCanvasUiStore((s) => s.setAnySelected)
  const setAnyHovered  = useCanvasUiStore((s) => s.setAnyHovered)
  const setHoveredNodeId = useCanvasUiStore((s) => s.setHoveredNodeId)
  const setHoveredEdgeNodeIds = useCanvasUiStore((s) => s.setHoveredEdgeNodeIds)
  const setSelectedNodeIds = useCanvasUiStore((s) => s.setSelectedNodeIds)

  const onSelectionChange = useCallback(({ nodes: selected }) => {
    setAnySelected(selected.length > 0)
    setSelectedNodeIds(new Set(selected.map((n) => n.id)))
  }, [setAnySelected, setSelectedNodeIds])

  const onNodeMouseEnter = useCallback((_event, node) => {
    setAnyHovered(true)
    setHoveredNodeId(node?.id ?? null)
  }, [setAnyHovered, setHoveredNodeId])

  const onNodeMouseLeave = useCallback(() => {
    setAnyHovered(false)
    setHoveredNodeId(null)
  }, [setAnyHovered, setHoveredNodeId])

  const onEdgeMouseEnter = useCallback((_event, edge) => {
    setHoveredEdgeNodeIds(new Set([edge.source, edge.target]))
  }, [setHoveredEdgeNodeIds])

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeNodeIds(null)
  }, [setHoveredEdgeNodeIds])

  return {
    onSelectionChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  }
}
