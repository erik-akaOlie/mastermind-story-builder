// ============================================================================
// SearchBar — beta simple search (node titles, current workspace)
// ----------------------------------------------------------------------------
// Top-RIGHT canvas overlay, mirror of the top-left breadcrumb. Collapsed it's
// a circular magnifier; it expands into a pill with the input on hover (as
// before) and now PINS open on click/tap/focus.
//
// Two distinct surfaces, kept deliberately separate (Erik, 2026-07-07):
//
//   PREDICTION MENU — attached under the input while typing. Shows QUERY
//   OPTIONS derived from the workspace's node titles (deduped — two nodes
//   sharing a title yield one prediction). Choosing one (click, or arrow +
//   Enter) SUBMITS that query; it never opens a node directly.
//
//   SEARCH RESULTS — the right-side drawer (SearchResultsDrawer) that opens
//   when a query is submitted with Enter / the magnifier / a prediction.
//   Submitting enters FIND MODE (Erik, 2026-07-07): the camera frames the
//   whole graph as beads; hovering/keyboard-focusing a result row spotlights
//   that node as a card (SearchResultsDrawer sets searchFocusNodeId).
//   Results are nodes; selecting one COMMITS the navigation — search exits
//   completely (collapse + clear), the graph stays search-framed, the node
//   is selected (existing single-select expansion keeps it in card form),
//   and the Inspector opens on it — all via searchOps → App.
//
// Cancel rewinds, select commits: any exit WITHOUT a selection (drawer X,
// Esc from the drawer) is a FULL exit that restores the pre-search camera
// view and the Inspector search displaced, collapses the pill back to the
// magnifier, and resets to a blank slate. Esc is layered: predictions open →
// close predictions; else drawer open → full exit; else collapse. Search
// state also resets on workspace switch.
//
// Touch: hover contributes nothing to the pill's expanded state on
// touch-primary devices — a tap synthesizes mouseenter with no matching
// mouseleave, which otherwise pins the pill open over the Inspector title
// after a selection (the 2026-07-07 mobile bug; same trap as the 2026-07-02
// bead-expansion crash). Submitting on touch also blurs the input so the
// keyboard drops and the full results panel is visible; tapping back into
// the input brings the keyboard back naturally.
//
// `SEARCH_BAND_REM` is the reserved vertical band at the top of the viewport
// (right side) that the docked Inspector and the results drawer sit beneath.
// Defined here because the search UI is what establishes the band.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import HoverReveal from './HoverReveal.jsx'
import SearchResultsDrawer from './SearchResultsDrawer.jsx'
import {
  getSearchEntries,
  notifySearchResultsOpened,
  notifySearchResultsClosed,
  openNodeFromSearch,
} from '../lib/searchOps.js'
import { rankEntries, predictQueries } from '../lib/nodeSearch.js'
import { useIsNarrowViewport } from '../hooks/useIsNarrowViewport.js'
import { useTouchPrimary } from '../hooks/useTouchPrimary.js'
import { useWorkspace } from '../lib/WorkspaceContext.jsx'
import { useCanvasUiStore } from '../store/useCanvasUiStore.js'
import { track } from '../lib/analytics.js'

// 5rem / 80px — reserved top band for the search UI. The docked inspector's
// top edge sits at this offset, as does the results drawer's. 8-grid: 80/8=10.
export const SEARCH_BAND_REM = 5

export default function SearchBar() {
  const narrow = useIsNarrowViewport()
  const touchPrimary = useTouchPrimary()
  const { activeWorkspaceId } = useWorkspace()

  const [hovered, setHovered] = useState(false)
  const [active, setActive]   = useState(false)     // pinned open (focus/typing/drawer)
  const [inputFocused, setInputFocused] = useState(false)
  const [query, setQuery]     = useState('')
  const [predictionsOpen, setPredictionsOpen] = useState(false)
  const [highlightIdx, setHighlightIdx]       = useState(-1)
  const [drawer, setDrawer]   = useState(null)      // { query, results } | null

  const containerRef = useRef(null)
  const inputRef     = useRef(null)

  // Query options for the prediction menu — recomputed per keystroke over a
  // fresh snapshot of the workspace's titles (a few hundred at most).
  const predictions = useMemo(() => {
    if (!predictionsOpen) return []
    if (!query.trim()) return []
    return predictQueries(getSearchEntries(), query)
  }, [query, predictionsOpen])

  // Hover is ignored on touch-primary devices (see header — synthetic
  // mouseenter has no matching mouseleave and would pin the pill open).
  const expanded = active || !!drawer || (hovered && !touchPrimary)

  // Stacking rule (Erik, 2026-07-07): the Inspector sits on top of all other
  // UI. The one exception is while the user is ACTIVELY searching — input
  // focused, predictions showing, or the drawer open (the drawer never
  // coexists with the Inspector) — when the cluster rises above the docked
  // Inspector (z-[9999]) so the prediction menu isn't swallowed by the
  // panel. Idle or collapsed, search drops below the Inspector — which is
  // what keeps the magnifier from floating over the full-screen Inspector
  // on phones.
  const engaged = inputFocused || (predictionsOpen && predictions.length > 0) || !!drawer

  // Everything resets when the user switches workspaces — entries, results,
  // and any pending restore all belong to the previous workspace.
  useEffect(() => {
    useCanvasUiStore.getState().setSearchFocusNodeId(null)
    setDrawer(null)
    setQuery('')
    setActive(false)
    setPredictionsOpen(false)
    setHighlightIdx(-1)
  }, [activeWorkspaceId])

  const activate = () => {
    if (!active) {
      setActive(true)
      track('search_opened')
    }
    inputRef.current?.focus()
  }

  const collapse = () => {
    setActive(false)
    setQuery('')
    setPredictionsOpen(false)
    setHighlightIdx(-1)
    inputRef.current?.blur()
  }

  // Submit a query → enter/refresh find mode. App frames the whole graph as
  // beads on EVERY submit (and on the first submit of a session captures the
  // rewind camera + displaces the Inspector, committing its edits first).
  // Predictions close; the query stays visible in the input for revision.
  // On touch, blur the input so the keyboard drops and the results panel is
  // fully visible — tapping back in reopens the keyboard.
  const submit = async (raw) => {
    const submitted = raw.trim()
    if (!submitted) return
    setQuery(raw)
    setPredictionsOpen(false)
    setHighlightIdx(-1)
    const results = rankEntries(getSearchEntries(), submitted)
    await notifySearchResultsOpened()
    setDrawer({ query: submitted, results })
    if (touchPrimary) inputRef.current?.blur()
    track('search_submitted', { queryLength: submitted.length, resultCount: results.length })
  }

  // Dismissed without selecting (X or Esc) → FULL exit: App rewinds the
  // camera to the pre-search view and restores the displaced Inspector;
  // the pill collapses back to the magnifier with a blank slate.
  const dismissDrawer = () => {
    useCanvasUiStore.getState().setSearchFocusNodeId(null)
    setDrawer(null)
    notifySearchResultsClosed({ selected: false })
    collapse()
  }

  // A result was chosen → COMMIT: exit search completely (no camera rewind —
  // focus has intentionally moved), then App selects the node and opens the
  // Inspector on it; the graph stays search-framed with the selected node
  // promoted to card form by the existing single-select expansion.
  const selectResult = (entry) => {
    useCanvasUiStore.getState().setSearchFocusNodeId(null)
    setDrawer(null)
    notifySearchResultsClosed({ selected: true })
    setActive(false)
    setHovered(false)
    setQuery('')
    setPredictionsOpen(false)
    setHighlightIdx(-1)
    inputRef.current?.blur()
    openNodeFromSearch(entry.id)
    track('search_result_selected', { typeKey: entry.typeKey })
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown' && predictions.length > 0) {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, predictions.length - 1))
      return
    }
    if (e.key === 'ArrowUp' && predictions.length > 0) {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx >= 0 && predictions[highlightIdx] != null) {
        submit(predictions[highlightIdx])
      } else {
        submit(query)
      }
      return
    }
    if (e.key === 'Escape') {
      // Layered exit; stopPropagation so the Inspector's own Esc handling
      // never fires from inside the search input.
      e.preventDefault()
      e.stopPropagation()
      if (predictionsOpen && predictions.length > 0) {
        setPredictionsOpen(false)
        setHighlightIdx(-1)
      } else if (drawer) {
        dismissDrawer()
      } else {
        collapse()
      }
    }
  }

  // Focus leaving the search cluster closes predictions; fully collapse only
  // when there's nothing worth keeping open (no query, no drawer).
  const onInputBlur = (e) => {
    if (containerRef.current?.contains(e.relatedTarget)) return
    setPredictionsOpen(false)
    setHighlightIdx(-1)
    if (!query.trim() && !drawer) setActive(false)
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`fixed top-4 right-4 ${engaged ? 'z-[10000]' : 'z-50'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex items-center bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 text-xs overflow-hidden">
          {/* Input revealed to the LEFT of the magnifier — hover previews the
              pill (as before); click/tap/focus pins it open. On phone-narrow
              viewports the width caps so the pill never crowds the top-left
              breadcrumb (comfortable-gap rule, 2026-07-07). */}
          <HoverReveal open={expanded}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Search…"
              aria-label="Search nodes by title"
              role="combobox"
              aria-expanded={predictionsOpen && predictions.length > 0}
              aria-autocomplete="list"
              aria-controls="search-prediction-menu"
              tabIndex={expanded ? 0 : -1}
              onFocus={() => {
                setInputFocused(true)
                activate()
              }}
              onBlur={(e) => {
                setInputFocused(false)
                onInputBlur(e)
              }}
              onChange={(e) => {
                setQuery(e.target.value)
                setPredictionsOpen(true)
                setHighlightIdx(-1)
                // Guardrail: a stale result preview must not outlive the
                // query it came from.
                useCanvasUiStore.getState().setSearchFocusNodeId(null)
              }}
              onKeyDown={onInputKeyDown}
              className="bg-transparent outline-none pl-3 pr-1 py-1.5 w-48 text-gray-900 placeholder-gray-400 whitespace-nowrap"
              style={narrow ? { maxWidth: 'calc(100vw - 8.5rem)' } : undefined}
            />
          </HoverReveal>

          {/* Magnifier: opens search when collapsed, submits when open. */}
          <button
            type="button"
            onClick={() => {
              if (!active) activate()
              else if (query.trim()) submit(query)
            }}
            title="Search"
            aria-label="Search"
            className="flex items-center justify-center text-gray-500 hover:text-gray-900 transition-all duration-150 ease-out p-1.5"
          >
            <MagnifyingGlass size={14} weight="bold" />
          </button>
        </div>

        {/* PREDICTION MENU — query options, not results. Sits above the
            results drawer (z: container 10000 > drawer 9990) so revising the
            query while results are open reads as "new query in progress". */}
        {predictionsOpen && predictions.length > 0 && (
          <div
            id="search-prediction-menu"
            role="listbox"
            aria-label="Query predictions"
            className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 overflow-hidden"
            style={{ width: narrow ? 'calc(100vw - 2rem)' : '16rem' }}
          >
            {predictions.map((title, i) => (
              <button
                key={title}
                type="button"
                role="option"
                aria-selected={i === highlightIdx}
                // mousedown fires before the input's blur — preventDefault
                // keeps focus in the input so blur doesn't close the menu
                // out from under the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(title)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 ${
                  i === highlightIdx ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <MagnifyingGlass size={12} weight="bold" className="flex-none text-gray-400" />
                <span className="truncate">{title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <SearchResultsDrawer
        open={!!drawer}
        query={drawer?.query ?? ''}
        results={drawer?.results ?? []}
        onSelect={selectResult}
        onClose={dismissDrawer}
      />
    </>
  )
}
