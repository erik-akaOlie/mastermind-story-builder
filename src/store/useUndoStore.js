// ============================================================================
// useUndoStore
// ----------------------------------------------------------------------------
// Per-tab, per-(user × campaign) undo/redo stack for the canvas.
//
// Design ref: docs/decisions/0006-undo-redo.md
//
// State layout:
//   - past:    Action[] — newest at end
//   - future:  Action[] — newest-undone at end
//
// Persistence: sessionStorage under `mastermind:undo:${userId}:${campaignId}`.
// sessionStorage is per-tab and clears on tab close, which matches V1 lifecycle:
// F5 mid-session preserves history; closing the tab forgets it.
//
// undo() and redo() route through src/lib/undo/index.js (the dispatcher),
// which decides whether the inverse/forward can still be applied (state
// hasn't drifted) and runs it via the existing lib/*.js write path. The
// store itself only owns stack semantics + persistence.
//
// Phase 3 (this commit): real dispatcher integration. moveCard is wired
// end-to-end; the other nine action types are still stubbed inside the
// dispatcher (canApply* return ok:true, apply* throw notWired) per ADR
// phase order — phases 4-8 fill them in.
// ============================================================================

import { create } from 'zustand'
import {
  applyInverse,
  applyForward,
  canApplyInverse,
  canApplyForward,
} from '../lib/undo/index.js'

const MAX_STACK = 75
const KEY_PREFIX = 'mastermind:undo:'

function buildKey(userId, campaignId) {
  if (!userId || !campaignId) return null
  return `${KEY_PREFIX}${userId}:${campaignId}`
}

function loadFromStorage(key) {
  if (!key) return { past: [], future: [] }
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return { past: [], future: [] }
    const parsed = JSON.parse(raw)
    return {
      past: Array.isArray(parsed?.past) ? parsed.past : [],
      future: Array.isArray(parsed?.future) ? parsed.future : [],
    }
  } catch {
    return { past: [], future: [] }
  }
}

function saveToStorage(key, past, future) {
  if (!key) return
  try {
    sessionStorage.setItem(key, JSON.stringify({ past, future }))
  } catch {
    // Quota or serialization failure — silent. The in-memory stack is still
    // correct; we just lose F5 protection for this scope.
  }
}

function removeFromStorage(key) {
  if (!key) return
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const useUndoStore = create((set, get) => ({
  userId: null,
  campaignId: null,
  past: [],
  future: [],

  setScope({ userId, campaignId }) {
    const { past, future } = loadFromStorage(buildKey(userId, campaignId))
    set({ userId, campaignId, past, future })
  },

  recordAction(entry) {
    const { userId, campaignId, past } = get()
    const next = [...past, entry]
    while (next.length > MAX_STACK) next.shift()
    const future = []
    set({ past: next, future })
    saveToStorage(buildKey(userId, campaignId), next, future)
  },

  popLastAction() {
    const { userId, campaignId, past, future } = get()
    if (past.length === 0) return
    const next = past.slice(0, -1)
    set({ past: next })
    saveToStorage(buildKey(userId, campaignId), next, future)
  },

  popLastFutureAction() {
    const { userId, campaignId, past, future } = get()
    if (future.length === 0) return
    const next = future.slice(0, -1)
    set({ future: next })
    saveToStorage(buildKey(userId, campaignId), past, next)
  },

  // -------------------------------------------------------------------------
  // undo(context) — Ctrl+Z handler.
  //
  // context = { nodes, edges, setNodes, setEdges } from App.jsx, captured
  // by useUndoShortcuts in a ref so the keydown listener always has fresh
  // values. canApply* read nodes/edges to detect state drift; apply* use
  // setNodes/setEdges for the optimistic local update before persisting.
  //
  // Returns { ok, conflict?, error?, reason?, entry } so callers (eventually
  // the toast layer in phase 9) can surface the right feedback.
  // -------------------------------------------------------------------------
  async undo(context = {}) {
    const { userId, campaignId, past, future } = get()
    if (past.length === 0) return { ok: false, reason: 'empty' }
    const entry = past[past.length - 1]

    const check = canApplyInverse(entry, context)
    if (!check.ok) {
      // State drifted since the action was recorded. Pop the orphan so
      // subsequent Ctrl+Z addresses the next action over (per ADR-0006 §2).
      const nextPast = past.slice(0, -1)
      set({ past: nextPast })
      saveToStorage(buildKey(userId, campaignId), nextPast, future)
      return { ok: false, conflict: true, reason: check.reason, entry }
    }

    try {
      await applyInverse(entry, context)
    } catch (err) {
      // DB write failed — persistWrite's retry/lock-overlay flow handles
      // user-facing UX. Stacks stay where they are so the user can retry.
      console.error('[useUndoStore] applyInverse failed', err)
      return { ok: false, error: err, entry }
    }

    const nextPast = past.slice(0, -1)
    const nextFuture = [...future, entry]
    set({ past: nextPast, future: nextFuture })
    saveToStorage(buildKey(userId, campaignId), nextPast, nextFuture)
    return { ok: true, entry }
  },

  // Mirror of undo() for the redo path.
  async redo(context = {}) {
    const { userId, campaignId, past, future } = get()
    if (future.length === 0) return { ok: false, reason: 'empty' }
    const entry = future[future.length - 1]

    const check = canApplyForward(entry, context)
    if (!check.ok) {
      const nextFuture = future.slice(0, -1)
      set({ future: nextFuture })
      saveToStorage(buildKey(userId, campaignId), past, nextFuture)
      return { ok: false, conflict: true, reason: check.reason, entry }
    }

    try {
      await applyForward(entry, context)
    } catch (err) {
      console.error('[useUndoStore] applyForward failed', err)
      return { ok: false, error: err, entry }
    }

    const nextFuture = future.slice(0, -1)
    const nextPast = [...past, entry]
    set({ past: nextPast, future: nextFuture })
    saveToStorage(buildKey(userId, campaignId), nextPast, nextFuture)
    return { ok: true, entry }
  },

  clear() {
    const { userId, campaignId } = get()
    removeFromStorage(buildKey(userId, campaignId))
    set({ past: [], future: [] })
  },
}))
