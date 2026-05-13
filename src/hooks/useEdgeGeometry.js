// ============================================================================
// useEdgeGeometry
// ----------------------------------------------------------------------------
// Whenever nodes or edges change, recompute:
//
//   - the spread border points where each edge meets each card (so multiple
//     edges from the same card don't all stack at one spot), and
//   - the connection-dot positions on each card (rendered in HTML for
//     z-stacking, see CampaignNode).
//
// Writes the results back into the React Flow state via the supplied
// setNodes / setEdges. Refs gate writes so we don't fire setState on every
// render — only when the geometry actually changed.
//
// Pure derivation: no DB writes, no side effects beyond the canvas itself.
// ============================================================================

import { useEffect, useRef } from 'react'
import {
  getNodeCenter,
  getSpreadBorderPoints,
  getSpreadCircularPoints,
} from '../utils/edgeRouting'
import { useTypeStore } from '../store/useTypeStore'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import { BEAD_DIAMETER_PX, MIN_CIRCLE_POINT_GAP_PX, CONNECTION_DOT_SCREEN_PX } from '../utils/altitude'

export function useEdgeGeometry({ nodes, edges, setNodes, setEdges }) {
  const prevEdgeGeoRef = useRef('')
  const prevDotsRef    = useRef('')

  // Altitude branches the geometry: 'beadView' uses circular perimeter math
  // against BEAD_DIAMETER_PX, otherwise the existing rectangular math runs.
  // Zoom feeds the min-arc-gap conversion (screen-px → canvas-px), so the
  // on-screen separation stays constant at all zoom levels — same posture
  // as the connection-dot size and bead-border thickness. Both values come
  // from useCanvasUiStore (App.jsx's onMove handler mirrors zoom there)
  // because this hook runs at the App level, outside the <ReactFlow>
  // context, so it can't call React Flow's own viewport hooks.
  const altitude = useCanvasUiStore((s) => s.altitude)
  const zoom     = useCanvasUiStore((s) => s.currentZoom)
  const isBead = altitude === 'beadView'

  useEffect(() => {
    // In bead mode the node's "center" is anchored to BEAD_DIAMETER_PX, not
    // node.width/node.height — those may still be the card's dimensions
    // while React Flow hasn't re-measured the morphed container, and even
    // if they have, the natural angle should be measured against the bead's
    // geometry (the only one visible at this altitude). Same anchoring goes
    // for the connected node, which is also a bead in this altitude.
    const beadHalf = BEAD_DIAMETER_PX / 2
    const centerOf = (node) => isBead
      ? { x: node.position.x + beadHalf, y: node.position.y + beadHalf }
      : getNodeCenter(node)

    const nodeConnections = {}
    nodes.forEach((n) => { nodeConnections[n.id] = [] })

    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const targetNode = nodes.find((n) => n.id === edge.target)
      if (!sourceNode || !targetNode) return

      const sourceCenter = centerOf(sourceNode)
      const targetCenter = centerOf(targetNode)

      nodeConnections[edge.source].push({ id: edge.id, targetCenter })
      nodeConnections[edge.target].push({ id: edge.id, targetCenter: sourceCenter })
    })

    const allBorderPoints = {}
    nodes.forEach((node) => {
      const conns = nodeConnections[node.id] || []
      if (isBead) {
        const center = centerOf(node)
        // Min arc-distance enforced between dot CENTERS = dot diameter + the
        // tunable edge-to-edge padding. Converted from screen-px to canvas-px
        // via 1/zoom so the visible spacing stays constant at every zoom.
        const minScreenCenterToCenter = CONNECTION_DOT_SCREEN_PX + MIN_CIRCLE_POINT_GAP_PX
        const minArcCanvasPx = zoom > 0 ? minScreenCenterToCenter / zoom : minScreenCenterToCenter
        allBorderPoints[node.id] = getSpreadCircularPoints(center, beadHalf, conns, minArcCanvasPx)
      } else {
        allBorderPoints[node.id] = getSpreadBorderPoints(node, conns)
      }
    })

    const newEdgeGeo = {}
    edges.forEach((edge) => {
      const sourcePoint = allBorderPoints[edge.source]?.[edge.id]
      const targetPoint = allBorderPoints[edge.target]?.[edge.id]
      if (!sourcePoint || !targetPoint) return
      newEdgeGeo[edge.id] = { sourcePoint, targetPoint }
    })

    const newDotsMap = {}
    nodes.forEach((node) => {
      const borderPoints = allBorderPoints[node.id] || {}
      newDotsMap[node.id] = Object.entries(borderPoints).map(([edgeId, p]) => {
        const edge = edges.find((e) => e.id === edgeId)
        const otherNodeId = edge?.source === node.id ? edge?.target : edge?.source
        const otherNode = nodes.find((n) => n.id === otherNodeId)
        const color = useTypeStore.getState().types[otherNode?.data?.type]?.color ?? '#94a3b8'
        return {
          x: p.x - node.position.x,
          y: p.y - node.position.y,
          color,
        }
      })
    })

    const edgeGeoJson = JSON.stringify(newEdgeGeo)
    const dotsJson    = JSON.stringify(newDotsMap)

    if (edgeGeoJson !== prevEdgeGeoRef.current) {
      prevEdgeGeoRef.current = edgeGeoJson
      setEdges((eds) =>
        eds.map((edge) => {
          const geo = newEdgeGeo[edge.id]
          if (!geo) return edge
          return { ...edge, type: 'floating', data: { ...edge.data, ...geo } }
        })
      )
    }

    if (dotsJson !== prevDotsRef.current) {
      prevDotsRef.current = dotsJson
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, connectionDots: newDotsMap[n.id] || [] },
        }))
      )
    }
  }, [nodes, edges, isBead, zoom, setEdges, setNodes])
}
