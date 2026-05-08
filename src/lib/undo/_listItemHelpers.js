// List-item-family helpers — used by addListItem, removeListItem, editListItem,
// reorderListItem.
//
// Identity is the item's stable id (bullets via normalizeBullets;
// media via the storage path). Position is recorded for re-insertion
// targeting and as a drift check, never as the primary identifier — that
// way duplicate-text bullets, mid-list deletes, and reorders all undo
// unambiguously.
//
// All four ops persist via the same path: read the card's current
// sections from React state (passed via context.nodes), apply the op
// to a fresh copy of the relevant array, optimistic setNodes, then
// updateNodeSections — which still rewrites all four sections in one
// JSONB write per ADR-0002. The other three sections come from current
// state unchanged.

import { updateNodeSections } from '../nodes.js'

// The four list-shaped card fields that participate in per-item undo.
// Other fields (label / type / summary / avatar) stay at editCardField
// granularity.
export const LIST_FIELDS = new Set(['storyNotes', 'hiddenLore', 'dmNotes', 'media'])

// For media, items have shape `{path, alt, uploaded_at} | string`. They
// don't carry an `id` field — the storage path is the natural identity for
// uploaded entries, and legacy strings get matched by value at array
// position. Bullets always have a stable `id` from normalizeBullets.
export function getItemId(item) {
  if (item && typeof item === 'object' && typeof item.id === 'string') return item.id
  // Media items: use path for storage entries, the string itself for legacy.
  if (item && typeof item === 'object' && typeof item.path === 'string') return item.path
  if (typeof item === 'string') return item
  return null
}

export function findItemIndexById(arr, id) {
  if (!Array.isArray(arr) || id == null) return -1
  return arr.findIndex((x) => getItemId(x) === id)
}

export function checkListItemBase(entry) {
  if (!entry?.cardId || !entry?.field) {
    return { ok: false, reason: 'Malformed list-item entry' }
  }
  if (!LIST_FIELDS.has(entry.field)) {
    return { ok: false, reason: `Unsupported list field: ${entry.field}` }
  }
  return null  // base shape ok
}

export function getCardArray({ nodes = [] }, cardId, field) {
  const target = nodes.find((n) => n.id === cardId)
  if (!target) return { error: 'Card no longer exists' }
  return { arr: target.data?.[field] || [], target }
}

export function checkListItemPresent(entry, currentState = {}) {
  const base = checkListItemBase(entry)
  if (base) return base
  const id = getItemId(entry.item) ?? entry.itemId
  if (id == null) return { ok: false, reason: 'Malformed list-item entry: missing id' }
  const { arr, error } = getCardArray(currentState, entry.cardId, entry.field)
  if (error) return { ok: false, reason: error }
  return findItemIndexById(arr, id) !== -1
    ? { ok: true }
    : { ok: false, reason: 'List item no longer in this card' }
}

export function checkListItemAbsent(entry, currentState = {}) {
  const base = checkListItemBase(entry)
  if (base) return base
  const id = getItemId(entry.item) ?? entry.itemId
  if (id == null) return { ok: false, reason: 'Malformed list-item entry: missing id' }
  const { arr, error } = getCardArray(currentState, entry.cardId, entry.field)
  if (error) return { ok: false, reason: error }
  return findItemIndexById(arr, id) === -1
    ? { ok: true }
    : { ok: false, reason: 'A list item with that id is already present' }
}

export function checkListItemValue(entry, currentState = {}, expectedValue) {
  const base = checkListItemBase(entry)
  if (base) return base
  const id = entry.itemId
  if (id == null) return { ok: false, reason: 'Malformed editListItem entry: missing itemId' }
  const { arr, error } = getCardArray(currentState, entry.cardId, entry.field)
  if (error) return { ok: false, reason: error }
  const idx = findItemIndexById(arr, id)
  if (idx === -1) return { ok: false, reason: 'List item no longer in this card' }
  const item = arr[idx]
  // For bullets the value lives at item.value. For media legacy strings
  // it's the string itself (covered by the typeof === 'string' branch).
  const currentValue = (item && typeof item === 'object' && 'value' in item) ? item.value : item
  return currentValue === expectedValue
    ? { ok: true }
    : { ok: false, reason: 'List item value changed elsewhere' }
}

export function checkListItemAtPosition(entry, currentState = {}, expectedPosition) {
  const base = checkListItemBase(entry)
  if (base) return base
  const id = entry.itemId
  if (id == null) return { ok: false, reason: 'Malformed reorderListItem entry: missing itemId' }
  if (typeof expectedPosition !== 'number' || expectedPosition < 0) {
    return { ok: false, reason: 'Malformed reorderListItem entry: bad position' }
  }
  const { arr, error } = getCardArray(currentState, entry.cardId, entry.field)
  if (error) return { ok: false, reason: error }
  const idx = findItemIndexById(arr, id)
  if (idx === -1) return { ok: false, reason: 'List item no longer in this card' }
  return idx === expectedPosition
    ? { ok: true }
    : { ok: false, reason: `List item moved elsewhere (now at index ${idx}, expected ${expectedPosition})` }
}

// Apply helpers. Each writes a new array to the card's data[field] via
// setNodes optimistic, then persists by re-passing the current state's
// other three sections to updateNodeSections.

export async function persistListChange(entry, { nodes = [], setNodes } = {}, nextArr) {
  const { cardId, field } = entry
  const target = nodes.find((n) => n.id === cardId)
  if (!target) {
    throw new Error(`[undoActions] list-item: card "${cardId}" not found`)
  }
  const data = target.data || {}

  if (typeof setNodes === 'function') {
    setNodes((nds) => nds.map((n) =>
      n.id === cardId ? { ...n, data: { ...n.data, [field]: nextArr } } : n
    ))
  }

  await updateNodeSections(cardId, {
    storyNotes: data.storyNotes || [],
    hiddenLore: data.hiddenLore || [],
    dmNotes:    data.dmNotes    || [],
    media:      data.media      || [],
    [field]:    nextArr,
  })
}

export async function removeListItemImpl(entry, context = {}) {
  const id = getItemId(entry.item) ?? entry.itemId
  if (id == null) throw new Error('[undoActions] list-item: missing id')
  const { arr, error } = getCardArray(context, entry.cardId, entry.field)
  if (error) throw new Error(`[undoActions] list-item: ${error}`)
  const idx = findItemIndexById(arr, id)
  if (idx === -1) throw new Error('[undoActions] list-item: target not in list')
  const next = [...arr.slice(0, idx), ...arr.slice(idx + 1)]
  await persistListChange(entry, context, next)
}

export async function insertListItemImpl(entry, context = {}) {
  const item = entry.item
  if (item == null) throw new Error('[undoActions] list-item: missing item payload')
  const { arr, error } = getCardArray(context, entry.cardId, entry.field)
  if (error) throw new Error(`[undoActions] list-item: ${error}`)
  // Clamp position to current array length so a redo into a list that
  // shrunk doesn't leave a gap. For undo right after the original remove
  // this is the recorded position; for undo after concurrent edits it's
  // the last valid index. Either way we land somewhere sensible rather
  // than throwing.
  const recordedPos = typeof entry.position === 'number' ? entry.position : arr.length
  const pos = Math.max(0, Math.min(recordedPos, arr.length))
  const next = [...arr.slice(0, pos), item, ...arr.slice(pos)]
  await persistListChange(entry, context, next)
}

export async function setListItemValueImpl(entry, context = {}, side /* 'before' | 'after' */) {
  const id = entry.itemId
  if (id == null) throw new Error('[undoActions] editListItem: missing itemId')
  if (entry.field === 'media') {
    throw new Error('[undoActions] editListItem: not supported for media')
  }
  const { arr, error } = getCardArray(context, entry.cardId, entry.field)
  if (error) throw new Error(`[undoActions] list-item: ${error}`)
  const idx = findItemIndexById(arr, id)
  if (idx === -1) throw new Error('[undoActions] editListItem: target not in list')
  const value = entry[side]
  const next = arr.map((item, i) =>
    i === idx ? { ...item, value } : item,
  )
  await persistListChange(entry, context, next)
}

export async function moveListItemImpl(entry, context = {}, direction /* 'forward' | 'inverse' */) {
  const id = entry.itemId
  if (id == null) throw new Error('[undoActions] reorderListItem: missing itemId')
  const { arr, error } = getCardArray(context, entry.cardId, entry.field)
  if (error) throw new Error(`[undoActions] list-item: ${error}`)
  const idx = findItemIndexById(arr, id)
  if (idx === -1) throw new Error('[undoActions] reorderListItem: target not in list')
  // Forward: pull from `from`, drop at `to`. Inverse: reversed.
  const targetPos = direction === 'forward' ? entry.to : entry.from
  const clamped = Math.max(0, Math.min(targetPos, arr.length - 1))
  if (clamped === idx) {
    // Already in place — treat as no-op rather than thrash setNodes/DB.
    return
  }
  const copy = [...arr]
  const [moved] = copy.splice(idx, 1)
  copy.splice(clamped, 0, moved)
  await persistListChange(entry, context, copy)
}
