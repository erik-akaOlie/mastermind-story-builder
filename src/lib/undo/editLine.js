// editLine — covers endpoint-handle drags (recorded on pointer-up) and style
// toolbar changes (weight / dashed / dash length / dash gap, recorded per
// click). `before` / `after` carry only the fields that actually changed;
// canApply* compares on those same fields. Mirrors editTextNode.

import { updateLine, linePositionFor } from '../lines.js'
import { checkLineFields } from './_lineHelpers.js'

const ANCHOR_KEYS = ['ax', 'ay', 'bx', 'by']

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = restore `before`. Current must match `after`.
  return checkLineFields(entry, currentState, 'after')
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = re-apply `after`. Current must match `before`.
  return checkLineFields(entry, currentState, 'before')
}

export async function applyInverse(entry, context = {}) {
  return editLineImpl(entry, context, 'before')
}

export async function applyForward(entry, context = {}) {
  return editLineImpl(entry, context, 'after')
}

async function editLineImpl(entry, { setNodes } = {}, side /* 'before' | 'after' */) {
  const { lineId } = entry
  if (!lineId) throw new Error('[undoActions] editLine: missing lineId')
  const fields = entry[side]
  if (!fields || typeof fields !== 'object') {
    throw new Error(`[undoActions] editLine: missing ${side} fields`)
  }

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== lineId || n.type !== 'lineNode') return n
      const data = { ...n.data, ...fields }
      // An anchor change moves the padded bounding box; style-only edits don't.
      const positionDirty = ANCHOR_KEYS.some((k) => k in fields)
      return { ...n, data, position: positionDirty ? linePositionFor(data) : n.position }
    }))
  }

  // The entry's field names already match updateLine's camelCase API.
  await updateLine(lineId, fields)
}
