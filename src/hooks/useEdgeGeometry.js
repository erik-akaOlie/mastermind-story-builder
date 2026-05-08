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
import { getNodeCenter, getSpreadBorderPoints } from '../utils/edgeRouting'
import { useTypeStore } from '../store/useTypeStore'

export function useEdgeGeometry({ nodes, edges, setNodes, setEdges }) {
  const prevEdgeGeoRef = useRef('')
  const prevDotsRef    = useRef('')

  useEffect(() => {
    const nodeConnections = {}
    nodes.forEach((n) => { nodeConnections[n.id] = [] })

    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const targetNode = nodes.find((n) => n.id === edge.target)
      if (!sourceNode || !targetNode) return

      const sourceCenter = getNodeCenter(sourceNode)
      const targetCenter = getNodeCenter(targetNode)

      nodeConnections[edge.source].push({ id: edge.id, targetCenter })
      nodeConnections[edge.target].push({ id: edge.id, targetCenter: sourceCenter })
    })

    const allBorderPoints = {}
    nodes.forEach((node) => {
      allBorderPoints[node.id] = getSpreadBorderPoints(node, nodeConnections[node.id] || [])
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
  }, [nodes, edges, setEdges, setNodes])
}
