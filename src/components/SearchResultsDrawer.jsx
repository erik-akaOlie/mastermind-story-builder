// ============================================================================
// SearchResultsDrawer — the SEARCH RESULTS surface (beta simple search)
// ----------------------------------------------------------------------------
// Terminology guard (Erik, 2026-07-07): this drawer shows SEARCH RESULTS —
// the submitted results for the current query. It is NOT the prediction menu
// (query options under the input; see SearchBar). Results are nodes; two
// nodes sharing a title each get a row.
//
// Presentation: anchored to the RIGHT edge, slides LEFTWARD into view and
// back rightward to hide. Top sits below the search band (SEARCH_BAND_REM)
// so the input stays visible for follow-up queries — on every device. It
// deliberately does NOT copy the docked Inspector's dress (which rises from
// the bottom, sits off the right edge with a margin, and wears the node
// type's color): this panel is flush-right, neutral white, and slides
// sideways, so nobody mistakes search results for the Inspector.
//
// While the drawer is open the app is in FIND MODE (2026-07-07): the camera
// has framed the whole graph as beads (App, on submit), and hovering or
// keyboard-focusing a row here spotlights its node as a card via
// searchFocusNodeId. The Inspector is closed for the duration (App owns
// that swap via searchOps.resultsOpened/resultsClosed, including the
// commit-then-rewind contract: cancel restores camera + Inspector, select
// commits). Selecting a row hands the entry up; SearchBar orchestrates
// exit + select + Inspector.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { SEARCH_BAND_REM } from './SearchBar.jsx'
import { useNodeTypes } from '../store/useTypeStore.js'
import { useCanvasUiStore } from '../store/useCanvasUiStore.js'
import { useImageUrl } from '../lib/useImageUrl.js'
import { useIsNarrowViewport } from '../hooks/useIsNarrowViewport.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

const SLIDE_MS = 250

// Same luminance rule used across type-colored surfaces (Inspector header,
// TypePicker, connection chips).
function textForHex(hex) {
  if (!hex || hex.length < 7) return '#111827'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#111827' : '#ffffff'
}

// One result row's identity image: the node thumbnail when present and not
// hidden, else the type icon on the type color (mirrors the bead fallback).
function ResultThumb({ entry, typeConfig }) {
  const showAvatar = !!entry.avatar && !entry.hideAvatar
  const url = useImageUrl(showAvatar ? entry.avatar : null, { variant: 'thumb' })
  const color = typeConfig?.color ?? '#6b7280'
  const TypeIcon = typeConfig?.icon
  if (showAvatar && url) {
    return (
      <img
        src={url}
        alt=""
        className="w-10 h-10 rounded-lg object-cover flex-none"
        draggable={false}
      />
    )
  }
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center flex-none"
      style={{ backgroundColor: color }}
    >
      {TypeIcon && <TypeIcon size={20} weight="fill" color={textForHex(color)} />}
    </div>
  )
}

// Set/clear the find-mode spotlight: while this row is hovered or keyboard-
// focused, its node is promoted bead→card on the canvas (searchFocusNodeId →
// the fourth expansion trigger in CampaignNode / App). Clearing only if this
// row still owns the focus id prevents a leave event that fires AFTER the
// pointer already entered the next row from wiping the next row's preview.
function setPreview(id) {
  useCanvasUiStore.getState().setSearchFocusNodeId(id)
}
function clearPreview(id) {
  const store = useCanvasUiStore.getState()
  if (store.searchFocusNodeId === id) store.setSearchFocusNodeId(null)
}

function ResultRow({ entry, typeConfig, onSelect }) {
  return (
    <button
      type="button"
      data-search-result-row
      onClick={() => onSelect(entry)}
      onMouseEnter={() => setPreview(entry.id)}
      onMouseLeave={() => clearPreview(entry.id)}
      onFocus={() => setPreview(entry.id)}
      onBlur={() => clearPreview(entry.id)}
      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
    >
      <ResultThumb entry={entry} typeConfig={typeConfig} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">
          {entry.title || 'Untitled'}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          {typeConfig?.icon && (
            <typeConfig.icon size={12} weight="fill" color={typeConfig.color} />
          )}
          <span className="truncate">{typeConfig?.label ?? entry.typeKey}</span>
        </div>
      </div>
    </button>
  )
}

export default function SearchResultsDrawer({ open, query, results, onSelect, onClose }) {
  const narrow = useIsNarrowViewport()
  const reducedMotion = useReducedMotion()
  const nodeTypes = useNodeTypes()
  const panelRef = useRef(null)

  // Mount/slide lifecycle: mount off-screen, slide in on the next frame;
  // on close, slide out and unmount after the transition. The last query/
  // results stay rendered during the slide-out so the panel doesn't blank
  // mid-exit. Reduced motion collapses both slides to instant.
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const lastContentRef = useRef({ query: '', results: [] })
  if (open) lastContentRef.current = { query, results }

  // Never-stick guardrail: whatever path closes the drawer (X, Esc,
  // selection, workspace switch, unmount), the find-mode spotlight clears.
  // Row-level leave/blur handlers cover the common cases; this covers the
  // rest.
  useEffect(() => {
    if (open) return
    useCanvasUiStore.getState().setSearchFocusNodeId(null)
  }, [open])
  useEffect(() => () => {
    useCanvasUiStore.getState().setSearchFocusNodeId(null)
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      if (reducedMotion) {
        setVisible(true)
      } else {
        const raf = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(raf)
      }
    } else {
      setVisible(false)
      if (reducedMotion) {
        setMounted(false)
      } else {
        const t = setTimeout(() => setMounted(false), SLIDE_MS)
        return () => clearTimeout(t)
      }
    }
  }, [open, reducedMotion])

  // Esc + arrow-key roving are handled on the panel and fire when focus is
  // inside it (a row or the close button, via Tab or click). While focus
  // stays in the search input, SearchBar's layered Esc handling owns
  // dismissal instead — the two never compete for the same keystroke.
  useEffect(() => {
    if (!open || !mounted) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      // Roving focus through the rows with the arrow keys.
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const rows = panelRef.current?.querySelectorAll('[data-search-result-row]')
        if (!rows || rows.length === 0) return
        const list = Array.from(rows)
        const idx = list.indexOf(document.activeElement)
        e.preventDefault()
        const next = e.key === 'ArrowDown'
          ? list[Math.min(idx + 1, list.length - 1)] ?? list[0]
          : list[Math.max(idx - 1, 0)]
        next?.focus()
      }
    }
    const el = panelRef.current
    el?.addEventListener('keydown', onKeyDown)
    return () => el?.removeEventListener('keydown', onKeyDown)
  }, [open, mounted, onClose])

  if (!mounted) return null

  const { query: shownQuery, results: shownResults } = lastContentRef.current

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Search results"
      tabIndex={-1}
      className="fixed z-[9990] flex flex-col bg-white border-l border-gray-200 shadow-2xl rounded-tl-[0.5rem] overflow-hidden focus:outline-none"
      style={{
        top: `${SEARCH_BAND_REM}rem`,
        right: 0,
        bottom: 0,
        width: narrow ? '100vw' : '30rem',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: reducedMotion ? 'none' : `transform ${SLIDE_MS}ms ease-out`,
      }}
    >
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 flex-none">
        <div className="min-w-0 flex-1 text-sm text-gray-900">
          <span className="font-medium">{shownResults.length}</span>
          {shownResults.length === 1 ? ' result for ' : ' results for '}
          <span className="font-medium truncate">“{shownQuery}”</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search results"
          title="Close"
          className="w-8 h-8 flex-none flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {shownResults.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-500">
            No matches for “{shownQuery}”. Check the spelling or try a shorter
            piece of the name.
          </div>
        ) : (
          shownResults.map((entry) => (
            <ResultRow
              key={entry.id}
              entry={entry}
              typeConfig={nodeTypes[entry.typeKey]}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
