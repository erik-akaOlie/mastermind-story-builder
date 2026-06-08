// ============================================================================
// blockIds — document-integrity helpers for BlockNote block IDs (F5f)
// ----------------------------------------------------------------------------
// Defends against the duplicate block-ID class of bug (a gallery — or ANY block —
// silently collapsing when two blocks in one document share an ID). Duplicate IDs
// arise from ID REUSE: copy/paste, drag/drop, cross-section move, or duplicating a
// card (which copies block IDs verbatim). BlockNote's own ID plugin only de-dupes
// within a single edit, not against IDs already present elsewhere in the document.
//
// This module is the SHARED, PURE core used by both repair layers (ADR-… / F5f):
//   • Layer 2 (stored / self-heal): dedupeBlockIds() runs on a zone's loaded JSON
//     so a document corrupted by an earlier session renders cleanly on next open.
//   • Layer 1 (live): the appendTransaction plugin reuses generateBlockId() and the
//     same first-occurrence-wins rule, but operates on ProseMirror nodes by POSITION
//     (never by ID — ID-addressed edits are ambiguous when IDs are duplicated).
//
// Design rules (per the approved plan):
//   • Regenerate ONLY duplicates — the first occurrence of an ID is kept; later
//     occurrences get a fresh ID. Never regenerate all IDs.
//   • Preserve content + order — only the offending `id` (and the spine of objects
//     above it) is rebuilt; everything else keeps its reference.
//   • No churn — a document with no duplicates returns the SAME array reference.
//   • Type-agnostic — keyed off the presence of `id`, not the block `type`.
//   • Recurses into `children` (BlockNote blocks form a tree); first-occurrence-wins
//     is evaluated in document order (depth-first, parent before its children).
// ============================================================================

// Fresh unique ID in BlockNote's format (UUID v4). Block IDs are opaque strings —
// BlockNote does not validate the format — but matching its uuidv4 shape keeps
// documents uniform. crypto.randomUUID covers browsers + modern Node; the
// getRandomValues path covers jsdom / older runtimes; the counter is a last resort
// so this never throws in any environment.
let _fallbackCounter = 0
export function generateBlockId() {
  const g = globalThis
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID()
  }
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    const b = g.crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40 // version 4
    b[8] = (b[8] & 0x3f) | 0x80 // variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
  }
  _fallbackCounter += 1
  return `mm-block-${_fallbackCounter}`
}

// Collect the set of IDs that appear more than once anywhere in the block tree.
// (Exported for the plugin + tests; document order, depth-first.)
export function collectDuplicateBlockIds(blocks) {
  const seen = new Set()
  const dupes = new Set()
  const walk = (list) => {
    if (!Array.isArray(list)) return
    for (const block of list) {
      if (!block || typeof block !== 'object') continue
      const id = block.id
      if (id != null) {
        if (seen.has(id)) dupes.add(id)
        else seen.add(id)
      }
      if (Array.isArray(block.children) && block.children.length) walk(block.children)
    }
  }
  walk(blocks)
  return dupes
}

export function hasDuplicateBlockIds(blocks) {
  return collectDuplicateBlockIds(blocks).size > 0
}

// Internal: walk a list, regenerating IDs already in `seen`. Returns the SAME list
// reference when nothing in (or below) it changed, so clean subtrees never churn.
function dedupeWalk(list, seen) {
  let listChanged = false
  const out = list.map((block) => {
    if (!block || typeof block !== 'object') return block
    let next = block

    const id = block.id
    if (id != null) {
      if (seen.has(id)) {
        next = { ...next, id: generateBlockId() }
        listChanged = true
      } else {
        seen.add(id)
      }
    }

    const kids = block.children
    if (Array.isArray(kids) && kids.length) {
      const newKids = dedupeWalk(kids, seen)
      if (newKids !== kids) {
        next = { ...next, children: newKids }
        listChanged = true
      }
    }

    return next
  })
  return listChanged ? out : list
}

// Return a document with duplicate block IDs regenerated (first occurrence kept).
// Non-arrays pass through untouched (e.g. a null/unsaved zone). The SAME reference
// is returned when there are no duplicates — callers can rely on `result === blocks`
// meaning "nothing changed" to avoid unnecessary writes.
export function dedupeBlockIds(blocks) {
  if (!Array.isArray(blocks)) return blocks
  return dedupeWalk(blocks, new Set())
}
