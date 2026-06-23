import { useState, useRef, useEffect, useMemo } from 'react'
import { Handle, Position, useViewport } from 'reactflow'
import { useNodeTypes } from '../store/useTypeStore'
import { useCanvasUiStore, selectIsEdgeHighlighted } from '../store/useCanvasUiStore'
import { useCanvasOps } from '../lib/CanvasOpsContext.jsx'
import QuickConnectButtons from './QuickConnectButtons.jsx'
import { useImageUrl } from '../lib/useImageUrl'
import { useLightbox } from '../components/Lightbox'
import { labelInitial } from '../utils/labelUtils'
import { BEAD_DIAMETER_PX, BEAD_BORDER_SCREEN_PX, MORPH_DURATION_MS, CONNECTION_DOT_SCREEN_PX, REPEL_PAD_FRACTION, currentThresholdZoom } from '../utils/altitude'
import { useReducedMotion } from '../hooks/useReducedMotion'
import BlockPreview from './BlockPreview'

// Shared offscreen canvas for text-width measurement. Created once, reused by
// every card instance. Used to decide whether the title needs the icon's space.
let __measureCtx = null
function getMeasureCtx() {
  if (!__measureCtx && typeof document !== 'undefined') {
    __measureCtx = document.createElement('canvas').getContext('2d')
  }
  return __measureCtx
}

const BASE_TITLE_SIZE = 1  // rem — 16px at default browser zoom; ÷8 ✓; this is the minimum

// Hover dwell before the quick-connect buttons appear on a selected card.
// Long enough that ordinary mousing across a selected card doesn't sprout
// buttons; short enough to feel responsive when the user parks deliberately.
const QUICK_CONNECT_DWELL_MS = 800
// Linger after hover ends before the buttons hide. The buttons float 8px off
// the card edge, and that gap belongs to no element — crossing it fires
// mouseleave. The linger keeps the buttons alive while the cursor crosses;
// same hover-intent pattern (and duration) as CanvasContextMenu's submenu.
const QUICK_CONNECT_LINGER_MS = 200

// Inline styles beat React Flow's class-based selection/focus box-shadow rules
// (specificity 1-0-0-0 vs 0-2-0), so these always win without needing !important.
const SHADOW_NORMAL = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)'
const SHADOW_LIFTED = '0 20px 40px -8px rgba(0,0,0,0.18), 0 8px 16px -4px rgba(0,0,0,0.1)'


const headerTextColor = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}

// Darkens a hex color by a given amount (0–1) for the avatar fallback background
const darkenColor = (hex, amount = 0.25) => {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - Math.round(255 * amount))
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amount))
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amount))
  return `rgb(${r},${g},${b})`
}

export default function CampaignNode({ data, selected, xPos, yPos }) {
  const [hovered, setHovered] = useState(false)
  const { zoom, x: panX, y: panY } = useViewport()
  const NODE_TYPES = useNodeTypes()
  const typeConfig = NODE_TYPES[data.type] || { label: data.type, color: data.color || '#6B7280' }

  // ── Reduced-motion accessibility (Chunk F, per ADR-0010) ──────────────────
  // When the OS-level `prefers-reduced-motion: reduce` is set, the morph
  // collapses to a zero-duration swap: geometry, content cross-fade,
  // dot fade, edge fade, and drag-end drift all run at 0 ms. `morphMs` is
  // the single source of truth for the morph's animation budget — used in
  // every transition string and the drift rAF guard below.
  const reducedMotion = useReducedMotion()
  const morphMs = reducedMotion ? 0 : MORPH_DURATION_MS

  // ── Bead View hover-expand (per ADR-0010 / Chunk D) ───────────────────────
  // A bead pops back into a readable card on hover or single-select, but
  // pinned at "threshold-size" (= the screen size cards had at the Card→
  // Bead morph trigger). That screen size is the floor; the card never gets
  // smaller than it, no matter how far below the threshold the user zooms.
  //
  // Implementation: treat the rendering math as if the canvas zoom were
  // clamped at the threshold (`effectiveZoom`), and compose a counter-scale
  // on the container that brings the rendered visual back up to threshold
  // size. At canvas zoom = threshold the counter-scale is 1; below threshold
  // it grows to (threshold / canvasZoom).
  const altitudeMode      = useCanvasUiStore((s) => s.altitude)
  const hoveredNodeId     = useCanvasUiStore((s) => s.hoveredNodeId)
  const selectedNodeIds   = useCanvasUiStore((s) => s.selectedNodeIds)
  const isInBeadView      = altitudeMode === 'beadView'
  const isThisHovered     = hoveredNodeId === data.id
  const isThisSingleSel   = selectedNodeIds.size === 1 && selectedNodeIds.has(data.id)
  // True when THIS node is one of the two endpoints of the currently-hovered
  // connection line (Part A's 200ms-dwell edge-hover set). In Bead View this
  // expands the node — so hovering a line pops BOTH its endpoints into cards.
  const isEdgeHighlighted = useCanvasUiStore(selectIsEdgeHighlighted(data.id))
  // A node expands when, in Bead View, any of these hold — this is a UNION, not
  // a winner-take-all: hover-expand (this node hovered), single-select expand
  // (selected alone, no node hovered), OR edge-hover expand (an endpoint of the
  // dwelled line). More than one node can therefore be expanded at once (the
  // two endpoints of a hovered line). This derivation mirrors App.jsx's
  // currentlyExpandedIds set so the local expansion and the store's published
  // records always agree on which nodes are expanded.
  const isExpanded        = isInBeadView && (
    isThisHovered ||
    (hoveredNodeId === null && isThisSingleSel) ||
    isEdgeHighlighted
  )
  // True when THIS card is open ONLY because an edge-hover session is holding
  // it (an endpoint of the dwelled line). Such a card is a read-only "peek":
  // it must be click-through (pointer-events:none, applied on the root below)
  // so it can't steal pointer-hover and collapse its partner endpoint. Scoped
  // to session expansion alone — `isEdgeHighlighted` is set only by an active
  // session (useEdgeHoverSession), so selection / direct node-hover expansion
  // keep their normal, interactive pointer behavior.
  const isSessionCard     = isInBeadView && isEdgeHighlighted
  // Read the threshold from the store so a future altitude-rail UI that
  // mutates it propagates here without code changes. Default value (2.65)
  // lives in the store; altitude.js exposes the legacy constant only as a
  // fallback for callers that don't have store access.
  const thresholdMm       = useCanvasUiStore((s) => s.thresholdGridGapMm)
  const thresholdZoom     = currentThresholdZoom(thresholdMm)
  const effectiveZoom     = isExpanded ? Math.max(zoom, thresholdZoom) : zoom
  const counterScale      = isExpanded ? Math.max(1, thresholdZoom / zoom) : 1

  // Scale header text up as the user zooms out so titles remain readable.
  // zoom >= 1 → use base sizes (already sharp at 100%+).
  // zoom <  1 → divide by zoom to compensate; cap at 5× so extreme zoom-out
  //             doesn't produce absurdly large CSS values.
  // In expanded mode, `effectiveZoom` is clamped at thresholdZoom so the
  // compensation matches what the card would look like at the threshold —
  // composing with the counter-scale below to produce threshold-size on
  // screen regardless of how deep the canvas is zoomed.
  const compensation = effectiveZoom < 1 ? Math.min(1 / effectiveZoom, 5) : 1
  const titleFontSize = BASE_TITLE_SIZE * compensation
  // Icon size in px — 1.25× the title font so it has visual weight without overpowering the text
  const iconSize = Math.round(titleFontSize * 16 * 1.25)

  // ── Avatar sizing — diameter tracks the header's rendered height ──────────
  // ResizeObserver fires whenever text wraps or zoom changes the header height.
  // borderBoxSize.blockSize is the full outer height including padding.
  const headerRef = useRef(null)
  const [avatarSize, setAvatarSize] = useState(0)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      setAvatarSize(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Dynamic icon visibility + dynamic card width ────────────────────────
  // Two decisions share the same word-width measurement, so they live in one
  // memo:
  //
  //   iconHidden — at extreme zoom-out, when the title's longest unbreakable
  //   word would be wider than the title span with the icon visible, the
  //   icon is hidden so the title gets the full header width.
  //
  //   cardWidth — when the title's longest word still doesn't fit (even with
  //   the icon hidden), the card itself widens just enough to give the
  //   longest word room plus a 1rem (16px) breathing strip between text and
  //   the card's right edge. At zoom ≥ 1 (or when the title comfortably fits)
  //   this returns to the base 256px width. React Flow re-measures the node
  //   when its outer div's width changes, which triggers useEdgeGeometry to
  //   re-place edge endpoints and connection dots automatically.
  //
  // Critical: this decision must NOT depend on the measured `avatarSize`
  // state, because `avatarSize` is itself a downstream result of the rendered
  // layout (depending on the chosen card width and whether the icon is
  // visible). Reading it here creates a feedback loop that oscillates at any
  // zoom level where the layout choice changes the title's line count.
  //
  // Instead, we simulate the converged layout deterministically: iterate
  // (avatar height, icon visibility, card width) until they all stabilize.
  //
  // Layout constants (see header JSX below):
  //   base card width         = 256 (w-64)
  //   outer flex gap          = 8   (gap-2 on the header container)
  //   title div right padding = 8   (pr-2)  ← contributes to the right margin
  //   title div inner gap     = 8   (gap-2 between title span and icon)
  //   header vertical padding = 32  (py-4)
  //   right breathing target  = 16  (1rem clear between text and card edge)
  const { iconHidden, cardWidth } = useMemo(() => {
    const BASE_CARD       = 256
    const PAD_OUTER       = 8
    const PR_2            = 8
    const INNER_GAP       = 8
    const PY_4            = 32
    const RIGHT_BREATHING = 16

    if (!data.label) return { iconHidden: false, cardWidth: BASE_CARD }
    const ctx = getMeasureCtx()
    if (!ctx) return { iconHidden: false, cardWidth: BASE_CARD }
    const fontPx = titleFontSize * 16
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`

    const words = data.label.split(/\s+/).filter(Boolean)
    if (words.length === 0) return { iconHidden: false, cardWidth: BASE_CARD }

    // Per-word widths (computed once) drive a real greedy word-wrap below.
    // An earlier version used `ceil(totalTextWidth / span)` which is a
    // continuous approximation; greedy wrap can produce MORE lines than that
    // estimate when adjacent words awkwardly overflow by a small margin
    // (e.g., "Strahd von" at 210px just barely doesn't fit a 208px span).
    // Underestimating lines underestimates avatar height, which shrinks the
    // computed span, which lets the longest word still overflow. Greedy
    // matches the browser's actual rendering decision.
    const wordWidths = words.map((w) => ctx.measureText(w).width)
    const spaceWidth = ctx.measureText(' ').width
    const longestWordWidth = wordWidths.reduce((m, w) => (w > m ? w : m), 0)

    function greedyLines(span) {
      if (span <= 0) return Infinity
      let lines = 1
      let lineW = 0
      for (const w of wordWidths) {
        const next = lineW === 0 ? w : lineW + spaceWidth + w
        if (next > span && lineW > 0) {
          lines++
          lineW = w
        } else {
          lineW = next
        }
      }
      return lines
    }

    const hasIcon = !!typeConfig.icon

    // The minimum span the title needs: longest word fits with `RIGHT_BREATHING`
    // total clear between rightmost text pixel and card's right edge. PR_2
    // already contributes 8px, so we need (RIGHT_BREATHING - PR_2) extra inside
    // the span.
    const minSpan = longestWordWidth + Math.max(0, RIGHT_BREATHING - PR_2)

    // Iterate: at the current cardWidth + iconHidden, compute span via the
    // greedy line counter → avatar height → required cardWidth. Loop until
    // stable. Converges in a handful of passes for any real title.
    let cardWidth  = BASE_CARD
    let iconHidden = false
    let avatar     = PY_4 + Math.max(fontPx, hasIcon ? iconSize : fontPx)

    for (let i = 0; i < 8; i++) {
      const iconStuff = hasIcon && !iconHidden ? (INNER_GAP + iconSize) : 0
      const fixedHorz = avatar + PAD_OUTER + iconStuff + PR_2
      const span      = cardWidth - fixedHorz

      // If a visible icon would force the longest word to overflow, hide it
      // and re-evaluate next pass.
      if (hasIcon && !iconHidden && span < longestWordWidth) {
        iconHidden = true
        continue
      }

      const lines     = greedyLines(span)
      const newAvatar = PY_4 + Math.max(lines * fontPx, hasIcon && !iconHidden ? iconSize : fontPx)

      // Required cardWidth so span ≥ minSpan with the new avatar.
      // The (newAvatar - avatar) term re-projects fixedHorz to the new avatar,
      // so we don't need a second pass just to apply the bump.
      const requiredCard = Math.max(BASE_CARD, fixedHorz + minSpan + (newAvatar - avatar))

      if (newAvatar === avatar && requiredCard === cardWidth) break
      avatar    = newAvatar
      cardWidth = requiredCard
    }

    return { iconHidden, cardWidth }
  }, [typeConfig.icon, data.label, titleFontSize, iconSize])

  const anyHovered   = useCanvasUiStore((s) => s.anyHovered)
  const anySelected  = useCanvasUiStore((s) => s.anySelected)
  const edgeHovered  = useCanvasUiStore((s) => s.hoveredEdgeNodeIds != null)
  const anythingActive = anyHovered || edgeHovered

  // ── Bead-form rendering + content-height measurement ──────────────────────
  // isBead = "render the bead form" (collapsed circular shape, opacity flip).
  // The Chunk D hover-expand carves out a third state: when in Bead View
  // AND the node is hovered/single-selected, the bead form is suppressed and
  // the card form re-appears at threshold-size. isExpanded was derived at
  // the top of the component.
  //
  // ResizeObserver tracks the rendered card-content height so the container
  // height can transition smoothly between that measured value and
  // BEAD_DIAMETER_PX — CSS can't transition from `height: auto` to a fixed
  // pixel value, so the natural height has to be a numeric value at all
  // times. Pattern mirrors the existing avatar-sizing observer above; same
  // shape, different concern.
  const isBead = isInBeadView && !isExpanded
  // Subscribed only to know whether we're inside the 150ms morph window —
  // when null, the geometric transitions (width/height/border-width/etc.)
  // are dropped from the inline transition string so card-mode zoom updates
  // (which change cardWidth continuously as the title font scales) don't
  // lag behind every zoom tick.
  const morphPhase = useCanvasUiStore((s) => s.morphPhase)
  // Local per-node morph flag for hover-expand transitions, with TWO parts:
  //   1. justFlippedExpansion (render-time):  true on the SAME render that
  //      isExpanded changes. Lets the dots snap to opacity 0 on the same
  //      frame the container starts morphing — without this the dots would
  //      stay visible for one paint cycle because useEffect runs only after
  //      the first paint.
  //   2. isExpansionMorphing (useEffect):     true for MORPH_DURATION_MS
  //      after isExpanded flips. Keeps the morph window open through the
  //      whole 150ms transition (the render-time flag is only true for
  //      one render).
  // Together they cover the full morph: dots invisible from the very first
  // paint of the morph through 150ms after.
  const prevIsExpandedRef = useRef(isExpanded)
  const justFlippedExpansion = prevIsExpandedRef.current !== isExpanded
  const [isExpansionMorphing, setIsExpansionMorphing] = useState(false)
  useEffect(() => {
    if (prevIsExpandedRef.current === isExpanded) return
    prevIsExpandedRef.current = isExpanded
    setIsExpansionMorphing(true)
    const t = setTimeout(() => setIsExpansionMorphing(false), morphMs)
    return () => clearTimeout(t)
  }, [isExpanded])
  const morphInFlight = morphPhase !== null || isExpansionMorphing || justFlippedExpansion
  const cardContentRef = useRef(null)
  const [contentHeight, setContentHeight] = useState(180) // fallback before first measurement

  useEffect(() => {
    const el = cardContentRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      // Skip the 0-height samples React Flow can briefly produce mid-mount;
      // they would zero out the container during the first paint.
      if (h > 0) setContentHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Selected cards are always part of the user's active focus — never dimmed, always lifted.
  // Hover and edge-highlight also lift. Selection persists regardless of what else is hovered.
  // The inspector's topic node (data.isEditing) stays in this active/selected
  // state too: it remains visible in the graph as the source of the open
  // inspector rather than vanishing under it.
  const isActive = hovered || isEdgeHighlighted || selected || data.isEditing
  const lifted   = hovered || isEdgeHighlighted || selected || data.isEditing

  // Three resting states for the card's opacity:
  //   - active   (hovered / edge-highlighted / selected)        → full
  //   - dimmed   (something ELSE is active — pulled out of focus) → pushed back
  //   - resting  (nothing on the canvas is active right now)     → slightly dimmed
  // Locked cards halve every level. The dim was 0.15 originally; testers
  // (Chris/Todd, 2026-05) found selecting one node made the rest of the graph
  // nearly invisible — losing the surrounding context that makes the web
  // legible. Softened to 0.45 so unselected cards recede but stay readable
  // (matches graph-focus norms in Obsidian / Neo4j).
  const baseOpacity = data.locked ? 0.5 : 1
  const isResting = !isActive && !anythingActive && !anySelected && !data.isEditing
  let opacity
  if (isActive) {
    opacity = baseOpacity
  } else if (anythingActive || anySelected) {
    opacity = baseOpacity * 0.45
  } else {
    opacity = baseOpacity * 0.85
  }

  const shadow = lifted ? SHADOW_LIFTED : SHADOW_NORMAL
  const scale  = lifted ? 1.03 : 1

  const avatarBg = darkenColor(typeConfig.color)
  const avatarInitialSize = Math.round(avatarSize * 0.45)
  const hdrText = headerTextColor(typeConfig.color)
  // Per-node display preference (migration 013). When set, the identity image
  // is suppressed in the canvas: nulling avatarUrl makes the BEAD fall back to
  // its first-letter initial automatically, and the card header below renders
  // title-only (no avatar box, no type icon). The stored avatar is untouched.
  const hideAvatar = !!data.hideAvatar
  const avatarUrl = useImageUrl(hideAvatar ? null : data.avatar, 'thumb')
  const lightbox = useLightbox()

  // Bead's no-thumbnail fallback — the card title's first initial in the
  // type's contrast color. Matches the card-view avatar empty state, so a
  // beadless card and a card-view card read the same identity cue at any
  // altitude. Revises ADR-0010's original "type icon as fallback" call
  // (see ADR-0010 addendum 2026-05-22).
  // Letter sized at 45% of bead diameter — the same ratio the card-view
  // avatar uses for its initial (avatarSize * 0.45), so card-view and
  // bead-view empty states share one sizing rule.
  const beadInitialSize = Math.round(BEAD_DIAMETER_PX * 0.45) // 72px in a 160px bead

  // Border width in CANVAS px — inverse-scaled by `compensation` in bead mode
  // so it renders at a constant ~BEAD_BORDER_SCREEN_PX on screen, zero in
  // card mode. Exported as a variable because two places consume it: the
  // container's border style, and the connection-dot positioning (which
  // must subtract it to compensate for CSS positioning being measured from
  // the padding-edge, not the border-edge, of the container).
  const borderCanvasPx = isBead ? BEAD_BORDER_SCREEN_PX * compensation : 0

  // ── Hit-box floor: prevent expand/collapse flicker on short cards ─────────
  // When a card with no summary/body and a short title is expanded, its
  // natural content height can be less than the bead's diameter. The
  // expanded card's layout box would then be SMALLER than the bead's
  // hit-box in the vertical direction. A user who triggered the expansion
  // by hovering the bottom of the bead would find the cursor outside the
  // card's hit-box at the end of the morph → mouse-leave → collapse →
  // mouse re-enters bead → re-expand → flicker loop.
  //
  // Fix: while expanded, the layout box's effective height is at least
  // BEAD_DIAMETER_PX. The extra room below the card content is just the
  // container's background tint extending down — the visible card simply
  // looks a touch taller than its content. The hit box now always
  // encompasses the bead's original extent, so mouse-leave only fires
  // when the user truly moves the cursor away.
  //
  // Horizontal is unaffected: cardWidth has a minimum of 256, which is
  // already > BEAD_DIAMETER_PX (160), so the flicker can only happen
  // vertically.
  const layoutHeight = isExpanded ? Math.max(BEAD_DIAMETER_PX, contentHeight) : contentHeight

  // ── Hover-expand clamp + centering offset (Chunk D) ───────────────────────
  // When the card is expanded in Bead View, we want the visible card center
  // to land on the BEAD's center (not the layout box's center — those
  // differ when isBead is false because the box is now cardWidth ×
  // contentHeight, not BEAD_DIAMETER_PX × BEAD_DIAMETER_PX).
  //
  // Two contributions to the transform's translate:
  //   1. Centering offset: -(cardWidth - BEAD_DIAMETER_PX)/2, similarly Y.
  //      Shifts the visible card so its center sits on the bead's center
  //      instead of the larger layout box's center.
  //   2. Clamp offset:     shift in screen-px to keep the visible card
  //                        inside the viewport with 24px padding.
  //
  // Both expressed in canvas units (the transform's translate is in CSS
  // local units, which equal canvas units inside the RF node coord space).
  // The clamp portion is computed in screen-px first, then /zoom converts.
  //
  // Pure visual offsets: never written into node.position. On collapse the
  // expansion disappears and the bead sits at its true canvas position
  // unchanged.
  const CLAMP_PADDING_PX = 24
  let naturalClampDxScreen = 0
  let naturalClampDyScreen = 0
  if (isExpanded && typeof xPos === 'number' && typeof yPos === 'number') {
    // Bead's screen-space center — the canvas point we want the visible
    // expanded card to be centered on (modulo the clamp).
    const beadScreenCx = (xPos + BEAD_DIAMETER_PX / 2) * zoom + panX
    const beadScreenCy = (yPos + BEAD_DIAMETER_PX / 2) * zoom + panY
    // Expanded card's screen-space size: cardWidth × thresholdZoom.
    // (counterScale × canvas-zoom compose to give thresholdZoom; the card's
    // box is cardWidth wide, so visible-on-screen = cardWidth × thresholdZoom.)
    const cardScreenW = cardWidth   * thresholdZoom
    const cardScreenH = layoutHeight * thresholdZoom
    const left   = beadScreenCx - cardScreenW / 2
    const right  = beadScreenCx + cardScreenW / 2
    const top    = beadScreenCy - cardScreenH / 2
    const bottom = beadScreenCy + cardScreenH / 2
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (left   < CLAMP_PADDING_PX)            naturalClampDxScreen = CLAMP_PADDING_PX - left
    else if (right  > vw - CLAMP_PADDING_PX)  naturalClampDxScreen = (vw - CLAMP_PADDING_PX) - right
    if (top    < CLAMP_PADDING_PX)            naturalClampDyScreen = CLAMP_PADDING_PX - top
    else if (bottom > vh - CLAMP_PADDING_PX)  naturalClampDyScreen = (vh - CLAMP_PADDING_PX) - bottom
  }

  // ── Drag freeze + post-drop drift (Chunk D step 7) ────────────────────────
  // While THIS node is being dragged AND it's the expanded one, the clamp
  // offset is FROZEN at whatever value was rendered the moment the drag
  // started. React Flow moves the bead 1:1 with the cursor in screen
  // space; with a constant clamp offset the visible expanded card moves
  // 1:1 with the cursor too — cursor attachment is preserved.
  //
  // At drag end, the clamp animates from the frozen value back to the
  // natural value (recomputed for the new bead position) over
  // MORPH_DURATION_MS. The animation is driven by requestAnimationFrame,
  // not CSS, so useEdgeGeometry's per-frame route recomputation tracks
  // the drifting visible card without lines visually detaching.
  //
  // Pure visual offsets: never written into node.position.
  const draggingNodeId = useCanvasUiStore((s) => s.draggingNodeId)
  const isDraggingThisNode = draggingNodeId === data.id
  const frozenClampRef = useRef({ dx: 0, dy: 0, valid: false })
  const driftAnchorRef = useRef({ startDx: 0, startDy: 0, startTime: 0 })
  const [driftActive, setDriftActive] = useState(false)
  const [, setDriftTick] = useState(0) // dummy state to force per-frame re-renders during drift

  // Track the last EFFECTIVE clamp so a drag-start during a drift captures
  // the current interpolated value (not the natural target).
  const effectiveClampRef = useRef({ dx: 0, dy: 0 })

  // Drag start / stop bookkeeping.
  useEffect(() => {
    if (isDraggingThisNode) {
      // Freeze whatever the visible clamp currently is.
      frozenClampRef.current = {
        dx: effectiveClampRef.current.dx,
        dy: effectiveClampRef.current.dy,
        valid: true,
      }
      // Cancel any in-flight drift; the new drag supersedes it.
      setDriftActive(false)
    } else if (frozenClampRef.current.valid) {
      // Drag just ended — start the drift from the frozen value toward
      // whatever the natural clamp is for the new bead position.
      driftAnchorRef.current = {
        startDx: frozenClampRef.current.dx,
        startDy: frozenClampRef.current.dy,
        startTime: performance.now(),
      }
      frozenClampRef.current = { dx: 0, dy: 0, valid: false }
      setDriftActive(true)
    }
  }, [isDraggingThisNode])

  // Drift rAF loop — runs only while driftActive is true.
  useEffect(() => {
    if (!driftActive) return
    let rafId
    const tick = () => {
      const elapsed = performance.now() - driftAnchorRef.current.startTime
      if (elapsed >= morphMs) {
        setDriftActive(false)
        return
      }
      // Force re-render so the interpolated value below is recomputed
      // and the published expandedNode record updates.
      setDriftTick((t) => t + 1)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [driftActive])

  // Compute the EFFECTIVE clamp for this render:
  //   - dragging this node  → frozen value
  //   - drift in flight     → interpolated value (frozen → natural)
  //   - otherwise           → natural clamp
  let effectiveClampDxScreen = naturalClampDxScreen
  let effectiveClampDyScreen = naturalClampDyScreen
  if (isDraggingThisNode && frozenClampRef.current.valid) {
    effectiveClampDxScreen = frozenClampRef.current.dx
    effectiveClampDyScreen = frozenClampRef.current.dy
  } else if (driftActive) {
    const elapsed = performance.now() - driftAnchorRef.current.startTime
    const t = morphMs > 0 ? Math.min(1, Math.max(0, elapsed / morphMs)) : 1
    // easeOutCubic for a settle-in feel; matches the morph animation timing.
    const eased = 1 - Math.pow(1 - t, 3)
    effectiveClampDxScreen = driftAnchorRef.current.startDx +
      (naturalClampDxScreen - driftAnchorRef.current.startDx) * eased
    effectiveClampDyScreen = driftAnchorRef.current.startDy +
      (naturalClampDyScreen - driftAnchorRef.current.startDy) * eased
  }
  // Remember the latest effective for the next drag-start snapshot.
  effectiveClampRef.current = { dx: effectiveClampDxScreen, dy: effectiveClampDyScreen }

  // ── Pairwise card repulsion (Part B Issue 2) ──────────────────────────────
  // When two beads expand into cards close enough to overlap, nudge each card
  // visually apart so both stay readable. Purely presentational — added to the
  // transform + published center below, never to node.position; it clears the
  // moment the card collapses back to a bead.
  //
  // Symmetric + loop-free: each card pushes HALF the minimum separation,
  // computed against every OTHER expanded card's NATURAL (pre-clamp, pre-repel)
  // bead-anchored rect — published as natCenterX/Y. Using the natural rect (not
  // the already-pushed one) means both cards see stable inputs and converge
  // instead of chasing each other. Standard AABB min-penetration separation
  // also yields Erik's special case for free: vertically-stacked tall cards
  // whose cheapest separation is horizontal get offset left/right; everything
  // else pushes along the line between the two beads. Decoupled from the
  // viewport-clamp (purely additive) so the fragile clamp code is untouched.
  const expandedNodesForRepel = useCanvasUiStore((s) => s.expandedNodes)
  let repelXCanvas = 0
  let repelYCanvas = 0
  if (isExpanded && typeof xPos === 'number' && typeof yPos === 'number') {
    const myCx = xPos + BEAD_DIAMETER_PX / 2
    const myCy = yPos + BEAD_DIAMETER_PX / 2
    const myW  = cardWidth   * thresholdZoom / (zoom || 1)
    const myH  = layoutHeight * thresholdZoom / (zoom || 1)
    for (const [otherId, rec] of expandedNodesForRepel) {
      if (otherId === data.id || typeof rec.natCenterX !== 'number') continue
      const dx = myCx - rec.natCenterX
      const dy = myCy - rec.natCenterY
      const pad  = REPEL_PAD_FRACTION * (myW + rec.width) / 2
      const sepX = (myW + rec.width)  / 2 + pad - Math.abs(dx)
      const sepY = (myH + rec.height) / 2 + pad - Math.abs(dy)
      if (sepX <= 0 || sepY <= 0) continue // these two don't overlap
      // Choose the push axis to PRESERVE the beads' relative orientation, NOT
      // the cheapest separation — otherwise side-by-side beads pop into a
      // vertical column (cards are a touch shorter than wide, so "cheapest"
      // is usually vertical). Dominant separation axis wins: |dx| >= |dy|
      // means the beads are arranged horizontally, so keep them side-by-side.
      let pushVertical = Math.abs(dy) > Math.abs(dx)
      if (pushVertical) {
        // Vertically-arranged beads normally stack. Exception (Erik's spec):
        // if the two cards are jointly too tall to stack within the viewport,
        // fall back to side-by-side. Because the fallback pushes only on X,
        // each card keeps its natural Y — so the upper bead's card stays the
        // higher one, as required.
        const vhCanvas = zoom > 0 ? window.innerHeight / zoom : Infinity
        if (myH + rec.height + pad > vhCanvas) pushVertical = false
      }
      // Each card moves half the needed separation; a deterministic id
      // tiebreak handles exact alignment so both pick opposite directions.
      if (pushVertical) {
        const dir = dy !== 0 ? Math.sign(dy) : (data.id < otherId ? -1 : 1)
        repelYCanvas += (dir * sepY) / 2
      } else {
        const dir = dx !== 0 ? Math.sign(dx) : (data.id < otherId ? -1 : 1)
        repelXCanvas += (dir * sepX) / 2
      }
    }
  }

  // The translate contributions in canvas units (= CSS local px inside the RF
  // node coord space): center-on-bead + viewport-clamp + pairwise repulsion.
  const centerOffsetX = isExpanded ? (BEAD_DIAMETER_PX / 2 - cardWidth    / 2) : 0
  const centerOffsetY = isExpanded ? (BEAD_DIAMETER_PX / 2 - layoutHeight / 2) : 0
  const clampDxCanvas = zoom > 0 ? effectiveClampDxScreen / zoom : 0
  const clampDyCanvas = zoom > 0 ? effectiveClampDyScreen / zoom : 0
  const totalTx = centerOffsetX + clampDxCanvas + repelXCanvas
  const totalTy = centerOffsetY + clampDyCanvas + repelYCanvas

  const finalScale = scale * counterScale
  const composedTransform = (totalTx || totalTy)
    ? `translate(${totalTx}px, ${totalTy}px) scale(${finalScale})`
    : `scale(${finalScale})`

  // ── Publish expansion record for useEdgeGeometry (Chunk D Step 5) ─────────
  // When expanded, edges connected to this node should route to the
  // expanded card's rectangular perimeter at the clamped visible center,
  // not the bead's circular perimeter at the true canvas center.
  // useEdgeGeometry runs at the App level and can't read CampaignNode
  // locals directly, so we publish the visible-form geometry to the store.
  //
  // Canvas-unit translation:
  //   center = (true bead center) + (clampDx/zoom, clampDy/zoom)
  //   size   = (cardWidth, contentHeight) × thresholdZoom / zoom
  // The size formula matches what the expanded card occupies on the canvas
  // *visually* — its layout box is still bead-sized, but counter-scale +
  // outer canvas zoom paint it at (cardWidth, contentHeight) × thresholdZoom
  // on screen, which is (cardWidth × thresholdZoom / zoom, ... / zoom) in
  // canvas units.
  useEffect(() => {
    const store = useCanvasUiStore.getState()
    if (!isExpanded || typeof xPos !== 'number' || typeof yPos !== 'number') {
      // Clear only THIS node's entry. The keyed map makes that inherently
      // safe — deleting our own key can never disturb another expanded node's
      // record (e.g. the other endpoint of a hovered edge).
      store.setExpandedNode(data.id, null)
      return
    }
    // Natural (pre-clamp, pre-repel) bead center — what OTHER cards' repulsion
    // reads, so the pairwise push has a stable, loop-free input.
    const natCenterX = xPos + BEAD_DIAMETER_PX / 2
    const natCenterY = yPos + BEAD_DIAMETER_PX / 2
    // Visible center edges route to: bead center + clamp + repulsion (canvas).
    const centerX = natCenterX + clampDxCanvas + repelXCanvas
    const centerY = natCenterY + clampDyCanvas + repelYCanvas
    // Visible card extent in canvas units = container's CSS box × counterScale.
    // counterScale = thresholdZoom / zoom (when expanded), so:
    //   visible = box × thresholdZoom / zoom
    // We use layoutHeight (max of bead diameter and natural content height)
    // so the published rect matches the container's actual hit-box AND the
    // visible bg-tint extent. Edges route to the visible card border,
    // including the small footer of bg-tint that short cards display.
    const width      = cardWidth     * thresholdZoom / zoom
    const height     = layoutHeight  * thresholdZoom / zoom
    // Box size in canvas units: just the CSS layout dimensions.
    const boxWidth   = cardWidth
    const boxHeight  = layoutHeight
    store.setExpandedNode(data.id, { centerX, centerY, natCenterX, natCenterY, width, height, boxWidth, boxHeight })
  }, [isExpanded, xPos, yPos, clampDxCanvas, clampDyCanvas, repelXCanvas, repelYCanvas, zoom, thresholdZoom, cardWidth, layoutHeight, data.id])

  // Clear our published record when this node unmounts mid-expansion.
  useEffect(() => () => {
    useCanvasUiStore.getState().setExpandedNode(data.id, null)
  }, [data.id])

  // ── Quick-connect buttons (selected + hover dwell) ────────────────────────
  // After the cursor rests on a SELECTED card for QUICK_CONNECT_DWELL_MS, the
  // four per-side connect buttons appear. The dwell condition uses the local
  // `hovered` state (driven by the root div's mouseenter/leave), which stays
  // true while the cursor is over the buttons themselves — they're DOM
  // children — so moving from card to button never dismisses them.
  // Works at ANY altitude (per Erik, 2026-06-11): in Bead View a hovered
  // node is by definition hover-expanded into its card form, so by the time
  // the dwell elapses the buttons attach to the expanded card's layout box —
  // never to a raw bead. Suppressed while this node is dragging.
  const { beginQuickConnect } = useCanvasOps()
  const [quickConnectReady, setQuickConnectReady] = useState(false)
  const quickConnectEligible =
    hovered && selected && !isBead && !isDraggingThisNode
  useEffect(() => {
    if (quickConnectEligible) {
      const t = setTimeout(() => setQuickConnectReady(true), QUICK_CONNECT_DWELL_MS)
      return () => clearTimeout(t)
    }
    if (!quickConnectReady) return
    // Hover just ended while the buttons are up: linger so the cursor can
    // cross the gap onto a button (which re-enters the node's DOM subtree
    // and restores eligibility) instead of yanking the target away.
    const t = setTimeout(() => setQuickConnectReady(false), QUICK_CONNECT_LINGER_MS)
    return () => clearTimeout(t)
  }, [quickConnectEligible, quickConnectReady])

  return (
    <div
      className={`relative ${lifted ? 'is-lifted' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      style={{
        // cardWidth defaults to 256px (the old w-64) and grows only when the
        // title's longest word can't fit at the current zoom-out font size.
        // In bead mode the container collapses to BEAD_DIAMETER_PX × DIAMETER
        // with a circular border-radius; CSS transitions interpolate every
        // numeric property over MORPH_DURATION_MS.
        width:  isBead ? BEAD_DIAMETER_PX : cardWidth,
        height: isBead ? BEAD_DIAMETER_PX : layoutHeight,
        opacity,
        // Edge-hover-session cards are a read-only peek: click-through so they
        // can't capture pointer-hover and collapse their partner endpoint.
        pointerEvents: isSessionCard ? 'none' : undefined,
        boxShadow: shadow,
        transform: composedTransform,
        // Card-mode bg: light tint of type color (existing). Bead-mode bg:
        // darkened type color so the no-thumbnail icon fallback has
        // contrast. Avatar (when present) covers either background.
        backgroundColor: isBead
          ? darkenColor(typeConfig.color, 0.35)
          : `color-mix(in srgb, ${typeConfig.color} 8%, white)`,
        // Always-present type-colored border. In bead mode the border-width
        // is inverse-scaled with `compensation` so it renders at a constant
        // BEAD_BORDER_SCREEN_PX on-screen regardless of zoom (matching the
        // connection-dot screen-space-constant behavior). In card mode the
        // border width is 0 — no visible border. Transitions 0 ↔ (8 × comp)
        // during the morph window. Width is also subtracted from each
        // connection-dot's left/top below (absolutely-positioned children
        // measure from the parent's PADDING-edge, not the border-edge).
        border: `${borderCanvasPx}px solid ${typeConfig.color}`,
        borderRadius: isBead ? '50%' : '0.5rem',
        // Overflow visible so connection-endpoint dots — still rendered at
        // rectangular border coordinates from useEdgeGeometry — stay
        // visible around the bead. Chunk C repositions them onto the
        // circular perimeter.
        overflow: 'visible',
        // Three opacity timing branches keyed off the card's destination state:
        //   - active   → 180ms ease-out          (no delay — snappy hover-in;
        //                                        physical motion + brightening
        //                                        kick in together for max
        //                                        responsiveness)
        //   - dimmed   → 260ms ease-in-out 90ms (gentle pull-back when another
        //                                        card takes focus; 90ms delay
        //                                        filters out rapid cursor
        //                                        flicks for seizure safety)
        //   - resting  → 500ms ease-in-out 90ms (collective settle when the
        //                                        cursor lands on empty canvas
        //                                        and the whole grid relaxes
        //                                        back to its default state in
        //                                        unison)
        // Scale + shadow at 128ms (15% faster than the 150ms baseline) so
        // the physical motion stays the lead "responsiveness" signal on
        // intentional hover. Bg/border/geometry use MORPH_DURATION_MS so
        // the card↔bead transition reads as one unified motion — BUT only
        // while morphPhase is non-null. Outside the morph window those
        // properties update instantly, matching pre-Chunk-B behavior:
        // crucial because cardWidth and contentHeight both vary on every
        // zoom tick in card mode (the title font scales with zoom and
        // re-flows the layout), and animating each tick over 150ms would
        // make ordinary zoom feel laggy.
        transition: [
          isActive
            ? 'opacity 180ms ease-out'
            : isResting
              ? 'opacity 500ms ease-in-out 90ms'
              : 'opacity 260ms ease-in-out 90ms',
          'transform 128ms ease',
          'box-shadow 128ms ease',
          `border-color 128ms ease`,
          ...(morphInFlight ? [
            `background-color ${morphMs}ms ease`,
            `border-width ${morphMs}ms ease`,
            `border-radius ${morphMs}ms ease`,
            `width ${morphMs}ms ease`,
            `height ${morphMs}ms ease`,
          ] : []),
        ].join(', '),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Connection endpoint dots — rendered in HTML so they sit above the card.
          Inverse-scaled so they never render smaller than 8px on screen,
          using the same `compensation` factor as the title (capped at 5×).
          Intentionally outside the clip-wrapper so they remain visible in
          bead mode (their rectangular-border coordinates fall outside the
          72px bead's circle — Chunk C fixes the positions). */}
      {/* Dots fade out instantly at morph-start (so the user doesn't see
          them lingering at old positions during the geometry transition)
          and fade back in over 75ms when the morph settles. Driven by the
          same signals as the lines: this node's per-node hover-expand
          morph (isExpansionMorphing) OR the global altitude morph
          (morphPhase). */}
      {data.connectionDots?.map((dot, i) => {
        const dotSize = CONNECTION_DOT_SCREEN_PX * compensation
        // Snap invisible on the very first frame the morph starts
        // (justFlippedExpansion is true the same render isExpanded changes,
        // before the useEffect-driven isExpansionMorphing catches up). Stay
        // invisible through the full 150ms morph window. Reappear with a
        // quick 75ms fade at the end.
        const dotsHidden = justFlippedExpansion || isExpansionMorphing || morphPhase !== null
        return (
          <div
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{
              width:  dotSize,
              height: dotSize,
              // Subtract borderCanvasPx so the dot's center lands on the
              // OUTER edge of the container (the visible bead perimeter),
              // not the inner padding-edge that absolute positioning
              // defaults to. In card mode borderCanvasPx is 0 so this is
              // identical to the pre-Chunk-B math.
              left:   dot.x - dotSize / 2 - borderCanvasPx,
              top:    dot.y - dotSize / 2 - borderCanvasPx,
              backgroundColor: dot.color ?? '#94a3b8',
              zIndex: 10,
              opacity: dotsHidden ? 0 : 1,
              // 0ms when going TO 0 (snap out at morph-start), 75ms ease
              // when going to 1 (fade back in at morph-end).
              transition: dotsHidden ? 'opacity 0ms' : `opacity ${morphMs / 2}ms ease`,
            }}
          />
        )
      })}
      {/* Quick-connect buttons — outside the clip wrapper so they can sit
          beyond the card's box. Positioned against the card's CSS layout box
          (cardWidth × layoutHeight), which is what the cursor actually
          interacts with in card mode. */}
      {quickConnectReady && (
        <QuickConnectButtons
          compensation={compensation}
          cardWidth={cardWidth}
          cardHeight={layoutHeight}
          onBeginConnect={(e) => beginQuickConnect?.(data.id, e)}
        />
      )}

      {/* Invisible center handles — floating edges compute their own border points */}
      <Handle type="source" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />
      <Handle type="target" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />

      {/* Clip wrapper — overflow:hidden + border-radius:inherit clips the two
          content layers to the container's current shape (rounded rectangle
          in card mode, circle in bead mode). Sits inside the type-colored
          border. Connection dots above are outside this wrapper on purpose. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: 'inherit',
        }}
      >
      {/* Card content layer — absolutely positioned so its natural height
          doesn't constrain the container's transitioning height. Width is
          pinned to cardWidth so it doesn't re-wrap when the bead container
          is narrow. Opacity cross-fades with the bead layer over the morph. */}
      <div
        ref={cardContentRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: cardWidth,
          opacity: isBead ? 0 : 1,
          // Only set 'none' when this layer is the inactive one. We
          // deliberately do NOT set 'auto' on the active layer — that would
          // override the inherited `none` value that .is-panning installs
          // on .react-flow__node to make every node inert during a
          // spacebar-pan. Letting the active layer fall through to the
          // inherited value preserves both behaviors.
          pointerEvents: isBead ? 'none' : undefined,
          transition: `opacity ${morphMs}ms ease`,
        }}
      >
      {/* Header */}
      <div
        className="flex items-center rounded-t-lg gap-2"
        style={{ backgroundColor: typeConfig.color }}
      >
        {/* Avatar — diameter matches the text div's border-box height (py-4 + text).
            The ref is on the sibling div, not the header, so there's no circular
            dependency: the avatar's size doesn't influence what it's measuring.
            Border radii are specified per corner (not via rounded-r-full + rounded-
            tl-lg) because Tailwind's "full" = 9999px would push the top-side
            corner-radius sum past the box width, triggering CSS proportional
            clamping that crushed the 8px top-left back to ~0.
            To bleed flush with the card's outer edges:
              - alignSelf: 'flex-start' opts out of the header's `items-center`
                so the negative top margin actually pulls the content to y=0
                instead of getting half-absorbed by re-centering against the
                title div (which is the height-determining sibling).
              - height = avatarSize + 1 expands the visible area so the avatar
                covers the full header height, including the 1px strip at the
                bottom where header bg used to peek through.
              - marginTop/Left: -1 pull the avatar 1px past the card's content
                area to overlap the border on top and left. */}
        {!hideAvatar && (
        <div
          className="flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{
            width:  avatarSize,
            height: avatarSize + 1,
            backgroundColor: avatarBg,
            borderTopLeftRadius:     8,                       // matches card's rounded-lg (0.5rem)
            borderTopRightRadius:    (avatarSize + 1) / 2,    // half-pill (right edge fully curved)
            borderBottomRightRadius: (avatarSize + 1) / 2,
            borderBottomLeftRadius:  0,                       // square where avatar meets card body
            alignSelf:  'flex-start',                         // opt out of header's items-center
            marginTop:  -1,                                   // overlap card's top border
            marginLeft: -1,                                   // overlap card's left border
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={data.label || ''}
              className="w-full h-full object-cover cursor-zoom-in"
              // pointerdown is stopped because React Flow registers node selection
              // on its pointerdown listener (which fires BEFORE onClick / onMouseDown).
              // Without this, opening the lightbox via the avatar would silently
              // select the card, leaving it highlighted after the lightbox closes.
              // Mousedown + click are also stopped for legacy event paths and to
              // keep the avatar from triggering canvas-level pan/select.
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                lightbox.open(data.avatar)
              }}
              draggable={false}
            />
          ) : (
            <span
              className="font-bold leading-none select-none"
              style={{ fontSize: avatarInitialSize, color: hdrText }}
            >
              {labelInitial(data.label)}
            </span>
          )}
        </div>
        )}

        {/* Title + type icon — this div is the source of truth for avatar height.
            When the thumbnail is hidden the title is the only header content, so
            it gets symmetric horizontal insets (px-8 = 32px, twice the 16px top
            padding) to sit clear of the card edges like a sticky note. */}
        <div
          ref={headerRef}
          className={`flex items-start gap-2 flex-1 min-w-0 ${hideAvatar ? 'py-4 px-8' : 'py-4 pr-2'}`}
        >
          <span
            className="font-semibold leading-none flex-1 min-w-0"
            style={{ fontSize: `${titleFontSize}rem`, color: hdrText }}
          >
            {data.label || 'Untitled'}
          </span>
          {typeConfig.icon && !iconHidden && !hideAvatar && (() => {
            const Icon = typeConfig.icon
            return (
              <Icon
                size={iconSize}
                color={hdrText}
                weight="fill"
                className="flex-shrink-0 opacity-90"
              />
            )
          })()}
        </div>
      </div>

      {/* Card content — block-editor Phase 2, Chunk D. When the migrated Card
          View JSON is present, render it read-only via BlockPreview. Fall back
          to the legacy summary + story-notes rendering for any card without a
          card_view row yet (brand-new or un-migrated). */}
      {data.cardView != null ? (
        <div className="p-3">
          <BlockPreview blocks={data.cardView} />
        </div>
      ) : (
        <>
          {data.summary && (
            <div className="px-3 pt-2 pb-1 border-b border-gray-100">
              <p className="text-gray-500 text-xs leading-snug">{data.summary}</p>
            </div>
          )}
          <div className="p-3 flex flex-col gap-2">
            {data.storyNotes && data.storyNotes.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {data.storyNotes.map((bullet) => (
                  <li key={bullet.id} className="flex items-start gap-2 text-xs text-gray-700 leading-snug">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                    {bullet.value}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-300 text-xs italic leading-snug">No content yet</p>
            )}
          </div>
        </>
      )}
      </div>
      {/* Bead content layer — absolutely positioned, fills the clip wrapper.
          Cross-fades opposite to the card-content layer. Avatar (if any)
          fills the circle via object-cover; otherwise the card-title's
          first initial is centered as the fallback (matches the card-view
          empty state — see ADR-0010 addendum 2026-05-22). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isBead ? 1 : 0,
          // See sibling card-content layer comment: only set 'none' when
          // this layer is inactive; leave the active layer's value unset
          // so it inherits from .react-flow__node (which .is-panning sets
          // to 'none' during spacebar-pan).
          pointerEvents: isBead ? undefined : 'none',
          transition: `opacity ${morphMs}ms ease`,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={data.label || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            draggable={false}
          />
        ) : (
          <span
            className="font-bold leading-none select-none"
            style={{ fontSize: beadInitialSize, color: hdrText }}
          >
            {labelInitial(data.label)}
          </span>
        )}
      </div>
      </div>
    </div>
  )
}
