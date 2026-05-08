import { useState, useMemo, useRef, useEffect } from 'react'
import { X, MagnifyingGlass } from '@phosphor-icons/react'
import { ICON_REGISTRY, recommendIcons, getIcon } from '../nodes/iconRegistry'
import { useTypeStore } from '../store/useTypeStore'

// ── Color math ─────────────────────────────────────────────────────────────
const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

const colorDistance = (a, b) => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if      (h < 60)  { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function hexToHsl(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8)  & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b - r) / d + 2) / 6; break
    default: h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s, l]
}

const CW = 480
const CH = 128
const MIN_L = 0.08
const MAX_L = 0.92
const PROXIMITY_DISABLE = 80
const MARKER_RING_RADIUS = 8
const MARKER_HIT_RADIUS = 11  // hover hit area slightly larger than the ring

function colorAtCanvasPos(cx, cy) {
  const h = Math.max(0, Math.min(359.9, (cx / CW) * 360))
  const l = MAX_L - (cy / CH) * (MAX_L - MIN_L)
  const [r, g, b] = hslToRgb(h, 1.0, l)
  return rgbToHex(r, g, b)
}

function hexToCanvasPos(hex) {
  const [h, s, l] = hexToHsl(hex)
  return {
    cx: (h / 360) * CW,
    cy: ((MAX_L - l) / (MAX_L - MIN_L)) * CH,
    s,
  }
}

// ── Gradient canvas color picker ───────────────────────────────────────────
// usedColorTypes: Array<{ hex, label, icon }>
function GradientColorPicker({ value, onChange, usedColorTypes }) {
  const canvasRef = useRef(null)
  // hover: null | { cx, cy, color, blocked, overType: null | { hex, label, icon, markerCx, markerCy } }
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // 1. Full-spectrum HSL gradient
    const img = ctx.createImageData(CW, CH)
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const h = (x / CW) * 360
        const l = MAX_L - (y / CH) * (MAX_L - MIN_L)
        const [r, g, b] = hslToRgb(h, 1.0, l)
        const i = (y * CW + x) * 4
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    // 2. Open ring markers for all existing type colors
    for (const { hex } of usedColorTypes) {
      const { cx, cy, s } = hexToCanvasPos(hex)
      if (s < 0.12) continue
      ctx.beginPath()
      ctx.arc(cx, cy, MARKER_RING_RADIUS, 0, Math.PI * 2)
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }

    // 3. Ring for currently selected value (if not already an existing type)
    if (value) {
      const alreadyDrawn = usedColorTypes.some((t) => t.hex.toLowerCase() === value.toLowerCase())
      if (!alreadyDrawn) {
        const { cx, cy, s } = hexToCanvasPos(value)
        if (s >= 0.12) {
          ctx.beginPath()
          ctx.arc(cx, cy, MARKER_RING_RADIUS, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }
  }, [value, usedColorTypes])

  const getCanvasXY = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      cx: Math.max(0, Math.min(CW, ((e.clientX - rect.left) / rect.width) * CW)),
      cy: Math.max(0, Math.min(CH, ((e.clientY - rect.top) / rect.height) * CH)),
    }
  }

  const findOverType = (cx, cy) => {
    for (const type of usedColorTypes) {
      const { cx: mx, cy: my, s } = hexToCanvasPos(type.hex)
      if (s < 0.12) continue
      const dist = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2)
      if (dist <= MARKER_HIT_RADIUS) return { ...type, markerCx: mx, markerCy: my }
    }
    return null
  }

  const handleMove = (e) => {
    const { cx, cy } = getCanvasXY(e)
    const overType = findOverType(cx, cy)
    const color = colorAtCanvasPos(cx, cy)
    const blocked = !overType && usedColorTypes.some((t) => colorDistance(color, t.hex) < PROXIMITY_DISABLE)
    setHover({ cx, cy, color, blocked, overType: overType || null })
  }

  const handleClick = (e) => {
    const { cx, cy } = getCanvasXY(e)
    if (findOverType(cx, cy)) return
    const color = colorAtCanvasPos(cx, cy)
    const blocked = usedColorTypes.some((t) => colorDistance(color, t.hex) < PROXIMITY_DISABLE)
    if (!blocked) onChange(color)
  }

  const cursor = hover?.overType ? 'default' : hover?.blocked ? 'not-allowed' : 'crosshair'

  return (
    <div className="relative rounded overflow-hidden border border-gray-200" style={{ height: CH }}>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="block w-full h-full"
        style={{ cursor }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
      />

      {/* Hover crosshair dot — only when not over a type marker */}
      {hover && !hover.overType && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 14,
            height: 14,
            left: `calc(${(hover.cx / CW) * 100}% - 7px)`,
            top: `calc(${(hover.cy / CH) * 100}% - 7px)`,
            border: hover.blocked ? '2px dashed rgba(255,255,255,0.5)' : '2.5px solid white',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            backgroundColor: hover.blocked ? 'transparent' : hover.color,
          }}
        />
      )}

      {/* Type tooltip — shown when hovering over a marker ring */}
      {hover?.overType && (() => {
        const { markerCx, markerCy, label, icon: Icon } = hover.overType
        const pctX = (markerCx / CW) * 100
        const pctY = (markerCy / CH) * 100
        const flipLeft = markerCx > CW * 0.62
        return (
          <div
            className="pointer-events-none absolute flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-white select-none"
            style={{
              backgroundColor: 'rgba(15,15,15,0.82)',
              backdropFilter: 'blur(6px)',
              left: flipLeft ? undefined : `calc(${pctX}% + 14px)`,
              right: flipLeft ? `calc(${100 - pctX}% + 14px)` : undefined,
              top: `calc(${pctY}% - 10px)`,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            }}
          >
            {Icon && <Icon size={12} weight="fill" color="white" />}
            {label}
          </div>
        )
      })()}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
export default function CreateTypeModal({ onClose, onCreated }) {
  const { types, addType } = useTypeStore()

  const usedColorTypes = useMemo(
    () => Object.values(types).map((t) => ({ hex: t.color, label: t.label, icon: getIcon(t.iconName) })),
    [types]
  )
  const usedIconNames = useMemo(() => new Set(Object.values(types).map((t) => t.iconName)), [types])

  const [label, setLabel] = useState('')
  const [iconName, setIconName] = useState(null)
  const [color, setColor] = useState('#7C3AED')
  const [iconSearch, setIconSearch] = useState('')

  const recommended = useMemo(() => recommendIcons(label, 8), [label])
  const searchResults = useMemo(() => {
    if (!iconSearch.trim()) return []
    const q = iconSearch.toLowerCase()
    return ICON_REGISTRY.filter(
      (i) => i.name.toLowerCase().includes(q) || i.keywords.some((kw) => kw.includes(q))
    ).slice(0, 16)
  }, [iconSearch])

  const displayedIcons = iconSearch.trim()
    ? searchResults
    : recommended.length ? recommended : ICON_REGISTRY.slice(0, 16)

  const canCreate = label.trim() && iconName && color

  const handleCreate = () => {
    if (!canCreate) return
    const key = label.trim().toLowerCase().replace(/\W+/g, '_') + '_' + Date.now()
    addType(key, { label: label.trim(), color, iconName })
    onCreated?.(key)
    onClose()
  }

  const textColor = luminance(color) > 0.5 ? '#1f2937' : '#ffffff'

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className="relative z-10 rounded-lg shadow-2xl flex flex-col"
        style={{ width: '26rem', maxHeight: '90vh', backgroundColor: 'white' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 rounded-t-lg bg-gray-100">
          <span className="font-semibold text-base text-gray-700">
            New card type
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5 overflow-y-auto">
          {/* Label */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Label</label>
            <input
              className="border border-gray-300 rounded px-3 py-2 text-sm font-light focus:outline-none focus:border-gray-400 focus:bg-white bg-gray-50"
              placeholder="e.g. Quest, Event, Monster…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>

          {/* Icon picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Icon</label>
            <div className="flex items-center gap-2 border border-gray-300 rounded px-2 py-1.5 bg-gray-50 focus-within:bg-white focus-within:border-gray-400">
              <MagnifyingGlass size={14} color="#9ca3af" />
              <input
                className="flex-1 text-sm font-light bg-transparent focus:outline-none placeholder-gray-400"
                placeholder="Search icons…"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-8 gap-1">
              {displayedIcons.map(({ name, component: Icon }) => {
                const isSelected = iconName === name
                const isInUse = usedIconNames.has(name)
                return (
                  <button
                    key={name}
                    title={name}
                    onClick={() => setIconName(name)}
                    className="relative flex items-center justify-center rounded transition-colors"
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      backgroundColor: isSelected ? color : 'transparent',
                      border: isSelected ? 'none' : '1px solid #e5e7eb',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f3f4f6'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <Icon size={20} weight="fill" color={isSelected ? textColor : '#374151'} />
                    {isInUse && !isSelected && (
                      <span
                        className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            {displayedIcons.length === 0 && (
              <p className="text-xs text-gray-400 italic">No icons match your search.</p>
            )}
            {!iconSearch && !label.trim() && (
              <p className="text-xs text-gray-400">Type a label to see icon recommendations.</p>
            )}
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Color</label>
              <div className="flex items-center gap-1.5">
                <div
                  className="rounded-full border border-gray-200"
                  style={{ width: 14, height: 14, backgroundColor: color }}
                />
                <span className="text-xs text-gray-400 font-mono">{color.toUpperCase()}</span>
              </div>
            </div>
            <GradientColorPicker
              value={color}
              onChange={setColor}
              usedColorTypes={usedColorTypes}
            />
            <p className="text-xs text-gray-400">
              Click to pick · Hover rings to see which type uses that color
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!canCreate}
            onClick={handleCreate}
            className="px-4 py-2 text-sm font-semibold rounded transition-opacity"
            style={{
              backgroundColor: canCreate ? '#0284C7' : '#d1d5db',
              color: canCreate ? '#ffffff' : '#9ca3af',
              opacity: canCreate ? 1 : 0.6,
              cursor: canCreate ? 'pointer' : 'not-allowed',
            }}
          >
            Create type
          </button>
        </div>
      </div>
    </div>
  )
}
