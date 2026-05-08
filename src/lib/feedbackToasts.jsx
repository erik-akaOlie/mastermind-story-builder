// ============================================================================
// feedbackToasts
// ----------------------------------------------------------------------------
// Public API for firing chip-styled toasts in the bottom-left feedback bar.
// Implemented on top of useFeedbackToastStore (custom queue + lifecycle).
// Sonner is no longer used for these — the slide-from-behind-chip pattern
// doesn't fit Sonner's defaults; see useFeedbackToastStore + ChipToast for
// the implementation.
//
// Variants & visual treatment:
//   All toasts share a dark + white-text chip body (FeedbackChip) so they
//   visually stand out from the SyncIndicator's light/frosted ambient chip.
//   Undo/redo success toasts lead with a curved-arrow icon instead of a
//   "Undid:" / "Redid:" word prefix; conflict and save-fail toasts read
//   text-only since the message itself names the action.
//
// Durations (per ADR-0006 §6 + Erik's interaction spec):
//   - Undo/redo success  → 2s visible, 300ms fadeout
//   - Undo/redo conflict → 5s visible, 300ms fadeout
//   - Persist-fail       → 8s visible, sticky id so repeated failures replace
//
// `entry.label` is the human-readable string written at record-time
// (e.g. "Move card", "Edit summary", "Delete \"Strahd\""). If somehow missing,
// fall back to the generic word so the toast still reads naturally.
// ============================================================================

import { ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react'
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

// Derive a pan-to descriptor from an undo/redo entry. Returns null when the
// entry has no meaningful canvas target (shouldn't happen for the 14 known
// types, but the toast layer treats null as "passive, no click").
//
// `fallbackPosition` is included for the two delete cases (deleteCard,
// deleteTextNode) so a redo of a delete can still pan the camera to where
// the content used to live — letting the user undo again to inspect what
// was just removed.
//
// Where each id field comes from in the entry shapes (verified against
// lib/undo/*.js):
//   createCard / editCardField / *ListItem      → entry.cardId
//   moveCard                                    → entry.cards[].cardId
//                                                 (legacy fallback: entry.cardId)
//   deleteCard                                  → entry.dbCardRow.id
//   addConnection / removeConnection            → entry.sourceNodeId,
//                                                 entry.targetNodeId
//   createTextNode / editTextNode / moveTextNode → entry.textNodeId
//   deleteTextNode                              → entry.textNodeId (+ dbRow)
function targetForEntry(entry) {
  if (!entry || typeof entry.type !== 'string') return null
  const t = entry.type

  // Card-family (single card, exists when toast fires)
  if (t === 'createCard' || t === 'editCardField' ||
      t === 'addListItem' || t === 'removeListItem' ||
      t === 'editListItem' || t === 'reorderListItem') {
    return entry.cardId ? { ids: [entry.cardId] } : null
  }

  // moveCard — possibly multi-card via entry.cards[]
  if (t === 'moveCard') {
    if (Array.isArray(entry.cards) && entry.cards.length > 0) {
      const ids = entry.cards.map((c) => c.cardId).filter(Boolean)
      return ids.length > 0 ? { ids } : null
    }
    return entry.cardId ? { ids: [entry.cardId] } : null
  }

  // deleteCard — cardId may be gone after redo; carry fallback position
  if (t === 'deleteCard') {
    const id = entry.dbCardRow?.id
    if (!id) return null
    const x = Number(entry.dbCardRow?.position_x)
    const y = Number(entry.dbCardRow?.position_y)
    const fallbackPosition = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined
    return { ids: [id], fallbackPosition }
  }

  // Connection-family — fit both endpoint cards in view
  if (t === 'addConnection' || t === 'removeConnection') {
    const ids = [entry.sourceNodeId, entry.targetNodeId].filter(Boolean)
    return ids.length > 0 ? { ids } : null
  }

  // Text-node-family
  if (t === 'createTextNode' || t === 'editTextNode' || t === 'moveTextNode') {
    return entry.textNodeId ? { ids: [entry.textNodeId] } : null
  }

  // deleteTextNode — id may be gone after redo; carry fallback position
  if (t === 'deleteTextNode') {
    const id = entry.textNodeId
    if (!id) return null
    const x = Number(entry.dbRow?.position_x)
    const y = Number(entry.dbRow?.position_y)
    const fallbackPosition = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined
    return { ids: [id], fallbackPosition }
  }

  return null
}

export function toastUndoSuccess(entry) {
  const label = labelOr(entry, 'last action')
  push({
    variant: 'info',
    icon: ArrowUUpLeft,
    content: label,
    durationMs: SUCCESS_DURATION_MS,
    target: targetForEntry(entry),
  })
}

export function toastRedoSuccess(entry) {
  const label = labelOr(entry, 'last action')
  push({
    variant: 'info',
    icon: ArrowUUpRight,
    content: label,
    durationMs: SUCCESS_DURATION_MS,
    target: targetForEntry(entry),
  })
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
