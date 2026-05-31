// ============================================================================
// SearchBar (placeholder)
// ----------------------------------------------------------------------------
// Top-RIGHT canvas overlay, the mirror image of the top-left breadcrumb
// (UserMenu). Collapsed it's a circular magnifier button styled exactly like
// the breadcrumb's house button; on hover it expands LEFTWARD to reveal a
// search input field (growing into the canvas, away from the right edge).
//
// SEARCH IS NOT WIRED YET. This is a visual placeholder so the layout reserves
// the top-right band the docked inspector stops beneath. The input is
// presentational only — typing performs no search.
//
// `SEARCH_BAND_REM` is the reserved vertical band at the top of the viewport
// (right side) that the docked inspector must not intrude on. Defined here
// because the search UI is what establishes the band; the docked inspector
// imports this constant rather than hard-coding the value.
// ============================================================================

import { useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import HoverReveal from './HoverReveal.jsx'

// 5rem / 80px — reserved top band for the (future) search UI. The docked
// inspector's top edge sits at this offset. 8-grid: 80 / 8 = 10.
export const SEARCH_BAND_REM = 5

export default function SearchBar() {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="fixed top-4 right-4 z-50"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 text-xs overflow-hidden">
        {/* Input revealed to the LEFT of the magnifier on hover — it morphs the
            circle into a pill over 200ms (see HoverReveal). Presentational
            only: no handler, no search yet. Kept out of the tab order while
            collapsed. */}
        <HoverReveal open={hovered}>
          <input
            type="text"
            placeholder="Search…"
            aria-label="Search (coming soon)"
            tabIndex={hovered ? 0 : -1}
            className="bg-transparent outline-none pl-3 pr-1 py-1.5 w-48 text-gray-900 placeholder-gray-400 whitespace-nowrap"
          />
        </HoverReveal>

        {/* Always-visible magnifier. Equal padding so it forms a proper circle
            centered on the icon — same treatment as the breadcrumb's house
            button. */}
        <button
          type="button"
          className="flex items-center justify-center text-gray-500 hover:text-gray-900 transition-all duration-150 ease-out p-1.5"
          title="Search"
          aria-label="Search"
        >
          <MagnifyingGlass size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}
