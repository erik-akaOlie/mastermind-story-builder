// TypePicker — the dropdown shown beneath the title input in EditModal's
// header for choosing a card type. Owns the open/close state, hovered-row
// highlighting, and the "Create new type…" affordance at the bottom.
//
// `type` + `setType` come from the parent (EditModal) so the auto-save
// useEffect sees changes. `onCreateNewType` is called when the user picks
// the bottom "Create new type…" row, letting the parent open its own
// CreateTypeModal.

import { useState } from 'react'
import { useNodeTypes } from '../store/useTypeStore'

// Color helpers — duplicated from EditModal so this component is independent.
// If a fourth consumer appears, lift these into a shared `colorUtils` file.
function tintHex(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * opacity + 255 * (1 - opacity))},${Math.round(g * opacity + 255 * (1 - opacity))},${Math.round(b * opacity + 255 * (1 - opacity))})`
}
function textForHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}
function textForTint(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const tr = Math.round(r * opacity + 255 * (1 - opacity))
  const tg = Math.round(g * opacity + 255 * (1 - opacity))
  const tb = Math.round(b * opacity + 255 * (1 - opacity))
  return (0.299 * tr + 0.587 * tg + 0.114 * tb) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}

export default function TypePicker({ type, setType, hdrText, onCreateNewType }) {
  const NODE_TYPES = useNodeTypes()
  const typeConfig = NODE_TYPES[type] || { color: '#6B7280', label: type }
  const [showPicker, setShowPicker] = useState(false)
  const [hoveredType, setHoveredType] = useState(null)

  return (
    <div className="relative w-[10.5rem]">
      {/* Trigger */}
      <button
        type="button"
        className="flex items-center justify-between w-full border-b border-[#a5a6f6] cursor-pointer"
        onClick={() => setShowPicker(v => !v)}
      >
        <span className="text-base font-light leading-[1.32]" style={{ color: hdrText }}>{typeConfig.label}</span>
        <svg className="w-4 h-4 flex-shrink-0" style={{ color: hdrText, opacity: 0.8 }} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>

      {showPicker && (
        <>
          <div className="fixed inset-0 z-[10000]" onClick={() => setShowPicker(false)} />
          <div className="absolute top-full left-0 z-[10001] w-full mt-1 rounded-[0.25rem] overflow-hidden shadow-lg">
            {Object.entries(NODE_TYPES).map(([key, cfg]) => {
              const Icon = cfg.icon
              const isActive = key === type || hoveredType === key
              const bg = isActive ? cfg.color : tintHex(cfg.color, 0.05)
              const fg = isActive ? textForHex(cfg.color) : textForTint(cfg.color, 0.05)
              return (
                <button
                  key={key}
                  type="button"
                  className="flex items-center gap-2 w-full px-2"
                  style={{ height: '2.5rem', backgroundColor: bg, color: fg }}
                  onMouseEnter={() => setHoveredType(key)}
                  onMouseLeave={() => setHoveredType(null)}
                  onClick={() => { setType(key); setShowPicker(false) }}
                >
                  <Icon size={16} weight="fill" color={isActive ? fg : cfg.color} />
                  <span className="text-sm font-medium">{cfg.label}</span>
                </button>
              )
            })}
            {/* Create new type */}
            <button
              type="button"
              className="flex items-center gap-2 w-full px-2 border-t border-black/10"
              style={{ height: '2.5rem', backgroundColor: '#f9fafb', color: '#6b7280' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb' }}
              onClick={() => { setShowPicker(false); onCreateNewType() }}
            >
              <span className="text-base leading-none font-light">+</span>
              <span className="text-sm font-medium">Create new type…</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
