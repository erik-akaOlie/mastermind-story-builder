// editCardField — one entry per changed field per modal session (see
// ADR-0006 §7). Two field families:
//
//   NODE_FIELDS:    label, summary, avatar, type → updateNode
//   SECTION_FIELDS: storyNotes, hiddenLore, dmNotes, media → updateNodeSections

import { updateNode, updateNodeSections } from '../nodes.js'
import { useTypeStore } from '../../store/useTypeStore.js'
import { NODE_FIELDS, SECTION_FIELDS, checkEditCardField } from './_cardHelpers.js'

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

async function editCardFieldSide(entry, { nodes = [], setNodes } = {}, side /* 'before' | 'after' */) {
  const { cardId, field } = entry
  const value = entry[side]

  if (!NODE_FIELDS.has(field) && !SECTION_FIELDS.has(field)) {
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

  if (NODE_FIELDS.has(field)) {
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
    return
  }

  // SECTION_FIELDS — updateNodeSections replaces all four, so merge current
  // state for the unchanged three with the recorded value for the changed one.
  const target = nodes.find((n) => n.id === cardId)
  const data = target?.data || {}
  await updateNodeSections(cardId, {
    storyNotes: data.storyNotes || [],
    hiddenLore: data.hiddenLore || [],
    dmNotes:    data.dmNotes    || [],
    media:      data.media      || [],
    [field]:    value,
  })
}
