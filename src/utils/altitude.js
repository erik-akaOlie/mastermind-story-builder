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
// 2.65 → zoom ≈ 0.5 with React Flow's default 20-unit grid gap. With Chunk
// F's dynamic minZoom in place, this no longer matches an external static
// floor — the threshold is purely an "altitude" decision now. ADR-0010
// addendum flags this constant as tunable; revisit after the first
// observation cycle.
export const MORPH_BELOW_GRID_GAP_MM = 2.65

// Return to Card View requires the gap to rise back above
// MORPH_BELOW_GRID_GAP_MM × this ratio. 15% spread is the documented
// safe value against trackpad-pinch wobble; widen if observation surfaces
// flicker, narrow if return-to-cards feels sluggish.
export const MORPH_HYSTERESIS_RATIO = 1.15

// React Flow <Background /> default gap, in canvas units. If we ever change
// the Background gap prop, this needs to change with it.
export const REACT_FLOW_GRID_GAP_UNITS = 20

// ── Bead View visual constants ─────────────────────────────────────────────
// Diameter (canvas-space px) of a bead. Used by CampaignNode for the
// collapsed circular form below the altitude threshold. This is the size
// in canvas units, so the bead shrinks on-screen as the user continues to
// zoom out below the morph threshold (the thumbnail/icon shrink too).
// The bead's border and connection-endpoint dots, by contrast, stay at a
// constant on-screen size — see the inverse-scaling in CampaignNode.
// Tunable.
export const BEAD_DIAMETER_PX = 160

// On-screen thickness of the bead's type-colored border (in CSS px,
// independent of canvas zoom). CampaignNode inverse-scales this against
// the current zoom — at zoom 0.5 the border is 16 canvas-px (= 8 px on
// screen). Capped via the same `compensation` factor used for connection
// dots (5×) so the border doesn't grow unboundedly at deep zoom-out.
export const BEAD_BORDER_SCREEN_PX = 8

// Minimum on-screen arc-distance between adjacent connection-endpoint dots
// on a bead's perimeter (in CSS px, independent of zoom). Per ADR-0010
// addendum. Used by useEdgeGeometry's circular branch to redistribute dots
// when natural angles cluster too tightly. Converted to canvas-px at use
// time by dividing by current zoom.
// On-screen diameter of a connection-endpoint dot, in CSS px. CampaignNode
// inverse-scales it by the zoom `compensation` factor so the dot renders at
// a constant ~8px on screen at every zoom level (matching the bead border).
// useEdgeGeometry's bead-mode branch adds this to MIN_CIRCLE_POINT_GAP_PX
// when computing minimum arc-spacing so the GAP value below describes the
// visible edge-to-edge padding between adjacent dots, not center-to-center.
export const CONNECTION_DOT_SCREEN_PX = 8

// Minimum visible edge-to-edge padding between two adjacent connection dots
// on a bead's perimeter, in CSS px. The spread logic enforces this by
// requiring arc-distance between dot CENTERS to be at least
// (CONNECTION_DOT_SCREEN_PX + MIN_CIRCLE_POINT_GAP_PX), so two dots never
// visually touch. Tunable; bump up for more breathing room.
export const MIN_CIRCLE_POINT_GAP_PX = 4

// Duration of the card↔bead morph (geometry, content cross-fade, connection-
// line fade). Per ADR-0010 the morph is "~200ms" but Erik calibrated 150ms
// during Chunk B planning — feels snappier without sacrificing legibility of
// the transition. Connection lines split the window: fade out 0–75ms, fade
// back in 75–150ms.
export const MORPH_DURATION_MS = 150

// ── Edge-hover session (Part B.1 stabilization) ───────────────────────────
// Constants for the stable "edge-hover session" that owns Bead View dual-
// expand persistence (see useEdgeHoverSession.js). All tunable; Erik tunes
// these by feel in the browser. Grouped here so there's one home for them.

// Dwell on a connection line this long (ms) before it activates a session.
// An intent filter so a glancing pass over a line doesn't pop its cards.
// (Was EDGE_HOVER_DELAY_MS, local to useNodeHoverSelection in Part A.)
export const EDGE_ACTIVATION_DWELL_MS = 200

// Half-width (screen px) of the frozen corridor that keeps a session alive.
// Screen-space constant — unlike React Flow's native interaction band, which
// is set in canvas units and therefore shrinks on screen as you zoom out.
export const EDGE_SESSION_HIT_WIDTH_PX = 24

// Padding (screen px) added around each expanded card rectangle when testing
// whether the cursor is still inside the session's alive region, so the very
// edge of a card isn't a hair-trigger exit.
export const EDGE_SESSION_CARD_PAD_PX = 8

// Grace period (ms) after the cursor leaves the alive region before the
// session collapses — absorbs normal hand jitter without feeling sticky.
export const EDGE_SESSION_EXIT_GRACE_MS = 150

// Pairwise card-repulsion padding, as a fraction of card width: when two
// beads expand into cards close enough to overlap, each is nudged visually so
// a gap of this × card-width opens between them. ~10% of a standard card per
// Erik's spec. Purely presentational — never touches node.position.
export const REPEL_PAD_FRACTION = 0.10

// React Flow per-edge `interactionWidth` (canvas units) — the invisible band
// that ACTIVATES edge hover. Modest bump above RF's default of 20 to make
// thin lines easier to target, especially zoomed out. First-pass aid only:
// widening helps activation but can worsen wrong-edge activation in dense
// graphs, so keep it modest and revisit (Pass 2 = nearest-edge arbitration).
export const EDGE_INTERACTION_WIDTH = 40

// 1 CSS pixel = 1/96 inch (per the CSS spec). 25.4 mm per inch.
const CSS_PX_PER_MM = 96 / 25.4

// On-screen distance between adjacent grid dots, in millimeters, at the given
// React Flow viewport zoom. Pure function — no side effects, no DOM reads.
export function gridGapMmAtZoom(zoom) {
  const gapPx = REACT_FLOW_GRID_GAP_UNITS * zoom
  return gapPx / CSS_PX_PER_MM
}

// Inverse of gridGapMmAtZoom: given a target grid-dot mm spacing, what
// viewport zoom produces it? Derives the threshold zoom from
// MORPH_BELOW_GRID_GAP_MM so Chunk D's hover-expand counter-scale can
// pin the expanded card's screen size to "what cards looked like at the
// threshold." Future-proof for when the threshold becomes user-configurable.
export function zoomAtGridGapMm(mm) {
  return (mm * CSS_PX_PER_MM) / REACT_FLOW_GRID_GAP_UNITS
}

// The zoom value at which the Card→Bead morph triggers, given a threshold
// mm value (default = MORPH_BELOW_GRID_GAP_MM). This is the "minimum
// readable" zoom for cards at the supplied threshold — at lower zooms,
// cards become beads, and hover-expanded cards counter-scale up to this
// size on screen but no larger. Threshold parameterized so the future
// altitude-rail UI can drive it from store state.
export function currentThresholdZoom(thresholdMm = MORPH_BELOW_GRID_GAP_MM) {
  return zoomAtGridGapMm(thresholdMm)
}

// ── Dynamic minZoom (Chunk F, per ADR-0010 addendum) ──────────────────────
// React Flow's static `minZoom = 0.5` is replaced by a per-campaign limit
// that lets the user zoom out far enough that the bounding box of all
// canvas content fills approximately BIRDS_EYE_VIEWPORT_FILL of the visible
// viewport on the more binding axis. As campaigns grow, the floor lowers
// automatically and the Bead View threshold (2.65 mm grid spacing) now
// always sits ABOVE that floor — so beads have visible zoom territory
// without a temp threshold bump.
export const BIRDS_EYE_VIEWPORT_FILL = 0.7

// Default minZoom used as both the upper cap on the dynamic value (we
// never let it rise above this — the user always has at least the legacy
// zoom-out range) and as the fallback for empty / single-node / degenerate
// campaigns.
export const DEFAULT_MIN_ZOOM = 0.5

// Default maxZoom matches React Flow v11's own default. Centralised here
// so the altitude rail (and any future viewport-bounds consumer) reads
// the same value the canvas enforces. If we ever set a non-default
// maxZoom prop on <ReactFlow>, change this too.
export const DEFAULT_MAX_ZOOM = 2.0

// Pure function: given the current nodes array and the viewport dimensions
// in CSS pixels, return the appropriate minZoom value. Caller is responsible
// for gating the call (don't compute during a drag — let the underlying
// data settle first per ADR-0010 addendum).
export function computeMinZoom({ nodes, viewportWidth, viewportHeight }) {
  if (!nodes || nodes.length <= 1) return DEFAULT_MIN_ZOOM
  if (!viewportWidth || !viewportHeight) return DEFAULT_MIN_ZOOM

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    const px = n?.position?.x
    const py = n?.position?.y
    if (typeof px !== 'number' || typeof py !== 'number') continue
    // Card-type nodes morph between forms — React Flow re-measures them as
    // they shrink to beads and grow back, which would shift this bbox and
    // therefore the altitude rail's threshold position on every mode flip.
    // Pin card footprint to the canonical (256, 180) regardless of rendered
    // form so adding / removing nodes is the only thing that changes the
    // graph's logical extent. Text nodes are user-resizable and don't morph,
    // so their measured dimensions stay authoritative.
    const isTextNode = n.type === 'textNode'
    const w = isTextNode
      ? (n.width  ?? n.data?.width  ?? 200)
      : 256
    const h = isTextNode
      ? (n.height ?? n.data?.height ?? 50)
      : 180
    if (px       < minX) minX = px
    if (py       < minY) minY = py
    if (px + w   > maxX) maxX = px + w
    if (py + h   > maxY) maxY = py + h
  }

  const bbW = maxX - minX
  const bbH = maxY - minY
  if (!isFinite(bbW) || !isFinite(bbH) || bbW <= 0 || bbH <= 0) {
    return DEFAULT_MIN_ZOOM
  }

  const zForWidth  = (BIRDS_EYE_VIEWPORT_FILL * viewportWidth)  / bbW
  const zForHeight = (BIRDS_EYE_VIEWPORT_FILL * viewportHeight) / bbH
  // Smaller of the two = the binding axis (the one whose 70% fill is hit
  // first as the user zooms out). Capped at DEFAULT_MIN_ZOOM so we never
  // tighten the floor beyond the legacy 0.5 — small campaigns retain the
  // historical zoom-out range.
  return Math.min(DEFAULT_MIN_ZOOM, Math.min(zForWidth, zForHeight))
}

// Given the current altitude and a viewport zoom, return the altitude the
// canvas should be in. Hysteresis: 'cardView' flips to 'beadView' only when
// the gap drops below the threshold; 'beadView' flips back to 'cardView'
// only when the gap rises above threshold × ratio. Inside the dead-band
// (and at every tick where the current altitude is already correct), the
// input altitude is returned unchanged so callers can no-op cheaply.
//
// The threshold is parameterized (default = MORPH_BELOW_GRID_GAP_MM) so the
// future altitude-rail UI can let the user drag the Card↔Bead boundary
// without changing this function's contract.
export function nextAltitude(currentAltitude, zoom, thresholdMm = MORPH_BELOW_GRID_GAP_MM) {
  const mm = gridGapMmAtZoom(zoom)
  if (currentAltitude === 'cardView' && mm < thresholdMm) {
    return 'beadView'
  }
  if (currentAltitude === 'beadView' && mm > thresholdMm * MORPH_HYSTERESIS_RATIO) {
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
