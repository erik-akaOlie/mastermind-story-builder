// ============================================================================
// useViewportWidth
// ----------------------------------------------------------------------------
// Returns the current CSS viewport width (window.innerWidth) and re-renders
// the consumer on resize/rotation.
//
// First consumer: the touch expanded-peek scale (altitude.js
// expandedPeekZoom, 2026-07-20) — the peek card targets a fraction of the
// viewport width, so the same card reads at a consistent physical share on a
// 320-px display-zoomed Android and a 430-px iPhone alike. Rotation changes
// innerWidth, so the resize subscription keeps the peek honest in landscape.
//
// Mirrors the useIsNarrowViewport pattern. SSR/jsdom-safe: falls back to 0
// when window is unavailable (consumers treat 0 as "unknown").
// ============================================================================

import { useEffect, useState } from 'react'

function current() {
  if (typeof window === 'undefined') return 0
  return window.innerWidth || 0
}

export function useViewportWidth() {
  const [width, setWidth] = useState(current)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setWidth(current())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return width
}
