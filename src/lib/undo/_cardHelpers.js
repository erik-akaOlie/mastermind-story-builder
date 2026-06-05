// Card-family helpers — used by createCard, editCardField, moveCard, deleteCard.
//
// editCardField operates on NODE_FIELDS only (label, summary, avatar, type →
// updateNode). canApply* compare against the live node's React-shape data using
// deep equality (`deepEqual` in `_shared.js`). The section-field family was
// retired in E5 (ADR-0016); that content lives in the block editor now.

import { useTypeStore } from '../../store/useTypeStore.js'
import { deepEqual } from './_shared.js'

export const NODE_FIELDS = new Set(['label', 'summary', 'avatar', 'type'])

// moveCard — defensive shape-reader. The entry shape is `{ cards: [{ cardId,
// before, after }, ...] }` (post-Sprint-2 grouping). If a stale singular-
// shape entry hydrates from sessionStorage, treat it as a 1-element grouping.
export function getMoveCards(entry) {
  if (Array.isArray(entry?.cards)) return entry.cards
  if (entry?.cardId) {
    return [{ cardId: entry.cardId, before: entry.before, after: entry.after }]
  }
  return []
}

export function checkEditCardField(entry, { nodes = [] } = {}, side /* 'before' | 'after' */) {
  const { cardId, field } = entry
  if (!cardId || !field) {
    return { ok: false, reason: 'Malformed editCardField entry' }
  }
  if (!NODE_FIELDS.has(field)) {
    return { ok: false, reason: `Unsupported field: ${field}` }
  }
  const target = nodes.find((n) => n.id === cardId)
  if (!target) return { ok: false, reason: 'Card no longer exists' }
  const currentValue = target.data?.[field]
  return deepEqual(currentValue, entry[side])
    ? { ok: true }
    : { ok: false, reason: `${field} changed elsewhere` }
}

// Reverse type lookup: useTypeStore exposes idByKey + types but not
// nodeTypesById in the shape dbNodeToReactFlow wants. Build it on demand
// from the live store. Cheap (5 entries by default).
export function buildNodeTypesById() {
  const { types = {}, idByKey = {} } = useTypeStore.getState() || {}
  const out = {}
  for (const [key, id] of Object.entries(idByKey)) {
    out[id] = { key, ...(types[key] || {}) }
  }
  return out
}
