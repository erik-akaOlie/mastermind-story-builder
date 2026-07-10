import { useEffect } from 'react'

// Right-click menu on canvas elements (nodes, text blocks, lines).
// Simplified 2026-07-10 to Duplicate + Delete only: Edit was redundant
// (double-click / repoint owns opening) and Lock is scoped out of V1 — the
// underlying handlers still exist in App; only the menu rows were removed.
//
// `selectedCount` > 1 means the clicked element is part of a multi-selection
// and Duplicate / Delete will act on the WHOLE selection — the labels say so.
export default function ContextMenu({ x, y, selectedCount = 1, onDuplicate, onDelete, onClose }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Adjust so the menu never clips outside the viewport
  const menuWidth = 176
  const menuHeight = 88   // 2 rows × 36 + divider 9 + 8 py + 2 borders
  const left = x + menuWidth > window.innerWidth  ? x - menuWidth : x
  const top  = y + menuHeight > window.innerHeight ? y - menuHeight : y

  const MenuItem = ({ label, onClick, danger = false }) => (
    <button
      className={`
        w-full text-left px-4 py-2 text-sm transition-colors
        ${danger
          ? 'text-red-500 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50'}
      `}
      onClick={() => { onClick(); onClose() }}
    >
      {label}
    </button>
  )

  return (
    <>
      {/* Invisible backdrop — click anywhere outside to close */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* Menu */}
      <div
        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-44 select-none"
        style={{ left, top }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <MenuItem
          label={selectedCount > 1 ? `Duplicate ${selectedCount} items` : 'Duplicate'}
          onClick={onDuplicate}
        />
        <div className="my-1 border-t border-gray-100" />
        <MenuItem
          label={selectedCount > 1 ? `Delete ${selectedCount} items` : 'Delete'}
          onClick={onDelete}
          danger
        />
      </div>
    </>
  )
}
