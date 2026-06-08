// Integration test for the live duplicate block-ID repair plugin (F5f, Checkpoint 2).
// Drives a REAL mounted BlockNote editor headlessly (jsdom): the ProseMirror plugin
// pipeline only activates once the editor is mounted, so each test mounts to a DOM
// element. We simulate the exact failure (a block whose id collides with an existing
// block's id — what a paste / drag / cross-section move produces) and assert the
// plugin's appendTransaction repairs it by position, keeping the first occurrence.

import { describe, it, expect, beforeEach } from 'vitest'
import { BlockNoteEditor } from '@blocknote/core'
import { schema } from './blockSchema.jsx'
import { uniqueBlockIds } from './uniqueBlockIdsExtension.js'

function mountedEditor() {
  const editor = BlockNoteEditor.create({ schema, extensions: [uniqueBlockIds] })
  const el = document.createElement('div')
  document.body.appendChild(el)
  editor.mount(el)
  return editor
}

// Force `victimId`'s block to take `targetId` (simulating a colliding moved/pasted
// block), by position, then dispatch — which runs the plugin's appendTransaction.
function forceCollision(editor, victimId, targetId) {
  const view = editor._tiptapEditor.view
  let pos = null
  view.state.doc.descendants((node, p) => {
    if (node.attrs?.id === victimId) pos = p
  })
  const tr = view.state.tr.setNodeMarkup(pos, undefined, {
    ...view.state.doc.nodeAt(pos).attrs,
    id: targetId,
  })
  view.dispatch(tr)
}

describe('uniqueBlockIds live plugin', () => {
  let editor
  beforeEach(() => {
    editor = mountedEditor()
    editor.insertBlocks([{ type: 'paragraph' }, { type: 'paragraph' }], editor.document[0], 'after')
  })

  it('activates the ProseMirror plugin pipeline once mounted', () => {
    expect(editor._tiptapEditor.view.state.plugins.length).toBeGreaterThan(0)
  })

  it('repairs a forced duplicate-id collision, keeping the first occurrence', () => {
    const before = editor.document.map((b) => b.id)
    const targetId = before[0]
    const victimId = before[2]
    expect(victimId).not.toBe(targetId)

    forceCollision(editor, victimId, targetId)

    const after = editor.document.map((b) => b.id)
    expect(after.length).toBe(before.length) // no block lost
    expect(new Set(after).size).toBe(after.length) // all unique → repaired
    expect(after).toContain(targetId) // first occurrence kept
    expect(after[2]).not.toBe(targetId) // the colliding (later) block was reassigned
  })

  it('does not churn IDs on a normal edit (no duplicates → no changes)', () => {
    const before = editor.document.map((b) => b.id)
    // A normal structural edit that introduces no duplicate.
    editor.insertBlocks([{ type: 'paragraph' }], editor.document[2], 'after')
    const after = editor.document.map((b) => b.id)
    // Every pre-existing id is still present and unchanged; only one new id added.
    for (const id of before) expect(after).toContain(id)
    expect(new Set(after).size).toBe(after.length)
    expect(after.length).toBe(before.length + 1)
  })

  it('undo after a repair is safe — never throws and never leaves duplicates', () => {
    const before = editor.document.map((b) => b.id)
    forceCollision(editor, before[2], before[0])
    expect(new Set(editor.document.map((b) => b.id)).size).toBe(editor.document.length)

    expect(() => editor.undo()).not.toThrow()
    const afterUndo = editor.document.map((b) => b.id)
    // The exact undo granularity is editor-internal; the invariant we require is
    // that undo never lands the document in a duplicate-id state.
    expect(new Set(afterUndo).size).toBe(afterUndo.length)
  })
})
