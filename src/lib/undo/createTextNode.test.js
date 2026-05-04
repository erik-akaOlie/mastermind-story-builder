// createTextNode — phase 8.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../textNodes.js', async () => {
  const actual = await vi.importActual('../textNodes.js')
  return {
    ...actual,
    createTextNode: vi.fn(async (args) => ({
      id: args.id ?? 'mock-text-uuid',
      type: 'textNode',
      position: { x: args.positionX, y: args.positionY },
      data: {
        text: args.contentHtml ?? '',
        editing: false,
        width: args.width,
        height: args.height ?? null,
        fontSize: args.fontSize,
        align: args.align,
      },
    })),
    deleteTextNode: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './createTextNode.js'
import { ACTION_TYPES } from './index.js'
import { createTextNode, deleteTextNode } from '../textNodes.js'

beforeEach(() => {
  createTextNode.mockClear()
  deleteTextNode.mockClear()
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

describe('createTextNode', () => {
  const entry = {
    type: ACTION_TYPES.CREATE_TEXT_NODE,
    campaignId: 'c1',
    label: 'Add text',
    timestamp: '2026-05-01T00:00:00Z',
    textNodeId: 'tn-1',
    dbRow: tnDbRow(),
  }

  it('canApplyInverse passes when the text node is still in the list', () => {
    expect(canApplyInverse(entry, { nodes: [textNode('tn-1')] }))
      .toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the text node was already removed elsewhere', () => {
    expect(canApplyInverse(entry, { nodes: [] }).ok).toBe(false)
  })

  it('canApplyForward passes when the id is currently absent', () => {
    expect(canApplyForward(entry, { nodes: [textNode('other')] }))
      .toEqual({ ok: true })
  })

  it('canApplyForward refuses when something already holds that id', () => {
    expect(canApplyForward(entry, { nodes: [textNode('tn-1')] }).ok).toBe(false)
  })

  it('applyInverse removes the text node optimistically and persists deleteTextNode', async () => {
    const setNodes = vi.fn()
    await applyInverse(entry, { setNodes })
    expect(deleteTextNode).toHaveBeenCalledWith('tn-1')
    const updater = setNodes.mock.calls[0][0]
    expect(updater([textNode('tn-1'), textNode('other')]))
      .toEqual([textNode('other')])
  })

  it('applyForward recreates via createTextNode using the recorded UUID + dbRow', async () => {
    const setNodes = vi.fn()
    await applyForward(entry, { setNodes })
    expect(createTextNode).toHaveBeenCalledWith({
      id:           'tn-1',
      campaignId:   'c1',
      contentHtml:  '<p>Strahd notes</p>',
      positionX:    100,
      positionY:    200,
      width:        256,
      height:       null,
      fontSize:     18,
      align:        'left',
    })
    // Optimistic append. Idempotent if the realtime echo got there first.
    const updater = setNodes.mock.calls[0][0]
    expect(updater([])).toHaveLength(1)
    expect(updater([textNode('tn-1')])).toEqual([textNode('tn-1')])
  })
})
