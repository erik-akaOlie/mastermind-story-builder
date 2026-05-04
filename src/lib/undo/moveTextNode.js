// moveTextNode — phase 8. Mirrors moveCard but operates on text-node positions.

import { updateTextNode } from '../textNodes.js'
import { checkTextNodePresent } from './_textNodeHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = move back to `before`. Text node must still exist.
  return checkTextNodePresent(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = move from `before` → `after`. Text node must still exist.
  return checkTextNodePresent(entry, currentState)
}

export async function applyInverse(entry, context = {}) {
  return moveTextNodeImpl(entry, context, 'before')
}

export async function applyForward(entry, context = {}) {
  return moveTextNodeImpl(entry, context, 'after')
}

async function moveTextNodeImpl(entry, { setNodes } = {}, side /* 'before' | 'after' */) {
  const { textNodeId } = entry
  if (!textNodeId) throw new Error('[undoActions] moveTextNode: missing textNodeId')
  const target = entry[side]
  if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
    throw new Error(`[undoActions] moveTextNode: missing ${side} { x, y }`)
  }

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.map((n) =>
      n.id === textNodeId && n.type === 'textNode'
        ? { ...n, position: { x: target.x, y: target.y } }
        : n,
    ))
  }
  await updateTextNode(textNodeId, { positionX: target.x, positionY: target.y })
}
