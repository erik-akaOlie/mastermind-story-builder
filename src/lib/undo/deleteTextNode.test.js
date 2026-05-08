// deleteTextNode — phase 8.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../textNodes.js', async () => {
  // Pull in the real dbTextNodeToReactFlow so the inverse rebuild
  // exercises the actual marshaler (no Supabase dependency).
  const actual = await vi.importActual('../textNodes.js')
  return {
    ...actual,
    deleteTextNode:  vi.fn(async () => {}),
    restoreTextNode: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './deleteTextNode.js'
import { ACTION_TYPES } from './index.js'
import { deleteTextNode, restoreTextNode } from '../textNodes.js'

beforeEach(() => {
  deleteTextNode.mockClear()
  restoreTextNode.mockClear()
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

const tnDbRow = (overrides = {}) => ({
  id:           'tn-1',
  campaign_id:  'c1',
  content_html: '<p>Strahd notes</p>',
  position_x:   100,
  position_y:   200,
  width:        256,
  height:       null,
  font_size:    18,
  align:        'left',
  ...overrides,
})

describe('deleteTextNode', () => {
  const entry = {
    type: ACTION_TYPES.DELETE_TEXT_NODE,
    campaignId: 'c1',
    label: 'Delete text',
    timestamp: '2026-05-01T00:00:00Z',
    textNodeId: 'tn-1',
    dbRow: tnDbRow(),
  }

  it('canApplyInverse passes when the id is currently absent (about to recreate)', () => {
    expect(canApplyInverse(entry, { nodes: [] })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when something already holds that id', () => {
    expect(canApplyInverse(entry, { nodes: [textNode('tn-1')] }).ok).toBe(false)
  })

  it('canApplyForward passes when the text node is still present', () => {
    expect(canApplyForward(entry, { nodes: [textNode('tn-1')] }))
      .toEqual({ ok: true })
  })

  it('applyInverse persists restoreTextNode with the snapshot intact', async () => {
    await applyInverse(entry, {})
    expect(restoreTextNode).toHaveBeenCalledWith(tnDbRow())
  })

  it('applyInverse optimistically appends a React-shaped text node (idempotent on echo)', async () => {
    const setNodes = vi.fn()
    await applyInverse(entry, { setNodes })
    const updater = setNodes.mock.calls[0][0]
    const result = updater([textNode('other')])
    expect(result).toHaveLength(2)
    const restored = result.find((n) => n.id === 'tn-1')
    expect(restored).toMatchObject({
      id: 'tn-1', type: 'textNode', position: { x: 100, y: 200 },
    })
    expect(restored.data.text).toBe('<p>Strahd notes</p>')
    // No double-insert if Realtime echo got there first.
    expect(updater([textNode('tn-1')])).toEqual([textNode('tn-1')])
  })

  it('applyForward removes optimistically and re-issues deleteTextNode', async () => {
    const setNodes = vi.fn()
    await applyForward(entry, { setNodes })
    expect(deleteTextNode).toHaveBeenCalledWith('tn-1')
    const updater = setNodes.mock.calls[0][0]
    expect(updater([textNode('tn-1'), textNode('other')]))
      .toEqual([textNode('other')])
  })
})
