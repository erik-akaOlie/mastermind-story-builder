// editTextNode — phase 8. Covers all "session edits" inside a text node.
// `before` / `after` carry only the fields that actually changed; canApply*
// compares on those same fields.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../textNodes.js', async () => {
  const actual = await vi.importActual('../textNodes.js')
  return {
    ...actual,
    updateTextNode: vi.fn(async () => {}),
  }
})

import { canApplyInverse, applyInverse, applyForward } from './editTextNode.js'
import { ACTION_TYPES } from './index.js'
import { updateTextNode } from '../textNodes.js'

beforeEach(() => {
  updateTextNode.mockClear()
})

const textNode = (id, overrides = {}) => ({
  id,
  type: 'textNode',
  position: { x: 100, y: 200 },
  data: {
    text:     '<p>Strahd notes</p>',
    width:    256,
    height:   null,
    fontSize: 18,
    align:    'left',
    editing:  false,
    ...overrides,
  },
})

describe('editTextNode', () => {
  const textOnlyEntry = {
    type: ACTION_TYPES.EDIT_TEXT_NODE,
    campaignId: 'c1',
    textNodeId: 'tn-1',
    before: { text: '<p>old</p>' },
    after:  { text: '<p>new</p>' },
  }

  it('canApplyInverse passes when current matches `after` on the recorded fields', () => {
    expect(canApplyInverse(textOnlyEntry, {
      nodes: [textNode('tn-1', { text: '<p>new</p>' })],
    })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the value drifted', () => {
    expect(canApplyInverse(textOnlyEntry, {
      nodes: [textNode('tn-1', { text: '<p>something else</p>' })],
    }).ok).toBe(false)
  })

  it('canApplyInverse only checks recorded fields (other field changes do not block)', () => {
    // Entry recorded only a text edit; the user also resized the node since.
    // canApplyInverse should still pass because `before` only specifies `text`.
    expect(canApplyInverse(textOnlyEntry, {
      nodes: [textNode('tn-1', { text: '<p>new</p>', width: 999 })],
    })).toEqual({ ok: true })
  })

  it('applyInverse persists only `before` fields via updateTextNode', async () => {
    await applyInverse(textOnlyEntry, {})
    expect(updateTextNode).toHaveBeenCalledWith('tn-1', { contentHtml: '<p>old</p>' })
  })

  it('applyForward persists only `after` fields', async () => {
    await applyForward(textOnlyEntry, {})
    expect(updateTextNode).toHaveBeenCalledWith('tn-1', { contentHtml: '<p>new</p>' })
  })

  it('handles a multi-field resize entry (width/height + position shift)', async () => {
    const resizeEntry = {
      type: ACTION_TYPES.EDIT_TEXT_NODE,
      campaignId: 'c1',
      textNodeId: 'tn-1',
      before: { width: 200, height: 80,  positionX: 100, positionY: 200 },
      after:  { width: 320, height: 120, positionX: 80,  positionY: 200 },
    }
    const setNodes = vi.fn()
    await applyInverse(resizeEntry, { setNodes })

    expect(updateTextNode).toHaveBeenCalledWith('tn-1', {
      width: 200, height: 80, positionX: 100, positionY: 200,
    })

    // Optimistic update threads positionX/positionY back into n.position.
    const updater = setNodes.mock.calls[0][0]
    const result = updater([textNode('tn-1', { width: 320, height: 120 })])
    expect(result[0].position).toEqual({ x: 100, y: 200 })
    expect(result[0].data.width).toBe(200)
    expect(result[0].data.height).toBe(80)
  })

  it('refuses when text node id is missing', async () => {
    await expect(applyInverse(
      { ...textOnlyEntry, textNodeId: undefined },
      {},
    )).rejects.toThrow(/missing textNodeId/i)
  })
})
