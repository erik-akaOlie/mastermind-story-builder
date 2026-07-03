// ============================================================================
// useVisualViewportHeight
// ----------------------------------------------------------------------------
// Returns the height (px) of the ACTUALLY VISIBLE viewport when it's smaller
// than the layout viewport — in practice: when the on-screen keyboard is
// open — and null otherwise.
//
// Why: a `fixed inset-0` element is sized to the LAYOUT viewport, which
// mobile browsers do NOT shrink when the keyboard opens (they overlay it).
// So the bottom of the full-screen Inspector — exactly where the GM's Eyes
// Only zone sits — was hidden behind the keyboard and the inner scroll area
// couldn't reach it (2026-07-02 audit follow-up: "I can't see what I'm
// writing"). Constraining the container to visualViewport.height makes the
// inner scroll region genuinely scrollable to the caret.
//
// visualViewport is the one cross-platform seam for this (Chrome 61+,
// iOS Safari 13+). Approved browser-specific dependency (Erik, 2026-07-02;
// option B over the Android-only interactive-widget meta). iOS reporting
// quirks are on the Safari verification list.
//
// `enabled` gates the subscription so desktop presentations don't pay for
// listeners they don't need. SSR-safe / no-visualViewport-safe: null.
// ============================================================================

import { useEffect, useState } from 'react'

export function useVisualViewportHeight(enabled) {
  const [height, setHeight] = useState(null)

  useEffect(() => {
    if (!enabled) {
      setHeight(null)
      return
    }
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const update = () => {
      // Meaningfully smaller than the layout viewport → keyboard (or
      // similar) is up. The 1px slack absorbs rounding.
      setHeight(vv.height < window.innerHeight - 1 ? vv.height : null)
    }
    update()
    vv.addEventListener('resize', update)
    // scroll fires when the visual viewport pans (iOS does this when the
    // keyboard pushes the page); height can change reportedly without a
    // resize in some versions.
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return height
}
