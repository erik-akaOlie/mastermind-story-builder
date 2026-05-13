// ============================================================================
// altitude.js — Card View ↔ Bead View threshold logic
// ----------------------------------------------------------------------------
// Pure math + state-transition helpers for the canvas's altitude axis (per
// ADR-0010, 2026-05-12 addendum). The "altitude" of the canvas refers to how
// much detail is being disclosed at the current zoom level:
//
//   - Card View   — cards render in full (title, type band, body, etc.)
//   - Bead View   — cards collapse to circular beads for structural overview
//
// Future altitude visualizations (minimap, semantic clustering, focus+context)
// plug into the same axis as additional values. The axis name and value names
// are deliberately distinct from "shape" so non-geometric altitudes fit later.
//
// Threshold reasoning (from ADR-0010 addendum):
//
//   - The trigger is grid-dot spacing in millimeters, not raw zoom, because
//     the grid is the canvas-level invariant unaffected by card content,
//     card width, or any per-card variable.
//   - Per the CSS spec, 1 CSS pixel ≈ 1/96 inch, giving a stable nominal
//     conversion from canvas units → CSS px → mm. Actual physical mm varies
//     ±20% across monitors and is acceptable for V1.
//   - Hysteresis (1.15× spread on the return-to-card boundary) prevents
//     trackpad-pinch flicker at the threshold.
// ============================================================================

// Bead View triggers when adjacent grid dots are closer than this on screen.
// Maps to React Flow zoom ≈ 0.5 with React Flow's default 20-unit grid gap,
// which matches the prior static minZoom — the morph activates exactly at the
// old zoom-out wall.
export const MORPH_BELOW_GRID_GAP_MM = 2.65

// Return to Card View requires the gap to rise back above
// MORPH_BELOW_GRID_GAP_MM × this ratio. 15% spread is the documented
// safe value against trackpad-pinch wobble; widen if observation surfaces
// flicker, narrow if return-to-cards feels sluggish.
export const MORPH_HYSTERESIS_RATIO = 1.15

// React Flow <Background /> default gap, in canvas units. If we ever change
// the Background gap prop, this needs to change with it.
export const REACT_FLOW_GRID_GAP_UNITS = 20

// 1 CSS pixel = 1/96 inch (per the CSS spec). 25.4 mm per inch.
const CSS_PX_PER_MM = 96 / 25.4

// On-screen distance between adjacent grid dots, in millimeters, at the given
// React Flow viewport zoom. Pure function — no side effects, no DOM reads.
export function gridGapMmAtZoom(zoom) {
  const gapPx = REACT_FLOW_GRID_GAP_UNITS * zoom
  return gapPx / CSS_PX_PER_MM
}

// Given the current altitude and a viewport zoom, return the altitude the
// canvas should be in. Hysteresis: 'cardView' flips to 'beadView' only when
// the gap drops below the threshold; 'beadView' flips back to 'cardView'
// only when the gap rises above threshold × ratio. Inside the dead-band
// (and at every tick where the current altitude is already correct), the
// input altitude is returned unchanged so callers can no-op cheaply.
export function nextAltitude(currentAltitude, zoom) {
  const mm = gridGapMmAtZoom(zoom)
  if (currentAltitude === 'cardView' && mm < MORPH_BELOW_GRID_GAP_MM) {
    return 'beadView'
  }
  if (currentAltitude === 'beadView' && mm > MORPH_BELOW_GRID_GAP_MM * MORPH_HYSTERESIS_RATIO) {
    return 'cardView'
  }
  return currentAltitude
}

// Human-readable label for a given altitude value. Used by the dev console
// log in Chunk A and may be useful for future debug UI.
export function altitudeLabel(altitude) {
  if (altitude === 'cardView') return 'Card View'
  if (altitude === 'beadView') return 'Bead View'
  return altitude
}
