// ============================================================================
// LineNode — a free-standing straight-line annotation on the canvas.
// ----------------------------------------------------------------------------
// Rendered as a React Flow node whose position is the top-left of the line's
// padded bounding box (see lib/lines.js linePositionFor); the two anchors
// (A, B) live in data as ABSOLUTE canvas coordinates. This node is an
// organization/annotation element — it has no handles, no connections, and
// never participates in the relationship graph.
//
// Interaction model:
//   - The wrapper is pointer-transparent; only the (widened) invisible hit
//     stroke and the endpoint handles receive events. Clicking the stroke
//     selects (React Flow event bubbling); dragging the stroke moves the
//     whole line (App's finalizeDragStop translates both anchors).
//   - When selected, endpoint handles appear at A and B. Dragging a handle
//     re-anchors that endpoint live via CanvasOpsContext (App owns state —
//     the useReactFlow().setNodes footgun rules out mutating from here) and
//     commits one editLine undo entry on release.
//   - Handle + hit geometry counter-scale with zoom so targets stay
//     finger/cursor sized at any altitude.
// ============================================================================

import { useRef } from 'react'
import { useStore } from 'reactflow'
import { LINE_PAD, snapToAxis } from '../lib/lines.js'
import { useCanvasOps } from '../lib/CanvasOpsContext.jsx'

const SELECT_COLOR = '#0284C7'   // system CTA sky-600 (selection accent)

export default function LineNode({ id, data, selected }) {
  const zoom = useStore((s) => s.transform[2])
  const { setLineAnchors, commitLineAnchors } = useCanvasOps()

  const { ax, ay, bx, by, weight, dashed, dashLength, dashGap, color } = data

  const minX = Math.min(ax, bx)
  const minY = Math.min(ay, by)
  const width  = Math.abs(ax - bx) + LINE_PAD * 2
  const height = Math.abs(ay - by) + LINE_PAD * 2

  // Anchor coords relative to the padded box.
  const rA = { x: ax - minX + LINE_PAD, y: ay - minY + LINE_PAD }
  const rB = { x: bx - minX + LINE_PAD, y: by - minY + LINE_PAD }

  // Screen-constant sizes expressed in canvas units.
  const hitWidth     = Math.max(weight + 8, 24 / zoom)
  const handleR      = 7 / zoom
  const handleStroke = 2 / zoom
  const haloWidth    = weight + 6 / zoom

  const dragRef = useRef(null)

  const onHandlePointerDown = (which) => (e) => {
    // Keep React Flow from starting a whole-node drag (belt: nodrag class;
    // suspenders: stopPropagation) and own the gesture via pointer capture.
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      which,
      startScreen: { x: e.clientX, y: e.clientY },
      startAnchors: { ax, ay, bx, by },
      zoom,
      moved: false,
    }
  }

  const onHandlePointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startScreen.x) / d.zoom
    const dy = (e.clientY - d.startScreen.y) / d.zoom
    if (!d.moved && Math.hypot(e.clientX - d.startScreen.x, e.clientY - d.startScreen.y) < 3) return
    d.moved = true
    const next = { ...d.startAnchors }
    if (d.which === 'a') { next.ax = d.startAnchors.ax + dx; next.ay = d.startAnchors.ay + dy }
    else                 { next.bx = d.startAnchors.bx + dx; next.by = d.startAnchors.by + dy }
    // Shift: constrain the dragged endpoint to the four axes through the
    // FIXED endpoint (same rule as drawing — horizontal / vertical / 45°s).
    if (e.shiftKey) {
      if (d.which === 'a') {
        const s = snapToAxis({ x: next.bx, y: next.by }, { x: next.ax, y: next.ay })
        next.ax = s.x; next.ay = s.y
      } else {
        const s = snapToAxis({ x: next.ax, y: next.ay }, { x: next.bx, y: next.by })
        next.bx = s.x; next.by = s.y
      }
    }
    d.lastAnchors = next
    setLineAnchors(id, next)
  }

  const onHandlePointerUp = (e) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (!d.moved || !d.lastAnchors) return
    commitLineAnchors(id, d.startAnchors, d.lastAnchors)
  }

  return (
    <div style={{ width, height, pointerEvents: 'none' }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', display: 'block' }}
      >
        {/* Selection halo (under the visible stroke) */}
        {selected && (
          <line
            x1={rA.x} y1={rA.y} x2={rB.x} y2={rB.y}
            stroke={SELECT_COLOR}
            strokeWidth={haloWidth}
            strokeLinecap="round"
            opacity={0.45}
          />
        )}

        {/* Visible stroke. Cap policy (2026-07-10, matches Figma/Illustrator
            convention): solid = round (soft ends), dashed = BUTT — a round
            cap extends every dash by weight/2 per end, so weight 8 dash 8
            gap 8 rendered as 16-long dashes with no visible gap (read as
            solid). Butt caps make dash/gap literal and independent of
            weight, which then affects thickness ONLY. */}
        <line
          x1={rA.x} y1={rA.y} x2={rB.x} y2={rB.y}
          stroke={color}
          strokeWidth={weight}
          strokeLinecap={dashed ? 'butt' : 'round'}
          strokeDasharray={dashed ? `${dashLength} ${dashGap}` : undefined}
        />

        {/* Invisible widened hit stroke — the ONLY body surface that takes
            pointer events, so clicks/drags land near the line, not anywhere
            in its bounding box. */}
        <line
          x1={rA.x} y1={rA.y} x2={rB.x} y2={rB.y}
          stroke="transparent"
          strokeWidth={hitWidth}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        />

        {/* Endpoint handles (selected only) */}
        {selected && (
          <>
            {[['a', rA], ['b', rB]].map(([which, p]) => (
              <circle
                key={which}
                className="nodrag"
                cx={p.x} cy={p.y} r={handleR}
                fill="#ffffff"
                stroke={SELECT_COLOR}
                strokeWidth={handleStroke}
                style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
                onPointerDown={onHandlePointerDown(which)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerUp}
              />
            ))}
          </>
        )}
      </svg>
    </div>
  )
}
