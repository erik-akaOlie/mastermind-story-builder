// Dispatcher tests. Phase 3 wires moveCard end-to-end; the other nine cases
// are still skeleton (canApply* return ok:true, apply* throw notWired).
//
// updateNode is mocked because the real implementation hits Supabase.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./nodes.js', () => ({
  updateNode: vi.fn(async () => {}),
}))

import {
  ACTION_TYPES,
  canApplyInverse,
  canApplyForward,
  applyInverse,
  applyForward,
} from './undoActions'
import { updateNode } from './nodes.js'

const KNOWN = Object.values(ACTION_TYPES)

// Action types that are still phase-2 skeleton (no real validation /
// implementation yet). Phase 3 wired moveCard, so it's no longer in this set.
const UNWIRED = KNOWN.filter((t) => t !== ACTION_TYPES.MOVE_CARD)

beforeEach(() => {
  updateNode.mockClear()
})

describe('undoActions — exports + catalog', () => {
  it('exposes the four dispatcher functions', () => {
    expect(typeof canApplyInverse).toBe('function')
    expect(typeof canApplyForward).toBe('function')
    expect(typeof applyInverse).toBe('function')
    expect(typeof applyForward).toBe('function')
  })

  it('catalogs all ten action types from ADR-0006 §1', () => {
    expect(KNOWN).toEqual(
      expect.arrayContaining([
        'createCard', 'editCardField', 'moveCard', 'deleteCard',
        'addConnection', 'removeConnection',
        'createTextNode', 'editTextNode', 'moveTextNode', 'deleteTextNode',
      ]),
    )
    expect(KNOWN).toHaveLength(10)
  })
})

describe('undoActions — phase-skeleton stubs', () => {
  it('canApplyInverse permissively accepts every still-unwired action type', () => {
    for (const type of UNWIRED) {
      expect(canApplyInverse({ type }, { nodes: [], edges: [] })).toEqual({ ok: true })
    }
  })

  it('canApplyForward permissively accepts every still-unwired action type', () => {
    for (const type of UNWIRED) {
      expect(canApplyForward({ type }, { nodes: [], edges: [] })).toEqual({ ok: true })
    }
  })

  it('applyInverse throws "not wired" for unwired known types (e.g. editCardField)', async () => {
    await expect(applyInverse({ type: ACTION_TYPES.EDIT_CARD_FIELD })).rejects.toThrow(/not wired/i)
  })

  it('applyForward throws "not wired" for unwired known types', async () => {
    await expect(applyForward({ type: ACTION_TYPES.EDIT_CARD_FIELD })).rejects.toThrow(/not wired/i)
  })
})

describe('undoActions — unknown / malformed entries', () => {
  it('canApplyInverse rejects unknown / missing types with a reason', () => {
    expect(canApplyInverse({ type: 'bogus' })).toMatchObject({ ok: false })
    expect(canApplyInverse(null)).toMatchObject({ ok: false })
    expect(canApplyInverse(undefined)).toMatchObject({ ok: false })
  })

  it('canApplyForward rejects unknown / missing types with a reason', () => {
    expect(canApplyForward({ type: 'bogus' })).toMatchObject({ ok: false })
    expect(canApplyForward(null)).toMatchObject({ ok: false })
  })

  it('applyInverse throws "unknown action type" for unknown types', async () => {
    await expect(applyInverse({ type: 'bogus' })).rejects.toThrow(/unknown action type/i)
    await expect(applyInverse(null)).rejects.toThrow(/unknown action type/i)
  })

  it('applyForward throws "unknown action type" for unknown types', async () => {
    await expect(applyForward({ type: 'bogus' })).rejects.toThrow(/unknown action type/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// moveCard — phase 3.
// Entry shape: { type, cards: [{ cardId, before, after }, ...] }. Single
// drag = 1-element array; multi-select drag collapses into one entry with N.
// ─────────────────────────────────────────────────────────────────────────────

const singleMove = {
  type: ACTION_TYPES.MOVE_CARD,
  campaignId: 'c1',
  label: 'Move card',
  timestamp: '2026-04-29T17:00:00.000Z',
  cards: [
    { cardId: 'a', before: { x: 10, y: 20 }, after: { x: 100, y: 200 } },
  ],
}

const multiMove = {
  ...singleMove,
  label: 'Move 2 cards',
  cards: [
    { cardId: 'a', before: { x: 10, y: 20 }, after: { x: 100, y: 200 } },
    { cardId: 'b', before: { x: 50, y: 60 }, after: { x: 150, y: 160 } },
  ],
}

const legacySingleShape = {
  type: ACTION_TYPES.MOVE_CARD,
  campaignId: 'c1',
  label: 'Move card',
  timestamp: '2026-04-29T17:00:00.000Z',
  cardId: 'a',
  before: { x: 10, y: 20 },
  after:  { x: 100, y: 200 },
}

describe('undoActions — moveCard canApplyInverse', () => {
  it('passes when every card in the entry exists in current state', () => {
    expect(canApplyInverse(multiMove, {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'other' }],
    })).toEqual({ ok: true })
  })

  it('refuses when ANY card has been deleted elsewhere', () => {
    const result = canApplyInverse(multiMove, { nodes: [{ id: 'a' }] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer exists?/i)
  })

  it('refuses when nodes is empty / missing', () => {
    expect(canApplyInverse(singleMove, { nodes: [] }).ok).toBe(false)
    expect(canApplyInverse(singleMove, {}).ok).toBe(false)
  })

  it('still validates a stale singular-shape entry (cardId/before/after at top level)', () => {
    expect(canApplyInverse(legacySingleShape, { nodes: [{ id: 'a' }] }).ok).toBe(true)
    expect(canApplyInverse(legacySingleShape, { nodes: [] }).ok).toBe(false)
  })
})

describe('undoActions — moveCard canApplyForward', () => {
  it('passes when every card still exists', () => {
    expect(canApplyForward(multiMove, {
      nodes: [{ id: 'a' }, { id: 'b' }],
    })).toEqual({ ok: true })
  })

  it('refuses when one card is missing', () => {
    expect(canApplyForward(multiMove, { nodes: [{ id: 'a' }] }).ok).toBe(false)
  })
})

describe('undoActions — moveCard applyInverse', () => {
  it('persists the `before` coordinates via updateNode for the lone card', async () => {
    await applyInverse(singleMove, {})
    expect(updateNode).toHaveBeenCalledWith('a', { positionX: 10, positionY: 20 })
    expect(updateNode).toHaveBeenCalledTimes(1)
  })

  it('persists `before` for every card in a multi-card entry (in parallel)', async () => {
    await applyInverse(multiMove, {})
    expect(updateNode).toHaveBeenCalledTimes(2)
    expect(updateNode).toHaveBeenCalledWith('a', { positionX: 10, positionY: 20 })
    expect(updateNode).toHaveBeenCalledWith('b', { positionX: 50, positionY: 60 })
  })

  it('optimistically moves all cards back in a single setNodes call (one render)', async () => {
    const setNodes = vi.fn()
    await applyInverse(multiMove, { setNodes })
    expect(setNodes).toHaveBeenCalledTimes(1)
    const updater = setNodes.mock.calls[0][0]
    const result = updater([
      { id: 'a', position: { x: 100, y: 200 } },
      { id: 'b', position: { x: 150, y: 160 } },
      { id: 'other', position: { x: 999, y: 999 } },
    ])
    expect(result).toEqual([
      { id: 'a', position: { x: 10, y: 20 } },     // moved back
      { id: 'b', position: { x: 50, y: 60 } },     // moved back
      { id: 'other', position: { x: 999, y: 999 } },
    ])
  })

  it('still persists when setNodes is omitted (Realtime echo will catch up)', async () => {
    await applyInverse(multiMove, {})
    expect(updateNode).toHaveBeenCalled()
  })

  it('handles a stale singular-shape entry as a 1-element grouping', async () => {
    await applyInverse(legacySingleShape, {})
    expect(updateNode).toHaveBeenCalledWith('a', { positionX: 10, positionY: 20 })
  })
})

describe('undoActions — moveCard applyForward', () => {
  it('persists `after` for every card in a multi-card entry', async () => {
    await applyForward(multiMove, {})
    expect(updateNode).toHaveBeenCalledWith('a', { positionX: 100, positionY: 200 })
    expect(updateNode).toHaveBeenCalledWith('b', { positionX: 150, positionY: 160 })
  })

  it('optimistically moves every card forward in one setNodes call', async () => {
    const setNodes = vi.fn()
    await applyForward(multiMove, { setNodes })
    const updater = setNodes.mock.calls[0][0]
    expect(updater([
      { id: 'a', position: { x: 10, y: 20 } },
      { id: 'b', position: { x: 50, y: 60 } },
    ])).toEqual([
      { id: 'a', position: { x: 100, y: 200 } },
      { id: 'b', position: { x: 150, y: 160 } },
    ])
  })
})
