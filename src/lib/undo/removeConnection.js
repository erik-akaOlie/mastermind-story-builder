// removeConnection — phase 7. Mirror of addConnection.

import {
  checkConnectionPresent,
  checkConnectionRestorable,
  removeConnectionImpl,
  restoreConnectionImpl,
} from './_connectionHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = recreate the connection we just removed. Source + target
  // nodes must still exist so the FK insert can land.
  return checkConnectionRestorable(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = delete the connection again. It must still exist.
  return checkConnectionPresent(entry, currentState)
}

export async function applyInverse(entry, context = {}) {
  return restoreConnectionImpl(entry, context)
}

export async function applyForward(entry, context = {}) {
  return removeConnectionImpl(entry, context)
}
