import { useState, useEffect, useRef } from 'react'
import { TextT, CaretRight } from '@phosphor-icons/react'
import { useNodeTypes } from '../store/useTypeStore'

const HOVER_INTENT_CLOSE_MS = 200
const BRIDGE_WIDTH = 16  // overlaps 6px into parent + 4px gap + 6px into submenu

export default function CanvasContextMenu({ x, y, onAddCard, onAddText, onClose }) {
  const NODE_TYPES = useNodeTypes()
  const [showSub, setShowSub] = useState(false)

  // Hover-intent: delay closing the submenu so a brief mouseleave (e.g., the
  // cursor briefly leaving all hover regions while crossing the gap) doesn't
  // immediately collapse the submenu. Re-entering cancels the pending close.
  const closeTimerRef = useRef(null)
  const openSub = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setShowSub(true)
  }
  const scheduleCloseSub = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setShowSub(false)
      closeTimerRef.current = null
    }, HOVER_INTENT_CLOSE_MS)
  }
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

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
          onMouseEnter={openSub}
          onMouseLeave={scheduleCloseSub}
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
            <>
              {/* Invisible hover bridge — overlaps both menus and the gap so the
                  cursor never lands in dead space while transitioning. Combined
                  with the hover-intent close delay, this makes the submenu robust
                  to fast / imperfect cursor paths. */}
              <div
                className="absolute"
                style={{
                  top: 0,
                  left: subOverflow ? -BRIDGE_WIDTH + 6 : menuWidth - 6,
                  width: BRIDGE_WIDTH,
                  height: subHeight,
                  zIndex: 9999,
                }}
                onMouseEnter={openSub}
                onMouseLeave={scheduleCloseSub}
              />
              <div
                className="absolute top-0 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-[10000]"
                style={{ left: subRight, width: menuWidth, minHeight: subHeight }}
                onMouseEnter={openSub}
                onMouseLeave={scheduleCloseSub}
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
            </>
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
