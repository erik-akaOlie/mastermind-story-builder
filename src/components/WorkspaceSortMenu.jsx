// ============================================================================
// WorkspaceSortMenu — the CampaignPicker's sort control.
// ----------------------------------------------------------------------------
// An understated "Sort by: <current> ⌄" text trigger plus a simple dropdown of
// three single-choice options (each carries its own direction). Pure
// presentation over workspaceSort.js: the parent owns the sortId + persistence.
//
// Trigger text is text-xs to match the "+ New workspace" button label, so their
// baselines line up on the shared row. The dropdown is offset so its option
// labels start under the current value (not under "Sort by:").
//
// `stacked` (MB-4, phone-width only — the parent decides): renders the trigger
// as two left-justified lines — "Sort by" label on top, active choice (+ ⌄)
// beneath — keeping the control narrow so it can't collide with the
// New-workspace control. Desktop keeps the one-line trigger unchanged.
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { SORT_OPTIONS, getSortOption } from '../lib/workspaceSort.js'

// Option rows use px-3 (12px) horizontal padding; offset the menu left by that
// so a row's label text aligns under the trigger's current value.
const OPTION_PADDING_PX = 12

export default function WorkspaceSortMenu({ sortId, onChange, stacked = false }) {
  const [open, setOpen] = useState(false)
  const [menuLeft, setMenuLeft] = useState(0)
  const wrapperRef = useRef(null)
  const valueRef = useRef(null)
  const current = getSortOption(sortId)

  // Align the dropdown so option labels sit under the current value text.
  useLayoutEffect(() => {
    if (open && valueRef.current) {
      setMenuLeft(Math.max(0, valueRef.current.offsetLeft - OPTION_PADDING_PX))
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      {stacked ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex flex-col items-start gap-1 text-xs leading-none text-gray-500 hover:text-gray-700"
        >
          <span>Sort by</span>
          <span className="flex items-center gap-1">
            <span ref={valueRef} className="font-medium text-gray-900">{current.label}</span>
            <CaretDown size={12} weight="bold" className="text-gray-400" />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-1 text-xs leading-none text-gray-500 hover:text-gray-700"
        >
          <span>Sort by:</span>
          <span ref={valueRef} className="font-medium text-gray-900">{current.label}</span>
          <CaretDown size={12} weight="bold" className="text-gray-400" />
        </button>
      )}

      {open && (
        <div
          role="menu"
          style={{ left: menuLeft }}
          className="absolute top-full mt-2 w-44 z-30 rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.id === sortId
            return (
              <button
                key={opt.id}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { onChange(opt.id); setOpen(false) }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-gray-50 ${
                  active ? 'text-sky-900' : 'text-gray-700'
                }`}
              >
                <span>{opt.label}</span>
                {active && <Check size={14} weight="bold" className="text-sky-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
