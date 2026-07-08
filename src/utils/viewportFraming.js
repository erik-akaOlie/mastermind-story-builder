// ============================================================================
// viewportFraming — the virtual framing envelope + entry-viewport math (MB-8)
// ----------------------------------------------------------------------------
// The "envelope" is INTERNAL GEOMETRY ONLY — it is never drawn, never walls
// off panning, and the canvas stays infinite. It exists to answer two
// questions deterministically from node positions alone (no persistence):
//
//   1. Entry framing — what viewport should a workspace open with?
//   2. Zoom-out floor — how far out should the user be able to zoom?
//      (Commit 2 of MB-8; computeMinZoom does not read this yet.)
//
// The envelope rule (Erik's "balloon" model, 2026-07-06): the framed world is
// whichever is bigger —
//   (a) a fixed STARTER ROOM (space for ~15–20 loosely clustered cards)
//       centered on the graph, or
//   (b) the graph's actual bounds plus ENVELOPE_MARGIN_RATIO on each side.
// With one node, (a) wins: lots of breathing room. As the graph grows, the
// empty-to-filled ratio shrinks continuously until the graph outgrows the
// room; from then on (b) wins forever — locked margin, envelope grows with
// the graph. max() of two continuous functions = no pop at the crossover,
// and no node-count thresholds anywhere (bounds-driven by design: framing
// only changes when occupied space changes, which is what the eye sees).
// ============================================================================

// Fixed starter room, in flow-space px. Product anchor: ~5 columns × 4 rows
// of canonical 256×180 cards at loose constellation spacing (~2× card pitch).
// Tunable by feel, like the altitude constants.
export const STARTER_ROOM_WIDTH  = 2560
export const STARTER_ROOM_HEIGHT = 1800

// Margin added to each side of the graph bounds once the graph outgrows the
// starter room (the "locked ratio" of the balloon model). 0.15 = 15% of the
// graph's own size per side.
export const ENVELOPE_MARGIN_RATIO = 0.15

// Horizontal band reserved on desktop for the docked Inspector, in CSS px:
// DOCKED_WIDTH 30rem (480px) + DOCKED_RIGHT 1rem (16px) — see Inspector.jsx.
// Reserved for framing even when the Inspector is closed (Erik's call,
// 2026-07-06): the graph should sit centered in the working area it will
// have once the Inspector docks, so opening it never demands a re-center.
export const RESERVED_INSPECTOR_BAND_PX = 496

// Horizontal band reserved on desktop for the altitude rail (its 64px
// pointer-events container hugs the left edge — see AltitudeRail.jsx).
// Framing insets the work area past it so the leftmost node keeps
// comfortable clearance from the rail instead of tucking under it.
export const RESERVED_RAIL_BAND_PX = 64

// Phone-narrow breakpoint, mirroring useIsNarrowViewport's media query
// (≤ 640px). On narrow viewports the Inspector takes over the whole window,
// so no band is reserved and the graph centers in the full window.
export const NARROW_VIEWPORT_MAX_PX = 640

// Canonical card footprint in flow px. Mirrors computeMinZoom's bbox logic
// (altitude.js): card nodes are pinned to canonical dimensions so the bead
// morph can't wobble the measured extent; text nodes are user-resizable and
// their stored size is authoritative.
const CARD_WIDTH  = 256
const CARD_HEIGHT = 180

// ----------------------------------------------------------------------------
// Bounding box over all nodes, in flow space. Returns null when there are no
// positioned nodes (empty workspace).
// ----------------------------------------------------------------------------
export function graphBounds(nodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let found = false
  for (const n of nodes || []) {
    const px = n?.position?.x
    const py = n?.position?.y
    if (typeof px !== 'number' || typeof py !== 'number') continue
    const isTextNode = n.type === 'textNode'
    const w = isTextNode ? (n.width  ?? n.data?.width  ?? 200) : CARD_WIDTH
    const h = isTextNode ? (n.height ?? n.data?.height ?? 50)  : CARD_HEIGHT
    found = true
    if (px     < minX) minX = px
    if (py     < minY) minY = py
    if (px + w > maxX) maxX = px + w
    if (py + h > maxY) maxY = py + h
  }
  if (!found) return null
  return { minX, minY, maxX, maxY }
}

// ----------------------------------------------------------------------------
// The virtual framing envelope: a flow-space rect { x, y, width, height }.
// Empty workspace → the starter room centered on the canvas origin.
// ----------------------------------------------------------------------------
export function computeEnvelope(nodes) {
  const b = graphBounds(nodes)
  if (!b) {
    return {
      x: -STARTER_ROOM_WIDTH / 2,
      y: -STARTER_ROOM_HEIGHT / 2,
      width: STARTER_ROOM_WIDTH,
      height: STARTER_ROOM_HEIGHT,
    }
  }

  const bbW = b.maxX - b.minX
  const bbH = b.maxY - b.minY
  const cx = b.minX + bbW / 2
  const cy = b.minY + bbH / 2

  // Per-axis max of (starter room) and (bounds + locked margin), both
  // centered on the graph center. Taking the max per axis keeps a graph
  // that's wide-but-flat inside a starter-height room instead of collapsing
  // the vertical breathing room the moment one axis outgrows the room.
  const width  = Math.max(STARTER_ROOM_WIDTH,  bbW * (1 + 2 * ENVELOPE_MARGIN_RATIO))
  const height = Math.max(STARTER_ROOM_HEIGHT, bbH * (1 + 2 * ENVELOPE_MARGIN_RATIO))

  return { x: cx - width / 2, y: cy - height / 2, width, height }
}

// ----------------------------------------------------------------------------
// The zoom at which the envelope exactly fits the available work area
// (window minus the reserved left/right bands), capped at `maxZoom`
// (zoom-level 1 — a one-card workspace should not open nose-to-card).
//
// There is deliberately NO lower clamp: the whole graph must fit the window
// no matter how wide it is (Erik, 2026-07-06 QA). Because a viewport parked
// below the zoom-out floor would snap inward on the first gesture (RF v11's
// setViewport bypasses the d3 scale clamp but user gestures don't), the
// floor itself must follow this value down — App composes the dynamic
// minZoom as min(bbox floor, this fit zoom), so entry framing and the
// gesture floor can never disagree.
// ----------------------------------------------------------------------------
export function computeEnvelopeFitZoom({
  envelope,
  viewportWidth,
  viewportHeight,
  reservedLeftPx = 0,
  reservedRightPx = 0,
  maxZoom = 1,
}) {
  if (!envelope || !viewportWidth || !viewportHeight) return maxZoom
  // Guard degenerate windows (reserves wider than the window): fall back to
  // the full window rather than a zero/negative work area.
  const reserved = reservedLeftPx + reservedRightPx
  const availW = viewportWidth - reserved > 0 ? viewportWidth - reserved : viewportWidth
  return Math.min(maxZoom, availW / envelope.width, viewportHeight / envelope.height)
}

// ----------------------------------------------------------------------------
// Focus viewport (simple search, 2026-07-07): center a single flow-space
// point in the work area at a fixed zoom. Implements Erik's standing camera
// rule — "centered" on desktop means centered in the display area LEFT of
// the reserved Inspector band (and right of the rail band), even when the
// Inspector is not visible. Same inset logic and constants as
// computeEntryViewport so the two centering rules can never disagree.
// ----------------------------------------------------------------------------

// Arrival zoom when the camera focuses one found node. 1 = cards at natural
// size (256×180 CSS px) — comfortably readable, well above the card↔bead
// threshold (~0.5), with surrounding context still visible. Tunable by feel.
// NOTE: currently consumer-less — search's find-mode revision (2026-07-07)
// frames the whole graph on submit instead of focus-zooming the selection.
// Kept (with computeFocusViewport) as the tested implementation of the
// standing centering rule for future camera work.
export const FOCUS_ZOOM = 1

// Search find-mode framing (2026-07-07): when a query is submitted, the
// whole graph frames as BEADS. Rather than a search-only bead override
// (which every altitude reader would have to respect), the framing zoom is
// capped at this fraction of the card↔bead threshold zoom — genuinely below
// the threshold, so the real zoom→altitude system flips to Bead View by
// itself and exits cleanly when the camera is restored. 0.9 sits safely
// inside the hysteresis dead-band on the way in.
export const SEARCH_BEAD_ZOOM_FACTOR = 0.9

// Flow-space center of a node, mirroring graphBounds' dimension rules
// (canonical card footprint; stored size for text nodes).
export function nodeCenter(node) {
  const isTextNode = node?.type === 'textNode'
  const w = isTextNode ? (node.width  ?? node.data?.width  ?? 200) : CARD_WIDTH
  const h = isTextNode ? (node.height ?? node.data?.height ?? 50)  : CARD_HEIGHT
  return {
    x: (node?.position?.x ?? 0) + w / 2,
    y: (node?.position?.y ?? 0) + h / 2,
  }
}

export function computeFocusViewport({
  center,
  viewportWidth,
  viewportHeight,
  reservedLeftPx = 0,
  reservedRightPx = 0,
  zoom = FOCUS_ZOOM,
}) {
  if (!center || !viewportWidth || !viewportHeight) {
    return { x: 0, y: 0, zoom }
  }
  const reserved = reservedLeftPx + reservedRightPx
  const degenerate = viewportWidth - reserved <= 0
  const availW = degenerate ? viewportWidth : viewportWidth - reserved
  const leftInset = degenerate ? 0 : reservedLeftPx
  return {
    x: leftInset + availW / 2 - center.x * zoom,
    y: viewportHeight / 2 - center.y * zoom,
    zoom,
  }
}

// ----------------------------------------------------------------------------
// Entry viewport: fit the envelope into the available work area and center it
// there. Returns a React Flow viewport transform { x, y, zoom }.
//
//   - `reservedRightPx` carves the docked-Inspector band off the right edge,
//     `reservedLeftPx` the altitude-rail band off the left (desktop). The
//     envelope centers in what remains, so the graph reads as centered in
//     the working area, clear of both instruments. Pass 0/0 on narrow
//     viewports (the Inspector takes over the window there).
// ----------------------------------------------------------------------------
export function computeEntryViewport({
  envelope,
  viewportWidth,
  viewportHeight,
  reservedLeftPx = 0,
  reservedRightPx = 0,
  maxZoom = 1,
}) {
  if (!envelope || !viewportWidth || !viewportHeight) {
    return { x: 0, y: 0, zoom: 1 }
  }

  const zoom = computeEnvelopeFitZoom({
    envelope, viewportWidth, viewportHeight, reservedLeftPx, reservedRightPx, maxZoom,
  })

  const reserved = reservedLeftPx + reservedRightPx
  const degenerate = viewportWidth - reserved <= 0
  const availW = degenerate ? viewportWidth : viewportWidth - reserved
  const leftInset = degenerate ? 0 : reservedLeftPx

  const envCx = envelope.x + envelope.width / 2
  const envCy = envelope.y + envelope.height / 2

  return {
    x: leftInset + availW / 2 - envCx * zoom,
    y: viewportHeight / 2 - envCy * zoom,
    zoom,
  }
}
