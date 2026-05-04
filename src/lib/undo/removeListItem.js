// removeListItem — phase 7c. Mirror of addListItem.

import {
  checkListItemPresent,
  checkListItemAbsent,
  insertListItemImpl,
  removeListItemImpl,
} from './_listItemHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = re-insert. Item must currently be ABSENT, and the card
  // must still exist so we have somewhere to insert.
  return checkListItemAbsent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = remove again. Item must currently be present.
  return checkListItemPresent(entry, currentState)
}

export async function applyInverse(entry, context = {}) {
  return insertListItemImpl(entry, context)
}

export async function applyForward(entry, context = {}) {
  return removeListItemImpl(entry, context)
}
