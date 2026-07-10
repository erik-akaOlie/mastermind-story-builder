// Line-family helpers — used by createLine, editLine, moveLine, deleteLine.
//
// Lines (free-standing straight-line annotations) get the same optimistic +
// persist + Realtime-echo treatment text nodes do. Identity is the row's
// UUID, captured at action-time. Whole-line drags are moveLine (anchor
// translation, 4px threshold in App.jsx); endpoint drags and style-toolbar
// clicks are editLine with `before` / `after` carrying only changed fields.

export function findLineIndex(nodes, id) {
  if (!Array.isArray(nodes) || id == null) return -1
  return nodes.findIndex((n) => n.id === id && n.type === 'lineNode')
}

export function checkLinePresent(entry, { nodes = [] } = {}) {
  const id = entry.lineId
  if (!id) return { ok: false, reason: 'Malformed line entry: missing lineId' }
  return findLineIndex(nodes, id) !== -1
    ? { ok: true }
    : { ok: false, reason: 'Line no longer exists' }
}

export function checkLineAbsent(entry, { nodes = [] } = {}) {
  const id = entry.lineId ?? entry.dbRow?.id
  if (!id) return { ok: false, reason: 'Malformed line entry: missing id' }
  return findLineIndex(nodes, id) === -1
    ? { ok: true }
    : { ok: false, reason: 'A line with that id already exists' }
}

// editLine / moveLine drift check. The entry carries `before` / `after`
// partial field-sets; every field on the recorded side must match current
// React state (all line fields live in node.data — ax/ay/bx/by/weight/
// dashed/dashLength/dashGap/color).
export function checkLineFields(entry, { nodes = [] } = {}, side /* 'before' | 'after' */) {
  const id = entry.lineId
  if (!id) return { ok: false, reason: 'Malformed line entry: missing lineId' }
  const fields = entry[side]
  if (!fields || typeof fields !== 'object') {
    return { ok: false, reason: `Malformed line entry: missing ${side}` }
  }
  const idx = findLineIndex(nodes, id)
  if (idx === -1) return { ok: false, reason: 'Line no longer exists' }
  const node = nodes[idx]
  for (const [k, v] of Object.entries(fields)) {
    if (node.data?.[k] !== v) {
      return { ok: false, reason: `Line ${k} changed elsewhere` }
    }
  }
  return { ok: true }
}
