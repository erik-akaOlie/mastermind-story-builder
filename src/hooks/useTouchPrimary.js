// ============================================================================
// useTouchPrimary
// ----------------------------------------------------------------------------
// Returns true when the PRIMARY input is touch — no hover capability and a
// coarse pointer (finger). Distinct from useIsNarrowViewport on purpose:
// that one is about LAYOUT (how much room), this one is about INPUT (what
// affordances make sense). A tablet can be wide (desktop layout) yet still
// touch-primary (needs visible tap targets, no hover reveals, no "Ctrl+V"
// copy); a small desktop window is narrow yet mouse-driven.
//
// First consumers (mobile beta hardening, 2026-07-02 audit):
//   - InspectorHeader: hover-revealed avatar controls become persistently
//     visible, separated tap targets (the invisible-but-tappable eye button
//     was swallowing taps meant for "add image").
//   - UploadImageModal: swaps the "Ctrl+V to paste" keyboard copy for
//     touch-appropriate buttons.
//
// Mirrors the useReducedMotion media-query pattern. SSR-safe: false.
// ============================================================================

import { useEffect, useState } from 'react'

const QUERY = '(hover: none) and (pointer: coarse)'

function initial() {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches === true
}

export function useTouchPrimary() {
  const [touchPrimary, setTouchPrimary] = useState(initial)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const handler = (e) => setTouchPrimary(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return touchPrimary
}
