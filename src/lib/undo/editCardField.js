// editCardField — one entry per changed field per modal session (see
// ADR-0006 §7). Operates on NODE_FIELDS only:
//
//   NODE_FIELDS: label, summary, avatar, type → updateNode
//
// Section fields (storyNotes/hiddenLore/dmNotes/media) were retired in E5
// (ADR-0016) along with the legacy fielded editor; that content lives in the
// block editor now, which owns its own save + undo.

import { updateNode } from '../nodes.js'
import { useTypeStore } from '../../store/useTypeStore.js'
import { NODE_FIELDS, checkEditCardField } from './_cardHelpers.js'

export function canApplyInverse(entry, currentState = {}) {
  return checkEditCardField(entry, currentState, 'after')
}

export function canApplyForward(entry, currentState = {}) {
  return checkEditCardField(entry, currentState, 'before')
}

export async function applyInverse(entry, context = {}) {
  return editCardFieldSide(entry, context, 'before')
}

export async function applyForward(entry, context = {}) {
  return editCardFieldSide(entry, context, 'after')
}

async function editCardFieldSide(entry, { setNodes } = {}, side /* 'before' | 'after' */) {
  const { cardId, field } = entry
  const value = entry[side]

  if (!NODE_FIELDS.has(field)) {
    throw new Error(`[undoActions] editCardField: unsupported field "${field}"`)
  }

  // Optimistic local update — same shape as App.jsx's onUpdateNode does for a
  // normal edit. Realtime would echo this back anyway; the optimistic write
  // makes the canvas snap immediately rather than wait for the round-trip.
  if (typeof setNodes === 'function') {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === cardId ? { ...n, data: { ...n.data, [field]: value } } : n,
      ),
    )
  }

  if (field === 'type') {
    const typeId = useTypeStore.getState().idByKey?.[value]
    if (!typeId) {
      throw new Error(`[undoActions] editCardField: no typeId for type key "${value}"`)
    }
    await updateNode(cardId, { typeId })
  } else if (field === 'avatar') {
    await updateNode(cardId, { avatarUrl: value })
  } else {
    await updateNode(cardId, { [field]: value })
  }
}
