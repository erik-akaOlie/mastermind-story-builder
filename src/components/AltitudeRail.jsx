// ============================================================================
// AltitudeRail
// ----------------------------------------------------------------------------
// Viewport-relative semantic-altitude instrument. Lives on the left edge of
// the canvas; reads navigation state from useCanvasUiStore + altitude.js,
// writes back exactly one thing — thresholdGridGapMm — when the user drags
// the thumb. Never reaches into the morph machinery.
//
// ── TWO VISUAL STATES ─────────────────────────────────────────────────────
//   ACTIVE (mouse over the rail area OR currently dragging the thumb):
//     - Track at 8 px wide, tucked to TRACK_LEFT_ACTIVE from container left.
//     - Magnifying-glass icons above + below the rail.
//     - Threshold thumb visible, draggable, spans the dead-band.
//     - Card-View highlight rises behind the thumb (square top corners).
//     - "card view" label visible inside the highlight.
//     - Current-zoom marker is the full chevron-bar-chevron at full stroke.
//
//   REST (mouse away from the rail area):
//     - Track collapses to 4 px wide and slides left toward the canvas edge.
//     - Icons fade out.
//     - Thumb fades out; with no thumb to tuck under, the highlight gets
//       fully rounded corners.
//     - Card-View highlight collapses to 4 px wide.
//     - Label fades out.
//     - Current-zoom marker simplifies to "bar + right chevron at half
//       stroke" (left chevron hidden).
//
//   In BOTH states the Card-View highlight's TOP edge tracks the actual
//   altitude — top at the down-trigger position when the canvas is in
//   Card View, top at the up-trigger position when the canvas is in
//   Bead View. So when the indicator sits inside the dead-band the
//   highlight still tells the user the right state (it'd otherwise lie
//   whichever way the threshold pointed).
//
//   A subtle dark gradient backdrop sits behind everything in both states
//   so the rail UI reads cleanly against busy canvas content (nodes, edges,
//   text annotations) that would otherwise overlap it.
//
// ── THUMB / DEAD-BAND ─────────────────────────────────────────────────────
//   The thumb's vertical extent IS the hysteresis dead-band. Top edge =
//   down-trigger zoom (Card→Bead, smaller number, HIGHER on the rail).
//   Bottom edge = up-trigger zoom (Bead→Card, larger number, LOWER on the
//   rail). While the current-zoom indicator is inside the thumb the
//   previous mode is preserved; only when it exits ABOVE the thumb does
//   Card→Bead fire, and only when it exits BELOW does Bead→Card fire.
//
//   Thumb height stretches to fill the actual dead-band region on the rail,
//   min-clamped at THUMB_MIN_HEIGHT_PX so the grips stay legible when the
//   dead-band fraction is tiny.
//
// ── DRAGGING THE THRESHOLD ────────────────────────────────────────────────
//   The thumb is a pointer-captured drag handle. Dragging up lowers the
//   down-trigger zoom (cards persist further out); dragging down raises it
//   (beads kick in earlier). App.jsx subscribes to thresholdGridGapMm and
//   re-evaluates altitude on change — the canvas morphs the instant the
//   user crosses a trigger, not on the next pan or zoom.
//
// ── MOBILE PORTRAIT (explicit touch model, 2026-07-16) ────────────────────
//   Phones have no hover, and iOS Safari's synthetic tap-hover is a lottery
//   (the codebase already refuses to trust it — see CanvasContextMenu). For
//   weeks that made the rail's engaged state unreachable-at-random on
//   phones ("zoom tool opens without the slider"). On mobile portrait
//   (useMobilePortrait) the rail therefore has a DETERMINISTIC model:
//     - mouseenter/mouseleave are no-ops (fake hover can't half-open it)
//     - a narrow touch strip over the rail line is the ONLY tap target
//       while closed; tapping it OPENS the tool (and does NOT jump zoom)
//     - while open: the thumb is visible/draggable as on desktop, and a
//       tap on the strip jumps zoom (the desktop track-click)
//     - a tap anywhere outside the rail closes it — observed via a
//       non-swallowing document listener, so the underlying canvas tap
//       still behaves normally (select, place, etc.)
//     - the 64px hover container stops intercepting entirely
//       (pointer-events: none) — the dead column over left-side canvas
//       content is gone; only the strip intercepts
//     - the backdrop scrim is much narrower closed, widening on open as a
//       deliberate response to the tap (constants below)
//   Desktop behavior is untouched — every branch keys off the hook.
//
// Sizing follows the 8 px grid as the default; sub-grid values are
// annotated inline.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import {
  DEFAULT_MAX_ZOOM,
  MORPH_HYSTERESIS_RATIO,
  currentThresholdZoom,
  gridGapMmAtZoom,
} from '../utils/altitude'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useMobilePortrait } from '../hooks/useMobilePortrait'

// Container.
const CONTAINER_WIDTH_PX = 64                              // 8 × 8 (hover hit area)
const RAIL_HEIGHT_CSS    = 'clamp(360px, 65vh, 720px)'      // 360 / 720 both ÷ 8

// Track geometry — different in each state.
const TRACK_LEFT_ACTIVE  = 24                              // 8 × 3
const TRACK_WIDTH_ACTIVE = 8                               // 8 × 1
const TRACK_LEFT_REST    = 8                               // 8 × 1 (tucked toward the canvas edge)
const TRACK_WIDTH_REST   = 4                               // ÷ 2: thinner ambient line

// Highlight segment geometry.
const SEGMENT_WIDTH_ACTIVE = 16                            // 8 × 2 (wider overlay on the track)
const SEGMENT_WIDTH_REST   = 4                             // ÷ 2: matches the rest-state track width
const SEGMENT_COLOR        = '#D9D9D9'

// Icon zones above and below the track.
const ICON_SIZE_PX       = 16                              // 8 × 2
const ICON_GAP_PX        = 16                              // 8 × 2 (gap between icon and rail end — = 1 rem)
const ICON_AREA_PX       = ICON_SIZE_PX + ICON_GAP_PX       // 32
const ICON_COLOR         = '#D9D9D9'

// Rotated "card view" label.
const LABEL_FONT_SIZE      = 12                            // ÷ 4: smaller than the 16 base so the rotated label fits the 16 px segment width
const LABEL_COLOR          = '#111827'
const LABEL_LETTER_SPACING = 0.5                           // sub-grid: tracks slightly so the small caps read clearly

// Threshold thumb.
const THUMB_WIDTH_PX      = 24                             // 8 × 3 (Figma 20.82, widened to 8-grid for an easier hit target)
const THUMB_MIN_HEIGHT_PX = 28                             // ÷ 4: matches Figma 27.04, snapped to a 4-multiple
const THUMB_RADIUS_PX     = 4                              // ÷ 4: from Figma; sub-8 to keep the slab feel without softening corners
const THUMB_COLOR         = '#D9D9D9'
const THUMB_SHADOW        = '0px 2px 2px rgba(0, 0, 0, 0.25)'  // from Figma

// Grip lines inside the thumb. Sub-grid because they're meant to read as
// fine texture, not as structural elements.
const GRIP_WIDTH_PX      = 14                              // ÷ 2: 16 would crowd the 24 px thumb
const GRIP_HEIGHT_PX     = 2                               // ÷ 4 (Figma 1.85)
const GRIP_GAP_PX        = 3                               // ÷ 2 (Figma ~2-3 px between grips)
const GRIP_COLOR         = '#989898'

// Current-zoom indicator dimensions.
const INDICATOR_W_PX           = 40                        // 8 × 5 (Figma 38, snapped)
const INDICATOR_H_PX           = 16                        // 8 × 2 (Figma 13, snapped)
const INDICATOR_COLOR          = '#FFFFFF'
const INDICATOR_CHEV_STROKE    = 2                         // ÷ 4: bolder than the bar for visual anchor
const INDICATOR_BAR_STROKE     = 1                         // ÷ 4 (Erik's spec: thin bar)
const INDICATOR_CHEV_ARM_PX    = 6                         // ÷ 2: chevron arm length
const INDICATOR_GAP_PX         = 6                         // ÷ 2: empty space between chevron tip and bar end

// Backdrop scrim — decidedly dark fade out behind the rail UI so it
// reads cleanly against busy canvas content. Width scales with
// interaction state: narrow at rest, widening on hover/drag so the
// expanded UI keeps strong contrast against whatever's underneath.
// Rendered as a viewport-height sibling of the rail container (NOT a
// child of it) so the scrim spans the full canvas vertically — a
// clamped-height backdrop produces visible horizontal edges where the
// rail's vertical extent ends.
//
// Color is tinted to match the canvas's near-edge color (~#061210
// vignetted from the #031a15 base) rather than pure black. Pure black
// drifts toward neutral gray when composited over the canvas's
// green-tinted dark, which reads as an off-hue foreign object instead
// of an organic shadow.
const BACKDROP_WIDTH_ACTIVE = 160                          // 8 × 20
const BACKDROP_WIDTH_REST   = 96                           // 8 × 12

// Mobile-portrait touch model (2026-07-16) — all tunable after phone QA.
const M_TOUCH_STRIP_W_CLOSED = 24                          // 8 × 3 (Erik: bump to 32 if hard to open)
const M_TOUCH_STRIP_W_OPEN   = 48                          // 8 × 6 (covers the active track for tap-to-jump)
const M_BACKDROP_WIDTH_OPEN   = 96                         // 8 × 12 (phone-scaled: desktop active 160 is too wide on 375px)
const M_BACKDROP_WIDTH_CLOSED = 40                         // 8 × 5 (the dead-column fix: was 96 at rest)

// Mobile-portrait CLOSED visuals (Erik's Figma mockup, node 265-226,
// measured 2026-07-16 and snapped to the 8→4→2 rule at 375px scale):
// hairline rail + highlight (mockup 1.8 / 2.7 → both 2, matching how
// desktop rest already keeps track and segment the same width), and the
// current-zoom indicator redrawn as a short notch CENTERED on the rail
// (mockup: 10.2px centered → 8) with only the arrowhead breaking symmetry
// to the right (tip 7.7px from rail center → 8). Open state reuses the
// desktop ACTIVE geometry unchanged.
const M_TRACK_WIDTH_CLOSED   = 2                           // ÷ 2: hairline per mockup (desktop rest stays 4)
const M_SEGMENT_WIDTH_CLOSED = 2                           // ÷ 2: matches the track, as at desktop rest
const M_NOTCH_W_PX           = 8                           // 8 × 1: notch length, centered on the rail
const M_CHEV_TIP_OFFSET_PX   = 8                           // 8 × 1: arrowhead tip's distance right of rail center
const BACKDROP_MAX_ALPHA    = 0.88                         // sub-grid: tuned so the composite at the left edge reads as a clear darker shade of the canvas hue
const BACKDROP_TINT_RGB     = '3, 9, 8'                    // ≈ canvas hue (#061210) at half luminance — darkens-in-hue when composited
// Multi-stop gradient mimics a cubic ease-out on alpha. Two-stop linear
// felt perceptually flat at the dark end and faded too quickly at the
// transparent end; the intermediate stops slow the falloff in the
// middle so the right edge dissolves rather than cutting off.
const BACKDROP_GRADIENT = (
  'linear-gradient(to right, ' +
    `rgba(${BACKDROP_TINT_RGB},${BACKDROP_MAX_ALPHA}) 0%, ` +
    `rgba(${BACKDROP_TINT_RGB},${(BACKDROP_MAX_ALPHA * 0.85).toFixed(3)}) 18%, ` +
    `rgba(${BACKDROP_TINT_RGB},${(BACKDROP_MAX_ALPHA * 0.6).toFixed(3)}) 42%, ` +
    `rgba(${BACKDROP_TINT_RGB},${(BACKDROP_MAX_ALPHA * 0.3).toFixed(3)}) 68%, ` +
    `rgba(${BACKDROP_TINT_RGB},${(BACKDROP_MAX_ALPHA * 0.1).toFixed(3)}) 85%, ` +
    `rgba(${BACKDROP_TINT_RGB},0) 100%` +
  ')'
)

// Animation timing for all state transitions.
const TRANSITION_MS = 220                                  // sub-grid (200 felt slightly snappy, 240 too lazy)
const T_OPACITY     = `opacity ${TRANSITION_MS}ms ease-out`
const T_GEOMETRY    = (
  `left ${TRANSITION_MS}ms ease-out, ` +
  `width ${TRANSITION_MS}ms ease-out, ` +
  `top ${TRANSITION_MS}ms ease-out, ` +
  `height ${TRANSITION_MS}ms ease-out, ` +
  `border-radius ${TRANSITION_MS}ms ease-out, ` +
  `opacity ${TRANSITION_MS}ms ease-out`
)
const T_STROKE      = `stroke-width ${TRANSITION_MS}ms ease-out, opacity ${TRANSITION_MS}ms ease-out`

// Log-scale normalization. The rail's vertical extent maps to log(zoom),
// so doubling zoom moves the same visual distance everywhere. Top of
// rail = full zoom OUT (minZoom); bottom = full zoom IN (maxZoom).
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

// Chevron-bar-chevron SVG. Single SVG; each element gets its own
// CSS-driven stroke-width and opacity so rest/active transitions read
// as smooth fades rather than DOM swaps.
//
// mobileNotch (phone portrait, CLOSED): instead of the rest-state
// "bar trailing right of the rail," the bar is a short notch CENTERED
// on the rail (SVG center = rail center) and the right chevron pulls in
// so only the arrowhead breaks the rail's symmetry — per the Figma
// mockup (265-226). Open state renders the normal ACTIVE indicator.
function ZoomIndicatorSvg({ isInteracting, mobileNotch, reducedMotion }) {
  const w = INDICATOR_W_PX
  const h = INDICATOR_H_PX
  const midY = h / 2
  const chevPad = 1
  const chevLeftTipX  = chevPad + INDICATOR_CHEV_ARM_PX
  const chevRightTipX = mobileNotch
    ? w / 2 + M_CHEV_TIP_OFFSET_PX
    : w - chevPad - INDICATOR_CHEV_ARM_PX
  const chevRightBackX = mobileNotch
    ? chevRightTipX + INDICATOR_CHEV_ARM_PX
    : w - chevPad
  const barLeftActiveX = chevLeftTipX + INDICATOR_GAP_PX
  // At rest the left chevron is hidden, but the bar shouldn't extend out
  // into the now-empty left half — it should look like the bar only
  // trails to the right of the rail. Anchor the bar's left edge at the
  // rail's center (= SVG center). Mobile closed: the notch straddles the
  // center instead.
  const barLeftRestX  = mobileNotch ? w / 2 - M_NOTCH_W_PX / 2 : w / 2
  const barRightX     = mobileNotch ? w / 2 + M_NOTCH_W_PX / 2 : chevRightTipX - INDICATOR_GAP_PX
  const chevStroke = isInteracting ? INDICATOR_CHEV_STROKE : INDICATOR_CHEV_STROKE / 2
  const barStroke  = isInteracting ? INDICATOR_BAR_STROKE  : INDICATOR_BAR_STROKE  / 2
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      stroke={INDICATOR_COLOR}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Left chevron — hidden at rest. */}
      <polyline
        points={`${chevPad},${chevPad} ${chevLeftTipX},${midY} ${chevPad},${h - chevPad}`}
        style={{
          strokeWidth: chevStroke,
          opacity: isInteracting ? 1 : 0,
          transition: reducedMotion ? 'none' : T_STROKE,
        }}
      />
      {/* Center bar — at rest only the right half trails to the right of
          the rail (no L-chev to "connect" to on the left). */}
      <line
        x1={isInteracting ? barLeftActiveX : barLeftRestX}
        y1={midY}
        x2={barRightX}
        y2={midY}
        style={{
          strokeWidth: barStroke,
          transition: reducedMotion ? 'none' : T_STROKE,
        }}
      />
      {/* Right chevron — always visible. */}
      <polyline
        points={`${chevRightBackX},${chevPad} ${chevRightTipX},${midY} ${chevRightBackX},${h - chevPad}`}
        style={{
          strokeWidth: chevStroke,
          transition: reducedMotion ? 'none' : T_STROKE,
        }}
      />
    </svg>
  )
}

export default function AltitudeRail({ onZoomTo }) {
  const currentZoom = useCanvasUiStore((s) => s.currentZoom)
  const minZoom     = useCanvasUiStore((s) => s.dynamicMinZoom)
  const thresholdMm = useCanvasUiStore((s) => s.thresholdGridGapMm)
  const altitude    = useCanvasUiStore((s) => s.altitude)
  const maxZoom     = DEFAULT_MAX_ZOOM
  // Honor the OS-level prefers-reduced-motion flag — the rest of the
  // morph machinery already respects it (cards collapse instantly to
  // beads, edges don't cross-fade), so the rail should too. When set,
  // every state-transition animation (slide-in, fade, stroke change,
  // gradient width) snaps to its final value in a single frame.
  const reducedMotion = useReducedMotion()
  const tGeometry = reducedMotion ? 'none' : T_GEOMETRY
  const tOpacity  = reducedMotion ? 'none' : T_OPACITY

  // Dead-band endpoints. downTriggerZ is the Card→Bead boundary (smaller
  // zoom → higher rail position → thumb's TOP edge). upTriggerZ is the
  // Bead→Card boundary (larger zoom → lower rail position → thumb's
  // BOTTOM edge).
  const downTriggerZ = currentThresholdZoom(thresholdMm)
  const upTriggerZ   = downTriggerZ * MORPH_HYSTERESIS_RATIO

  const trackRef = useRef(null)
  const rootRef  = useRef(null)
  const [isDraggingThumb, setIsDraggingThumb] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  // Mobile portrait: the explicit tap-open state (see header). Hover plays
  // no part on phones — iOS fake tap-hover is nondeterministic.
  const mobilePortrait = useMobilePortrait()
  const [isTouchOpen, setIsTouchOpen] = useState(false)
  // The component reads as ACTIVE whenever (desktop) the pointer is over
  // the rail container, (mobile) the tool was tap-opened, OR a drag is in
  // flight (so the rail doesn't collapse out from under the user mid-drag).
  const isInteracting = (mobilePortrait ? isTouchOpen : isHovered) || isDraggingThumb

  // No-ops on mobile so a synthetic tap-hover can never half-open the rail
  // (deterministic open/close belongs to the touch strip alone).
  const handleEnter = () => { if (!mobilePortrait) setIsHovered(true) }
  const handleLeave = () => { if (!mobilePortrait) setIsHovered(false) }

  // Tap-outside closes (mobile, only while open). The listener OBSERVES —
  // never swallows — so the underlying canvas tap still behaves normally
  // (select / marquee / placement all proceed); the rail just closes
  // alongside. Capture phase so a stopPropagation elsewhere can't leave
  // the rail stuck open.
  useEffect(() => {
    if (!mobilePortrait || !isTouchOpen) return
    const onDocPointerDown = (e) => {
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return
      setIsTouchOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true)
  }, [mobilePortrait, isTouchOpen])

  const handleTrackClick = (event) => {
    if (isDraggingThumb) return
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const t = (event.clientY - rect.top) / rect.height
    const targetZoom = denormalizeLog(t, minZoom, maxZoom)
    onZoomTo?.(targetZoom)
  }

  // Pointer-captured drag on the thumb. The grab point stays under the
  // cursor; the new threshold zoom is computed from where the thumb's
  // TOP edge would land at each pointermove. Writes only to
  // thresholdGridGapMm — App.jsx subscribes to that value and re-runs
  // the altitude evaluation in real time.
  const handleThumbPointerDown = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.button !== 0) return
    const trackEl = trackRef.current
    if (!trackEl) return
    const trackRect = trackEl.getBoundingClientRect()
    const thumbEl = event.currentTarget
    const thumbRect = thumbEl.getBoundingClientRect()
    const grabOffsetY = event.clientY - thumbRect.top

    try { thumbEl.setPointerCapture(event.pointerId) } catch { /* older browsers */ }
    setIsDraggingThumb(true)

    const updateThresholdFromY = (clientY) => {
      const desiredThumbTopY = clientY - grabOffsetY
      let t = (desiredThumbTopY - trackRect.top) / trackRect.height
      t = Math.max(0, Math.min(1, t))
      const newDownTriggerZ = denormalizeLog(t, minZoom, maxZoom)
      const newMm = gridGapMmAtZoom(newDownTriggerZ)
      useCanvasUiStore.getState().setThresholdGridGapMm(newMm)
    }

    const onMove = (moveEvent) => {
      moveEvent.preventDefault()
      updateThresholdFromY(moveEvent.clientY)
    }
    const onUp = () => {
      setIsDraggingThumb(false)
      try { thumbEl.releasePointerCapture(event.pointerId) } catch { /* noop */ }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // Positions in [0, 1] along the rail (0 = top, 1 = bottom).
  const posCurrent     = normalizeLog(currentZoom,  minZoom, maxZoom)
  const posDownTrigger = normalizeLog(downTriggerZ, minZoom, maxZoom)
  const posUpTrigger   = normalizeLog(upTriggerZ,   minZoom, maxZoom)

  // Resolved geometry — branches on isInteracting; mobile portrait's
  // CLOSED state uses the hairline widths from the Figma mockup (open
  // reuses the desktop ACTIVE geometry unchanged).
  const trackLeft    = isInteracting ? TRACK_LEFT_ACTIVE  : TRACK_LEFT_REST
  const trackWidth   = isInteracting
    ? TRACK_WIDTH_ACTIVE
    : (mobilePortrait ? M_TRACK_WIDTH_CLOSED : TRACK_WIDTH_REST)
  const trackCenterX = trackLeft + trackWidth / 2
  const segmentWidth = isInteracting
    ? SEGMENT_WIDTH_ACTIVE
    : (mobilePortrait ? M_SEGMENT_WIDTH_CLOSED : SEGMENT_WIDTH_REST)

  // The Card-View highlight's TOP edge depends on whether the user is
  // INTERACTING with the rail or not:
  //
  //   ACTIVE (thumb visible, threshold legible):
  //     Highlight tops out at posDownTrigger and extends UP BEHIND the
  //     thumb. The thumb itself shows the dead-band; the highlight
  //     shows "Card View territory defined by the current threshold."
  //     Relative position of the indicator vs the thumb tells the user
  //     which side they're actually on — the highlight doesn't need to
  //     do that work too.
  //
  //   REST (no thumb, no dead-band visual):
  //     Highlight has to reflect the ACTUAL altitude on its own — there's
  //     no thumb to disambiguate the dead-band region. So the top edge
  //     tracks altitude:
  //       altitude === 'cardView' → top at posDownTrigger
  //                                 (covers the whole Card View region,
  //                                  including the dead-band the user is
  //                                  currently in)
  //       altitude === 'beadView' → top at posUpTrigger
  //                                 (Card View territory starts at the
  //                                  up-trigger; indicator sits above)
  //
  // When the user hovers in/out and altitude is beadView, the highlight
  // top animates between posUpTrigger (rest) and posDownTrigger (active)
  // — the height of one dead-band. Smooth via CSS transition.
  const isCardView    = altitude === 'cardView'
  const segmentTopPos = isInteracting
    ? posDownTrigger
    : (isCardView ? posDownTrigger : posUpTrigger)
  const segmentTopPct    = segmentTopPos * 100
  const segmentHeightPct = 100 - segmentTopPct

  // Top corners: square whenever the thumb is visible (it tucks over the
  // highlight's top to give the "rises behind the slider" effect, both
  // altitudes). Rounded at rest (no thumb covering the top edge).
  const cornerRadiusPx = segmentWidth / 2
  const segmentRadius = isInteracting
    ? `0 0 ${cornerRadiusPx}px ${cornerRadiusPx}px`
    : `${cornerRadiusPx}px`

  // Thumb height as a CSS expression. The actual dead-band fraction
  // multiplied by the rail height is the "real" height; min-clamped so
  // the grips stay legible if the dead-band is small.
  const deadBandPct    = (posUpTrigger - posDownTrigger) * 100
  const thumbHeightCss = `max(${THUMB_MIN_HEIGHT_PX}px, ${deadBandPct}%)`

  return (
    <>
      {/* Backdrop scrim — SIBLING of the rail container, full canvas
          height so there's no hard horizontal edge where a clamped-
          height backdrop would end. Width scales with interaction
          state. Pointer-events: none so it never blocks anything. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: mobilePortrait
            ? (isInteracting ? M_BACKDROP_WIDTH_OPEN : M_BACKDROP_WIDTH_CLOSED)
            : (isInteracting ? BACKDROP_WIDTH_ACTIVE : BACKDROP_WIDTH_REST),
          background: BACKDROP_GRADIENT,
          pointerEvents: 'none',
          transition: tGeometry,
          zIndex: 4,
        }}
      />

    <div
      ref={rootRef}
      className="absolute"
      style={{
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width:  CONTAINER_WIDTH_PX,
        height: RAIL_HEIGHT_CSS,
        zIndex: 5,
        // DESKTOP: capture pointer events on the WHOLE container so the
        // rail expands as soon as the mouse enters its area. Trade-off:
        // marquee-from-leftmost-pixel is blocked, but the rail becomes
        // discoverable without having to aim for a 4 px line.
        // MOBILE PORTRAIT: none — hover doesn't exist, so the 64px column
        // bought nothing and blocked left-side canvas taps (the "dead
        // column"). Only the touch strip (and open-state thumb) intercept.
        pointerEvents: mobilePortrait ? 'none' : 'auto',
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Top icon — full zoom out. Fades + slides to active position. */}
      <div
        style={{
          position: 'absolute',
          left: trackCenterX - ICON_SIZE_PX / 2,
          top: 0,
          width:  ICON_SIZE_PX,
          height: ICON_SIZE_PX,
          color: ICON_COLOR,
          opacity: isInteracting ? 1 : 0,
          transition: tGeometry,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <MagnifyingGlassMinus size={ICON_SIZE_PX} weight="fill" />
      </div>

      {/* Track region — everything that maps to the [minZoom, maxZoom]
          axis lives here. Children use percentages so they scale with
          the responsive rail height. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: ICON_AREA_PX,
          right: 0,
          bottom: ICON_AREA_PX,
        }}
      >
        {/* Mobile touch strip — the ONLY closed-state tap target on phones.
            Invisible; sits over the rail line (24px wide closed — tunable,
            32 if QA finds it hard to hit; 48 open, covering the active
            track). First tap OPENS the tool without jumping zoom; while
            open, a tap is the desktop track-click (jump zoom). The thumb
            renders later in the DOM, so it stacks above and keeps its own
            drag. */}
        {mobilePortrait && (
          <div
            role="button"
            aria-label={isTouchOpen
              ? 'Altitude rail — tap to jump zoom'
              : 'Open zoom tool'}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: isTouchOpen ? M_TOUCH_STRIP_W_OPEN : M_TOUCH_STRIP_W_CLOSED,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              if (!isTouchOpen) {
                setIsTouchOpen(true)   // opening tap opens ONLY — no zoom jump
                return
              }
              handleTrackClick(e)
            }}
          />
        )}

        {/* The clickable rail line (desktop; on mobile the touch strip owns
            taps so the 4px line never competes with it). */}
        <div
          ref={trackRef}
          className="absolute rounded-full bg-gray-400"
          style={{
            left:    trackLeft,
            top:     0,
            width:   trackWidth,
            height:  '100%',
            opacity: 0.45,
            cursor:  'pointer',
            pointerEvents: mobilePortrait ? 'none' : 'auto',
            transition: tGeometry,
          }}
          onClick={handleTrackClick}
          aria-label="Altitude rail — click to jump zoom"
        />

        {/* Card-View highlight band. Always present; geometry / corners
            differ between states. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left:         trackCenterX - segmentWidth / 2,
            top:          `${segmentTopPct}%`,
            width:        segmentWidth,
            height:       `${segmentHeightPct}%`,
            background:   SEGMENT_COLOR,
            borderRadius: segmentRadius,
            opacity:      1,
            transition:   tGeometry,
          }}
        />

        {/* "card view" rotated label — fades out at rest. writingMode +
            rotate(180deg) lets the rotated text claim its true rotated
            dimensions in layout flow so a plain flex-center on the
            wrapper centers it correctly. */}
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{
            left:   trackCenterX - SEGMENT_WIDTH_ACTIVE / 2,
            top:    `${posUpTrigger * 100}%`,
            width:  SEGMENT_WIDTH_ACTIVE,
            height: `${(1 - posUpTrigger) * 100}%`,
            opacity: isInteracting ? 1 : 0,
            transition: tOpacity,
          }}
        >
          <span
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontFamily: 'Inter, sans-serif',
              fontSize: LABEL_FONT_SIZE,
              color: LABEL_COLOR,
              letterSpacing: LABEL_LETTER_SPACING,
            }}
          >
            card view
          </span>
        </div>

        {/* Threshold thumb — visible only in active state. Pointer-
            events are auto only while visible so a rest-state click in
            the same vertical band still reaches the track underneath. */}
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{
            left:       trackCenterX - THUMB_WIDTH_PX / 2,
            top:        `${posDownTrigger * 100}%`,
            width:      THUMB_WIDTH_PX,
            height:     thumbHeightCss,
            background: THUMB_COLOR,
            borderRadius: THUMB_RADIUS_PX,
            boxShadow:  THUMB_SHADOW,
            gap:        GRIP_GAP_PX,
            opacity:    isInteracting ? 1 : 0,
            pointerEvents: isInteracting ? 'auto' : 'none',
            cursor: isDraggingThumb ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
            transition: tGeometry,
          }}
          onPointerDown={handleThumbPointerDown}
          role="slider"
          aria-label="Card / Bead threshold — drag to set where on the zoom scale cards become beads"
          aria-valuemin={minZoom}
          aria-valuemax={maxZoom}
          aria-valuenow={downTriggerZ}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width:  GRIP_WIDTH_PX,
                height: GRIP_HEIGHT_PX,
                background: GRIP_COLOR,
                borderRadius: 1,
              }}
            />
          ))}
        </div>

        {/* Current-zoom indicator — same SVG in both states; CSS
            transitions on opacity and stroke-width do the visual
            simplification at rest. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: trackCenterX - INDICATOR_W_PX / 2,
            top:  `calc(${posCurrent * 100}% - ${INDICATOR_H_PX / 2}px)`,
            width:  INDICATOR_W_PX,
            height: INDICATOR_H_PX,
            transition: tGeometry,
          }}
          aria-hidden="true"
        >
          <ZoomIndicatorSvg
            isInteracting={isInteracting}
            mobileNotch={mobilePortrait && !isInteracting}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>

      {/* Bottom icon — full zoom in. */}
      <div
        style={{
          position: 'absolute',
          left: trackCenterX - ICON_SIZE_PX / 2,
          bottom: 0,
          width:  ICON_SIZE_PX,
          height: ICON_SIZE_PX,
          color: ICON_COLOR,
          opacity: isInteracting ? 1 : 0,
          transition: tGeometry,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <MagnifyingGlassPlus size={ICON_SIZE_PX} weight="fill" />
      </div>
    </div>
    </>
  )
}
