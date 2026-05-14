// ============================================================================
// AltitudeRail
// ----------------------------------------------------------------------------
// Viewport-relative semantic-altitude instrument. Lives on the left edge of
// the canvas; always present but visually quiet at rest. Reads navigation
// state from useCanvasUiStore and the threshold helpers in altitude.js —
// never owns any of that state, and never reaches into the morph machinery.
//
// Phase 1: structural scaffolding + click-to-zoom interaction.
// Phase 2 (this update): log-scale normalization + threshold marker +
//   Card View segment overlay.
//   - Normalization is in log space so doubling the zoom moves the same
//     visual distance regardless of starting zoom — matches how zoom is
//     perceptually experienced.
//   - Threshold marker (currentThresholdZoom from the store-resident
//     thresholdGridGapMm) shown as a horizontal tick across the track.
//   - Card View segment overlay highlights [threshold, maxZoom] —
//     the zoom range in which cards (not beads) render.
//   - Visual states still NOT differentiated yet (Phase 3).
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
import { DEFAULT_MAX_ZOOM, currentThresholdZoom } from '../utils/altitude'

// Container & track dimensions (canvas-overlay coordinate space).
const CONTAINER_WIDTH_PX = 64                              // 8 × 8 (hover hit area)
const RAIL_HEIGHT_CSS    = 'clamp(360px, 65vh, 720px)'      // 360 / 720 both ÷ 8
const TRACK_LEFT_PX      = 24                              // 8 × 3 (distance from viewport edge in expanded state)
const TRACK_WIDTH_PX     = 8                               // 8 × 1
const CURRENT_MARKER_W   = 24                              // 8 × 3 (placeholder; refined Phase 3)
const CURRENT_MARKER_H   = 8                               // 8 × 1
const CARDVIEW_SEG_W     = 16                              // 8 × 2 (wider than track; overlay highlight)
const THRESHOLD_MARKER_W = 24                              // 8 × 3 (matches CURRENT_MARKER_W rhythm)
const THRESHOLD_MARKER_H = 4                               // ÷ 4: visibly a tick rather than a slab; 8 would read as heavy

// Log-scale normalization. The rail's vertical extent maps to log(zoom),
// so doubling zoom moves the same visual distance everywhere on the rail.
// Top of rail = full zoom OUT (minZoom). Bottom = full zoom IN (maxZoom).
function normalizeLog(zoom, minZoom, maxZoom) {
  if (!(maxZoom > minZoom) || !(zoom > 0) || !(minZoom > 0)) return 0
  const t = (Math.log(zoom) - Math.log(minZoom)) / (Math.log(maxZoom) - Math.log(minZoom))
  return Math.max(0, Math.min(1, t))
}
function denormalizeLog(t, minZoom, maxZoom) {
  if (!(maxZoom > minZoom) || !(minZoom > 0)) return minZoom
  const clamped = Math.max(0, Math.min(1, t))
  return Math.exp(Math.log(minZoom) + clamped * (Math.log(maxZoom) - Math.log(minZoom)))
}

export default function AltitudeRail({ onZoomTo }) {
  const currentZoom  = useCanvasUiStore((s) => s.currentZoom)
  const minZoom      = useCanvasUiStore((s) => s.dynamicMinZoom)
  const thresholdMm  = useCanvasUiStore((s) => s.thresholdGridGapMm)
  const maxZoom      = DEFAULT_MAX_ZOOM
  const thresholdZ   = currentThresholdZoom(thresholdMm)

  const trackRef = useRef(null)
  const handleClick = (event) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const t = (event.clientY - rect.top) / rect.height
    const targetZoom = denormalizeLog(t, minZoom, maxZoom)
    onZoomTo?.(targetZoom)
  }

  // Positions in [0, 1] — 0 = top of rail, 1 = bottom.
  const posCurrent   = normalizeLog(currentZoom, minZoom, maxZoom)
  const posThreshold = normalizeLog(thresholdZ,  minZoom, maxZoom)

  // Card View segment spans [threshold, maxZoom]. In log-normalized
  // space that's [posThreshold, 1]. Top edge sits at posThreshold;
  // height is the remaining fraction. Expressed as percentages so the
  // segment scales with the rail's CSS-driven height.
  const segmentTopPct    = posThreshold * 100
  const segmentHeightPct = (1 - posThreshold) * 100

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
          left:    TRACK_LEFT_PX,
          top:     0,
          width:   TRACK_WIDTH_PX,
          height:  '100%',
          opacity: 0.45,
        }}
        onClick={handleClick}
        aria-label="Altitude rail — click to jump zoom"
      />

      {/* Card View segment — overlay highlighting [threshold, maxZoom].
          Wider than the underlying track; rounded. Sits ON the track
          and ABOVE the current-zoom marker would be confusing, so this
          element is rendered BEFORE the current marker in DOM order
          (= behind it in the natural stacking). */}
      <div
        className="absolute rounded-full pointer-events-none bg-gray-200"
        style={{
          left:    TRACK_LEFT_PX + TRACK_WIDTH_PX / 2 - CARDVIEW_SEG_W / 2,
          top:     `${segmentTopPct}%`,
          width:   CARDVIEW_SEG_W,
          height:  `${segmentHeightPct}%`,
          opacity: 0.35,
        }}
      />

      {/* Threshold tick — the boundary between Card View and Bead View.
          Centered on posThreshold. */}
      <div
        className="absolute pointer-events-none rounded-sm bg-gray-200"
        style={{
          left:    TRACK_LEFT_PX + TRACK_WIDTH_PX / 2 - THRESHOLD_MARKER_W / 2,
          top:     `calc(${posThreshold * 100}% - ${THRESHOLD_MARKER_H / 2}px)`,
          width:   THRESHOLD_MARKER_W,
          height:  THRESHOLD_MARKER_H,
          opacity: 0.75,
        }}
      />

      {/* Current-zoom marker — the user's position on the rail. Last
          in DOM order so it sits visually above the segment + tick. */}
      <div
        className="absolute pointer-events-none rounded-full bg-white"
        style={{
          left:    TRACK_LEFT_PX + TRACK_WIDTH_PX / 2 - CURRENT_MARKER_W / 2,
          top:     `calc(${posCurrent * 100}% - ${CURRENT_MARKER_H / 2}px)`,
          width:   CURRENT_MARKER_W,
          height:  CURRENT_MARKER_H,
          opacity: 0.9,
        }}
      />
    </div>
  )
}
