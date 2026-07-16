// ============================================================================
// useToolStore
// ----------------------------------------------------------------------------
// Zustand store for the active canvas tool, introduced with the bottom
// toolbar (approved first cut, 2026-07-10 — see BACKLOG "First-run creation
// affordance"). Tools:
//
//   'pointer' — select; drag on empty canvas = marquee (today's default)
//   'hand'    — movement; click+drag = pan, canvas elements inert
//   'node' | 'text' | 'line' — one-shot creation tools (armed → place once →
//                              revert to pointer). Wired in Chunk 2.
//
// `spacebarHeld` is a separate flag rather than a mutation of activeTool so
// the while-held temporary switch (spacebar rule in the approved spec) can
// never lose the tool it must restore: the tool the user chose stays put,
// the override is pure derivation via effectiveTool(), and releasing the
// key simply stops overriding.
//
// `placementGestureActive` (Chunk 2) is true while a placement gesture is
// mid-flight — today that means a line's anchor A is placed but B isn't.
// While it's set, the spacebar is IGNORED (Erik's resolved rule, 2026-07-10:
// before the first anchor, spacebar suspends placement and pans; once a
// gesture is in flight it does nothing until the gesture completes or
// cancels — a half-drawn line is never thrown away). LinePlacementOverlay
// owns the flag: sets it at anchor A, clears it on complete/cancel/unmount.
// ============================================================================

import { create } from 'zustand'

// The while-held spacebar switch: every tool temporarily becomes Hand
// (click+drag pans) EXCEPT Hand itself, which temporarily becomes Pointer
// (click selects, drag marquees). Release always restores activeTool.
// A mid-flight placement gesture suppresses the switch entirely.
export function effectiveTool(activeTool, spacebarHeld, placementGestureActive = false) {
  if (!spacebarHeld || placementGestureActive) return activeTool
  return activeTool === 'hand' ? 'pointer' : 'hand'
}

export const useToolStore = create((set) => ({
  activeTool: 'pointer',
  spacebarHeld: false,
  placementGestureActive: false,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSpacebarHeld: (held) => set({ spacebarHeld: held }),
  setPlacementGestureActive: (active) => set({ placementGestureActive: active }),
}))
