// Text-node-family helpers — used by createTextNode, editTextNode, moveTextNode,
// deleteTextNode.
//
// Text nodes (free-floating annotations on the canvas) get the same
// optimistic + persist + Realtime-echo treatment cards do. Identity is the
// row's UUID (same for forward and inverse), captured at action-time.
// Position diffs are bounded by App.jsx's 4px filter for moveTextNode;
// edit / toolbar / resize all collapse into editTextNode whose `before` /
// `after` carry only the fields that changed.

export function findTextNodeIndex(nodes, id) {
  if (!Array.isArray(nodes) || id == null) return -1
  return nodes.findIndex((n) => n.id === id && n.type === 'textNode')
}

export function checkTextNodePresent(entry, { nodes = [] } = {}) {
  const id = entry.textNodeId
  if (!id) return { ok: false, reason: 'Malformed text-node entry: missing textNodeId' }
  return findTextNodeIndex(nodes, id) !== -1
    ? { ok: true }
    : { ok: false, reason: 'Text node no longer exists' }
}

export function checkTextNodeAbsent(entry, { nodes = [] } = {}) {
  const id = entry.textNodeId ?? entry.dbRow?.id
  if (!id) return { ok: false, reason: 'Malformed text-node entry: missing id' }
  return findTextNodeIndex(nodes, id) === -1
    ? { ok: true }
    : { ok: false, reason: 'A text node with that id already exists' }
}

// editTextNode drift check. The entry carries `before` / `after` partial
// field-sets — only the fields that actually changed. We require every
// field in the recorded side to match current React state. Other fields
// not in the entry are ignored (e.g. resizing changed only width/height,
// so a concurrent text edit elsewhere shouldn't block undo).
//
// Field name maps from the React-shape (text/width/height/fontSize/align)
// to the locations in node.data. `text` lives in n.data.text;
// width/height/fontSize/align all live in n.data; position lives in
// n.position.x / n.position.y. moveTextNode handles position separately,
// but resize bundles position+size into editTextNode (a resize from a top
// or left handle moves the node's origin), so we need to compare position
// fields here too when they're in the entry.
export function checkTextNodeFields(entry, { nodes = [] } = {}, side /* 'before' | 'after' */) {
  const id = entry.textNodeId
  if (!id) return { ok: false, reason: 'Malformed editTextNode entry: missing textNodeId' }
  const fields = entry[side]
  if (!fields || typeof fields !== 'object') {
    return { ok: false, reason: `Malformed editTextNode entry: missing ${side}` }
  }
  const idx = findTextNodeIndex(nodes, id)
  if (idx === -1) return { ok: false, reason: 'Text node no longer exists' }
  const node = nodes[idx]
  for (const [k, v] of Object.entries(fields)) {
    let current
    if (k === 'positionX')      current = node.position?.x
    else if (k === 'positionY') current = node.position?.y
    else if (k === 'text')      current = node.data?.text
    else                        current = node.data?.[k]
    if (current !== v) {
      return { ok: false, reason: `Text node ${k} changed elsewhere` }
    }
  }
  return { ok: true }
}
