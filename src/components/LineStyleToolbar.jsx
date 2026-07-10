// ============================================================================
// LineStyleToolbar — floating contextual styling for ONE selected line.
// ----------------------------------------------------------------------------
// Modeled on the text block's floating toolbar family: a screen-layer child
// of <ReactFlow> (constant size, follows the selection on pan/zoom via
// useViewport), edge-aware placement via placeFloatingToolbar, hidden during
// an active drag. Appears whenever exactly one line is selected.
//
// Controls: stroke weight · solid/dashed toggle · dash length + gap (dashed
// only) · delete. Numeric values are direct type-in fields (matching the
// text block's editable px font-size field — Erik 2026-07-10, replacing the
// first-cut +/- steppers): click in, type, commit on Enter/blur; invalid
// input reverts, out-of-range clamps. Every committed change is one discrete
// editLine undo entry (recorded by App's onRestyleLine).
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useViewport, useReactFlow } from 'reactflow'
import { Trash } from '@phosphor-icons/react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import { CanvasToolbar, ToolbarDivider, placeFloatingToolbar } from './CanvasToolbar.jsx'

const WEIGHT_RANGE = [1, 32]
const DASH_RANGE   = [1, 64]

function NumberField({ label, value, range, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  // External change (undo, another tab) → resync the draft.
  useEffect(() => { setDraft(String(value)) }, [value])

  const commit = () => {
    const n = Math.round(Number(draft))
    if (!Number.isFinite(n) || draft.trim() === '') {
      setDraft(String(value))          // invalid → revert, never break rendering
      return
    }
    const clamped = Math.min(range[1], Math.max(range[0], n))
    setDraft(String(clamped))
    if (clamped !== value) onCommit(clamped)
  }

  return (
    <label className="flex items-center gap-1" title={`${label} (${range[0]}–${range[1]})`}>
      <span className="text-[0.625rem] uppercase tracking-wide text-gray-400 select-none">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        className="w-8 text-xs text-gray-700 text-center tabular-nums border border-gray-200 rounded px-0.5 py-0.5 focus:outline-none focus:border-sky-500"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape') { e.stopPropagation(); setDraft(String(value)); e.currentTarget.blur() }
        }}
      />
    </label>
  )
}

// 16px inline glyphs — Phosphor has no dashed-line icon, so both stroke
// styles are drawn directly for a like-for-like visual pair.
const SolidGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)
const DashedGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" /></svg>
)

export default function LineStyleToolbar({ onRestyleLine, onDeleteNode }) {
  const { zoom, x: panX, y: panY } = useViewport()
  const rf = useReactFlow()
  const selectedNodeIds = useCanvasUiStore((s) => s.selectedNodeIds)
  const draggingNodeId  = useCanvasUiStore((s) => s.draggingNodeId)
  const toolbarRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width !== size.w || r.height !== size.h) setSize({ w: r.width, h: r.height })
  })

  if (draggingNodeId || selectedNodeIds.size !== 1) return null
  const [onlyId] = selectedNodeIds
  const line = rf.getNodes().find((n) => n.id === onlyId && n.type === 'lineNode')
  if (!line) return null

  const { ax, ay, bx, by, weight, dashed, dashLength, dashGap } = line.data

  // Line bounding box in flow coords → screen, then edge-aware placement.
  const tl = rf.flowToScreenPosition({ x: Math.min(ax, bx), y: Math.min(ay, by) })
  const br = rf.flowToScreenPosition({ x: Math.max(ax, bx), y: Math.max(ay, by) })
  const anchorRect = { left: tl.x, top: tl.y, bottom: br.y, width: br.x - tl.x }
  const { left, top } = placeFloatingToolbar(anchorRect, size)

  const toggleBtn = (active) =>
    `p-1 rounded transition-colors ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`

  void zoom; void panX; void panY

  return (
    <div
      style={{
        position: 'fixed',
        left, top,
        zIndex: 50,
        pointerEvents: 'auto',
        visibility: size.w ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <CanvasToolbar ref={toolbarRef}>
        <NumberField
          label="Weight"
          value={weight}
          range={WEIGHT_RANGE}
          onCommit={(v) => onRestyleLine(line.id, { weight: v })}
        />

        <ToolbarDivider />

        <button title="Solid" className={toggleBtn(!dashed)} onMouseDown={(e) => e.preventDefault()}
          onClick={() => dashed && onRestyleLine(line.id, { dashed: false })}>
          <SolidGlyph />
        </button>
        <button title="Dashed" className={toggleBtn(dashed)} onMouseDown={(e) => e.preventDefault()}
          onClick={() => !dashed && onRestyleLine(line.id, { dashed: true })}>
          <DashedGlyph />
        </button>

        {dashed && (
          <>
            <ToolbarDivider />
            <NumberField
              label="Dash"
              value={dashLength}
              range={DASH_RANGE}
              onCommit={(v) => onRestyleLine(line.id, { dashLength: v })}
            />
            <NumberField
              label="Gap"
              value={dashGap}
              range={DASH_RANGE}
              onCommit={(v) => onRestyleLine(line.id, { dashGap: v })}
            />
          </>
        )}

        <ToolbarDivider />

        <button
          title="Delete line"
          className="p-1 rounded text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onDeleteNode(line.id)}
        >
          <Trash size={16} weight="bold" />
        </button>
      </CanvasToolbar>
    </div>
  )
}
