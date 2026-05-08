// editTextNode — phase 8. Covers all "session edits" inside a text node:
// text content changes captured at blur, toolbar clicks (font size / align /
// bold / italic) recorded immediately, and resize gestures recorded on
// mouseup. The entry's `before` / `after` carries only the fields that
// actually changed; canApply* compares on those same fields.

import { updateTextNode } from '../textNodes.js'
import { checkTextNodeFields } from './_textNodeHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  // Inverse = restore `before`. Each field in entry.after must currently
  // match the live text node (otherwise something else changed it).
  return checkTextNodeFields(entry, currentState, 'after')
}

export function canApplyForward(entry, currentState = {}) {
  // Forward (redo) = re-apply `after`. Current must match `before`.
  return checkTextNodeFields(entry, currentState, 'before')
}

export async function applyInverse(entry, context = {}) {
  return editTextNodeImpl(entry, context, 'before')
}

export async function applyForward(entry, context = {}) {
  return editTextNodeImpl(entry, context, 'after')
}

// The recorded `before` / `after` partial maps say which fields to write;
// translate them to the React shape for setNodes and to the camelCase lib
// API for updateTextNode.
async function editTextNodeImpl(entry, { setNodes } = {}, side /* 'before' | 'after' */) {
  const { textNodeId } = entry
  if (!textNodeId) throw new Error('[undoActions] editTextNode: missing textNodeId')
  const fields = entry[side]
  if (!fields || typeof fields !== 'object') {
    throw new Error(`[undoActions] editTextNode: missing ${side} fields`)
  }

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== textNodeId || n.type !== 'textNode') return n
      const next = { ...n, data: { ...n.data } }
      if ('text'     in fields) next.data.text     = fields.text
      if ('width'    in fields) next.data.width    = fields.width
      if ('height'   in fields) next.data.height   = fields.height
      if ('fontSize' in fields) next.data.fontSize = fields.fontSize
      if ('align'    in fields) next.data.align    = fields.align
      if ('positionX' in fields || 'positionY' in fields) {
        next.position = {
          x: 'positionX' in fields ? fields.positionX : n.position.x,
          y: 'positionY' in fields ? fields.positionY : n.position.y,
        }
      }
      return next
    }))
  }

  // Persist. updateTextNode takes camelCase { contentHtml, ... } so the
  // entry's `text` field maps to `contentHtml`; everything else passes
  // through unchanged.
  const patch = {}
  if ('text'      in fields) patch.contentHtml = fields.text
  if ('width'     in fields) patch.width       = fields.width
  if ('height'    in fields) patch.height      = fields.height
  if ('fontSize'  in fields) patch.fontSize    = fields.fontSize
  if ('align'     in fields) patch.align       = fields.align
  if ('positionX' in fields) patch.positionX   = fields.positionX
  if ('positionY' in fields) patch.positionY   = fields.positionY
  if (Object.keys(patch).length === 0) return
  await updateTextNode(textNodeId, patch)
}
