// moveTextNode — phase 8. Mirrors moveCard but for text-node positions.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../textNodes.js', async () => {
  const actual = await vi.importActual('../textNodes.js')
  return {
    ...actual,
    updateTextNode: vi.fn(async () => {}),
  }
})

import { canApplyInverse, applyInverse, applyForward } from './moveTextNode.js'
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

describe('moveTextNode', () => {
  const entry = {
    type: ACTION_TYPES.MOVE_TEXT_NODE,
    campaignId: 'c1',
    textNodeId: 'tn-1',
    before: { x: 10, y: 20 },
    after:  { x: 100, y: 200 },
  }

  it('canApplyInverse passes when the text node still exists', () => {
    expect(canApplyInverse(entry, { nodes: [textNode('tn-1')] }))
      .toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the text node was deleted elsewhere', () => {
    expect(canApplyInverse(entry, { nodes: [] }).ok).toBe(false)
  })

  it('applyInverse persists `before` and updates setNodes optimistically', async () => {
    const setNodes = vi.fn()
    await applyInverse(entry, { setNodes })
    expect(updateTextNode).toHaveBeenCalledWith('tn-1', { positionX: 10, positionY: 20 })
    const updater = setNodes.mock.calls[0][0]
    const result = updater([textNode('tn-1', { editing: false })])
    expect(result[0].position).toEqual({ x: 10, y: 20 })
  })

  it('applyForward persists `after`', async () => {
    await applyForward(entry, {})
    expect(updateTextNode).toHaveBeenCalledWith('tn-1', { positionX: 100, positionY: 200 })
  })
})
