// deleteLine — restore via restoreLine (inserts at the original UUID); redo
// deletes again. Mirrors deleteTextNode.

import { deleteLine, restoreLine, dbLineToReactFlow } from '../lines.js'
import { checkLinePresent, checkLineAbsent } from './_lineHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = restore the deleted line. The id must currently be absent.
  return checkLineAbsent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = delete again. Line must currently exist.
  return checkLinePresent(entry, currentState)
}

export async function applyInverse(entry, { setNodes } = {}) {
  const { lineId, dbRow } = entry
  if (!lineId || !dbRow) {
    throw new Error('[undoActions] deleteLine: missing lineId or dbRow')
  }

  if (typeof setNodes === 'function') {
    const reactNode = dbLineToReactFlow(dbRow)
    setNodes((nds) => (nds.some((n) => n.id === lineId) ? nds : [...nds, reactNode]))
  }
  await restoreLine(dbRow)
}

export async function applyForward(entry, { setNodes } = {}) {
  const { lineId } = entry
  if (!lineId) throw new Error('[undoActions] deleteLine: missing lineId')

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.filter((n) => n.id !== lineId))
  }
  await deleteLine(lineId)
}
