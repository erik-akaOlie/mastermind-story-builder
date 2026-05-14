// ============================================================================
// useReducedMotion
// ----------------------------------------------------------------------------
// Returns the current state of the OS-level `prefers-reduced-motion: reduce`
// media query and re-renders the consumer when it changes. Used across the
// Bead View morph system (cards, dots, lines, drift) to collapse every
// animation to a zero-duration swap when the user has expressed a preference
// for reduced motion — per ADR-0010's accessibility section.
//
// SSR-safe: returns false when window is undefined (and the matchMedia
// subscription is a no-op on the server).
// ============================================================================

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function initial() {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches === true
}

export function useReducedMotion() {
  const [prefers, setPrefers] = useState(initial)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const handler = (e) => setPrefers(e.matches)
    // Modern API; addEventListener has been available cross-browser for
    // years. Skip the legacy addListener fallback.
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return prefers
}
