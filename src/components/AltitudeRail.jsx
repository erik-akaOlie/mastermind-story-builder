// ============================================================================
// AltitudeRail
// ----------------------------------------------------------------------------
// Viewport-relative semantic-altitude instrument. Lives on the left edge of
// the canvas; always present but visually quiet at rest. Reads navigation
// state from useCanvasUiStore and the threshold helpers in altitude.js —
// never owns any of that state, and never reaches into the morph machinery.
//
// Phase 1 (this file): structural scaffolding + click-to-zoom interaction.
//   - Container at left edge, vertically centered, height clamp(360, 65vh, 720).
//   - Thin vertical track, click-anywhere-to-zoom hit area.
//   - Current-zoom marker that tracks `currentZoom`.
//   - Linear normalization placeholder (Phase 2 swaps to log).
//   - Two visual states are NOT differentiated yet (Phase 3).
//   - Threshold marker and Card View segment NOT drawn yet (Phase 2).
//
// Hover hit area is the outer container (wider than the visible track) so
// that even when Phase 3 tucks the visible content toward the edge, the
// user's cursor catches it without precision aiming.
//
// Sizing follows the 8 px grid as the default; sub-grid values are
// annotated inline.
// ============================================================================

import { useRef } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import { DEFAULT_MAX_ZOOM } from '../utils/altitude'

// Container & track dimensions (canvas-overlay coordinate space).
const CONTAINER_WIDTH_PX = 64                              // 8 × 8 (hover hit area)
const RAIL_HEIGHT_CSS    = 'clamp(360px, 65vh, 720px)'      // 360 / 720 both ÷ 8
const TRACK_LEFT_PX      = 24                              // 8 × 3 (distance from viewport edge in expanded state)
const TRACK_WIDTH_PX     = 8                               // 8 × 1
const CURRENT_MARKER_W   = 24                              // 8 × 3 (placeholder; refined Phase 3)
const CURRENT_MARKER_H   = 8                               // 8 × 1

export default function AltitudeRail({ onZoomTo }) {
  const currentZoom = useCanvasUiStore((s) => s.currentZoom)
  const minZoom     = useCanvasUiStore((s) => s.dynamicMinZoom)
  const maxZoom     = DEFAULT_MAX_ZOOM

  // Phase 1: linear normalization. Phase 2 swaps to log scale so that
  // doubling the zoom moves the same visual distance regardless of
  // starting zoom — matching how zoom is perceptually experienced.
  const normalize = (z) => {
    if (maxZoom <= minZoom) return 0
    return Math.max(0, Math.min(1, (z - minZoom) / (maxZoom - minZoom)))
  }
  const denormalize = (t) => {
    const clamped = Math.max(0, Math.min(1, t))
    return minZoom + clamped * (maxZoom - minZoom)
  }

  const trackRef = useRef(null)
  const handleClick = (event) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const t = (event.clientY - rect.top) / rect.height
    const targetZoom = denormalize(t)
    onZoomTo?.(targetZoom)
  }

  const posCurrent = normalize(currentZoom)

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width:  CONTAINER_WIDTH_PX,
        height: RAIL_HEIGHT_CSS,
        zIndex: 5,
      }}
    >
      {/* Vertical track — the clickable rail itself. */}
      <div
        ref={trackRef}
        className="absolute rounded-full pointer-events-auto cursor-pointer bg-gray-400"
        style={{
          left:   TRACK_LEFT_PX,
          top:    0,
          width:  TRACK_WIDTH_PX,
          height: '100%',
          opacity: 0.45,
        }}
        onClick={handleClick}
        aria-label="Altitude rail — click to jump zoom"
      />

      {/* Current-zoom marker. Translates by half its own size so its
          centre lands on `posCurrent`, not its top edge. */}
      <div
        className="absolute pointer-events-none rounded-full bg-white"
        style={{
          // Centre horizontally on the track:
          //   left = TRACK_LEFT_PX + TRACK_WIDTH_PX/2 - CURRENT_MARKER_W/2
          //        = 24 + 4 - 12 = 16  (÷ 8 ✓)
          left:    TRACK_LEFT_PX + TRACK_WIDTH_PX / 2 - CURRENT_MARKER_W / 2,
          top:     `calc(${posCurrent * 100}% - ${CURRENT_MARKER_H / 2}px)`,
          width:   CURRENT_MARKER_W,
          height:  CURRENT_MARKER_H,
          opacity: 0.85,
        }}
      />
    </div>
  )
}
