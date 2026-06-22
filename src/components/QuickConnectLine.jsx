// ============================================================================
// QuickConnectLine
// ----------------------------------------------------------------------------
// The in-flight rubber-band line for the quick-connect gesture. Same overlay
// pattern as MarqueeRect: anchored in canvas coordinates (the source card's
// border), rendered in fixed screen coordinates above the canvas, re-derived
// every render so the line stays glued through pans/zooms mid-drag.
//
// The free end follows the cursor; when the cursor is over a VALID drop
// target the end snaps to that card's border instead, previewing exactly
// where the floating edge will land (both ends use the same border-
// intersection math FloatingEdge geometry is built on).
//
// Bead View: a hover-expanded bead's VISIBLE card box differs from its
// layout box (the expansion is a transform — counter-scale + clamp
// translate). useEdgeGeometry solves this by reading the expandedNodes
// records CampaignNode publishes to the store; we do the same here so the
// line anchors to what the user actually sees. (More than one node can be
// expanded at once — edge-hover dual-expand — so we look each up by id.)
//
// Sky-600 (system CTA) while in flight — this is an action-in-progress, not
// a settled connection; it becomes a normal gray edge on release.
// ============================================================================

import { useCanvasUiStore } from '../store/useCanvasUiStore'
import { getBorderIntersection } from '../utils/edgeRouting'

const FALLBACK_W = 256
const FALLBACK_H = 224

// Visible geometry for a node: the published expanded-card record when this
// node is expanded, otherwise its React Flow layout box.
function visibleGeom(node, expandedNodes) {
  const rec = expandedNodes.get(node.id)
  if (rec) {
    return {
      cx: rec.centerX,
      cy: rec.centerY,
      w:  rec.width,
      h:  rec.height,
    }
  }
  const w = node.width || FALLBACK_W
  const h = node.height || FALLBACK_H
  return { cx: node.position.x + w / 2, cy: node.position.y + h / 2, w, h }
}

export default function QuickConnectLine({ quickConnect, rfInstanceRef }) {
  const expandedNodes = useCanvasUiStore((s) => s.expandedNodes)
  if (!quickConnect) return null
  const rf = rfInstanceRef.current
  if (!rf) return null

  const sourceNode = rf.getNode(quickConnect.sourceId)
  if (!sourceNode) return null
  const sourceGeom = visibleGeom(sourceNode, expandedNodes)

  const cursor = quickConnect.cursorScreen
  const cursorFlow = rf.screenToFlowPosition
    ? rf.screenToFlowPosition(cursor)
    : rf.project(cursor)

  // Free end: the cursor — or the target card's border when snapped.
  const targetNode = quickConnect.targetId ? rf.getNode(quickConnect.targetId) : null
  let endScreen = cursor
  let aimFlow = cursorFlow
  if (targetNode) {
    const targetGeom = visibleGeom(targetNode, expandedNodes)
    aimFlow = { x: targetGeom.cx, y: targetGeom.cy }
    const endFlow = getBorderIntersection(
      targetGeom.cx, targetGeom.cy, targetGeom.w, targetGeom.h,
      { x: sourceGeom.cx, y: sourceGeom.cy },
    )
    endScreen = rf.flowToScreenPosition(endFlow)
  }

  // Anchored end: where the line exits the source card, aimed at the free end.
  const startFlow = getBorderIntersection(
    sourceGeom.cx, sourceGeom.cy, sourceGeom.w, sourceGeom.h, aimFlow,
  )
  const startScreen = rf.flowToScreenPosition(startFlow)

  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none', // never block the hit-testing under the cursor
        zIndex: 5,             // matches MarqueeRect's overlay layer
      }}
    >
      <line
        x1={startScreen.x}
        y1={startScreen.y}
        x2={endScreen.x}
        y2={endScreen.y}
        stroke="#0284C7"
        strokeWidth={2}
      />
      {/* End cap: solid when snapped to a valid target, hollow while seeking. */}
      <circle
        cx={endScreen.x}
        cy={endScreen.y}
        r={4}
        fill={targetNode ? '#0284C7' : '#ffffff'}
        stroke="#0284C7"
        strokeWidth={2}
      />
    </svg>
  )
}
