// ============================================================================
// ConnectionsBlock — the real data-driven Connections custom block (Chunk B)
// ----------------------------------------------------------------------------
// Renders this card's LIVE connections as type-colored chips and lets the user
// delete each one. Per ADR-0016 §6/§7 the Connections block is the authoritative
// place to remove a connection; deleting here removes the line (and, once inline
// links exist in Chunk C, reverts any [[links]] to that node to plain text).
//
// Per §8, the list is read from EditorContext every render (never cached in
// component state), so a deletion can't ghost back. Deleting reuses the
// Inspector's existing localConns flow, so the canvas edge removal, persistence,
// and undo entry all happen through the path that already exists.
//
// Adding a connection has TWO doors (restored 2026-07-29, Erik's call): the
// AddConnectionControl plus-button at the end of the chip row (search picker,
// same canonical onAddConnection path as [[), and the inline [[Node]] link.
// The empty-state hint mentions both, with the plus as the actionable element.
// ============================================================================

import { useNodeTypes } from '../../store/useTypeStore'
import { useEditorContext } from './EditorContext.jsx'
import AddConnectionControl from './AddConnectionControl.jsx'

// Readable foreground for a hex background (same luminance rule used across the
// app on type-colored surfaces).
function textForHex(hex) {
  if (typeof hex !== 'string' || hex.length < 7) return '#ffffff'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}

export default function ConnectionsView() {
  const { connections, onDeleteConnection } = useEditorContext()
  const nodeTypes = useNodeTypes()

  return (
    <div contentEditable={false} className="w-full">
      {/* Chip row + the add control. The plus sits at the END of the chips
          (first item when there are none) — Erik's placement call. */}
      <div className="flex flex-wrap items-center gap-2">
        {connections.map((c) => {
          const color = nodeTypes[c.type]?.color || '#6B7280'
          const fg = textForHex(color)
          return (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1.5 py-1 text-sm font-medium"
              style={{ backgroundColor: color, color: fg }}
            >
              {c.label || 'Untitled'}
              <button
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs leading-none hover:bg-black/20"
                style={{ color: fg }}
                onClick={() => onDeleteConnection(c.id)}
                aria-label={`Remove connection to ${c.label || 'Untitled'}`}
              >
                ×
              </button>
            </span>
          )
        })}
        <AddConnectionControl />
      </div>
      {connections.length === 0 && (
        <div className="mt-2 text-sm text-gray-400">
          No connections yet — add one with the plus, or type{' '}
          <span className="font-mono">[[</span> in the text to link a card.
        </div>
      )}
    </div>
  )
}
