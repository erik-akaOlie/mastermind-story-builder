// ============================================================================
// useIsNarrowViewport
// ----------------------------------------------------------------------------
// Returns true when the viewport is phone-narrow (≤ 640px — 8-grid: 80×8) and
// re-renders the consumer when a resize/rotation crosses the boundary.
//
// First consumer: the Inspector (MB-2, mobile beta hardening). On narrow
// viewports both desktop presentations (floating modal 660px, docked panel
// 480px) are wider than the screen — the Inspector renders full-screen
// instead. Erik's product call, 2026-07-02: on mobile, users don't carry the
// desktop expectation of seeing the knowledge graph alongside the editor, so
// a full-screen takeover beats a bottom sheet with a canvas peek.
//
// Mirrors the useReducedMotion pattern (media query + change subscription).
// SSR-safe: false when window/matchMedia are unavailable.
// ============================================================================

import { useEffect, useState } from 'react'

const QUERY = '(max-width: 640px)'

function initial() {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches === true
}

export function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(initial)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const handler = (e) => setIsNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isNarrow
}
