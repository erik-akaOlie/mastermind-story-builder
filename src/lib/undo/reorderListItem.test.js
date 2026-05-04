// reorderListItem — phase 7c. Per-item position move on a list-shaped field.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    updateNodeSections: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './reorderListItem.js'
import { ACTION_TYPES } from './index.js'
import { updateNodeSections } from '../nodes.js'

beforeEach(() => {
  updateNodeSections.mockClear()
})

const listEntry = (overrides = {}) => ({
  type: ACTION_TYPES.REORDER_LIST_ITEM,
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

describe('reorderListItem', () => {
  // Erik's scenario #3: reordering must keep IDs attached to values, not positions.
  const reorderEntry = listEntry({
    itemId: 'b1', from: 0, to: 2,
  })

  it('canApplyInverse passes when the item is currently at `to`', () => {
    expect(canApplyInverse(reorderEntry, {
      nodes: [cardWithBullets([
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
        { id: 'b1', value: 'first' },
      ])],
    })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the item moved to a different position elsewhere', () => {
    expect(canApplyInverse(reorderEntry, {
      nodes: [cardWithBullets([
        { id: 'b2', value: 'middle' },
        { id: 'b1', value: 'first' },
        { id: 'b3', value: 'last' },
      ])],
    }).ok).toBe(false)
  })

  it('canApplyForward passes when the item is currently at `from`', () => {
    expect(canApplyForward(reorderEntry, {
      nodes: [cardWithBullets([
        { id: 'b1', value: 'first' },
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
      ])],
    })).toEqual({ ok: true })
  })

  it('applyInverse moves the item back from `to` to `from`, IDs preserved', async () => {
    const card = cardWithBullets([
      { id: 'b2', value: 'middle' },
      { id: 'b3', value: 'last' },
      { id: 'b1', value: 'first' },
    ])
    await applyInverse(reorderEntry, { nodes: [card] })
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [
        { id: 'b1', value: 'first' },
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
      ],
    }))
  })

  it('applyForward moves the item from `from` to `to`', async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'first' },
      { id: 'b2', value: 'middle' },
      { id: 'b3', value: 'last' },
    ])
    await applyForward(reorderEntry, { nodes: [card] })
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
        { id: 'b1', value: 'first' },
      ],
    }))
  })

  it('no-ops on a from===to entry (defensive — should never be recorded)', async () => {
    // BulletSection's drag-end handler is supposed to filter out
    // same-position drops before any recordAction; this guard is the
    // safety net if a malformed entry slips through.
    const card = cardWithBullets([
      { id: 'b1', value: 'first' },
      { id: 'b2', value: 'middle' },
    ])
    await applyForward(
      listEntry({ itemId: 'b1', from: 0, to: 0 }),
      { nodes: [card] },
    )
    expect(updateNodeSections).not.toHaveBeenCalled()
  })
})
