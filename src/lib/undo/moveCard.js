// moveCard — both directions optimistically update local state for every
// card in the grouped entry in one setNodes call (so the canvas re-renders
// once, not N times), then persist each card's position in parallel via
// updateNode. persistWrite owns retry + lock-overlay behavior; Realtime
// echoes positions back to other tabs (and harmlessly to this one).

import { updateNode } from '../nodes.js'
import { getMoveCards } from './_cardHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Every card in the grouped entry must still exist for the inverse to
  // apply. Conservative semantics: if even one was deleted elsewhere,
  // refuse the whole undo so the user gets a clear "changed elsewhere"
  // signal rather than a silent partial revert.
  const { nodes = [] } = currentState
  const cards = getMoveCards(entry)
  if (cards.length === 0) {
    return { ok: false, reason: 'No cards to move' }
  }
  const allExist = cards.every((c) => nodes.some((n) => n.id === c.cardId))
  return allExist
    ? { ok: true }
    : { ok: false, reason: 'One or more cards no longer exist' }
}

export function canApplyForward(entry, currentState = {}) {
  const { nodes = [] } = currentState
  const cards = getMoveCards(entry)
  if (cards.length === 0) {
    return { ok: false, reason: 'No cards to move' }
  }
  const allExist = cards.every((c) => nodes.some((n) => n.id === c.cardId))
  return allExist
    ? { ok: true }
    : { ok: false, reason: 'One or more cards no longer exist' }
}

export async function applyInverse(entry, context = {}) {
  return applyMoveCardSide(entry, context, 'before')
}

export async function applyForward(entry, context = {}) {
  return applyMoveCardSide(entry, context, 'after')
}

async function applyMoveCardSide(entry, { setNodes } = {}, side /* 'before' | 'after' */) {
  const cards = getMoveCards(entry)
  if (cards.length === 0) return

  if (typeof setNodes === 'function') {
    const targetById = new Map(cards.map((c) => [c.cardId, c[side]]))
    setNodes((nds) =>
      nds.map((n) => {
        const target = targetById.get(n.id)
        return target ? { ...n, position: { x: target.x, y: target.y } } : n
      }),
    )
  }

  await Promise.all(
    cards.map((c) =>
      updateNode(c.cardId, { positionX: c[side].x, positionY: c[side].y }),
    ),
  )
}
