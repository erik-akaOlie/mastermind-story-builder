// addListItem — phase 7c. Per-item granularity for the four list-shaped
// fields (storyNotes / hiddenLore / dmNotes / media). Identifies its target
// by stable id (bullets via {id, value}; media via storage path). Position
// is recorded but used only as a hint and a drift check.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    updateNodeSections: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './addListItem.js'
import { ACTION_TYPES } from './index.js'
import { updateNodeSections } from '../nodes.js'

beforeEach(() => {
  updateNodeSections.mockClear()
})

const listEntry = (overrides = {}) => ({
  type: ACTION_TYPES.ADD_LIST_ITEM,
  campaignId: 'c1',
  cardId: 'card-1',
  field: 'storyNotes',
  ...overrides,
})

const cardWithBullets = (storyNotes) => ({
  id: 'card-1',
  data: {
    label: 'Strahd',
    type: 'character',
    summary: '',
    avatar: null,
    storyNotes,
    hiddenLore: [{ id: 'h1', value: 'secret' }],
    dmNotes:    [{ id: 'd1', value: 'note' }],
    media:      [],
  },
})

describe('addListItem — canApply*', () => {
  it('canApplyInverse passes when the item is still in the list (by id)', () => {
    expect(canApplyInverse(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [cardWithBullets([
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
        { id: 'b3', value: 'C' },
      ])] },
    )).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the item id is no longer in the list', () => {
    const result = canApplyInverse(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [cardWithBullets([
        { id: 'b1', value: 'A' },
        { id: 'b3', value: 'C' },
      ])] },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer in this card/i)
  })

  it('canApplyForward passes when the item is currently absent', () => {
    expect(canApplyForward(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [cardWithBullets([{ id: 'b1', value: 'A' }])] },
    )).toEqual({ ok: true })
  })

  it('canApplyForward refuses when the item id is already present', () => {
    expect(canApplyForward(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [cardWithBullets([
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
      ])] },
    ).ok).toBe(false)
  })

  it('refuses entries for unsupported list fields', () => {
    expect(canApplyInverse(
      listEntry({ field: 'label', item: { id: 'x', value: '' } }),
      { nodes: [cardWithBullets([])] },
    ).ok).toBe(false)
  })
})

describe('addListItem — apply*', () => {
  it('applyInverse removes the item by id (not position) and persists merged sections', async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'A' },
      { id: 'b2', value: 'B' },
      { id: 'b3', value: 'C' },
    ])
    await applyInverse(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [card] },
    )
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [{ id: 'b1', value: 'A' }, { id: 'b3', value: 'C' }],
      // Other sections preserved.
      hiddenLore: [{ id: 'h1', value: 'secret' }],
      dmNotes:    [{ id: 'd1', value: 'note' }],
      media:      [],
    }))
  })

  it('applyInverse removes by id even when position has shifted', async () => {
    // Other ops since the original add: 'b2' is now at index 0, not 1.
    const card = cardWithBullets([
      { id: 'b2', value: 'B' },
      { id: 'b1', value: 'A' },
    ])
    await applyInverse(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [card] },
    )
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [{ id: 'b1', value: 'A' }],
    }))
  })

  it('applyForward inserts the item at the recorded position', async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'A' },
      { id: 'b3', value: 'C' },
    ])
    await applyForward(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [card] },
    )
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
        { id: 'b3', value: 'C' },
      ],
    }))
  })

  it('applyForward clamps an out-of-range position to current array length', async () => {
    const card = cardWithBullets([{ id: 'b1', value: 'A' }])
    await applyForward(
      listEntry({ position: 99, item: { id: 'b2', value: 'B' } }),
      { nodes: [card] },
    )
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [{ id: 'b1', value: 'A' }, { id: 'b2', value: 'B' }],
    }))
  })

  it('optimistically updates setNodes with the new array', async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'A' },
      { id: 'b2', value: 'B' },
    ])
    const setNodes = vi.fn()
    await applyInverse(
      listEntry({ position: 1, item: { id: 'b2', value: 'B' } }),
      { nodes: [card], setNodes },
    )
    const updater = setNodes.mock.calls[0][0]
    const result = updater([card, { id: 'other', data: {} }])
    expect(result[0].data.storyNotes).toEqual([{ id: 'b1', value: 'A' }])
    expect(result[1]).toEqual({ id: 'other', data: {} })
  })
})
