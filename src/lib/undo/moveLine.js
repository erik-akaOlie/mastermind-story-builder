// moveLine — whole-line translation (React Flow node drag). `before` /
// `after` each carry the full anchor set { ax, ay, bx, by }; the node's
// position is re-derived from the anchors (linePositionFor) so the padded
// bounding box follows. Mirrors moveTextNode.

import { updateLine, linePositionFor } from '../lines.js'
import { checkLineFields } from './_lineHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = move back to `before`. Current anchors must match `after`.
  return checkLineFields(entry, currentState, 'after')
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = move to `after`. Current anchors must match `before`.
  return checkLineFields(entry, currentState, 'before')
}

export async function applyInverse(entry, context = {}) {
  return moveLineImpl(entry, context, 'before')
}

export async function applyForward(entry, context = {}) {
  return moveLineImpl(entry, context, 'after')
}

async function moveLineImpl(entry, { setNodes } = {}, side /* 'before' | 'after' */) {
  const { lineId } = entry
  if (!lineId) throw new Error('[undoActions] moveLine: missing lineId')
  const t = entry[side]
  if (!t || [t.ax, t.ay, t.bx, t.by].some((v) => typeof v !== 'number')) {
    throw new Error(`[undoActions] moveLine: missing ${side} { ax, ay, bx, by }`)
  }

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.map((n) =>
      n.id === lineId && n.type === 'lineNode'
        ? { ...n, position: linePositionFor(t), data: { ...n.data, ...t } }
        : n,
    ))
  }
  await updateLine(lineId, { ax: t.ax, ay: t.ay, bx: t.bx, by: t.by })
}
