import { useState, useRef, useEffect, useMemo } from 'react'
import { Handle, Position, useViewport } from 'reactflow'
import { useNodeTypes } from '../store/useTypeStore'
import { useCanvasUiStore, selectIsEdgeHighlighted } from '../store/useCanvasUiStore'
import { useImageUrl } from '../lib/useImageUrl'
import { useLightbox } from '../components/Lightbox'
import { labelInitial } from '../utils/labelUtils'

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

export default function CampaignNode({ data, selected }) {
  const [hovered, setHovered] = useState(false)
  const { zoom } = useViewport()
  const NODE_TYPES = useNodeTypes()
  const typeConfig = NODE_TYPES[data.type] || { label: data.type, color: data.color || '#6B7280' }

  // Scale header text up as the user zooms out so titles remain readable.
  // zoom >= 1 → use base sizes (already sharp at 100%+).
  // zoom <  1 → divide by zoom to compensate; cap at 5× so extreme zoom-out
  //             doesn't produce absurdly large CSS values.
  const compensation = zoom < 1 ? Math.min(1 / zoom, 5) : 1
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

  const isEdgeHighlighted = useCanvasUiStore(selectIsEdgeHighlighted(data.id))
  const anyHovered   = useCanvasUiStore((s) => s.anyHovered)
  const anySelected  = useCanvasUiStore((s) => s.anySelected)
  const edgeHovered  = useCanvasUiStore((s) => s.hoveredEdgeNodeIds != null)
  const anythingActive = anyHovered || edgeHovered

  // Selected cards are always part of the user's active focus — never dimmed, always lifted.
  // Hover and edge-highlight also lift. Selection persists regardless of what else is hovered.
  const isActive = hovered || isEdgeHighlighted || selected
  const lifted   = hovered || isEdgeHighlighted || selected

  // Three resting states for the card's opacity:
  //   - active   (hovered / edge-highlighted / selected)        → full
  //   - dimmed   (something ELSE is active — pulled out of focus) → way back
  //   - resting  (nothing on the canvas is active right now)     → slightly dimmed
  // Locked cards halve every level. The 0.25 "way back" is intentional — it
  // signals "this isn't what you're looking at" without losing the card.
  const baseOpacity = data.locked ? 0.5 : 1
  const isResting = !isActive && !anythingActive && !anySelected && !data.isEditing
  let opacity
  if (data.isEditing) {
    opacity = 0
  } else if (isActive) {
    opacity = baseOpacity
  } else if (anythingActive || anySelected) {
    opacity = baseOpacity * 0.25
  } else {
    opacity = baseOpacity * 0.85
  }

  const shadow = lifted ? SHADOW_LIFTED : SHADOW_NORMAL
  const scale  = lifted ? 1.03 : 1

  const avatarBg = darkenColor(typeConfig.color)
  const avatarInitialSize = Math.round(avatarSize * 0.45)
  const hdrText = headerTextColor(typeConfig.color)
  const avatarUrl = useImageUrl(data.avatar, 'thumb')
  const lightbox = useLightbox()

  return (
    <div
      className={`relative rounded-lg ${lifted ? 'is-lifted' : ''}`}
      style={{
        // cardWidth defaults to 256px (the old w-64) and grows only when the
        // title's longest word can't fit at the current zoom-out font size.
        width: cardWidth,
        opacity,
        boxShadow: shadow,
        transform:  `scale(${scale})`,
        backgroundColor: `color-mix(in srgb, ${typeConfig.color} 8%, white)`,
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
        // Scale + shadow + bg + border at 128ms (15% faster than the 150ms
        // baseline) so the physical motion stays the lead "responsiveness"
        // signal on intentional hover.
        transition: [
          isActive
            ? 'opacity 180ms ease-out'
            : isResting
              ? 'opacity 500ms ease-in-out 90ms'
              : 'opacity 260ms ease-in-out 90ms',
          'transform 128ms ease',
          'box-shadow 128ms ease',
          'background-color 128ms ease',
          'border-color 128ms ease',
        ].join(', '),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Connection endpoint dots — rendered in HTML so they sit above the card.
          Inverse-scaled so they never render smaller than 8px on screen,
          using the same `compensation` factor as the title (capped at 5×). */}
      {data.connectionDots?.map((dot, i) => {
        const dotSize = 8 * compensation
        return (
          <div
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{
              width:  dotSize,
              height: dotSize,
              left:   dot.x - dotSize / 2,
              top:    dot.y - dotSize / 2,
              backgroundColor: dot.color ?? '#94a3b8',
              zIndex: 10,
            }}
          />
        )
      })}
      {/* Invisible center handles — floating edges compute their own border points */}
      <Handle type="source" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />
      <Handle type="target" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />

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
              onClick={(e) => {
                e.stopPropagation()
                lightbox.open(data.avatar)
              }}
              onMouseDown={(e) => e.stopPropagation()}
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

        {/* Title + type icon — this div is the source of truth for avatar height */}
        <div ref={headerRef} className="flex items-start py-4 pr-2 gap-2 flex-1 min-w-0">
          <span
            className="font-semibold leading-none flex-1 min-w-0"
            style={{ fontSize: `${titleFontSize}rem`, color: hdrText }}
          >
            {data.label || 'Untitled'}
          </span>
          {typeConfig.icon && !iconHidden && (() => {
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

      {/* Summary */}
      {data.summary && (
        <div className="px-3 pt-2 pb-1 border-b border-gray-100">
          <p className="text-gray-500 text-xs leading-snug">{data.summary}</p>
        </div>
      )}

      {/* Body */}
      <div className="p-3 flex flex-col gap-2">
        {data.storyNotes && data.storyNotes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {data.storyNotes.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-snug">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                {bullet}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-300 text-xs italic leading-snug">No content yet</p>
        )}
      </div>
    </div>
  )
}
