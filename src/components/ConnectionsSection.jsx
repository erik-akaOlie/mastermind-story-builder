// ConnectionsSection — the chip list + picker shown at the bottom of EditModal.
// Owns:
//   - The picker dropdown's open/close state
//   - Click-outside to dismiss
//   - Add / remove handlers (which mutate the parent's localConns array)
//   - Chip rendering with type-aware coloring
//
// State (`localConns`) lives in the parent so that EditModal's auto-save
// useEffect can read it and emit { addNodeIds, removeNodeIds } to the canvas.
// The parent passes `localConns` and `setLocalConns` props plus the list of
// candidate target nodes (`allOtherNodes`).

import { useState } from 'react'
import { useNodeTypes } from '../store/useTypeStore'
import { sortKey } from '../utils/labelUtils'
import SectionLabel from './SectionLabel'

// Same readability formula used elsewhere — chosen background determines
// whether the chip's label/× text is dark or white. Inlined here to avoid
// a dependency back into EditModal; consider extracting to a util if more
// places start using it.
function textForHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}

export default function ConnectionsSection({ localConns, setLocalConns, allOtherNodes }) {
  const NODE_TYPES = useNodeTypes()
  const [showPicker, setShowPicker] = useState(false)

  const availableNodes = allOtherNodes
    .filter((n) => !localConns.find((c) => c.nodeId === n.id))
    .sort((a, b) => sortKey(a.data.label).localeCompare(sortKey(b.data.label)))

  const addConnection = (n) => {
    setLocalConns((prev) => [
      ...prev,
      { edgeId: null, nodeId: n.id, label: n.data.label, type: n.data.type, isNew: true },
    ])
    setShowPicker(false)
  }
  const removeConnection = (nodeId) =>
    setLocalConns((prev) => prev.filter((c) => c.nodeId !== nodeId))

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Connections</SectionLabel>

      {localConns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...localConns]
            .sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label)))
            .map((conn) => {
              const cfg = NODE_TYPES[conn.type] || { color: '#6B7280', label: conn.type }
              const chipText = textForHex(cfg.color)
              return (
                <div
                  key={conn.nodeId}
                  className="flex items-center gap-2 pl-4 pr-2 py-1 rounded-full text-xs font-medium select-none"
                  style={{ backgroundColor: cfg.color, color: chipText }}
                >
                  <span className="max-w-[9rem] truncate leading-none">{conn.label || 'Untitled'}</span>
                  <button
                    className="text-base leading-none transition-opacity flex-shrink-0 opacity-50 hover:opacity-100"
                    style={{ color: chipText }}
                    onClick={() => removeConnection(conn.nodeId)}
                  >×</button>
                </div>
              )
            })}
        </div>
      )}

      {localConns.length === 0 && (
        <p className="text-base font-light text-[#6b7280] italic">No connections yet</p>
      )}

      {availableNodes.length > 0 && (
        <div className="relative">
          <button
            className="flex items-center gap-1 text-base font-light text-[#6b7280] hover:text-gray-600 transition-colors"
            onClick={() => setShowPicker((v) => !v)}
          >
            <span className="text-xl leading-none">+</span>Add connection
          </button>
          {showPicker && (
            <>
              <div className="fixed inset-0 z-[10000]" onClick={() => setShowPicker(false)} />
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[10001] w-72 max-h-52 overflow-y-auto">
                {availableNodes.map((n) => {
                  const cfg = NODE_TYPES[n.data?.type] || { color: '#6B7280', label: n.data?.type }
                  return (
                    <button
                      key={n.id}
                      className="w-full text-left px-3 py-3 text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      onClick={() => addConnection(n)}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="flex-1 truncate text-gray-700">{n.data?.label || 'Untitled'}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
