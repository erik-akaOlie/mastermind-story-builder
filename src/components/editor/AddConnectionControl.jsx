// ============================================================================
// AddConnectionControl — create a connection from the Connections panel
// ----------------------------------------------------------------------------
// Restores the add door the block-editor E4 cutover removed (BACKLOG "Restore
// add-connection in the Connections panel", Erik go 2026-07-29), upgraded with
// the type-to-filter search the legacy dropdown never had.
//
// Interaction: a circular plus (28px — the connection chips' height) expands
// into a search input (width morph, SearchBar-style). A menu beneath lists the
// ELIGIBLE nodes (everything in the workspace except the card being edited —
// allOtherNodes already excludes it — and nodes already connected),
// alphabetized, filtered live by the query via the same searchNodes() the [[
// autocomplete uses. Selecting one calls the canonical onAddConnection() from
// EditorContext — the [[ path — so dedup (one connection per node-pair),
// canvas edge, persistence, undo, and Realtime all ride the existing flow.
// After a selection the control clears and collapses back to the plus.
//
// Menu is a document.body portal placed by placeDropdown (flip-above +
// viewport clamp) so the zone editor's scroll container can't clip it and no
// z-index contest with Inspector chrome is possible. Key events stop
// propagation so BlockNote never sees keystrokes typed into the search field.
// Shows 12 results + a "+N more" hint when the match set overflows, so the
// cap never reads as "that's every node."
//
// Analytics: the legacy funnel, same event names — connection_started
// (expand), connection_completed (select), connection_abandoned (Esc /
// click-away).
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from '@phosphor-icons/react'
import { useNodeTypes } from '../../store/useTypeStore'
import { sortKey } from '../../utils/labelUtils'
import { placeDropdown } from '../CanvasToolbar.jsx'
import { searchNodes } from './editorLinks.js'
import { useEditorContext } from './EditorContext.jsx'
import { track } from '../../lib/analytics.js'

// 28px = the chip height (text-sm line + py-1) — Erik's spec: the plus circle
// matches the chips. Expanded width 224 (8-grid); menu width 288 (the legacy
// picker's w-72). Shown-results cap matches the [[ menu's 12.
const CONTROL_H_PX = 28
const EXPANDED_W_PX = 224
const MENU_W_PX = 288
const MENU_MAX_H_PX = 208
const SHOWN_CAP = 12
// Row-height estimates for pre-placement sizing only (placeDropdown needs a
// size before the menu exists; a few px of error only affects the flip point).
const ROW_H_PX = 40
const HINT_ROW_H_PX = 32

export default function AddConnectionControl() {
  const { connections, allOtherNodes, onAddConnection } = useEditorContext()
  const nodeTypes = useNodeTypes()

  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [menuPos, setMenuPos] = useState(null)

  const pillRef = useRef(null)
  const inputRef = useRef(null)
  const menuRef = useRef(null)
  const wasExpandedRef = useRef(false)

  // Eligible = every other node in the workspace not already connected,
  // alphabetized (the legacy picker's ordering).
  const connectedIds = new Set(connections.map((c) => c.nodeId))
  const eligible = (allOtherNodes || [])
    .filter((n) => !connectedIds.has(n.id))
    .sort((a, b) => sortKey(a.data?.label).localeCompare(sortKey(b.data?.label)))
  const matches = searchNodes(eligible, query, Infinity)
  const shown = matches.slice(0, SHOWN_CAP)
  const overflow = matches.length - shown.length

  const collapse = () => {
    setExpanded(false)
    setQuery('')
    setHighlight(0)
    setMenuPos(null)
  }
  const expand = () => {
    track('connection_started')
    setExpanded(true)
  }
  const abandon = () => {
    track('connection_abandoned')
    collapse()
  }
  const select = (n) => {
    track('connection_completed', { targetType: n.data?.type })
    onAddConnection?.(n)
    collapse()
  }

  // Focus the input on expand; return focus to the pill after collapse.
  useEffect(() => {
    if (expanded) {
      const t = requestAnimationFrame(() => inputRef.current?.focus())
      wasExpandedRef.current = true
      return () => cancelAnimationFrame(t)
    }
    if (wasExpandedRef.current) {
      wasExpandedRef.current = false
      pillRef.current?.querySelector('button')?.focus()
    }
  }, [expanded])

  // Place the menu under the pill (portal → flip-above + clamp). Re-placed
  // when the result count changes since the estimated height changes.
  useLayoutEffect(() => {
    if (!expanded || !pillRef.current) return
    const rect = pillRef.current.getBoundingClientRect()
    const estH = Math.min(
      MENU_MAX_H_PX,
      (shown.length || 1) * ROW_H_PX + (overflow > 0 ? HINT_ROW_H_PX : 0),
    )
    setMenuPos(placeDropdown(rect, { w: MENU_W_PX, h: estH }))
  }, [expanded, shown.length, overflow])

  // Click-away while expanded = abandonment (Esc's sibling). pointerdown so
  // it fires before any focus churn; ignores clicks inside pill or menu.
  useEffect(() => {
    if (!expanded) return
    const onDocPointerDown = (e) => {
      if (pillRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      abandon()
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  const onKeyDown = (e) => {
    // BlockNote must never see these keystrokes (slash menu, [[ trigger,
    // text insertion all listen upstream).
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); abandon(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, shown.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const n = shown[highlight] ?? shown[0]
      if (n) select(n)
    }
  }

  const menu = expanded && menuPos && (
    <div
      ref={menuRef}
      className="fixed z-[10001] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
      style={{ left: menuPos.left, top: menuPos.top, width: MENU_W_PX, maxHeight: MENU_MAX_H_PX }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {shown.length === 0 ? (
        <div className="px-3 py-3 text-sm text-gray-400">
          {eligible.length === 0
            ? 'Every node is already connected'
            : 'No nodes match'}
        </div>
      ) : (
        <>
          {shown.map((n, i) => {
            const cfg = nodeTypes[n.data?.type] || { color: '#6B7280', label: n.data?.type }
            return (
              <button
                key={n.id}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${i === highlight ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(n)}
              >
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="flex-1 truncate text-gray-700">{n.data?.label || 'Untitled'}</span>
                <span
                  className="flex-shrink-0 rounded px-1.5 py-0.5 text-xs"
                  style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </button>
            )
          })}
          {overflow > 0 && (
            <div className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-400">
              +{overflow} more — keep typing to narrow
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <>
      <div
        ref={pillRef}
        className="flex flex-shrink-0 items-center overflow-hidden rounded-full border border-gray-300 bg-white transition-[width] duration-200 ease-out"
        style={{ width: expanded ? EXPANDED_W_PX : CONTROL_H_PX, height: CONTROL_H_PX }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {expanded ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
            onKeyDown={onKeyDown}
            placeholder="Search nodes…"
            aria-label="Search nodes to connect"
            className="w-full bg-transparent px-3 text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
        ) : (
          <button
            aria-label="Add connection"
            onClick={expand}
            className="flex h-full w-full items-center justify-center text-gray-500 transition-colors hover:text-gray-700"
          >
            <Plus size={14} weight="bold" />
          </button>
        )}
      </div>
      {menu && createPortal(menu, document.body)}
    </>
  )
}
