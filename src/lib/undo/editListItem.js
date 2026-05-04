// editListItem — phase 7c. Per-item value edit on a list-shaped field.
// Identity is the item's stable id (entry.itemId); value is at item.value.

import {
  checkListItemValue,
  setListItemValueImpl,
} from './_listItemHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = restore `before`. The item must exist and currently
  // hold the recorded `after` value.
  return checkListItemValue(entry, currentState, entry.after)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = re-apply `after`. Current value must equal `before`.
  return checkListItemValue(entry, currentState, entry.before)
}

export async function applyInverse(entry, context = {}) {
  return setListItemValueImpl(entry, context, 'before')
}

export async function applyForward(entry, context = {}) {
  return setListItemValueImpl(entry, context, 'after')
}
