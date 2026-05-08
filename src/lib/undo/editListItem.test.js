// editListItem — phase 7c. Per-item value edit on a list-shaped field.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    updateNodeSections: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './editListItem.js'
import { ACTION_TYPES } from './index.js'
import { updateNodeSections } from '../nodes.js'

beforeEach(() => {
  updateNodeSections.mockClear()
})

const listEntry = (overrides = {}) => ({
  type: ACTION_TYPES.EDIT_LIST_ITEM,
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

describe('editListItem', () => {
  const editEntry = listEntry({
    itemId: 'b2', before: 'B', after: 'B edited',
  })

  it('canApplyInverse passes when the item exists and currently holds `after`', () => {
    expect(canApplyInverse(editEntry, {
      nodes: [cardWithBullets([
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B edited' },
      ])],
    })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the value drifted', () => {
    expect(canApplyInverse(editEntry, {
      nodes: [cardWithBullets([
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'something else' },
      ])],
    }).ok).toBe(false)
  })

  it('canApplyInverse refuses when the item id no longer exists', () => {
    expect(canApplyInverse(editEntry, {
      nodes: [cardWithBullets([{ id: 'b1', value: 'A' }])],
    }).ok).toBe(false)
  })

  it('applyInverse sets the targeted bullet (by id) to `before`, preserving the id', async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'A' },
      { id: 'b2', value: 'B edited' },
    ])
    await applyInverse(editEntry, { nodes: [card] })
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
      ],
    }))
  })

  it('applyForward sets the targeted bullet to `after`', async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'A' },
      { id: 'b2', value: 'B' },
    ])
    await applyForward(editEntry, { nodes: [card] })
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B edited' },
      ],
    }))
  })

  it('rejects edits to media (no value field on storage entries)', async () => {
    await expect(applyInverse(
      listEntry({ field: 'media', itemId: 'm1', before: 'a', after: 'b' }),
      { nodes: [cardWithBullets([])] },
    )).rejects.toThrow(/not supported for media/i)
  })
})
