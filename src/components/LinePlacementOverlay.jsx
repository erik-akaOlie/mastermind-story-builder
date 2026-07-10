// ============================================================================
// LinePlacementOverlay — the "draw a line" interaction mode.
// ----------------------------------------------------------------------------
// Mounted by App while the Line tool is active. A full-viewport overlay owns
// every pointer event for the duration, which (a) makes anchor placement
// unambiguous and (b) keeps the gesture from colliding with marquee-select /
// touch pan-zoom (MB-1) — the canvas simply never sees the pointer.
//
// One state machine serves both input worlds (per Erik's spec, 2026-07-10):
//   - Desktop click-move-click: click anchors A, moving previews the line,
//     a second click anchors B.
//   - Touch (and mouse) drag-draw: press anchors A, dragging previews,
//     lifting anchors B. A stationary tap (< DRAG_MIN px) falls through to
//     the click-move-click path instead of creating a zero-length line.
//   - Shift constrains the line to the four axes through A (horizontal,
//     vertical, both 45° diagonals) — preview and commit alike. Snapping
//     happens in screen space (equivalent to flow space under uniform zoom)
//     so the preview shows exactly what will be committed.
//   - Esc or right-click cancels.
//
// Pan/zoom is intentionally unavailable while the tool is active (first cut);
// screen coords therefore stay valid for the whole gesture and the preview
// can live in plain screen space.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { LINE_DEFAULTS, snapToAxis } from '../lib/lines.js'

const DRAG_MIN = 8   // screen px separating a tap/click from a drag-draw

export default function LinePlacementOverlay({ rfInstanceRef, onComplete, onCancel }) {
  const [a, setA] = useState(null)          // { screen: {x,y}, flow: {x,y} }
  const [cursor, setCursor] = useState(null) // screen {x,y}
  const pressRef = useRef(null)             // down point while deciding tap vs drag
  const zoomRef = useRef(1)

  useEffect(() => {
    zoomRef.current = rfInstanceRef.current?.getViewport()?.zoom ?? 1
  }, [rfInstanceRef])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const toFlow = (x, y) => rfInstanceRef.current.screenToFlowPosition({ x, y })

  // Screen point for B, honoring Shift's axis constraint relative to A.
  const bScreenFor = (e) => {
    const raw = { x: e.clientX, y: e.clientY }
    return e.shiftKey ? snapToAxis(a.screen, raw) : raw
  }

  const complete = (e) => {
    const b = bScreenFor(e)
    const bFlow = toFlow(b.x, b.y)
    onComplete({ ax: a.flow.x, ay: a.flow.y, bx: bFlow.x, by: bFlow.y })
  }

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return  // secondary → contextmenu path
    e.preventDefault()
    if (!a) {
      const screen = { x: e.clientX, y: e.clientY }
      setA({ screen, flow: toFlow(screen.x, screen.y) })
      setCursor(screen)
      pressRef.current = screen
      e.currentTarget.setPointerCapture?.(e.pointerId)
      return
    }
    // Click-move-click mode: the second press anchors B.
    complete(e)
  }

  const onPointerMove = (e) => {
    if (a) setCursor(bScreenFor(e))
  }

  const onPointerUp = (e) => {
    const press = pressRef.current
    pressRef.current = null
    if (!a || !press) return
    // Drag-draw: a real drag between press and lift anchors B at the lift.
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) >= DRAG_MIN) {
      complete(e)
    }
    // Otherwise: stationary tap/click — stay armed, await the second press.
  }

  const zoom = zoomRef.current
  const previewWidth = Math.max(LINE_DEFAULTS.weight * zoom, 1.5)

  return (
    <div
      className="fixed inset-0 z-[9000]"
      style={{ cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => { e.preventDefault(); onCancel() }}
    >
      <svg className="w-full h-full" style={{ display: 'block' }}>
        {a && cursor && (
          <line
            x1={a.screen.x} y1={a.screen.y}
            x2={cursor.x}   y2={cursor.y}
            stroke={LINE_DEFAULTS.color}
            strokeWidth={previewWidth}
            strokeLinecap="round"
            opacity={0.9}
          />
        )}
        {a && (
          <circle cx={a.screen.x} cy={a.screen.y} r={4} fill={LINE_DEFAULTS.color} />
        )}
      </svg>
    </div>
  )
}
