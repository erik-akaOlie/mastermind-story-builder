// addListItem — phase 7c. Per-item op on storyNotes / hiddenLore / dmNotes /
// media. Identity is the item's stable id, captured at action-time.

import {
  checkListItemPresent,
  checkListItemAbsent,
  insertListItemImpl,
  removeListItemImpl,
} from './_listItemHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = remove the item we inserted. Item must still be in the
  // list (identified by id, not position — position may have shifted
  // due to other ops since the original add).
  return checkListItemPresent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = re-insert. Item must currently be absent.
  return checkListItemAbsent(entry, currentState)
}

export async function applyInverse(entry, context = {}) {
  return removeListItemImpl(entry, context)
}

export async function applyForward(entry, context = {}) {
  return insertListItemImpl(entry, context)
}
