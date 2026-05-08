// reorderListItem — phase 7c. Per-item position move on a list-shaped field.

import {
  checkListItemAtPosition,
  moveListItemImpl,
} from './_listItemHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = move from `to` back to `from`. Item must exist and
  // currently sit at `to`.
  return checkListItemAtPosition(entry, currentState, entry.to)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = move from `from` → `to`. Item must currently sit at `from`.
  return checkListItemAtPosition(entry, currentState, entry.from)
}

export async function applyInverse(entry, context = {}) {
  return moveListItemImpl(entry, context, 'inverse')
}

export async function applyForward(entry, context = {}) {
  return moveListItemImpl(entry, context, 'forward')
}
