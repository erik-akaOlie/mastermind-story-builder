// removeListItem — phase 7c. Mirror of addListItem.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    updateNodeSections: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './removeListItem.js'
import { ACTION_TYPES } from './index.js'
import { updateNodeSections } from '../nodes.js'

beforeEach(() => {
  updateNodeSections.mockClear()
})

const listEntry = (overrides = {}) => ({
  type: ACTION_TYPES.REMOVE_LIST_ITEM,
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

describe('removeListItem', () => {
  // Erik's scenario: distinguishing duplicate-text bullets by id.
  it('canApplyInverse passes when the recorded id is currently absent (we are about to re-insert)', () => {
    expect(canApplyInverse(
      listEntry({ position: 1, item: { id: 'b-gone', value: 'TODO' } }),
      { nodes: [cardWithBullets([
        { id: 'b1', value: 'TODO' },
        { id: 'b3', value: 'TODO' },
      ])] },
    )).toEqual({ ok: true })
  })

  it("applyInverse re-inserts the recorded item at the recorded position (Erik's duplicate-text scenario)", async () => {
    // Three bullets all with text 'TODO'; we're restoring the middle one.
    const card = cardWithBullets([
      { id: 'b1', value: 'TODO' },
      { id: 'b3', value: 'TODO' },
    ])
    await applyInverse(
      listEntry({ position: 1, item: { id: 'b2', value: 'TODO' } }),
      { nodes: [card] },
    )
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [
        { id: 'b1', value: 'TODO' },
        { id: 'b2', value: 'TODO' },
        { id: 'b3', value: 'TODO' },
      ],
    }))
  })

  // Erik's scenario: deleting the first bullet preserves remaining IDs.
  it('canApplyForward passes when the recorded id is still present (we are about to remove it)', () => {
    expect(canApplyForward(
      listEntry({ position: 0, item: { id: 'b1', value: 'first' } }),
      { nodes: [cardWithBullets([
        { id: 'b1', value: 'first' },
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
      ])] },
    )).toEqual({ ok: true })
  })

  it("applyForward removes the first bullet, leaving the survivors with their original IDs (Erik's scenario #2)", async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'first' },
      { id: 'b2', value: 'middle' },
      { id: 'b3', value: 'last' },
    ])
    await applyForward(
      listEntry({ position: 0, item: { id: 'b1', value: 'first' } }),
      { nodes: [card] },
    )
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      storyNotes: [
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
      ],
    }))
  })
})
