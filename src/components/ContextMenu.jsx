import { useEffect } from 'react'

export default function ContextMenu({ x, y, node, onEdit, onDuplicate, onLockToggle, onDelete, onClose }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Adjust so the menu never clips outside the viewport
  const menuWidth = 176
  const menuHeight = 160
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
        <MenuItem label="Edit"      onClick={onEdit} />
        <MenuItem label="Duplicate" onClick={onDuplicate} />
        <div className="my-1 border-t border-gray-100" />
        <MenuItem
          label={node?.data?.locked ? 'Unlock' : 'Lock'}
          onClick={onLockToggle}
        />
        <div className="my-1 border-t border-gray-100" />
        <MenuItem label="Delete" onClick={onDelete} danger />
      </div>
    </>
  )
}
