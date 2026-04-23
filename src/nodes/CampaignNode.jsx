import { useState, useRef, useEffect, useMemo } from 'react'
import { Handle, Position, useViewport } from 'reactflow'
import { useNodeTypes } from '../store/useTypeStore'
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

  // ── Dynamic icon visibility ──────────────────────────────────────────────
  // When the title's longest unbreakable word is wider than the span width
  // it would have with the icon visible, the title text would visually slide
  // under the icon. In that case we hide the icon so the title gets the full
  // header width.
  //
  // Critical: this decision must NOT depend on the measured `avatarSize`
  // state, because `avatarSize` is itself a downstream result of the rendered
  // layout (which depends on whether the icon is visible). Reading it here
  // creates a feedback loop that oscillates at any zoom level where hiding
  // the icon changes the title's line count.
  //
  // Instead, we simulate the converged layout deterministically: iterate an
  // avatar-size estimate as if the icon WERE visible, converging on the line
  // count the browser would produce, and use the resulting span to decide.
  //
  // Layout constants (see header JSX below):
  //   card width              = 256 (w-64)
  //   outer flex gap          = 8   (gap-2 on the header container)
  //   title div right padding = 8   (pr-2)
  //   title div inner gap     = 8   (gap-2 between title span and icon)
  //   header vertical padding = 32  (py-4)
  const iconHidden = useMemo(() => {
    if (!typeConfig.icon || !data.label) return false
    const ctx = getMeasureCtx()
    if (!ctx) return false
    const fontPx = titleFontSize * 16  // 1rem = 16px at browser default
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`

    const words = data.label.split(/\s+/).filter(Boolean)
    if (words.length === 0) return false

    let longestWordWidth = 0
    let totalTextWidth = 0
    for (const w of words) {
      const width = ctx.measureText(w).width
      if (width > longestWordWidth) longestWordWidth = width
      totalTextWidth += width
    }
    if (words.length > 1) {
      totalTextWidth += (words.length - 1) * ctx.measureText(' ').width
    }

    const CARD     = 256
    const PAD_GAPS = 8 + 8 + 8   // outer gap + pr-2 + inner gap
    const PY_4     = 32

    // Simulate the converged layout with the icon visible. Start with a
    // one-line avatar estimate, then iterate: compute span width, estimate
    // line count from greedy word wrapping, recompute avatar. Converges in
    // a handful of passes for any real title.
    let avatar = PY_4 + Math.max(fontPx, iconSize)
    for (let i = 0; i < 6; i++) {
      const span = CARD - avatar - PAD_GAPS - iconSize
      // If even the longest word can't fit in the span, text overflows
      // regardless — hide the icon.
      if (span <= longestWordWidth) return true
      const lines = Math.max(1, Math.ceil(totalTextWidth / span))
      const nextAvatar = PY_4 + Math.max(lines * fontPx, iconSize)
      if (nextAvatar === avatar) break
      avatar = nextAvatar
    }

    const finalSpan = CARD - avatar - PAD_GAPS - iconSize
    return longestWordWidth > finalSpan
  }, [typeConfig.icon, data.label, titleFontSize, iconSize])

  const isEdgeHighlighted = data.hoveredEdgeNodeIds?.has(data.id)
  const anythingActive = data.anyHovered || data.hoveredEdgeNodeIds != null

  // Selected cards are always part of the user's active focus — never dimmed, always lifted.
  // Hover and edge-highlight also lift. Selection persists regardless of what else is hovered.
  const isActive = hovered || isEdgeHighlighted || selected
  const lifted   = hovered || isEdgeHighlighted || selected

  const baseopacity = data.locked ? 0.5 : 1
  const isDimmed = !isActive && (anythingActive || data.anySelected)
  const opacity = data.isEditing ? 0 : (isDimmed ? baseopacity * 0.5 : baseopacity)

  const shadow = lifted ? SHADOW_LIFTED : SHADOW_NORMAL
  const scale  = lifted ? 1.03 : 1

  const avatarBg = darkenColor(typeConfig.color)
  const avatarInitialSize = Math.round(avatarSize * 0.45)
  const hdrText = headerTextColor(typeConfig.color)

  return (
    <div
      className="relative rounded-lg border w-64 transition-all duration-150"
      style={{
        opacity,
        boxShadow: shadow,
        transform:  `scale(${scale})`,
        backgroundColor: `color-mix(in srgb, ${typeConfig.color} 8%, white)`,
        borderColor: `color-mix(in srgb, ${typeConfig.color} 30%, #e5e7eb)`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Connection endpoint dots — rendered in HTML so they sit above the card */}
      {data.connectionDots?.map((dot, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 8,
            height: 8,
            left: dot.x - 4,
            top: dot.y - 4,
            backgroundColor: dot.color ?? '#94a3b8',
            zIndex: 10,
          }}
        />
      ))}
      {/* Invisible center handles — floating edges compute their own border points */}
      <Handle type="source" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />
      <Handle type="target" position={Position.Top} className="opacity-0" style={{ top: '50%', left: '50%' }} />

      {/* Header */}
      <div
        className="flex items-center rounded-t-lg gap-2 overflow-hidden"
        style={{ backgroundColor: typeConfig.color }}
      >
        {/* Avatar — diameter matches the text div's border-box height (py-4 + text).
            The ref is on the sibling div, not the header, so there's no circular
            dependency: the avatar's size doesn't influence what it's measuring. */}
        <div
          className="flex-shrink-0 rounded-r-full overflow-hidden flex items-center justify-center"
          style={{
            width:  avatarSize,
            height: avatarSize,
            backgroundColor: avatarBg,
          }}
        >
          {data.avatar ? (
            <img
              src={data.avatar}
              alt={data.label || ''}
              className="w-full h-full object-cover"
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
