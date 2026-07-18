// ============================================================================
// FtueIntro — the handwritten first-run introduction (Figma 225-1971)
// ----------------------------------------------------------------------------
// A screen-fixed, pointer-events-none overlay that teaches a brand-new user
// to create (and name) their first node via the bottom toolbar. Handwritten
// voice: the Caveat brand font (`font-hand` + `leading-hand` for wrapped
// text — see tailwind.config.js) + hand-drawn-styled SVG arrows.
//
// VISUAL HIERARCHY (Erik's design QA passes, 2026-07-16) — three tiers:
//   1. "Welcome to your new workspace" — the primary hit. Desktop: 96px
//      near the vertical center. Mobile portrait: kept HIGHER (much less
//      vertical space — Erik's call) with the Figma 265:229 line breaks.
//   2. "Get started by adding your first node" — second-tier instruction,
//      anchored near the toolbar so text + arrow + action read as a unit.
//   3. The "You can also…" aside — clearly tertiary; on mobile it tucks
//      against the right edge above the tray (Figma 265:229).
// Toolbar-pointing guidance is BOTTOM-ANCHORED (fixed offsets above the
// tray — mobile offsets add the iOS safe-area inset) so arrow lengths stay
// short and constant; only the welcome title is proportionally placed.
// The placement message sits ONE TRAY-HEIGHT above its tray (both variants).
//
// Two guidance states, derived — never stored:
//   welcome    — no creation tool armed (tiers 1–3).
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
// Variants: desktop (hover-primary) and MOBILE PORTRAIT (useMobilePortrait
// — the same gate as the mobile tray). Touch-primary WITHOUT phone
// portrait (tablets, landscape) renders nothing — there is no toolbar to
// point at there.
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useToolStore } from '../store/useToolStore'
import { useTouchPrimary } from '../hooks/useTouchPrimary'
import { useMobilePortrait } from '../hooks/useMobilePortrait'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { track } from '../lib/analytics.js'

// Fade duration for state swaps + dismissal (0 under reduced motion).
const FADE_MS = 300

// ── Desktop layout constants ────────────────────────────────────────────────
// Tier 1: proportional placement — the title's TOP; with the title's own
// height this reads as "near the center of the screen".
const TITLE_TOP = '34%'

// COORDINATED type scale (responsive pass, Erik 2026-07-17): the title and
// the tier-2 instruction scale TOGETHER through the same vw band, locked
// at a 2:1 ratio (96/48 caps → 7vw/3.5vw → 56/28 floors), so narrowing
// the window can never invert the hierarchy — the welcome stays the
// primary hit at every width the desktop FTUE renders. Never scale one
// tier without the other.
const TITLE_FONT_CSS = 'clamp(3.5rem, 7vw, 6rem)'
const SUBTITLE_FONT_CSS = 'clamp(1.75rem, 3.5vw, 3rem)'

// Tier 2 + placement copy: bottom-anchored offsets (px above the window
// bottom; the desktop tray is 72px tall, flush to the bottom). 8-grid.
const SUBTITLE_BOTTOM_PX = 224
// Placement copy sits one tray-height above the tray (Erik, design QA
// pass 3): gap = tray height = 72px, so bottom offset = 72 (tray) + 72.
const PLACEMENT_BOTTOM_PX = 144

// Tier 3 aside: pushed clearly right of the tier-2 column and slightly
// lower (design QA pass 2 — at +192px the two read as one instruction
// cluster; the user should process the primary action before noticing the
// optional alternatives). The min() clamp keeps the whole block on-screen
// on laptop widths: item text (ASIDE_MAX_W) + the 48px item indent + a
// 48px right margin.
const ASIDE_BOTTOM_PX = 120
const ASIDE_LEFT_OFFSET_PX = 320
const ASIDE_MAX_W_PX = 320
const ASIDE_INDENT_PX = 48
const asideLeftCss =
  `min(calc(50% + ${ASIDE_LEFT_OFFSET_PX}px), calc(100% - ${ASIDE_MAX_W_PX + ASIDE_INDENT_PX + 48}px))`

// Where the CSS min() above actually puts the aside's left edge, in px —
// the JS mirror used by the hide-before-collision rule. Keep in sync with
// asideLeftCss.
export function asideLeftPxFor(windowWidth) {
  return Math.min(
    windowWidth / 2 + ASIDE_LEFT_OFFSET_PX,
    windowWidth - (ASIDE_MAX_W_PX + ASIDE_INDENT_PX + 48),
  )
}

// Hide-before-collision (responsive pass, Erik 2026-07-17): the tertiary
// aside is OPTIONAL support — if there isn't room for it to stay clearly
// separate from the tier-2 instruction, it (and its arrows) drops out
// entirely rather than sliding over the text. Measured, not a breakpoint:
// the instruction's width varies with the coordinated type scale.
export const ASIDE_MIN_GAP_PX = 48
export function shouldShowAside(windowWidth, subtitleRightEdge) {
  return asideLeftPxFor(windowWidth) - subtitleRightEdge >= ASIDE_MIN_GAP_PX
}

// Arrow tips stop this far ABOVE a toolbar button's top edge — breathing
// room so heads never sit on the icons (desktop button top = tray top +
// 16, so tips float 16px clear of the tray itself).
const ARROW_TIP_CLEARANCE = 32

// ── Mobile-portrait layout constants (Figma 265:229) ────────────────────────
// The phone tray is 56px tall (40px buttons + 8px padding) and flush to
// the bottom plus the iOS safe-area inset; every mobile bottom offset adds
// env(safe-area-inset-bottom) so nothing hides behind the home indicator.
//
// COMPOSITION MODEL (mobile pass 4 — Erik's revised mockup, 2026-07-17):
// a CONTENT-vs-STRUCTURE teach replacing the desktop copy's structure.
// One-word "Welcome" hero, the mission line "Use these tools to map your
// work", then a two-column tool legend right above the tray: "add
// content with / Nodes" (aligned over the Node button, with the single
// short arrow down to it) and "structure and organize with / Labels &
// Lines" (no arrows — the legend sits above the tools it names). All
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

// Placement-state message per armed tool. Product vocabulary: NODE is the
// entity; annotations are TEXT BLOCKS and LINES.
const PLACEMENT_COPY = {
  node: 'Now place the node wherever you like on the canvas',
  text: 'Now place the text block wherever you like on the canvas',
  line: 'Now draw a line wherever you like on the canvas',
}

// Mobile override (Erik, 2026-07-17): the FTUE — and ONLY the FTUE —
// introduces text blocks as "labels" (a one-word frame for the tool;
// thereafter the object is a text block everywhere, so the name never
// limits creative use). The mobile legend says "Labels & Lines", so the
// mobile placement copy matches it. Desktop FTUE keeps its current copy
// until the post-beta desktop/mobile unification.
const MOBILE_PLACEMENT_COPY = {
  ...PLACEMENT_COPY,
  text: 'Now place the label wherever you like on the canvas',
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

// Mobile variant (pass 3 — pass 2's chained-S read as overdrawn, "three
// tight curves"; Erik wants TWO BROAD MOTIONS, closer to desktop's
// character): ONE cubic — a departure motion and an aimed sweep — ending
// in a short DEAD-STRAIGHT run along the aim direction into the tip. The
// straight arrival guarantees the arrowhead's barbs sit symmetrically
// around the visible final stroke, so a barb can never cross the arrow's
// own incoming line. Optional `startDir` (unit vector) pins the tail's
// departure direction — the aside arrows use it to bend strongly AWAY
// from their text line before sweeping toward the toolbar, which is what
// visually attaches a tail to its text.
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
  const reducedMotion = useReducedMotion()

  const activeTool = useToolStore((s) => s.activeTool)
  const mode = ftueModeFor(activeTool)

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
  const subtitleRef = useRef(null)
  const asideTextRef = useRef(null)
  const asideLineRef = useRef(null)
  const nodesLabelRef = useRef(null)   // mobile: the "Nodes" legend name
  const labelsLinesRef = useRef(null)  // mobile: the "Labels & Lines" name
  const placementRef = useRef(null)
  const [geom, setGeom] = useState(null)
  const [measureTick, setMeasureTick] = useState(0)

  useLayoutEffect(() => {
    if (!mounted) return
    const measure = () => {
      const subtitle = subtitleRef.current?.getBoundingClientRect() ?? null
      const asideText = asideTextRef.current?.getBoundingClientRect() ?? null
      const asideLine = asideLineRef.current?.getBoundingClientRect() ?? null
      const nodesLabel = nodesLabelRef.current?.getBoundingClientRect() ?? null
      const labelsLines = labelsLinesRef.current?.getBoundingClientRect() ?? null
      const placement = placementRef.current?.getBoundingClientRect() ?? null
      setGeom({
        node: measureTarget('node'),
        text: measureTarget('text'),
        line: measureTarget('line'),
        subtitle, asideText, asideLine, nodesLabel, labelsLines, placement,
        // Desktop-only collision rule; the mobile stack can't collide.
        // Runs in a LAYOUT effect, so a colliding aside is hidden before
        // the first paint — it never flashes over the instruction.
        showAside: mobilePortrait
          ? true
          : shouldShowAside(window.innerWidth, subtitle?.right ?? 0),
      })
    }
    measure()
    // Second pass after the desktop tray's 200ms morph settles (first mount
    // only matters when the tray was mid-transition; cheap insurance).
    const t = setTimeout(measure, 260)
    const onResize = () => setMeasureTick((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [mounted, mode, measureTick, mobilePortrait])

  // Tablets / phone landscape: no toolbar exists to point at → no intro.
  if (touchPrimary && !mobilePortrait) return null
  if (!mounted) return null

  const mobile = mobilePortrait
  const fade = reducedMotion ? 0 : FADE_MS
  const welcomeActive = visible && mode === 'welcome'
  const placementActive = visible && mode === 'placement'
  const tipClearance = mobile ? M_ARROW_TIP_CLEARANCE : ARROW_TIP_CLEARANCE

  // ── Arrow paths (screen coordinates; guarded on measurement) ─────────────
  // Supporting, not starring (design QA): short spans, lighter strokes,
  // tips backed off the buttons, arrival tangents AIMED at icon centers,
  // small per-arrow horizontal bias on tips approached from the side.
  const arrows = { welcome: [], placement: [] }
  if (geom) {
    const { node, text, line, subtitle, asideText, asideLine, nodesLabel, labelsLines, placement } = geom
    if (mobile) {
      // Mobile (annotated mockup): THREE short, subtle arrows bridging
      // the legend down to the tray — "the arrows make the text feel
      // closer to the toolbar." Nodes → Node button (near-straight);
      // the Labels and Lines WORDS in the right column's name each get
      // their own gentle down-left curve to their tool. Tails hang 8px
      // under the word they belong to (word positions as fractions of
      // the measured name rect); tips keep the standard clearance.
      if (nodesLabel && node) {
        const tail = { x: nodesLabel.left + nodesLabel.width / 2, y: nodesLabel.bottom + 8 }
        const tip = { x: node.cx, y: node.top - tipClearance }
        arrows.welcome.push({
          tail, tip, aim: node.center, wavy: true,
          bow: -6, width: 2, opacity: 0.55, head: 10,
        })
      }
      if (labelsLines && text) {
        const tail = { x: labelsLines.left + labelsLines.width * 0.1, y: labelsLines.bottom + 8 }
        const tip = { x: text.cx + 4, y: text.top - tipClearance }
        arrows.welcome.push({
          tail, tip, aim: text.center, wavy: true,
          bow: -14, width: 2, opacity: 0.55, head: 10,
        })
      }
      if (labelsLines && line) {
        const tail = { x: labelsLines.left + labelsLines.width * 0.85, y: labelsLines.bottom + 8 }
        const tip = { x: line.cx + 4, y: line.top - tipClearance }
        arrows.welcome.push({
          tail, tip, aim: line.center, wavy: true,
          bow: -18, width: 2, opacity: 0.55, head: 10,
        })
      }
    } else {
      if (subtitle && node) {
        const tail = { x: subtitle.left + subtitle.width / 2 + 16, y: subtitle.bottom + 16 }
        const tip = { x: node.cx, y: node.top - tipClearance }
        arrows.welcome.push({
          tail, tip, aim: node.center, bow: -24, width: 3, opacity: 0.75, head: 12,
        })
      }
      if (asideText && text) {
        const tail = { x: asideText.left - 16, y: asideText.top + asideText.height / 2 }
        // Approached from the upper right → nudge the tip slightly right
        // of the icon center so the aimed curve reads on-target.
        const tip = { x: text.cx + 4, y: text.top - tipClearance }
        arrows.welcome.push({ tail, tip, aim: text.center, bow: 16, width: 2, opacity: 0.5, head: 10 })
      }
      if (asideLine && line) {
        const tail = { x: asideLine.left - 16, y: asideLine.top + asideLine.height / 2 }
        const tip = { x: line.cx + 4, y: line.top - tipClearance }
        arrows.welcome.push({ tail, tip, aim: line.center, bow: 12, width: 2, opacity: 0.5, head: 10 })
      }
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
              ref={subtitleRef}
              className="font-hand leading-hand absolute left-1/2 -translate-x-1/2 text-center text-white/75"
              style={{ bottom: mBottom(M_SUBTITLE_BOTTOM_PX), fontSize: 'min(1.75rem, 7vw)', width: 'max-content', maxWidth: '80vw' }}
            >
              Use these tools to
              <br />
              build your workspace
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
          /* DESKTOP: tier 1 near center; tiers 2–3 bottom-anchored near
             the tray. width:max-content on every translate-centered
             block: an absolute element at left:50% otherwise
             shrink-to-fits into the RIGHT HALF of the window and wraps
             far too early. */
          <>
            <div
              className="font-hand leading-hand absolute left-1/2 -translate-x-1/2 text-center text-white"
              style={{ top: TITLE_TOP, fontSize: TITLE_FONT_CSS, width: 'max-content', maxWidth: '92vw' }}
            >
              Welcome to your new workspace
            </div>
            <div
              ref={subtitleRef}
              className="font-hand leading-hand absolute left-1/2 -translate-x-1/2 text-center text-white/75"
              style={{ bottom: SUBTITLE_BOTTOM_PX, fontSize: SUBTITLE_FONT_CSS, width: 'max-content' }}
            >
              Get started by adding
              <br />
              your first node
            </div>
            {/* Tier 3 — the quieter "You can also…" aside: pushed well
                right of the tier-2 column (see asideLeftCss); 28px heading
                (4-grid step: 24px went blobby in Caveat, 32px competed
                with tier 2) over 24px items; HIDDEN (with its arrows)
                when the window is too narrow for clear separation
                (shouldShowAside) — optional support drops out before it
                can overlap the primary instruction. */}
            {(geom?.showAside ?? true) && (
              <div
                className="font-hand absolute text-white/60"
                style={{ bottom: ASIDE_BOTTOM_PX, left: asideLeftCss }}
              >
                <div className="text-[1.75rem]">You can also:</div>
                <div ref={asideTextRef} className="mt-2 ml-12 text-2xl">
                  add text blocks
                </div>
                <div
                  ref={asideLineRef}
                  className="leading-hand mt-3 ml-12 text-2xl"
                  style={{ maxWidth: ASIDE_MAX_W_PX }}
                >
                  or draw lines to help segment and organize your workspace
                </div>
              </div>
            )}
          </>
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
          {(mobile ? MOBILE_PLACEMENT_COPY : PLACEMENT_COPY)[activeTool] ?? PLACEMENT_COPY.node}
        </div>
        <svg className="absolute inset-0 h-full w-full">{renderArrows(arrows.placement)}</svg>
      </div>
    </div>
  )
}
