// ============================================================================
// feedbackToasts
// ----------------------------------------------------------------------------
// Public API for firing chip-styled toasts in the bottom-left feedback bar.
// Implemented on top of useFeedbackToastStore (custom queue + lifecycle).
// Sonner is no longer used for these — the horizontal-stack-with-32px-shift
// + slide-from-behind-chip pattern doesn't fit Sonner's defaults; see
// useFeedbackToastStore + ChipToast for the implementation.
//
// Variants:
//   - info  (gray)  — undo / redo success
//   - warn  (amber) — undo / redo conflict (state drifted before apply)
//   - error (red)   — persist-write final failure (after retries gave up)
//
// Per ADR-0006 §6 + Erik's interaction spec:
//   - Undo/redo success  → 2s visible, 300ms fadeout
//   - Undo/redo conflict → 5s visible, 300ms fadeout
//   - Persist-fail       → 8s visible, sticky id so repeated failures replace
//
// `entry.label` is the human-readable string written at record-time
// (e.g. "Move card", "Edit summary", "Delete \"Strahd\""). If somehow missing,
// fall back to the generic word so the toast still reads naturally.
// ============================================================================

import { useFeedbackToastStore } from '../store/useFeedbackToastStore.js'

const SUCCESS_DURATION_MS   = 2000
const CONFLICT_DURATION_MS  = 5000
const SAVE_FAIL_DURATION_MS = 8000

function labelOr(entry, fallback) {
  const raw = entry?.label
  return typeof raw === 'string' && raw.length > 0 ? raw : fallback
}

function push(args) {
  useFeedbackToastStore.getState().push(args)
}

export function toastUndoSuccess(entry) {
  const label = labelOr(entry, 'last action')
  push({ variant: 'info', content: `Undid: ${label}`, durationMs: SUCCESS_DURATION_MS })
}

export function toastRedoSuccess(entry) {
  const label = labelOr(entry, 'last action')
  push({ variant: 'info', content: `Redid: ${label}`, durationMs: SUCCESS_DURATION_MS })
}

export function toastUndoConflict() {
  push({
    variant: 'warn',
    content: "Couldn't undo — this changed elsewhere.",
    durationMs: CONFLICT_DURATION_MS,
  })
}

export function toastRedoConflict() {
  push({
    variant: 'warn',
    content: "Couldn't redo — this changed elsewhere.",
    durationMs: CONFLICT_DURATION_MS,
  })
}

// `context` is the human-readable label persistWrite was given
// (default "your changes"; some call sites pass a more specific phrase).
export function toastSaveFailed(context = 'your changes') {
  push({
    stickyId: 'persist-fail',
    variant: 'error',
    content: `Can't save ${context} — check your connection.`,
    durationMs: SAVE_FAIL_DURATION_MS,
  })
}
