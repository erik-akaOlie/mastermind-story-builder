// ============================================================================
// undoActions — dispatcher for the undo/redo system
// ----------------------------------------------------------------------------
// Each undo entry carries a `type` discriminator (see ADR-0006 §1). This
// module owns the switch-on-type for the four dispatcher operations:
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
// Phase 4 (this commit): editCardField joins moveCard as fully wired. The
// remaining cases are still skeleton — canApply* permissively return
// { ok: true }; apply* throw notWired. Subsequent phases (per ADR-0006 §10)
// replace each case body in place:
//
//   phase 5 → createCard, deleteCard
//   phase 7 → addConnection, removeConnection
//   phase 8 → createTextNode, editTextNode, moveTextNode, deleteTextNode
// ============================================================================

import { updateNode, updateNodeSections } from './nodes.js'
import { useTypeStore } from '../store/useTypeStore.js'

export const ACTION_TYPES = Object.freeze({
  CREATE_CARD:        'createCard',
  EDIT_CARD_FIELD:    'editCardField',
  MOVE_CARD:          'moveCard',
  DELETE_CARD:        'deleteCard',
  ADD_CONNECTION:     'addConnection',
  REMOVE_CONNECTION:  'removeConnection',
  CREATE_TEXT_NODE:   'createTextNode',
  EDIT_TEXT_NODE:     'editTextNode',
  MOVE_TEXT_NODE:     'moveTextNode',
  DELETE_TEXT_NODE:   'deleteTextNode',
})

const KNOWN_TYPES = new Set(Object.values(ACTION_TYPES))

function notWired(entry, fn) {
  throw new Error(
    `[undoActions] ${fn} for type "${entry?.type}" is not wired yet — see ADR-0006 §10 phase order.`,
  )
}

// ---------------------------------------------------------------------------
// canApplyInverse — should the recorded inverse still be applicable, given
// where the world is now?
//
// Phase 3+ replaces each case with the real check listed in ADR-0006 §2:
//   - editCardField: nodes-by-id has cardId, and current value of `field`
//     deep-equals `entry.after`
//   - moveCard / moveTextNode: target still exists
//   - createCard / createTextNode: nothing with that id exists (we're about
//     to delete it, so a stale recreate elsewhere should refuse)
//   - deleteCard / deleteTextNode: nothing with that id exists (we're about
//     to recreate it; if something already does, refuse)
//   - addConnection: connection still exists
//   - removeConnection: connection still missing
//   - editTextNode: current text-node fields deep-equal `entry.after`
// ---------------------------------------------------------------------------

export function canApplyInverse(entry, currentState = {}) {
  if (!entry || !KNOWN_TYPES.has(entry.type)) {
    return { ok: false, reason: `Unknown action type: ${entry?.type}` }
  }
  switch (entry.type) {
    case ACTION_TYPES.MOVE_CARD: {
      // Every card in the grouped entry must still exist for the inverse
      // to apply. Conservative semantics: if even one was deleted elsewhere,
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
    case ACTION_TYPES.EDIT_CARD_FIELD:
      return checkEditCardField(entry, currentState, 'after')
    case ACTION_TYPES.CREATE_CARD:
    case ACTION_TYPES.DELETE_CARD:
    case ACTION_TYPES.ADD_CONNECTION:
    case ACTION_TYPES.REMOVE_CONNECTION:
    case ACTION_TYPES.CREATE_TEXT_NODE:
    case ACTION_TYPES.EDIT_TEXT_NODE:
    case ACTION_TYPES.MOVE_TEXT_NODE:
    case ACTION_TYPES.DELETE_TEXT_NODE:
      // Stubbed — phases 4-8 will replace each with real validation.
      return { ok: true }
    default:
      return { ok: false, reason: `Unknown action type: ${entry.type}` }
  }
}

// ---------------------------------------------------------------------------
// canApplyForward — mirror of canApplyInverse for the redo path. Each case
// checks the recorded `before` matches reality (see ADR-0006 §2 examples).
// ---------------------------------------------------------------------------

export function canApplyForward(entry, currentState = {}) {
  if (!entry || !KNOWN_TYPES.has(entry.type)) {
    return { ok: false, reason: `Unknown action type: ${entry?.type}` }
  }
  switch (entry.type) {
    case ACTION_TYPES.MOVE_CARD: {
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
    case ACTION_TYPES.EDIT_CARD_FIELD:
      return checkEditCardField(entry, currentState, 'before')
    case ACTION_TYPES.CREATE_CARD:
    case ACTION_TYPES.DELETE_CARD:
    case ACTION_TYPES.ADD_CONNECTION:
    case ACTION_TYPES.REMOVE_CONNECTION:
    case ACTION_TYPES.CREATE_TEXT_NODE:
    case ACTION_TYPES.EDIT_TEXT_NODE:
    case ACTION_TYPES.MOVE_TEXT_NODE:
    case ACTION_TYPES.DELETE_TEXT_NODE:
      return { ok: true }
    default:
      return { ok: false, reason: `Unknown action type: ${entry.type}` }
  }
}

// ---------------------------------------------------------------------------
// applyInverse — run the inverse via lib/*.js. Phase 2 throws per-type;
// subsequent phases replace each case body with the real lib call:
//
//   moveCard          → updateNode(cardId, { positionX, positionY }) using `before`
//   editCardField     → updateNode or updateNodeSection writing `before` back
//   createCard        → deleteNode(cardId)
//   deleteCard        → restoreCardWithDependents(snapshot)   [new helper, phase 5]
//   addConnection     → deleteConnection(connectionId)
//   removeConnection  → createConnection({ id, source, target })
//   createTextNode    → deleteTextNode(textNodeId)
//   deleteTextNode    → restoreTextNode(dbRow)                [new helper, phase 8]
//   moveTextNode      → updateTextNode(id, { positionX, positionY }) using `before`
//   editTextNode      → updateTextNode(id, { ...before })
// ---------------------------------------------------------------------------

export async function applyInverse(entry, context = {}) {
  if (!entry || !KNOWN_TYPES.has(entry.type)) {
    throw new Error(`[undoActions] applyInverse: unknown action type "${entry?.type}"`)
  }
  switch (entry.type) {
    case ACTION_TYPES.MOVE_CARD:          return moveCardInverse(entry, context)
    case ACTION_TYPES.EDIT_CARD_FIELD:    return editCardFieldSide(entry, context, 'before')
    case ACTION_TYPES.CREATE_CARD:        return notWired(entry, 'applyInverse')
    case ACTION_TYPES.DELETE_CARD:        return notWired(entry, 'applyInverse')
    case ACTION_TYPES.ADD_CONNECTION:     return notWired(entry, 'applyInverse')
    case ACTION_TYPES.REMOVE_CONNECTION:  return notWired(entry, 'applyInverse')
    case ACTION_TYPES.CREATE_TEXT_NODE:   return notWired(entry, 'applyInverse')
    case ACTION_TYPES.EDIT_TEXT_NODE:     return notWired(entry, 'applyInverse')
    case ACTION_TYPES.MOVE_TEXT_NODE:     return notWired(entry, 'applyInverse')
    case ACTION_TYPES.DELETE_TEXT_NODE:   return notWired(entry, 'applyInverse')
    default:
      throw new Error(`[undoActions] applyInverse: unhandled action type "${entry.type}"`)
  }
}

// ---------------------------------------------------------------------------
// applyForward — re-runs the forward action (redo). Mirror of applyInverse,
// using `entry.after` semantics. Phase 2 throws per-type; subsequent phases
// replace each case body in place.
// ---------------------------------------------------------------------------

export async function applyForward(entry, context = {}) {
  if (!entry || !KNOWN_TYPES.has(entry.type)) {
    throw new Error(`[undoActions] applyForward: unknown action type "${entry?.type}"`)
  }
  switch (entry.type) {
    case ACTION_TYPES.MOVE_CARD:          return moveCardForward(entry, context)
    case ACTION_TYPES.EDIT_CARD_FIELD:    return editCardFieldSide(entry, context, 'after')
    case ACTION_TYPES.CREATE_CARD:        return notWired(entry, 'applyForward')
    case ACTION_TYPES.DELETE_CARD:        return notWired(entry, 'applyForward')
    case ACTION_TYPES.ADD_CONNECTION:     return notWired(entry, 'applyForward')
    case ACTION_TYPES.REMOVE_CONNECTION:  return notWired(entry, 'applyForward')
    case ACTION_TYPES.CREATE_TEXT_NODE:   return notWired(entry, 'applyForward')
    case ACTION_TYPES.EDIT_TEXT_NODE:     return notWired(entry, 'applyForward')
    case ACTION_TYPES.MOVE_TEXT_NODE:     return notWired(entry, 'applyForward')
    case ACTION_TYPES.DELETE_TEXT_NODE:   return notWired(entry, 'applyForward')
    default:
      throw new Error(`[undoActions] applyForward: unhandled action type "${entry.type}"`)
  }
}

// ---------------------------------------------------------------------------
// Per-action implementations
// ---------------------------------------------------------------------------

// moveCard — both directions optimistically update local state for every
// card in the grouped entry in one setNodes call (so the canvas re-renders
// once, not N times), then persist each card's position in parallel via
// updateNode. persistWrite owns retry + lock-overlay behavior; Realtime
// echoes positions back to other tabs (and harmlessly to this one).

// Defensive shape-reader. The entry shape is `{ cards: [{ cardId, before,
// after }, ...] }` (post-Sprint-2 grouping). If a stale singular-shape
// entry hydrates from sessionStorage, treat it as a 1-element grouping.
function getMoveCards(entry) {
  if (Array.isArray(entry?.cards)) return entry.cards
  if (entry?.cardId) {
    return [{ cardId: entry.cardId, before: entry.before, after: entry.after }]
  }
  return []
}

async function moveCardInverse(entry, { setNodes } = {}) {
  return applyMoveCardSide(entry, { setNodes }, 'before')
}

async function moveCardForward(entry, { setNodes } = {}) {
  return applyMoveCardSide(entry, { setNodes }, 'after')
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

// editCardField — one entry per changed field per modal session (see ADR-0006
// §7). Two field families:
//
//   NODE_FIELDS:    label, summary, avatar, type → updateNode
//   SECTION_FIELDS: storyNotes, hiddenLore, dmNotes, media → updateNodeSections
//
// updateNodeSections rewrites all four sections in one call, so the dispatcher
// merges current local state for the three unchanged sections with the
// recorded value for the changed one. canApply* compare against the live
// node's React-shape data using deep equality.

const NODE_FIELDS    = new Set(['label', 'summary', 'avatar', 'type'])
const SECTION_FIELDS = new Set(['storyNotes', 'hiddenLore', 'dmNotes', 'media'])

function checkEditCardField(entry, { nodes = [] } = {}, side /* 'before' | 'after' */) {
  const { cardId, field } = entry
  if (!cardId || !field) {
    return { ok: false, reason: 'Malformed editCardField entry' }
  }
  if (!NODE_FIELDS.has(field) && !SECTION_FIELDS.has(field)) {
    return { ok: false, reason: `Unsupported field: ${field}` }
  }
  const target = nodes.find((n) => n.id === cardId)
  if (!target) return { ok: false, reason: 'Card no longer exists' }
  const currentValue = target.data?.[field]
  return deepEqual(currentValue, entry[side])
    ? { ok: true }
    : { ok: false, reason: `${field} changed elsewhere` }
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

// Small structural deep-equal good enough for the React-shape values we
// snapshot: strings, nulls, arrays of strings, arrays of plain objects
// (e.g. media entries `{ path, alt, uploaded_at }`). Avoids JSON.stringify's
// key-order fragility on plain objects coming back from Supabase vs from
// upload helpers.
export function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!deepEqual(a[k], b[k])) return false
  }
  return true
}
