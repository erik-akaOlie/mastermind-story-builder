// addConnection — phase 7. Pairs with removeConnection; the impl bodies live
// in `_connectionHelpers.js` so the symmetry is obvious from the dispatcher.

import {
  checkConnectionPresent,
  checkConnectionRestorable,
  removeConnectionImpl,
  restoreConnectionImpl,
} from './_connectionHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = delete the connection we just created. It must still exist.
  return checkConnectionPresent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = recreate the connection. Source + target must
  // still exist; the connection itself must currently be absent.
  return checkConnectionRestorable(entry, currentState)
}

export async function applyInverse(entry, context = {}) {
  return removeConnectionImpl(entry, context)
}

export async function applyForward(entry, context = {}) {
  return restoreConnectionImpl(entry, context)
}
