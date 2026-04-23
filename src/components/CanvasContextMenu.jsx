import { useState, useEffect } from 'react'
import { TextT, CaretRight } from '@phosphor-icons/react'
import { useNodeTypes } from '../store/useTypeStore'

export default function CanvasContextMenu({ x, y, onAddCard, onAddText, onClose }) {
  const NODE_TYPES = useNodeTypes()
  const [showSub, setShowSub] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const menuWidth  = 192
  const menuHeight = 120
  const left = x + menuWidth  > window.innerWidth  ? x - menuWidth  : x
  const top  = y + menuHeight > window.innerHeight ? y - menuHeight : y

  const typeEntries = Object.entries(NODE_TYPES)
  const subHeight   = typeEntries.length * 40 + 8
  const subLeft     = left + menuWidth + 4
  const subOverflow = subLeft + menuWidth > window.innerWidth
  const subRight    = subOverflow ? -(menuWidth + 4) : menuWidth + 4

  return (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />

      <div
        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl py-1 select-none"
        style={{ left, top, width: menuWidth }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <p className="px-4 py-1.5 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">
          Add to canvas
        </p>

        {/* Add card — click adds character; hover opens type submenu */}
        <div
          className="relative"
          onMouseEnter={() => setShowSub(true)}
          onMouseLeave={() => setShowSub(false)}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
            onClick={() => { onAddCard(typeEntries[0]?.[0] ?? 'character'); onClose() }}
          >
            <span className="flex-1">Add card</span>
            <CaretRight size={12} className="text-gray-400" weight="bold" />
          </button>

          {/* Card type submenu */}
          {showSub && (
            <div
              className="absolute top-0 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-[10000]"
              style={{ left: subRight, width: menuWidth, minHeight: subHeight }}
            >
              {typeEntries.map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
                    onClick={() => { onAddCard(key); onClose() }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                    {Icon && <Icon size={14} weight="fill" color={cfg.color} />}
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="my-1 border-t border-gray-100" />

        {/* Add text */}
        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
          onClick={() => { onAddText(); onClose() }}
        >
          <TextT size={14} weight="bold" color="#6b7280" />
          Add text
        </button>
      </div>
    </>
  )
}
