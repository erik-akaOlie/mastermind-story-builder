// ============================================================================
// useUndoStore
// ----------------------------------------------------------------------------
// Per-tab, per-(user × workspace) undo/redo stack for the canvas.
//
// Design ref: docs/decisions/0006-undo-redo.md
//
// State layout:
//   - past:    Action[] — newest at end
//   - future:  Action[] — newest-undone at end
//
// Persistence: sessionStorage under `mastermind:undo:${userId}:${workspaceId}`.
// sessionStorage is per-tab and clears on tab close, which matches V1 lifecycle:
// F5 mid-session preserves history; closing the tab forgets it.
//
// Note: the persistence key string itself never carries the literal text
// "campaign" or "workspace" — both fields are UUIDs — so the campaign →
// workspace rename (ADR-0012) didn't require a sessionStorage migration of
// the keys themselves. Only the in-memory field name and entry-shape field
// name (entry.workspaceId → entry.workspaceId) changed in production code.
// Pre-rename entries on disk (if any survive the page reload that loads the
// new code) will fail canApplyInverse / canApplyForward and be silently
// dropped per the existing state-drift handling.
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
  isKnownActionType,
} from '../lib/undo/index.js'
import {
  toastUndoSuccess,
  toastRedoSuccess,
  toastUndoConflict,
  toastRedoConflict,
} from '../lib/feedbackToasts.jsx'

const MAX_STACK = 75
const KEY_PREFIX = 'mastermind:undo:'

function buildKey(userId, workspaceId) {
  if (!userId || !workspaceId) return null
  return `${KEY_PREFIX}${userId}:${workspaceId}`
}

// Drop entries whose action type is no longer handled by the dispatcher.
// Tab-local undo history (sessionStorage) can outlive a code change that
// retires an action type — e.g. the list-item families removed in E5
// (ADR-0016). Such an entry would otherwise sit on the stack and, on Ctrl+Z,
// surface a misleading "conflict" toast via the dispatcher's unknown-type
// guard. Filtering at load makes the retirement silent and explicit.
function keepKnown(arr) {
  return Array.isArray(arr) ? arr.filter((e) => isKnownActionType(e?.type)) : []
}

function loadFromStorage(key) {
  if (!key) return { past: [], future: [] }
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return { past: [], future: [] }
    const parsed = JSON.parse(raw)
    return {
      past: keepKnown(parsed?.past),
      future: keepKnown(parsed?.future),
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
  workspaceId: null,
  past: [],
  future: [],

  setScope({ userId, workspaceId }) {
    const { past, future } = loadFromStorage(buildKey(userId, workspaceId))
    set({ userId, workspaceId, past, future })
  },

  recordAction(entry) {
    const { userId, workspaceId, past } = get()
    const next = [...past, entry]
    while (next.length > MAX_STACK) next.shift()
    const future = []
    set({ past: next, future })
    saveToStorage(buildKey(userId, workspaceId), next, future)
  },

  popLastAction() {
    const { userId, workspaceId, past, future } = get()
    if (past.length === 0) return
    const next = past.slice(0, -1)
    set({ past: next })
    saveToStorage(buildKey(userId, workspaceId), next, future)
  },

  popLastFutureAction() {
    const { userId, workspaceId, past, future } = get()
    if (future.length === 0) return
    const next = future.slice(0, -1)
    set({ future: next })
    saveToStorage(buildKey(userId, workspaceId), past, next)
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
    const { userId, workspaceId, past, future } = get()
    if (past.length === 0) return { ok: false, reason: 'empty' }
    const entry = past[past.length - 1]

    const check = canApplyInverse(entry, context)
    if (!check.ok) {
      // State drifted since the action was recorded. Pop the orphan so
      // subsequent Ctrl+Z addresses the next action over (per ADR-0006 §2).
      const nextPast = past.slice(0, -1)
      set({ past: nextPast })
      saveToStorage(buildKey(userId, workspaceId), nextPast, future)
      toastUndoConflict()
      return { ok: false, conflict: true, reason: check.reason, entry }
    }

    try {
      await applyInverse(entry, context)
    } catch (err) {
      // DB write failed — persistWrite's retry/lock-overlay flow handles
      // user-facing UX (its own toast). Stacks stay where they are so the
      // user can retry; we deliberately don't fire a second undo-failed
      // toast here.
      console.error('[useUndoStore] applyInverse failed', err)
      return { ok: false, error: err, entry }
    }

    const nextPast = past.slice(0, -1)
    const nextFuture = [...future, entry]
    set({ past: nextPast, future: nextFuture })
    saveToStorage(buildKey(userId, workspaceId), nextPast, nextFuture)
    toastUndoSuccess(entry)
    return { ok: true, entry }
  },

  // Mirror of undo() for the redo path.
  async redo(context = {}) {
    const { userId, workspaceId, past, future } = get()
    if (future.length === 0) return { ok: false, reason: 'empty' }
    const entry = future[future.length - 1]

    const check = canApplyForward(entry, context)
    if (!check.ok) {
      const nextFuture = future.slice(0, -1)
      set({ future: nextFuture })
      saveToStorage(buildKey(userId, workspaceId), past, nextFuture)
      toastRedoConflict()
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
    saveToStorage(buildKey(userId, workspaceId), nextPast, nextFuture)
    toastRedoSuccess(entry)
    return { ok: true, entry }
  },

  clear() {
    const { userId, workspaceId } = get()
    removeFromStorage(buildKey(userId, workspaceId))
    set({ past: [], future: [] })
  },

  // Sign-out cleanup (per ADR-0006 §3). Wipes the in-memory stack AND every
  // sessionStorage entry under `mastermind:undo:${userId}:*` so a different
  // user signing in next on this tab can't inherit the prior user's history
  // (across any workspaces they touched, not just the active one).
  //
  // Called from AuthContext.signOut BEFORE supabase.auth.signOut() so the
  // userId is still available to scope the cleanup.
  clearAllForUser(userId) {
    set({ userId: null, workspaceId: null, past: [], future: [] })
    if (!userId) return
    const prefix = `${KEY_PREFIX}${userId}:`
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(prefix)) keysToRemove.push(key)
    }
    for (const key of keysToRemove) {
      try {
        sessionStorage.removeItem(key)
      } catch {
        // ignore — quota / storage-disabled environments
      }
    }
  },
}))
