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

import { useCallback, useEffect, useRef } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'

// Dwell on a connection line this long before its two endpoint nodes light up.
// An intent filter: without it, sweeping the cursor across a dense graph flashes
// node highlights on every line the pointer grazes. Long enough to require a
// deliberate pause, short enough to feel responsive once parked.
const EDGE_HOVER_DELAY_MS = 200

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

  // 400ms enter-delay so a glancing pass over a line doesn't flash its nodes.
  // The pending timer lives in a ref; each enter cancels any prior timer, and
  // leave cancels + clears immediately (snappy off, deliberate on).
  const edgeHoverTimerRef = useRef(null)

  const onEdgeMouseEnter = useCallback((_event, edge) => {
    if (edgeHoverTimerRef.current) clearTimeout(edgeHoverTimerRef.current)
    const ids = new Set([edge.source, edge.target])
    edgeHoverTimerRef.current = setTimeout(() => {
      edgeHoverTimerRef.current = null
      setHoveredEdgeNodeIds(ids)
    }, EDGE_HOVER_DELAY_MS)
  }, [setHoveredEdgeNodeIds])

  const onEdgeMouseLeave = useCallback(() => {
    if (edgeHoverTimerRef.current) {
      clearTimeout(edgeHoverTimerRef.current)
      edgeHoverTimerRef.current = null
    }
    setHoveredEdgeNodeIds(null)
  }, [setHoveredEdgeNodeIds])

  // Clear a pending enter-timer if the component unmounts mid-dwell.
  useEffect(() => () => {
    if (edgeHoverTimerRef.current) clearTimeout(edgeHoverTimerRef.current)
  }, [])

  return {
    onSelectionChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  }
}
