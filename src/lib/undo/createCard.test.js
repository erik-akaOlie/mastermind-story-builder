// createCard — phase 5.
// Entry shape: { type, cardId, dbRow: { typeId, typeKey, label, summary,
// avatarUrl, positionX, positionY }, campaignId, label, timestamp }.
// Inverse = deleteNode(cardId). Forward = createNode({ id: cardId, ... }).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    createNode: vi.fn(async () => ({ id: 'mock-react-node' })),
    deleteNode: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './createCard.js'
import { ACTION_TYPES } from './index.js'
import { createNode, deleteNode } from '../nodes.js'

beforeEach(() => {
  createNode.mockClear()
  deleteNode.mockClear()
})

const createEntry = (overrides = {}) => ({
  type: ACTION_TYPES.CREATE_CARD,
  campaignId: 'c1',
  label: 'Add card',
  timestamp: '2026-04-30T17:00:00.000Z',
  cardId: 'card-new',
  dbRow: {
    typeId:    'type-character-uuid',
    typeKey:   'character',
    label:     '',
    summary:   '',
    avatarUrl: null,
    positionX: 100,
    positionY: 200,
  },
  ...overrides,
})

describe('createCard — canApply*', () => {
  it('canApplyInverse passes when the card still exists (we are about to delete it)', () => {
    expect(canApplyInverse(createEntry(), { nodes: [{ id: 'card-new' }] }))
      .toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the card was already deleted elsewhere', () => {
    const result = canApplyInverse(createEntry(), { nodes: [] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer exists/i)
  })

  it('canApplyForward passes when nothing currently holds the recorded id', () => {
    expect(canApplyForward(createEntry(), { nodes: [{ id: 'someone-else' }] }))
      .toEqual({ ok: true })
  })

  it('canApplyForward refuses when something already holds that id', () => {
    const result = canApplyForward(createEntry(), { nodes: [{ id: 'card-new' }] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already exists/i)
  })
})

describe('createCard — applyInverse', () => {
  it('removes the card from local state and persists the delete', async () => {
    const setNodes = vi.fn()
    const setEdges = vi.fn()
    await applyInverse(createEntry(), { setNodes, setEdges })

    // Optimistic filter: card-new dropped, others kept.
    const nodeUpdater = setNodes.mock.calls[0][0]
    expect(nodeUpdater([
      { id: 'card-new' }, { id: 'other' },
    ])).toEqual([{ id: 'other' }])

    // Edges touching the removed card are dropped too.
    const edgeUpdater = setEdges.mock.calls[0][0]
    expect(edgeUpdater([
      { id: 'e1', source: 'card-new', target: 'other' },
      { id: 'e2', source: 'a', target: 'b' },
    ])).toEqual([{ id: 'e2', source: 'a', target: 'b' }])

    expect(deleteNode).toHaveBeenCalledWith('card-new')
  })
})

describe('createCard — applyForward', () => {
  it('recreates the card via createNode using the recorded UUID + dbRow', async () => {
    createNode.mockResolvedValueOnce({ id: 'card-new', position: { x: 100, y: 200 }, data: {} })
    const setNodes = vi.fn()
    await applyForward(createEntry(), { setNodes })

    expect(createNode).toHaveBeenCalledWith({
      id:         'card-new',
      campaignId: 'c1',
      typeId:     'type-character-uuid',
      typeKey:    'character',
      label:      '',
      summary:    '',
      avatarUrl:  null,
      positionX:  100,
      positionY:  200,
    })

    // Appended to local state, but only if not already present.
    const updater = setNodes.mock.calls[0][0]
    expect(updater([{ id: 'other' }])).toHaveLength(2)
    expect(updater([{ id: 'card-new' }])).toEqual([{ id: 'card-new' }])
  })
})
