// removeConnection — phase 7. Mirror of addConnection.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../connections.js', () => ({
  createConnection: vi.fn(async ({ id, sourceNodeId, targetNodeId }) => ({
    id, source: sourceNodeId, target: targetNodeId, type: 'floating',
  })),
  deleteConnection: vi.fn(async () => {}),
}))

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './removeConnection.js'
import { ACTION_TYPES } from './index.js'
import { createConnection, deleteConnection } from '../connections.js'

beforeEach(() => {
  createConnection.mockClear()
  deleteConnection.mockClear()
})

const connectionEntry = (overrides = {}) => ({
  type: ACTION_TYPES.REMOVE_CONNECTION,
  campaignId: 'c1',
  label: 'Remove connection',
  timestamp: '2026-04-30T17:00:00.000Z',
  connectionId: 'edge-1',
  sourceNodeId: 'card-a',
  targetNodeId: 'card-b',
  ...overrides,
})

describe('removeConnection — canApply* (mirror of addConnection)', () => {
  it('canApplyInverse passes when both endpoints exist and the connection is absent', () => {
    expect(canApplyInverse(connectionEntry(), {
      nodes: [{ id: 'card-a' }, { id: 'card-b' }],
      edges: [],
    })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when source has been deleted (FK would fail)', () => {
    const result = canApplyInverse(connectionEntry(), {
      nodes: [{ id: 'card-b' }],
      edges: [],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/source/i)
  })

  it('canApplyForward passes when the connection still exists', () => {
    expect(canApplyForward(connectionEntry(), {
      edges: [{ id: 'edge-1' }],
    })).toEqual({ ok: true })
  })

  it('canApplyForward refuses when the connection has already been removed', () => {
    expect(canApplyForward(connectionEntry(), {
      edges: [],
    }).ok).toBe(false)
  })
})

describe('removeConnection — apply*', () => {
  it('applyInverse calls createConnection at the original id', async () => {
    await applyInverse(connectionEntry(), {})
    expect(createConnection).toHaveBeenCalledWith({
      id: 'edge-1',
      campaignId: 'c1',
      sourceNodeId: 'card-a',
      targetNodeId: 'card-b',
    })
    expect(deleteConnection).not.toHaveBeenCalled()
  })

  it('applyForward calls deleteConnection (mirror of addConnection inverse)', async () => {
    const setEdges = vi.fn()
    await applyForward(connectionEntry(), { setEdges })
    expect(deleteConnection).toHaveBeenCalledWith('edge-1')
    expect(createConnection).not.toHaveBeenCalled()

    // And filters the edge from local state.
    const updater = setEdges.mock.calls[0][0]
    expect(updater([{ id: 'edge-1' }, { id: 'other' }])).toEqual([{ id: 'other' }])
  })
})
