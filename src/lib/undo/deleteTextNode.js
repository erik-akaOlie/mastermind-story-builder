// deleteTextNode — phase 8. Restore via restoreTextNode (which inserts at
// the original UUID); redo deletes again.

import {
  deleteTextNode,
  restoreTextNode,
  dbTextNodeToReactFlow,
} from '../textNodes.js'
import { checkTextNodePresent, checkTextNodeAbsent } from './_textNodeHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = restore the deleted text node. The id must currently
  // be absent (otherwise another tab beat us to it).
  return checkTextNodeAbsent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = delete again. Text node must currently exist.
  return checkTextNodePresent(entry, currentState)
}

export async function applyInverse(entry, { setNodes } = {}) {
  const { textNodeId, dbRow } = entry
  if (!textNodeId || !dbRow) {
    throw new Error('[undoActions] deleteTextNode: missing textNodeId or dbRow')
  }

  if (typeof setNodes === 'function') {
    const reactNode = dbTextNodeToReactFlow(dbRow)
    setNodes((nds) => (nds.some((n) => n.id === textNodeId) ? nds : [...nds, reactNode]))
  }
  await restoreTextNode(dbRow)
}

export async function applyForward(entry, { setNodes } = {}) {
  const { textNodeId } = entry
  if (!textNodeId) throw new Error('[undoActions] deleteTextNode: missing textNodeId')

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.filter((n) => n.id !== textNodeId))
  }
  await deleteTextNode(textNodeId)
}
