// createTextNode — phase 8. Recreate at the original UUID via
// createTextNode({ id, ... }) so any later undo entry referring to this
// text node still finds it.

import { createTextNode, deleteTextNode } from '../textNodes.js'
import { checkTextNodePresent, checkTextNodeAbsent } from './_textNodeHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = delete the text node we just created. It must still exist.
  return checkTextNodePresent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = recreate at the original UUID. Must currently be absent.
  return checkTextNodeAbsent(entry, currentState)
}

export async function applyInverse(entry, { setNodes } = {}) {
  const id = entry.textNodeId
  if (!id) throw new Error('[undoActions] createTextNode: missing textNodeId')

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.filter((n) => n.id !== id))
  }
  await deleteTextNode(id)
}

export async function applyForward(entry, { setNodes } = {}) {
  const { textNodeId, dbRow } = entry
  if (!textNodeId || !dbRow) {
    throw new Error('[undoActions] createTextNode: missing textNodeId or dbRow')
  }
  const reactNode = await createTextNode({
    id:           textNodeId,
    campaignId:   entry.campaignId,
    contentHtml:  dbRow.content_html ?? '',
    positionX:    dbRow.position_x,
    positionY:    dbRow.position_y,
    width:        dbRow.width,
    height:       dbRow.height,
    fontSize:     dbRow.font_size,
    align:        dbRow.align,
  })

  if (typeof setNodes === 'function') {
    setNodes((nds) => (nds.some((n) => n.id === textNodeId) ? nds : [...nds, reactNode]))
  }
}
