// ============================================================================
// FtueIntro — the handwritten first-run introduction
//   Desktop: Figma 286-148 (Erik's approved mockup, 2026-07-29)
//   Mobile portrait: Figma 265:229 (Erik's revised mockup, 2026-07-17)
// ----------------------------------------------------------------------------
// A screen-fixed, pointer-events-none overlay that teaches a brand-new user
// the CONTENT-vs-STRUCTURE model on BOTH variants (desktop adopted mobile's
// proven composition 2026-07-29 — same architecture, desktop-scaled, per
// Erik's mockup). Handwritten voice: the Caveat brand font (`font-hand` +
// `leading-hand` for wrapped text — see tailwind.config.js) + hand-drawn-
// styled SVG arrows.
//
// COMPOSITION (both variants; the mockup specifies RELATIONSHIPS — the
// hierarchy, grouping, and spacing rhythm — not pixel values):
//   1. Hero — one-word "Welcome", the clearly dominant text.
//   2. Mission line — "Use the tools below to build your workspace"
//      (desktop) / "Use these tools to build your workspace" (mobile).
//   3. Two-column tool legend above the tray: "add content with / Nodes"
//      (primary — full white, larger) and "or structure and organize with /
//      Labels & Lines" (secondary — gray, smaller), with three measured
//      arrows down to the Node / Text / Line buttons. The Node arrow is
//      the loud one (bright, thicker); the structure arrows are quiet.
// DESKTOP layout is ONE FLEX COLUMN ending at the tray top (see the
// GAP_* rhythm constants): groups compress on short windows but can
// never overlap, and the legend stays grouped with the toolbar. MOBILE
// keeps its proven fixed-anchor model (bottom offsets + safe-area
// inset). Windows ≤640px wide render the MOBILE layout regardless of
// input type — narrowing a desktop browser resolves to the mobile
// composition, never an invented intermediate. The placement message
// sits ONE TRAY-HEIGHT above its tray (both variants).
//
// Two guidance states, derived — never stored:
//   welcome    — no creation tool armed (hero + mission + legend).
//   placement  — a creation tool is armed: "Now place the node wherever
//                you like on the canvas" (per-tool copy) + a decorative
//                fan into open canvas. Derived from activeTool (NOT
//                effectiveTool) so a held-spacebar pan suspension doesn't
//                flicker the copy.
//
// Visibility is owned by App (`visible` prop = canvas empty AND the FTUE
// flag unset — see useFtueStore). This component only fades (FADE_MS, 0
// under reduced motion), then unmounts.
//
// Arrow anchoring: arrows END short of the real toolbar buttons (measured
// live via [data-ftue-target] on BOTH trays; tips back off above the
// button so they never sit on the icons) and START at the rendered
// guidance text (refs). Each arrow's arrival tangent is AIMED at the icon
// center (`aim`) so the curve visually points at its target. Measured per
// render + window resize + one delayed pass — never hardcoded coordinates.
// Desktop force-expands the tray while visible; the mobile tray is always
// expanded, so its buttons are always measurable.
//
// Variants: the DESKTOP layout, and the MOBILE layout on phone portrait
// (useMobilePortrait — the same gate as the mobile tray) OR any
// phone-narrow window (useIsNarrowViewport, ≤640px — a narrowed desktop
// browser resolves to the mobile composition, pointing its arrows at the
// desktop tray). Touch-primary WITHOUT phone portrait (tablets,
// landscape) renders nothing — there is no toolbar to point at there.
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useToolStore } from '../store/useToolStore'
import { useTouchPrimary } from '../hooks/useTouchPrimary'
import { useMobilePortrait } from '../hooks/useMobilePortrait'
import { useIsNarrowViewport } from '../hooks/useIsNarrowViewport.js'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { track } from '../lib/analytics.js'

// Fade duration for state swaps + dismissal (0 under reduced motion).
const FADE_MS = 300

// ── Desktop layout constants (Figma 286-148) ────────────────────────────────
// The mockup is a specification of VISUAL RELATIONSHIPS, not pixel values
// (Erik, 2026-07-29 QA): what must hold at every window size is the
// hierarchy (hero ≫ mission ≫ content column ≫ structure column ≫
// ampersand), the grouping (each descriptor + its name is one unit; the
// legend + toolbar reads as one cluster), and no-overlap. The desktop
// welcome is therefore ONE FLEX COLUMN ending at the tray top — groups
// can squeeze, but they structurally cannot collide (the bottom-anchored-
// cluster-vs-proportional-hero overlap this replaces was a real QA
// failure on short windows).
//
// TWO-DIMENSIONAL SCALE (pass-3 model, approved 2026-07-29). Two pure
// inputs drive every desktop value:
//
//   kW — WIDTH interpolation, 0 at the 640px mobile breakpoint → 1 at
//        1440px+. Each value interpolates between its `mobileEnd` (what
//        the mobile FTUE's own responsive formulas produce at a 640px
//        viewport — NOT literal phone pixels) and its `full` desktop
//        value. At kW=0 the desktop branch renders the same numbers the
//        mobile branch would, so crossing the breakpoint is visually
//        continuous by construction.
//   cH — HEIGHT compression multiplier, 1 at comfortable heights
//        (≥720px, so laptops are uncompressed and boundary convergence
//        is intact at real window heights) ramping to 0.5 by 400px.
//        A short-but-wide window compresses because its HEIGHT says so,
//        regardless of width. Known residual: below-breakpoint windows
//        use the mobile branch's fixed offsets (no height compression),
//        so a narrow window SHORTER than ~640px keeps a boundary
//        discontinuity — evidenced in the harness, severity for Erik to
//        judge (not pre-accepted).
//
// The hierarchy cannot flatten or invert: at any (kW, cH) every tier is
// the same interpolation of two ordered ladders times a shared
// multiplier. Endpoints follow the 8/4/2 grid; interpolated in-between
// values are continuous by design (grid-snapping mid-scale would step
// visibly). All pure + unit-tested.
export function ftueScaleFor(width, height) {
  const clamp01 = (v) => Math.min(1, Math.max(0, v))
  return {
    kW: clamp01((width - 640) / (1440 - 640)),
    cH: Math.min(1, Math.max(0.5, 0.5 + (0.5 * (height - 400)) / 320)),
  }
}
export function ftuePx({ full, mobileEnd, floor = 0 }, { kW, cH }) {
  return Math.max(floor, Math.round((mobileEnd + (full - mobileEnd) * kW) * cH))
}

// TYPE LADDER, provisional pending Erik's visual QA: hierarchy per the
// mockup with mobile's differentiation ratio as the reference (hero 3×
// the mission, vs mobile's 3.7× and the mockup's 1.67×). `mobileEnd` =
// the mobile formulas at 640px wide (hero min(104, 25vw) → 104, mission
// 28, names 24, descriptors 16). The ampersand runs OPPOSITE to the
// others (smallest at full scale, easing UP to mobile's uniform name
// row at the boundary).
const T_HERO = { full: 144, mobileEnd: 104 }        // "Welcome"
const T_MISSION = { full: 48, mobileEnd: 28 }       // mission line
const T_NODES_NAME = { full: 48, mobileEnd: 24 }    // "Nodes"
const T_ORG_NAME = { full: 36, mobileEnd: 24 }      // "Labels & Lines"
const T_CONTENT_DESC = { full: 32, mobileEnd: 16 }  // "add content with"
const T_ORG_DESC = { full: 24, mobileEnd: 16 }      // "or structure and organize with"
const T_AMP = { full: 20, mobileEnd: 24 }           // the "&"

// VERTICAL RHYTHM. The arrow zone and the mission→legend pause are
// DESIGNED distances (kW/cH-scaled, hard floors) — never residual
// storage, so they cannot inflate when leftover height grows. Arrow
// zone full = 112 (half the pass-2 ~230, per Erik); mobileEnd = 56
// (the mobile system's legend→tray distance at the boundary). Residual
// height goes only ABOVE the mission line: the window-top gap and the
// hero→mission pause split it 2:1 — Erik's pacing (big pause after
// Welcome, smaller pause before the legend, mission favoring the
// legend it describes). justify-end still guarantees no-overlap: an
// impossibly short window clips the hero off the top, never the
// cluster into the toolbar.
const ARROW_ZONE = { full: 112, mobileEnd: 56, floor: 48 }
const MISSION_LEGEND_GAP = { full: 48, mobileEnd: 44, floor: 24 }
const LEGEND_ROW_GAP = { full: 16, mobileEnd: 8, floor: 8 }   // descriptor → name
const LEGEND_COL_GAP = { full: 40, mobileEnd: 96, floor: 40 } // column separation aid:
// grows as columns narrow so total separation approximates the mobile
// 24%/62% arrangement at the boundary (small drift there is the
// disclosed tunable).
const GAP_TOP = { flexGrow: 2, minHeight: 32 }
const GAP_HERO_MISSION = { flexGrow: 1, minHeight: 24 }
const TRAY_H_PX = 72 // desktop tray height — the flex column's floor

// Exported for the unit tests that pin the scale model's invariants
// (hierarchy ordering, boundary convergence, height governance).
export const FTUE_LADDER = {
  hero: T_HERO,
  mission: T_MISSION,
  nodesName: T_NODES_NAME,
  orgName: T_ORG_NAME,
  contentDesc: T_CONTENT_DESC,
  orgDesc: T_ORG_DESC,
  amp: T_AMP,
  arrowZone: ARROW_ZONE,
}

// Placement copy sits one tray-height above the tray (Erik, design QA
// pass 3): gap = tray height = 72px, so bottom offset = 72 (tray) + 72.
const PLACEMENT_BOTTOM_PX = 144

// Arrow tips stop this far ABOVE a toolbar button's top edge — real
// breathing room between arrowheads and the tray (Erik QA 2026-07-29:
// tips touching the tray read as crowding; button top = tray top + 16,
// so 40 floats the tips 24px clear of the tray itself).
const ARROW_TIP_CLEARANCE = 40

// ── Mobile-portrait layout constants (Figma 265:229) ────────────────────────
// The phone tray is 56px tall (40px buttons + 8px padding) and flush to
// the bottom plus the iOS safe-area inset; every mobile bottom offset adds
// env(safe-area-inset-bottom) so nothing hides behind the home indicator.
//
// COMPOSITION MODEL (mobile pass 4 — Erik's revised mockup, 2026-07-17;
// desktop adopted this same composition 2026-07-29, Figma 286-148):
// a CONTENT-vs-STRUCTURE teach. One-word "Welcome" hero, the mission
// line, then a two-column tool legend right above the tray: "add
// content with / Nodes" (aligned over the Node button) and "structure
// and organize with / Labels & Lines", with three arrows bridging the
// legend names down to their tools (see the arrow block). All
// blocks are bottom-anchored (+ safe-area): the legend's NAME row stays
// aligned across wrap differences, arrow spans are device-stable, and
// the surplus height breathes ABOVE the hero — total content is short
// enough that even squat viewports keep real headroom. Gaps are the
// mockup's designed unequal rhythm, not an even distribution. 8-grid.
//
// TERMINOLOGY NOTE: "Labels" here is Erik's re-identification of text
// blocks as an ORGANIZING tool (2026-07-17, this mockup) — the wider
// product rename (tooltips, Canvas Tool Menu, placement copy, docs) is
// a pending product decision; do not spread the term further without
// Erik's explicit scope call.
// Pass-9 spacing (Erik's Android QA vs the mockup): the hero centers
// PROPORTIONALLY at M_TITLE_CENTER (its vertical center, on every
// device — "closer to the center of the screen"); the mission + legend
// are bottom-anchored px so the cluster and the (halved, 48px) arrows
// stay tray-relative; the gap between hero and cluster absorbs device
// height. Arrow length = (M_COLS_BOTTOM − 8 tail drop) − 72 (tip
// offset: button top sits 48px up — 56 tray minus 8 inset — plus 24
// clearance) → 48px, half the pass-8 length per Erik's QA.
// "Closer to the center", not centered (Erik, pass 10): 45% minus a
// fixed 72px lift.
const M_TITLE_CENTER = 'calc(45% - 72px)'
const M_SUBTITLE_BOTTOM_PX = 240
const M_COLS_BOTTOM_PX = 128
// Column centers per the mockup (fractions of the width; the arrows are
// measured-anchored to the real buttons, so small drift between a column
// center and its button across widths is absorbed by the arrow).
const M_NODE_COL_CENTER_CSS = '24%'
const M_ORG_COL_CENTER_CSS = '62%'
// Placement rule (same as desktop): gap = tray height = 56px → 56 + 56.
const M_PLACEMENT_BOTTOM_PX = 112
// Phone buttons sit 8px inside the tray (vs 16 on desktop): 24px keeps the
// same "tip floats 16px above the tray" relationship.
const M_ARROW_TIP_CLEARANCE = 24

const mBottom = (px) => `calc(${px}px + env(safe-area-inset-bottom, 0px))`

// Creation tools whose arming flips the copy to the placement state.
const CREATION_TOOLS = new Set(['node', 'text', 'line'])

// Placement-state message per armed tool — SHARED by both variants since
// the desktop legend adopted "Labels & Lines" (Figma 286-148, 2026-07-29).
// "Label" remains an FTUE-ONLY introduction name for text blocks (Erik,
// 2026-07-17): after the FTUE the object is a TEXT BLOCK everywhere —
// there is NO product-wide rename.
const PLACEMENT_COPY = {
  node: 'Now place the node wherever you like on the canvas',
  text: 'Now place the label wherever you like on the canvas',
  line: 'Now draw a line wherever you like on the canvas',
}

// Pure helper (unit-tested): which guidance state a given active tool maps to.
export function ftueModeFor(activeTool) {
  return CREATION_TOOLS.has(activeTool) ? 'placement' : 'welcome'
}

// ----------------------------------------------------------------------------
// Hand-drawn-styled SVG path helpers. All pure; exported for tests.
// ----------------------------------------------------------------------------

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

// The legend-arrow curve, BOTH variants since the 286-148 desktop adoption
// (born as the mobile pass-3 variant — pass 2's chained-S read as
// overdrawn, "three tight curves"; Erik wants TWO BROAD MOTIONS): ONE
// cubic — a departure motion and an aimed sweep — ending in a short
// DEAD-STRAIGHT run along the aim direction into the tip. The straight
// arrival guarantees the arrowhead's barbs sit symmetrically around the
// visible final stroke, so a barb can never cross the arrow's own
// incoming line. Optional `startDir` (unit vector) pins the tail's
// departure direction (bend strongly AWAY from the text line before
// sweeping toward the toolbar — what visually attaches a tail to its
// text); currently unused but kept for tuning.
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

// Measure a [data-ftue-target] toolbar button. Returns null when absent so
// the overlay degrades to text-only rather than throwing. `center` is the
// icon center the arrows AIM at.
function measureTarget(tool) {
  const el = document.querySelector(`[data-ftue-target="${tool}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    cx: r.left + r.width / 2,
    top: r.top,
    center: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
  }
}

export default function FtueIntro({ visible }) {
  const touchPrimary = useTouchPrimary()
  const mobilePortrait = useMobilePortrait()
  const narrowViewport = useIsNarrowViewport()
  const reducedMotion = useReducedMotion()

  const activeTool = useToolStore((s) => s.activeTool)
  const mode = ftueModeFor(activeTool)

  // Which LAYOUT renders. Phone portrait, of course — but also any
  // phone-narrow window (≤640px, the shared breakpoint), so narrowing a
  // desktop browser resolves to the proven mobile composition instead of
  // inventing an intermediate layout (Erik QA 2026-07-29). The arrows
  // measure the real toolbar buttons, so the mobile layout points at the
  // desktop tray correctly in that case.
  const mobileLayout = mobilePortrait || narrowViewport

  // Dismissal fade: keep rendering for FADE_MS after `visible` drops so the
  // handwriting fades out instead of vanishing on the placement tap.
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) { setMounted(true); return }
    if (!mounted) return
    if (reducedMotion) { setMounted(false); return }
    const t = setTimeout(() => setMounted(false), FADE_MS)
    return () => clearTimeout(t)
  }, [visible, mounted, reducedMotion])

  // One ftue_shown per overlay appearance (per ADR-0009 — the FTUE exists to
  // fight first-session abandonment; this is how the beta measures it).
  const shownRef = useRef(false)
  useEffect(() => {
    if (visible && !shownRef.current) { shownRef.current = true; track('ftue_shown') }
    if (!visible) shownRef.current = false
  }, [visible])

  // ── Geometry: guidance-text rects (refs) + toolbar-button anchors ────────
  // Both variants share the legend refs: the "Nodes" name and the
  // "Labels & Lines" name are the arrow tails on desktop AND mobile.
  const nodesLabelRef = useRef(null)
  const labelsLinesRef = useRef(null)
  const placementRef = useRef(null)
  const [geom, setGeom] = useState(null)
  const [measureTick, setMeasureTick] = useState(0)

  // Live viewport for the two-dimensional scale (kW, cH). Updated by the
  // same resize listener that re-measures the arrows.
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined'
      ? { w: 1280, h: 800 }
      : { w: window.innerWidth, h: window.innerHeight },
  )

  useLayoutEffect(() => {
    if (!mounted) return
    const measure = () => {
      const nodesLabel = nodesLabelRef.current?.getBoundingClientRect() ?? null
      const labelsLines = labelsLinesRef.current?.getBoundingClientRect() ?? null
      const placement = placementRef.current?.getBoundingClientRect() ?? null
      setGeom({
        node: measureTarget('node'),
        text: measureTarget('text'),
        line: measureTarget('line'),
        nodesLabel, labelsLines, placement,
      })
    }
    measure()
    // Second pass after the desktop tray's 200ms morph settles (first mount
    // only matters when the tray was mid-transition; cheap insurance).
    const t = setTimeout(measure, 260)
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      setMeasureTick((n) => n + 1)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [mounted, mode, measureTick, mobileLayout])

  // Tablets / phone landscape: no toolbar exists to point at → no intro.
  if (touchPrimary && !mobilePortrait) return null
  if (!mounted) return null

  const mobile = mobileLayout
  const fade = reducedMotion ? 0 : FADE_MS
  const welcomeActive = visible && mode === 'welcome'
  const placementActive = visible && mode === 'placement'
  const tipClearance = mobile ? M_ARROW_TIP_CLEARANCE : ARROW_TIP_CLEARANCE

  // Desktop two-dimensional scale: every type size and designed gap is a
  // pure function of the live viewport (see ftueScaleFor / ftuePx).
  const scale = ftueScaleFor(viewport.w, viewport.h)
  const px = (tier) => ftuePx(tier, scale)

  // ── Arrow paths (screen coordinates; guarded on measurement) ─────────────
  // Supporting, not starring (design QA): short spans, lighter strokes,
  // tips backed off the buttons, arrival tangents AIMED at icon centers,
  // small per-arrow horizontal bias on tips approached from the side.
  const arrows = { welcome: [], placement: [] }
  if (geom) {
    const { node, text, line, nodesLabel, labelsLines, placement } = geom
    // THREE arrows bridging the legend down to the tray, both variants —
    // "the arrows make the text feel closer to the toolbar." Nodes →
    // Node button; the Labels and Lines WORDS in the right column's name
    // each get their own down-left curve to their tool. Tails hang 8px
    // under the word they belong to (word positions as fractions of the
    // measured name rect); tips keep the standard clearance. Per-variant
    // styling (mobile: three equal quiet arrows over short spans;
    // desktop, per the 286-148 mockup: long sweeps where the Node arrow
    // is LOUD — bright + thicker — and the structure arrows are faint).
    // Desktop's node + text arrows carry startDir STRAIGHT DOWN: the
    // departure visibly leaves from under the label before the aimed
    // sweep begins — the two-motion read (Erik QA 2026-07-29: without
    // it, long shallow arrows look like they spawn off the label's left
    // edge). The line arrow already reads as intentional without it.
    const down = { x: 0, y: 1 }
    const style = mobile
      ? {
          node: { bow: -6, width: 2, opacity: 0.55, head: 10 },
          text: { bow: -14, width: 2, opacity: 0.55, head: 10 },
          line: { bow: -18, width: 2, opacity: 0.55, head: 10 },
          labelsWordFrac: 0.1,
        }
      : {
          node: { bow: -24, width: 3, opacity: 0.9, head: 14, startDir: down },
          text: { bow: -28, width: 2, opacity: 0.3, head: 12, startDir: down },
          line: { bow: -36, width: 2, opacity: 0.3, head: 12 },
          // Desktop name row is larger: 0.2 lands the tail under the
          // CENTER of the word "Labels" instead of its first letter.
          labelsWordFrac: 0.2,
        }
    if (nodesLabel && node) {
      const tail = { x: nodesLabel.left + nodesLabel.width / 2, y: nodesLabel.bottom + 8 }
      const tip = { x: node.cx, y: node.top - tipClearance }
      arrows.welcome.push({ tail, tip, aim: node.center, wavy: true, ...style.node })
    }
    if (labelsLines && text) {
      const tail = { x: labelsLines.left + labelsLines.width * style.labelsWordFrac, y: labelsLines.bottom + 8 }
      const tip = { x: text.cx + 4, y: text.top - tipClearance }
      arrows.welcome.push({ tail, tip, aim: text.center, wavy: true, ...style.text })
    }
    if (labelsLines && line) {
      const tail = { x: labelsLines.left + labelsLines.width * 0.85, y: labelsLines.bottom + 8 }
      const tip = { x: line.cx + 4, y: line.top - tipClearance }
      arrows.welcome.push({ tail, tip, aim: line.center, wavy: true, ...style.line })
    }
    if (placement) {
      // Decorative fan out of the placement message into open canvas.
      const cx = placement.left + placement.width / 2
      const topY = placement.top - 24
      const spread = mobile ? 40 : 48
      const fan = [
        { angle: -150, len: 56 }, { angle: -120, len: 64 }, { angle: -90, len: 72 },
        { angle: -60, len: 64 }, { angle: -30, len: 56 },
      ]
      for (const { angle, len } of fan) {
        const rad = (angle * Math.PI) / 180
        const tail = { x: cx + Math.cos(rad) * spread, y: topY + Math.sin(rad) * 16 }
        const tip = { x: cx + Math.cos(rad) * (spread + len), y: topY + Math.sin(rad) * (16 + len * 0.75) }
        arrows.placement.push({ tail, tip, aim: null, bow: 8, width: 3, opacity: 0.5, head: 10 })
      }
    }
  }

  const renderArrows = (list) => list.map((a, i) => (
    <g key={i} stroke="#ffffff" strokeOpacity={a.opacity} strokeWidth={a.width}
       strokeLinecap="round" fill="none">
      <path d={a.wavy
        ? handArrowPathWavy(a.tail, a.tip, a.bow, a.aim, a.startDir ?? null)
        : handArrowPath(a.tail, a.tip, a.bow, a.aim)} />
      <path d={arrowheadPath(a.tail, a.tip, a.bow, a.head, a.aim)} />
    </g>
  ))

  return (
    <div className="pointer-events-none fixed inset-0 z-30 select-none" aria-hidden="true">
      {/* ── Welcome state ──────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 transition-opacity ease-out"
        style={{ opacity: welcomeActive ? 1 : 0, transitionDuration: `${fade}ms` }}
      >
        {mobile ? (
          /* MOBILE: the pass-4 mockup — "Welcome" hero, mission line, and
             the content-vs-structure tool legend above the tray (see the
             composition-model comment on the constants). */
          <>
            <div
              className="font-hand absolute left-0 w-full -translate-y-1/2 text-center text-white"
              style={{ top: M_TITLE_CENTER, fontSize: 'min(6.5rem, 25vw)' }}
            >
              Welcome
            </div>
            <div
              className="font-hand leading-hand absolute left-1/2 -translate-x-1/2 text-center text-white/75"
              style={{ bottom: mBottom(M_SUBTITLE_BOTTOM_PX), fontSize: 'min(1.75rem, 7vw)', width: 'max-content', maxWidth: '80vw' }}
            >
              {/* Canonical mission copy (Erik 2026-07-29): identical
                  sentence to desktop so the wording never changes at the
                  breakpoint; phone-width line break. */}
              Use the tools below
              <br />
              to build your workspace
            </div>
            {/* The tool legend — small and quiet per the annotated
                mockup. Hard line breaks make both descriptors exactly
                two lines, so with equal fonts + margins the descriptor
                rows AND the name rows sit on the same horizontal lines
                ("uniformly aligned horizontally"). Names never wrap. */}
            <div
              className="font-hand absolute -translate-x-1/2 text-center"
              style={{ bottom: mBottom(M_COLS_BOTTOM_PX), left: M_NODE_COL_CENTER_CSS }}
            >
              <div className="leading-hand text-base text-white/60">
                add content
                <br />
                with
              </div>
              <div ref={nodesLabelRef} className="mt-2 whitespace-nowrap text-2xl text-white/80">
                Nodes
              </div>
            </div>
            <div
              className="font-hand absolute -translate-x-1/2 text-center"
              style={{ bottom: mBottom(M_COLS_BOTTOM_PX), left: M_ORG_COL_CENTER_CSS }}
            >
              <div className="leading-hand text-base text-white/60">
                structure and
                <br />
                organize with
              </div>
              <div ref={labelsLinesRef} className="mt-2 whitespace-nowrap text-2xl text-white/80">
                Labels &amp; Lines
              </div>
            </div>
          </>
        ) : (
          /* DESKTOP (Figma 286-148): ONE COMPOSITION — a flex column
             ending at the tray top: [breathing] hero [gap] mission [gap]
             legend [arrow zone] toolbar. Groups squeeze via the GAP_*
             rhythm but structurally cannot overlap; justify-end keeps
             the legend+toolbar cluster intact and clips the hero first
             on impossibly short windows. Colors per the mockup: primary
             column full white, mission + structure column gray-400
             (#9ca3af — the mockup's content/weak token). */
          <div
            className="absolute inset-x-0 top-0 flex flex-col items-center justify-end overflow-hidden"
            style={{ bottom: TRAY_H_PX }}
          >
            <div className="shrink-0" style={GAP_TOP} />
            <div
              className="font-hand shrink-0 text-center text-white"
              style={{ fontSize: px(T_HERO) }}
            >
              Welcome
            </div>
            <div className="shrink-0" style={GAP_HERO_MISSION} />
            <div
              className="font-hand leading-hand shrink-0 text-center text-gray-400"
              style={{ fontSize: px(T_MISSION) }}
            >
              Use the tools below to build
              <br />
              your workspace
            </div>
            <div className="shrink-0" style={{ height: px(MISSION_LEGEND_GAP) }} />
            {/* The tool legend — a 2×2 grid so each descriptor + name
                pair moves as one unit and the rows stay aligned at every
                size: descriptors self-end (base-aligned boxes of roughly
                equal height — 2 lines × 32px ≈ 3 lines × 24px by
                design), names baseline-aligned. */}
            <div
              className="font-hand grid shrink-0 grid-cols-2 text-center"
              style={{ columnGap: px(LEGEND_COL_GAP), rowGap: px(LEGEND_ROW_GAP) }}
            >
              <div className="leading-hand self-end text-white" style={{ fontSize: px(T_CONTENT_DESC) }}>
                add content
                <br />
                with
              </div>
              <div className="leading-hand self-end text-gray-400" style={{ fontSize: px(T_ORG_DESC) }}>
                or
                <br />
                structure and
                <br />
                organize with
              </div>
              <div
                ref={nodesLabelRef}
                className="self-baseline whitespace-nowrap text-white"
                style={{ fontSize: px(T_NODES_NAME) }}
              >
                Nodes
              </div>
              <div
                ref={labelsLinesRef}
                className="self-baseline whitespace-nowrap text-gray-400"
                style={{ fontSize: px(T_ORG_NAME) }}
              >
                Labels{' '}
                <span className="mx-1" style={{ fontSize: px(T_AMP) }}>&amp;</span>{' '}
                Lines
              </div>
            </div>
            {/* The arrow zone — a DESIGNED distance, never residual. */}
            <div className="shrink-0" style={{ height: px(ARROW_ZONE) }} />
          </div>
        )}
        <svg className="absolute inset-0 h-full w-full">{renderArrows(arrows.welcome)}</svg>
      </div>

      {/* ── Placement state ────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 transition-opacity ease-out"
        style={{ opacity: placementActive ? 1 : 0, transitionDuration: `${fade}ms` }}
      >
        {/* One tray-height above the tray (both variants); 40px desktop /
            32px-capped mobile for Caveat legibility. */}
        <div
          ref={placementRef}
          className="font-hand leading-hand absolute left-1/2 -translate-x-1/2 text-center text-white/85"
          style={
            mobile
              ? { bottom: mBottom(M_PLACEMENT_BOTTOM_PX), fontSize: 'min(2rem, 8vw)', width: 'max-content', maxWidth: '80vw' }
              : { bottom: PLACEMENT_BOTTOM_PX, fontSize: '2.5rem', width: 'max-content', maxWidth: '560px' }
          }
        >
          {PLACEMENT_COPY[activeTool] ?? PLACEMENT_COPY.node}
        </div>
        <svg className="absolute inset-0 h-full w-full">{renderArrows(arrows.placement)}</svg>
      </div>
    </div>
  )
}
