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
// ============================================================================

import { create } from 'zustand'

// The while-held spacebar switch: every tool temporarily becomes Hand
// (click+drag pans) EXCEPT Hand itself, which temporarily becomes Pointer
// (click selects, drag marquees). Release always restores activeTool.
export function effectiveTool(activeTool, spacebarHeld) {
  if (!spacebarHeld) return activeTool
  return activeTool === 'hand' ? 'pointer' : 'hand'
}

export const useToolStore = create((set) => ({
  activeTool: 'pointer',
  spacebarHeld: false,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSpacebarHeld: (held) => set({ spacebarHeld: held }),
}))
