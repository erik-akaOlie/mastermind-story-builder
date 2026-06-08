// ============================================================================
// uniqueBlockIdsExtension — live duplicate block-ID repair (F5f, Checkpoint 2)
// ----------------------------------------------------------------------------
// A BlockNote extension contributing a ProseMirror plugin whose appendTransaction
// runs after every edit, finds any block whose `id` duplicates an EARLIER block in
// the same document, and reassigns the later one a fresh ID — BY POSITION
// (setNodeMarkup at the node's pos), never by the ambiguous ID.
//
// Why this exists: BlockNote's built-in ID plugin only de-duplicates IDs created
// *within a single edit*; it does not catch an incoming block whose ID already
// exists elsewhere in the document. That gap is exactly the duplicate-gallery bug —
// copy/paste, drag/drop, and cross-section move all carry a block's ID along, and
// when it lands next to a block that already has that ID, the two collide and one is
// lost. This plugin closes that gap for ALL block types (it keys off the presence of
// an `id` attr, not the block type).
//
// Composition / safety:
//   • Repairs by POSITION via setNodeMarkup — never updateBlock/removeBlocks, which
//     are ID-addressed and ambiguous when IDs are duplicated (the approved guardrail).
//   • No churn: returns null when there are no duplicates.
//   • Converges: after a repair, a re-run finds no duplicates and returns null — so it
//     cannot ping-pong with BlockNote's own ID plugin (our regenerated IDs are unique
//     and non-null, which that plugin leaves untouched).
//   • Mirrors the shape of BlockNote's own UniqueID appendTransaction, the proven
//     pattern for this kind of housekeeping transaction.
//
// prosemirror-state resolves to BlockNote's single hoisted instance (verified one
// copy in node_modules), so `new Plugin` here is the same Plugin class BlockNote uses.
// ============================================================================

import { createExtension } from '@blocknote/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { generateBlockId } from './blockIds.js'

const KEY = new PluginKey('mmUniqueBlockIds')

function uniqueBlockIdsPlugin() {
  return new Plugin({
    key: KEY,
    appendTransaction(transactions, _oldState, newState) {
      // Only react to edits that actually changed the document.
      if (!transactions.some((tr) => tr.docChanged)) return null

      // First pass: walk the doc in document order, collecting the POSITIONS of
      // blocks whose id was already seen (first occurrence wins). Only block nodes
      // carry an `id` attr; inline content and structural nodes are skipped.
      const seen = new Set()
      const dupePositions = []
      newState.doc.descendants((node, pos) => {
        const id = node.attrs?.id
        if (id == null) return
        if (seen.has(id)) dupePositions.push(pos)
        else seen.add(id)
      })
      if (dupePositions.length === 0) return null

      // Second pass: reassign each duplicate a fresh id, addressed by position.
      // setNodeMarkup does not change node sizes, so positions stay valid across the
      // loop. Re-read each node from tr.doc defensively.
      const tr = newState.tr
      for (const pos of dupePositions) {
        const node = tr.doc.nodeAt(pos)
        if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateBlockId() })
      }
      tr.setMeta(KEY, true)
      return tr.steps.length ? tr : null
    },
  })
}

// Pass into useCreateBlockNote({ extensions: [uniqueBlockIds] }).
export const uniqueBlockIds = createExtension({
  key: 'mmUniqueBlockIds',
  prosemirrorPlugins: [uniqueBlockIdsPlugin()],
})
