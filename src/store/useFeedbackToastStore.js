// ============================================================================
// useFeedbackToastStore
// ----------------------------------------------------------------------------
// Custom queue + lifecycle for the chip-style feedback toasts that appear
// just to the right of the SyncIndicator. Replaces what we previously got
// from `sonner` because Sonner can't do the slide-from-behind-chip pattern
// Erik specced. See FeedbackChipBar + ChipToast for the rendering side; see
// src/lib/feedbackToasts.jsx for the public push API.
//
// State layout:
//   toasts: ordered NEWEST FIRST. Index 0 is the toast currently sliding in
//   or already settled. Indices ≥ 1 are toasts that have already been told
//   to exit (a newer push superseded them) and are mid-fadeout.
//
// No-stacking: when a new toast is pushed, any existing non-exiting toasts
// are immediately transitioned to the exiting phase — they fade out in
// place rather than being shifted aside. They're still in `toasts` until
// the fade finishes so the React tree can transition opacity smoothly.
//
// Each toast carries a lifecycle phase ('visible' or 'exiting') and a
// paused flag. The visible phase runs durationMs (default 2000ms); when it
// ends, the toast moves to 'exiting' and the chip fades out over 300ms
// before the store removes it. Hover pauses whichever timer is running;
// unhover resumes from the remaining time.
//
// Sticky id (used for persist-fail) replaces the existing toast in place
// rather than stacking — we never want a dozen "Can't save" chips piling up.
// ============================================================================

import { create } from 'zustand'

export const FADEOUT_MS = 300
export const DEFAULT_DURATION_MS = 2000

// Module-scope timer registry. Kept outside Zustand state because timer ids
// aren't part of the rendered shape and shouldn't trigger re-renders.
//
// Shape per entry:
//   { timeoutId, startedAt, durationMs, phase: 'visible' | 'exiting',
//     paused: boolean, remainingMs?: number }
const _timers = new Map()

let _nextId = 1
function _generateId() {
  return `feedback-toast-${_nextId++}`
}

function _scheduleVisibleTimer(id, durationMs) {
  const timeoutId = setTimeout(() => {
    useFeedbackToastStore.getState()._beginExit(id)
  }, durationMs)
  _timers.set(id, {
    timeoutId,
    startedAt: Date.now(),
    durationMs,
    phase: 'visible',
    paused: false,
  })
}

function _scheduleExitingTimer(id, durationMs) {
  const timeoutId = setTimeout(() => {
    useFeedbackToastStore.getState()._remove(id)
  }, durationMs)
  _timers.set(id, {
    timeoutId,
    startedAt: Date.now(),
    durationMs,
    phase: 'exiting',
    paused: false,
  })
}

function _clearTimer(id) {
  const entry = _timers.get(id)
  if (entry?.timeoutId != null) clearTimeout(entry.timeoutId)
  _timers.delete(id)
}

export const useFeedbackToastStore = create((set, get) => ({
  toasts: [],

  // push({ stickyId?, variant, content, durationMs? }) → toast id
  //
  // stickyId is for "only one of these at a time" toasts (persist-fail).
  // If a toast with that id already exists, it's replaced — the old one
  // is dropped immediately (no fade) and the new one slides in fresh.
  //
  // For non-sticky pushes, any other currently-visible toasts are kicked
  // into the exiting phase so they fade out as the new one slides in.
  push({ stickyId, variant, icon, content, durationMs = DEFAULT_DURATION_MS }) {
    const { toasts } = get()
    const id = stickyId ?? _generateId()

    // Sticky-id replace: drop the prior copy without animation.
    let nextToasts = toasts
    if (stickyId != null) {
      const existingIndex = toasts.findIndex((t) => t.id === stickyId)
      if (existingIndex !== -1) {
        _clearTimer(stickyId)
        nextToasts = toasts.filter((t) => t.id !== stickyId)
      }
    }

    // No-stacking: every other still-visible toast starts exiting.
    const exitedToasts = nextToasts.map((t) => {
      if (t.exiting) return t
      _transitionToExiting(t.id)
      return { ...t, exiting: true }
    })

    const newToast = {
      id,
      variant,
      icon,
      content,
      durationMs,
      paused: false,
      exiting: false,
    }
    set({ toasts: [newToast, ...exitedToasts] })

    _scheduleVisibleTimer(id, durationMs)
    return id
  },

  // pause(id) — freeze the timer for this toast. Used on mouseenter; the
  // ChipToast component additionally freezes the CSS opacity transition
  // when paused mid-fadeout.
  pause(id) {
    const entry = _timers.get(id)
    if (!entry || entry.paused) return
    clearTimeout(entry.timeoutId)
    const elapsed = Date.now() - entry.startedAt
    const remainingMs = Math.max(0, entry.durationMs - elapsed)
    _timers.set(id, { ...entry, timeoutId: null, paused: true, remainingMs })
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, paused: true } : t)),
    }))
  },

  // resume(id) — restart the timer from where pause() left it, in the same
  // phase the toast was in.
  resume(id) {
    const entry = _timers.get(id)
    if (!entry || !entry.paused) return
    if (entry.phase === 'visible') {
      _scheduleVisibleTimer(id, entry.remainingMs)
    } else {
      _scheduleExitingTimer(id, entry.remainingMs)
    }
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, paused: false } : t)),
    }))
  },

  // Internal: visible-phase timer fires (or another push superseded this
  // toast). Flip the exiting flag so the CSS fade-out starts and start the
  // exiting-phase timer if not already paused.
  _beginExit(id) {
    const target = get().toasts.find((t) => t.id === id)
    if (!target || target.exiting) return
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, exiting: true } : t,
      ),
    }))
    _transitionToExiting(id)
  },

  // Internal: exiting-phase timer fires. Drop the toast from state.
  _remove(id) {
    _timers.delete(id)
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  // Test hook — clears every timer + state. Production code never calls this
  // directly; vitest tests use it between cases to avoid cross-test bleed.
  _resetForTests() {
    for (const id of Array.from(_timers.keys())) _clearTimer(id)
    set({ toasts: [] })
  },
}))

// Module-scope helper that transitions a toast's TIMER side to the exiting
// phase. Called by both push() (when a new toast supersedes an older one)
// and _beginExit (when a toast's own visible-timer expires). Handles the
// paused case: if the toast was paused mid-visible, we preserve `paused:
// true` and update phase + remainingMs so a later resume() schedules the
// right timer.
function _transitionToExiting(id) {
  const entry = _timers.get(id)
  if (!entry) return
  if (entry.phase === 'exiting') return  // already on exit timeline
  if (entry.paused) {
    _timers.set(id, {
      ...entry,
      phase: 'exiting',
      remainingMs: FADEOUT_MS,
      timeoutId: null,
    })
    return
  }
  if (entry.timeoutId != null) clearTimeout(entry.timeoutId)
  _scheduleExitingTimer(id, FADEOUT_MS)
}
