// addConnection — phase 7. Symmetric pair with removeConnection: each side's
// inverse calls the other's lib helper. canApply* on the recreate path
// checks BOTH source and target nodes still exist locally.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../connections.js', () => ({
  createConnection: vi.fn(async ({ id, sourceNodeId, targetNodeId }) => ({
    id, source: sourceNodeId, target: targetNodeId, type: 'floating',
  })),
  deleteConnection: vi.fn(async () => {}),
}))

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './addConnection.js'
import { ACTION_TYPES } from './index.js'
import { createConnection, deleteConnection } from '../connections.js'

beforeEach(() => {
  createConnection.mockClear()
  deleteConnection.mockClear()
})

const connectionEntry = (overrides = {}) => ({
  type: ACTION_TYPES.ADD_CONNECTION,
  campaignId: 'c1',
  label: 'Add connection',
  timestamp: '2026-04-30T17:00:00.000Z',
  connectionId: 'edge-1',
  sourceNodeId: 'card-a',
  targetNodeId: 'card-b',
  ...overrides,
})

describe('addConnection — canApply*', () => {
  it('canApplyInverse passes when the connection is still in edges (about to delete it)', () => {
    expect(canApplyInverse(connectionEntry(), {
      edges: [{ id: 'edge-1', source: 'card-a', target: 'card-b' }],
    })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the connection was already removed elsewhere', () => {
    const result = canApplyInverse(connectionEntry(), { edges: [] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer exists/i)
  })

  it('canApplyForward passes when both endpoints exist and the connection is absent', () => {
    expect(canApplyForward(connectionEntry(), {
      nodes: [{ id: 'card-a' }, { id: 'card-b' }],
      edges: [],
    })).toEqual({ ok: true })
  })

  it('canApplyForward refuses when the connection already exists', () => {
    const result = canApplyForward(connectionEntry(), {
      nodes: [{ id: 'card-a' }, { id: 'card-b' }],
      edges: [{ id: 'edge-1', source: 'card-a', target: 'card-b' }],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already exists/i)
  })

  it('canApplyForward refuses when source node is gone', () => {
    const result = canApplyForward(connectionEntry(), {
      nodes: [{ id: 'card-b' }],
      edges: [],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/source.*no longer exists/i)
  })

  it('canApplyForward refuses when target node is gone', () => {
    const result = canApplyForward(connectionEntry(), {
      nodes: [{ id: 'card-a' }],
      edges: [],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/target.*no longer exists/i)
  })
})

describe('addConnection — apply*', () => {
  it('applyInverse calls deleteConnection and filters the edge optimistically', async () => {
    const setEdges = vi.fn()
    await applyInverse(connectionEntry(), { setEdges })

    expect(deleteConnection).toHaveBeenCalledWith('edge-1')
    const updater = setEdges.mock.calls[0][0]
    expect(updater([
      { id: 'edge-1' }, { id: 'edge-2' },
    ])).toEqual([{ id: 'edge-2' }])
  })

  it('applyForward calls createConnection with the recorded id and appends the edge', async () => {
    const setEdges = vi.fn()
    await applyForward(connectionEntry(), { setEdges })

    expect(createConnection).toHaveBeenCalledWith({
      id: 'edge-1',
      campaignId: 'c1',
      sourceNodeId: 'card-a',
      targetNodeId: 'card-b',
    })
    const updater = setEdges.mock.calls[0][0]
    expect(updater([])).toEqual([
      { id: 'edge-1', source: 'card-a', target: 'card-b', type: 'floating' },
    ])
  })

  it('applyForward is idempotent on a Realtime echo that re-inserted the edge first', async () => {
    const setEdges = vi.fn()
    await applyForward(connectionEntry(), { setEdges })

    const updater = setEdges.mock.calls[0][0]
    const have = [{ id: 'edge-1', source: 'card-a', target: 'card-b' }]
    expect(updater(have)).toBe(have)   // unchanged — no double-insert
  })
})
