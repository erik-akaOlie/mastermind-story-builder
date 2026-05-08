// ============================================================================
// undo dispatcher — entry point for the undo/redo system
// ----------------------------------------------------------------------------
// Each undo entry carries a `type` discriminator (see ADR-0006 §1). This
// module owns the four dispatcher operations:
//
//   - canApplyInverse(entry, { nodes, edges })             → { ok, reason? }
//   - canApplyForward(entry, { nodes, edges })             → { ok, reason? }
//   - applyInverse(entry, { setNodes, setEdges, ... })     → Promise<void>
//   - applyForward(entry, { setNodes, setEdges, ... })     → Promise<void>
//
// canApply* validate that current local state still matches what the entry
// expects (avoids the silent-clobber failure mode if another tab edited the
// same field since the action was recorded). apply* perform an optimistic
// local update via the supplied setters, then persist through the existing
// lib/*.js API so persistWrite + the Realtime channel + sync chip behave
// like a normal edit.
//
// Each action type lives in its own per-type module exposing the same
// `{ canApplyInverse, canApplyForward, applyInverse, applyForward }` shape.
// The dispatcher is a Map<type, handlers> lookup. Family-specific helper
// pools live in `_cardHelpers.js`, `_connectionHelpers.js`,
// `_listItemHelpers.js`, and `_textNodeHelpers.js`.
// ============================================================================

import * as createCard       from './createCard.js'
import * as editCardField    from './editCardField.js'
import * as moveCard         from './moveCard.js'
import * as deleteCard       from './deleteCard.js'
import * as addConnection    from './addConnection.js'
import * as removeConnection from './removeConnection.js'
import * as addListItem      from './addListItem.js'
import * as removeListItem   from './removeListItem.js'
import * as editListItem     from './editListItem.js'
import * as reorderListItem  from './reorderListItem.js'
import * as createTextNode   from './createTextNode.js'
import * as editTextNode     from './editTextNode.js'
import * as moveTextNode     from './moveTextNode.js'
import * as deleteTextNode   from './deleteTextNode.js'

export { deepEqual } from './_shared.js'

export const ACTION_TYPES = Object.freeze({
  CREATE_CARD:         'createCard',
  EDIT_CARD_FIELD:     'editCardField',
  MOVE_CARD:           'moveCard',
  DELETE_CARD:         'deleteCard',
  ADD_CONNECTION:      'addConnection',
  REMOVE_CONNECTION:   'removeConnection',
  CREATE_TEXT_NODE:    'createTextNode',
  EDIT_TEXT_NODE:      'editTextNode',
  MOVE_TEXT_NODE:      'moveTextNode',
  DELETE_TEXT_NODE:    'deleteTextNode',
  // Phase 7c: per-item ops on list-shaped fields. Identity is the item's
  // stable id (phase 7b); position is a hint and a drift check, never the
  // primary identifier.
  ADD_LIST_ITEM:       'addListItem',
  REMOVE_LIST_ITEM:    'removeListItem',
  EDIT_LIST_ITEM:      'editListItem',
  REORDER_LIST_ITEM:   'reorderListItem',
})

const handlers = new Map([
  [ACTION_TYPES.CREATE_CARD,        createCard],
  [ACTION_TYPES.EDIT_CARD_FIELD,    editCardField],
  [ACTION_TYPES.MOVE_CARD,          moveCard],
  [ACTION_TYPES.DELETE_CARD,        deleteCard],
  [ACTION_TYPES.ADD_CONNECTION,     addConnection],
  [ACTION_TYPES.REMOVE_CONNECTION,  removeConnection],
  [ACTION_TYPES.ADD_LIST_ITEM,      addListItem],
  [ACTION_TYPES.REMOVE_LIST_ITEM,   removeListItem],
  [ACTION_TYPES.EDIT_LIST_ITEM,     editListItem],
  [ACTION_TYPES.REORDER_LIST_ITEM,  reorderListItem],
  [ACTION_TYPES.CREATE_TEXT_NODE,   createTextNode],
  [ACTION_TYPES.EDIT_TEXT_NODE,     editTextNode],
  [ACTION_TYPES.MOVE_TEXT_NODE,     moveTextNode],
  [ACTION_TYPES.DELETE_TEXT_NODE,   deleteTextNode],
])

export function canApplyInverse(entry, currentState = {}) {
  const h = entry ? handlers.get(entry.type) : null
  if (!h) return { ok: false, reason: `Unknown action type: ${entry?.type}` }
  return h.canApplyInverse(entry, currentState)
}

export function canApplyForward(entry, currentState = {}) {
  const h = entry ? handlers.get(entry.type) : null
  if (!h) return { ok: false, reason: `Unknown action type: ${entry?.type}` }
  return h.canApplyForward(entry, currentState)
}

export async function applyInverse(entry, context = {}) {
  const h = entry ? handlers.get(entry.type) : null
  if (!h) {
    throw new Error(`[undoActions] applyInverse: unknown action type "${entry?.type}"`)
  }
  return h.applyInverse(entry, context)
}

export async function applyForward(entry, context = {}) {
  const h = entry ? handlers.get(entry.type) : null
  if (!h) {
    throw new Error(`[undoActions] applyForward: unknown action type "${entry?.type}"`)
  }
  return h.applyForward(entry, context)
}
