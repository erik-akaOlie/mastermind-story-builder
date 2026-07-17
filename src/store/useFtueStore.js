// ============================================================================
// useFtueStore
// ----------------------------------------------------------------------------
// Zustand store for the FTUE introduction's per-workspace "completed" flag
// (the handwritten first-run guidance — Figma 225-1971).
//
// Storage: localStorage under `mastermind:ftue-done:${workspaceId}`. This is
// UX/interface state, NOT world/story data — deliberately localStorage, not a
// DB column (Erik, 2026-07-16): cross-device persistence is not worth a
// schema migration unless beta feedback proves otherwise. Same precedent as
// the Inspector mode + workspace sort keys.
//
// Semantics (Erik's timeline model, 2026-07-16):
//   - The flag is SET by the user's own successful creation of a canvas item
//     (node / text block / line) — the persist landed, the undo entry was
//     recorded. A REMOTE insert (Realtime from another device) hides the
//     overlay while the content exists but never marks the intro completed.
//   - UNDOING a creation that leaves the canvas empty CLEARS the flag —
//     undo rewinds the user's timeline, so the intro returns.
//   - DELETING content back to an empty canvas does NOT clear the flag —
//     deletion moves the timeline forward; the blank canvas may be intent.
//   - REDOING a creation re-sets the flag (forward motion again).
//
// The store mirrors the flag for the ACTIVE workspace so React consumers
// (FtueIntro, BottomToolbar's force-open) re-render on change; the note*
// helpers below own the set/clear rules so App's call sites stay one-liners.
// ============================================================================

import { create } from 'zustand'
import { ACTION_TYPES } from '../lib/undo/index.js'
import { track } from '../lib/analytics.js'

const KEY_PREFIX = 'mastermind:ftue-done:'

// The action types whose creation/undo/redo drive the flag. Everything the
// FTUE teaches creates one of these three.
export const CREATE_ACTION_TYPES = new Set([
  ACTION_TYPES.CREATE_CARD,
  ACTION_TYPES.CREATE_TEXT_NODE,
  ACTION_TYPES.CREATE_LINE,
])

export function readFtueDone(workspaceId) {
  if (!workspaceId) return true // no scope → never show
  try { return localStorage.getItem(KEY_PREFIX + workspaceId) === '1' }
  catch { return true } // storage unavailable → fail toward not showing
}

export function writeFtueDone(workspaceId, done) {
  if (!workspaceId) return
  try {
    if (done) localStorage.setItem(KEY_PREFIX + workspaceId, '1')
    else localStorage.removeItem(KEY_PREFIX + workspaceId)
  } catch { /* private mode / quota — in-memory state still applies this tab */ }
}

export const useFtueStore = create((set, get) => ({
  workspaceId: null,
  // `done: true` until a scope loads, so nothing flashes pre-hydration.
  done: true,

  setScope(workspaceId) {
    set({ workspaceId, done: readFtueDone(workspaceId) })
  },

  markDone(workspaceId) {
    writeFtueDone(workspaceId, true)
    if (get().workspaceId === workspaceId) set({ done: true })
  },

  rewind(workspaceId) {
    writeFtueDone(workspaceId, false)
    if (get().workspaceId === workspaceId) set({ done: false })
  },
}))

// ----------------------------------------------------------------------------
// Semantic note helpers — called from App's create/undo/redo sites.
// ----------------------------------------------------------------------------

// A LOCAL create succeeded (persist landed). `wasEmpty` = the canvas had no
// content when the gesture started — i.e. this create is the one the FTUE
// was teaching. Every local create marks the intro done (idempotent), so an
// emptied-by-delete workspace can never resurface the intro to a user who
// has already created things in it.
export function noteLocalCreate({ workspaceId, kind, wasEmpty }) {
  const wasDone = readFtueDone(workspaceId)
  useFtueStore.getState().markDone(workspaceId)
  if (wasEmpty && !wasDone) track('ftue_completed', { kind })
}

// An undo resolved. If it reversed a creation and that left the canvas empty
// (the undone item was the only content), the user rewound to the blank
// state — bring the intro back. `priorNodeCount` is the canvas content count
// BEFORE the undo applied (cards + text blocks + lines are all RF nodes).
export function noteUndoResult(result, priorNodeCount) {
  if (!result?.ok || !result.entry) return
  if (!CREATE_ACTION_TYPES.has(result.entry.type)) return
  if (priorNodeCount !== 1) return
  useFtueStore.getState().rewind(result.entry.workspaceId)
  track('ftue_rewound')
}

// A redo resolved. Redoing a creation is forward motion — the intro is
// completed again (the overlay already hid via the content re-appearing).
export function noteRedoResult(result) {
  if (!result?.ok || !result.entry) return
  if (!CREATE_ACTION_TYPES.has(result.entry.type)) return
  useFtueStore.getState().markDone(result.entry.workspaceId)
}
