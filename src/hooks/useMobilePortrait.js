// ============================================================================
// useMobilePortrait
// ----------------------------------------------------------------------------
// Returns true only for a phone held upright: the primary input is touch
// (no hover, coarse pointer — same clauses as useTouchPrimary), the viewport
// is phone-narrow (≤ 640px, same boundary as useIsNarrowViewport), AND the
// orientation is portrait. All three at once is the CONSERVATIVE mobile
// detection Erik specified for toolbar Chunk 3 (2026-07-16): a touchscreen
// laptop fails the touch-primary clause, a small desktop window fails it
// too, a tablet fails the width clause, and a phone held sideways fails the
// orientation clause — those all keep their current behavior.
//
// First consumers (toolbar Chunk 3): BottomToolbar (always-expanded
// creation-only tray), SyncIndicator (hide the passive "Edited Nm ago"
// state), FeedbackChipBar (raise the strip above the always-present tray).
//
// Mirrors the useTouchPrimary / useIsNarrowViewport media-query pattern.
// SSR-safe: false.
// ============================================================================

import { useEffect, useState } from 'react'

const QUERY =
  '(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)'

function initial() {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches === true
}

export function useMobilePortrait() {
  const [mobilePortrait, setMobilePortrait] = useState(initial)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const handler = (e) => setMobilePortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mobilePortrait
}
