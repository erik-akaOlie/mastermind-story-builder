// ============================================================================
// handDrawn.js — hand-drawn-styled SVG path helpers (pure)
// ----------------------------------------------------------------------------
// The "handwritten guidance" product pattern: Caveat text plus a loose curved
// arrow from an instruction to the control it refers to. Born in the FTUE
// intro (FtueIntro.jsx), reused by the workspace picker's empty-library state
// (CampaignPicker.jsx). Geometry only — each surface supplies its own colors
// and measured anchor rects; arrows are always COMPUTED from live element
// measurements, never hardcoded (the relationship is the spec, not pixels).
//
// All helpers are pure and unit-tested (via FtueIntro.test.jsx, which imports
// the FtueIntro re-exports so the tests pin the consumer surface).
// ============================================================================

// Unit vector from a toward b (falls back to "down" for zero length so a
// degenerate arrow can't produce NaN).
function unitToward(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (!len) return { x: 0, y: 1 }
  return { x: dx / len, y: dy / len }
}

// A gently bowed cubic from `tail` to `tip`. `bow` displaces the first
// control point perpendicular to the chord (the loose hand-drawn curve).
// When `aim` is given (the icon center the arrow refers to), the SECOND
// control point is placed along the tip→aim line, so the curve ARRIVES
// pointing at the target — a curve that lands on a spot but aims past it
// reads as pointing at the neighbor (Erik's design QA).
export function handArrowPath(tail, tip, bow = 24, aim = null) {
  const dx = tip.x - tail.x
  const dy = tip.y - tail.y
  const len = Math.hypot(dx, dy) || 1
  // Unit perpendicular to the chord.
  const px = -dy / len
  const py = dx / len
  const c1 = { x: tail.x + dx * 0.35 + px * bow, y: tail.y + dy * 0.35 + py * bow }
  const c2 = aim
    ? (() => {
        const dir = unitToward(tip, aim)
        return { x: tip.x - dir.x * len * 0.35, y: tip.y - dir.y * len * 0.35 }
      })()
    : { x: tail.x + dx * 0.7 - px * bow, y: tail.y + dy * 0.7 - py * bow }
  return `M ${tail.x} ${tail.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tip.x} ${tip.y}`
}

// The guidance-arrow curve (born as the FTUE legend arrow; Erik wants TWO
// BROAD MOTIONS — a chained-S read as overdrawn): ONE cubic — a departure
// motion and an aimed sweep — ending in a short DEAD-STRAIGHT run along the
// aim direction into the tip. The straight arrival guarantees the
// arrowhead's barbs sit symmetrically around the visible final stroke, so a
// barb can never cross the arrow's own incoming line. Optional `startDir`
// (unit vector) pins the tail's departure direction (bend strongly AWAY
// from the text line before sweeping toward the target — what visually
// attaches a tail to its text).
export function handArrowPathWavy(tail, tip, bow = 24, aim = null, startDir = null) {
  const aimDir = aim ? unitToward(tip, aim) : unitToward(tail, tip)
  const straight = 20
  const pre = { x: tip.x - aimDir.x * straight, y: tip.y - aimDir.y * straight }
  const dx = pre.x - tail.x
  const dy = pre.y - tail.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  // Departure: either the explicit start direction (strong bend out of
  // the text) or a perpendicular bow off the chord.
  const c1 = startDir
    ? { x: tail.x + startDir.x * Math.max(28, len * 0.3), y: tail.y + startDir.y * Math.max(28, len * 0.3) }
    : { x: tail.x + dx * 0.35 + px * bow, y: tail.y + dy * 0.35 + py * bow }
  // Arrival: pulled back along the aim line with a whisper of counter-bow
  // — the second broad motion, not a third wiggle.
  const c2 = {
    x: pre.x - aimDir.x * Math.max(32, len * 0.35) - px * bow * 0.15,
    y: pre.y - aimDir.y * Math.max(32, len * 0.35) - py * bow * 0.15,
  }
  return (
    `M ${tail.x} ${tail.y} ` +
    `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${pre.x} ${pre.y} ` +
    `L ${tip.x} ${tip.y}`
  )
}

// Two loose strokes forming an open arrowhead at `tip`. Oriented along the
// aim direction when given (matching the curve's aimed arrival tangent),
// otherwise against the curve's own arrival. Returns one path string with
// two subpaths.
export function arrowheadPath(tail, tip, bow = 24, size = 16, aim = null) {
  let ux, uy
  if (aim) {
    const dir = unitToward(tip, aim)
    ux = dir.x
    uy = dir.y
  } else {
    const dx = tip.x - tail.x
    const dy = tip.y - tail.y
    const len = Math.hypot(dx, dy) || 1
    const px = -dy / len
    const py = dx / len
    const c2 = { x: tail.x + dx * 0.7 - px * bow, y: tail.y + dy * 0.7 - py * bow }
    const dir = unitToward(c2, tip)
    ux = dir.x
    uy = dir.y
  }
  const barb = (angleRad) => {
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)
    // Rotate the reversed arrival direction by ±angle.
    const bxv = -ux * cos - -uy * sin
    const byv = -uy * cos + -ux * sin
    return { x: tip.x + bxv * size, y: tip.y + byv * size }
  }
  const left = barb(0.5)   // ~28°
  const right = barb(-0.5)
  return `M ${left.x} ${left.y} L ${tip.x} ${tip.y} M ${right.x} ${right.y} L ${tip.x} ${tip.y}`
}
