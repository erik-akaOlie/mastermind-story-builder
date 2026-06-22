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
  getNodeSpreadBorderPoints,
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
  const altitude      = useCanvasUiStore((s) => s.altitude)
  const zoom          = useCanvasUiStore((s) => s.currentZoom)
  const expandedNodes = useCanvasUiStore((s) => s.expandedNodes)
  const isBead = altitude === 'beadView'

  useEffect(() => {
    // Per-node "current visible form":
    //   - In Card View, every node renders as a card → rectangular routing.
    //   - In Bead View without expansion, every node renders as a bead →
    //     circular routing.
    //   - In Bead View WITH a hover/select expansion (Chunk D), the expanded
    //     node renders as a card at threshold-size with a viewport-clamp
    //     visual offset — its EDGES should attach to the clamped rectangle's
    //     perimeter, not the underlying bead's circular perimeter. Every
    //     OTHER node stays a bead.
    //
    // We branch per-node, not globally. The form a node renders as drives
    // BOTH where its own outgoing dots sit AND where another node's edges
    // aim (because the OTHER node aims at THIS node's visible center).
    const beadHalf = BEAD_DIAMETER_PX / 2
    const formOf = (node) => {
      const rec = expandedNodes.get(node.id)
      if (rec) {
        return { kind: 'expanded', rect: rec }
      }
      if (isBead) return { kind: 'bead' }
      return { kind: 'card' }
    }
    const centerOf = (node) => {
      const f = formOf(node)
      if (f.kind === 'expanded') return { x: f.rect.centerX, y: f.rect.centerY }
      if (f.kind === 'bead')     return { x: node.position.x + beadHalf, y: node.position.y + beadHalf }
      return getNodeCenter(node)
    }

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

    // Screen-constant dot spacing for the RECTANGULAR spreaders (card +
    // expanded card), mirroring the circular bead spreader: a fixed canvas
    // gap shrinks on screen as you zoom out, so aligned dots visually stack.
    // Convert the same screen-px target the bead branch uses (dot diameter +
    // edge padding) into canvas units via 1/zoom.
    const dotMinGapCanvas = zoom > 0
      ? (CONNECTION_DOT_SCREEN_PX + MIN_CIRCLE_POINT_GAP_PX) / zoom
      : (CONNECTION_DOT_SCREEN_PX + MIN_CIRCLE_POINT_GAP_PX)
    const dotCornerPadCanvas = zoom > 0
      ? CONNECTION_DOT_SCREEN_PX / zoom
      : CONNECTION_DOT_SCREEN_PX

    const allBorderPoints = {}
    nodes.forEach((node) => {
      const conns = nodeConnections[node.id] || []
      const form = formOf(node)
      if (form.kind === 'bead') {
        const center = centerOf(node)
        // Min arc-distance enforced between dot CENTERS = dot diameter + the
        // tunable edge-to-edge padding. Converted from screen-px to canvas-px
        // via 1/zoom so the visible spacing stays constant at every zoom.
        const minScreenCenterToCenter = CONNECTION_DOT_SCREEN_PX + MIN_CIRCLE_POINT_GAP_PX
        const minArcCanvasPx = zoom > 0 ? minScreenCenterToCenter / zoom : minScreenCenterToCenter
        allBorderPoints[node.id] = getSpreadCircularPoints(center, beadHalf, conns, minArcCanvasPx)
      } else if (form.kind === 'expanded') {
        // Rectangular routing against the published clamped center +
        // threshold-zoom effective size from CampaignNode. The raw five-arg
        // form of getSpreadBorderPoints accepts these synthetic values
        // directly — no node-shape adapter needed.
        allBorderPoints[node.id] = getSpreadBorderPoints(
          form.rect.centerX, form.rect.centerY,
          form.rect.width, form.rect.height,
          conns,
          dotMinGapCanvas, dotCornerPadCanvas
        )
      } else {
        allBorderPoints[node.id] = getNodeSpreadBorderPoints(
          node, conns, dotMinGapCanvas, dotCornerPadCanvas
        )
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
      const form = formOf(node)
      // For non-expanded forms, the React Flow node container's layout box
      // top-left is at (node.position.x, node.position.y) with no transform
      // beyond the existing hover-lift scale(1.03). CSS local = canvas - nodePos.
      //
      // For the expanded form, the container has:
      //   - layout box size (boxWidth, boxHeight) in CSS px
      //   - transform: translate(tx, ty) scale(s), with transform-origin at
      //     the box center (boxWidth/2, boxHeight/2)
      //   - tx, ty chosen so the visible center equals (nodePos + halfBead
      //     + clamp), the published rect.center
      // Given a canvas position p, the CSS local position lx, ly is the
      // inverse of the transform composition:
      //   lx = boxWidth/2 + (p.x - rect.centerX) / s
      //   ly = boxHeight/2 + (p.y - rect.centerY) / s
      // We recover s from the published rect: s = rect.width / rect.boxWidth.
      // Hover-lift's 1.03 multiplier is intentionally not modeled here — the
      // resulting ~1.5% radial offset is the V1 fidelity reduction.
      newDotsMap[node.id] = Object.entries(borderPoints).map(([edgeId, p]) => {
        const edge = edges.find((e) => e.id === edgeId)
        const otherNodeId = edge?.source === node.id ? edge?.target : edge?.source
        const otherNode = nodes.find((n) => n.id === otherNodeId)
        const color = useTypeStore.getState().types[otherNode?.data?.type]?.color ?? '#94a3b8'
        if (form.kind === 'expanded' && form.rect.boxWidth > 0) {
          const s = form.rect.width / form.rect.boxWidth
          const lx = form.rect.boxWidth  / 2 + (p.x - form.rect.centerX) / s
          const ly = form.rect.boxHeight / 2 + (p.y - form.rect.centerY) / s
          return { x: lx, y: ly, color }
        }
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
  }, [nodes, edges, isBead, zoom, expandedNodes, setEdges, setNodes])
}
