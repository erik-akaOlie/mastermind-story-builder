// ============================================================================
// MarqueeRect
// ----------------------------------------------------------------------------
// Renders the in-flight selection rectangle for useCustomMarquee. Anchored
// in canvas coordinates (so it grows correctly when the canvas pans under
// the cursor) but rendered in fixed screen coordinates (so it sits above
// the canvas without participating in React Flow's transform).
//
// Receives:
//   - marquee: null when no marquee is active, or { sessionRef, current }
//     where sessionRef.current.startCanvas is the anchor in canvas coords
//     and current is the latest cursor screen position.
//   - rfInstanceRef: needed to convert canvas coords back to screen coords
//     each render (the camera may have panned since last paint).
//
// Visual matches React Flow's default selection rectangle: a sky-tinted
// translucent fill with a 1px sky-600 border.
// ============================================================================

export default function MarqueeRect({ marquee, rfInstanceRef }) {
  if (!marquee) return null
  const rf = rfInstanceRef.current
  if (!rf) return null

  const session = marquee.sessionRef.current
  if (!session) return null

  // Re-derive the start point's SCREEN position each render. The canvas-
  // coord anchor is stable; its screen position drifts as the viewport pans.
  const startScreen = rf.flowToScreenPosition(session.startCanvas)
  const current     = marquee.current

  const left   = Math.min(startScreen.x, current.x)
  const top    = Math.min(startScreen.y, current.y)
  const width  = Math.abs(startScreen.x - current.x)
  const height = Math.abs(startScreen.y - current.y)

  return (
    <div
      style={{
        position:        'fixed',
        left,
        top,
        width,
        height,
        border:          '1px solid #0284c7',
        backgroundColor: 'rgba(2, 132, 199, 0.1)',
        pointerEvents:   'none',
        zIndex:          5,
      }}
    />
  )
}
