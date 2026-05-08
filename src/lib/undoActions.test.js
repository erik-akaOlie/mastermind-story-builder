// Dispatcher tests. Phase 3 wired moveCard; phase 4 wires editCardField.
// The remaining cases are still skeleton (canApply* return ok:true, apply*
// throw notWired).
//
// updateNode + updateNodeSections are mocked because the real implementations
// hit Supabase. useTypeStore is the live Zustand store; tests seed it with
// idByKey lookups via setState as needed for the 'type' field path.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./nodes.js', () => ({
  updateNode: vi.fn(async () => {}),
  updateNodeSections: vi.fn(async () => {}),
}))

import {
  ACTION_TYPES,
  canApplyInverse,
  canApplyForward,
  applyInverse,
  applyForward,
  deepEqual,
} from './undoActions'
import { updateNode, updateNodeSections } from './nodes.js'
import { useTypeStore } from '../store/useTypeStore.js'

const KNOWN = Object.values(ACTION_TYPES)

// Action types that are still skeleton (no real validation / implementation
// yet). Phases 3 and 4 wired moveCard and editCardField, so they're not here.
const UNWIRED = KNOWN.filter(
  (t) => t !== ACTION_TYPES.MOVE_CARD && t !== ACTION_TYPES.EDIT_CARD_FIELD,
)

beforeEach(() => {
  updateNode.mockClear()
  updateNodeSections.mockClear()
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

  it('applyInverse throws "not wired" for unwired known types (e.g. createCard)', async () => {
    await expect(applyInverse({ type: ACTION_TYPES.CREATE_CARD })).rejects.toThrow(/not wired/i)
  })

  it('applyForward throws "not wired" for unwired known types', async () => {
    await expect(applyForward({ type: ACTION_TYPES.CREATE_CARD })).rejects.toThrow(/not wired/i)
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

// ─────────────────────────────────────────────────────────────────────────────
// editCardField — phase 4.
// One entry per changed field per modal session. Two field families:
//   NODE_FIELDS    — label, summary, avatar, type → updateNode
//   SECTION_FIELDS — storyNotes, hiddenLore, dmNotes, media → updateNodeSections
// ─────────────────────────────────────────────────────────────────────────────

const editEntry = (overrides = {}) => ({
  type: ACTION_TYPES.EDIT_CARD_FIELD,
  campaignId: 'c1',
  label: 'Edit summary',
  timestamp: '2026-04-30T17:00:00.000Z',
  cardId: 'card-1',
  field: 'summary',
  before: 'old',
  after:  'new',
  ...overrides,
})

const cardWith = (fields = {}) => ({
  id: 'card-1',
  data: {
    label:      'Strahd',
    summary:    'new',
    avatar:     null,
    type:       'character',
    storyNotes: ['beat 1'],
    hiddenLore: [],
    dmNotes:    [],
    media:      [],
    ...fields,
  },
})

describe('undoActions — editCardField canApplyInverse', () => {
  it('passes when current field value deep-equals entry.after', () => {
    expect(canApplyInverse(editEntry(), { nodes: [cardWith({ summary: 'new' })] }))
      .toEqual({ ok: true })
  })

  it('refuses when current field value diverged from entry.after', () => {
    const result = canApplyInverse(editEntry(), {
      nodes: [cardWith({ summary: 'something else' })],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/changed elsewhere/i)
  })

  it('refuses when the card no longer exists', () => {
    const result = canApplyInverse(editEntry(), { nodes: [] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer exists/i)
  })

  it('refuses for an unsupported field name', () => {
    const result = canApplyInverse(
      editEntry({ field: 'bogus', after: 'x' }),
      { nodes: [cardWith()] },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/unsupported field/i)
  })

  it('does deep-equality for array fields (storyNotes)', () => {
    const entry = editEntry({
      field: 'storyNotes',
      before: ['beat 1'],
      after:  ['beat 1', 'beat 2'],
    })
    expect(canApplyInverse(entry, {
      nodes: [cardWith({ storyNotes: ['beat 1', 'beat 2'] })],
    })).toEqual({ ok: true })
    // Different array contents → refuse.
    expect(canApplyInverse(entry, {
      nodes: [cardWith({ storyNotes: ['something else'] })],
    }).ok).toBe(false)
  })
})

describe('undoActions — editCardField canApplyForward', () => {
  it('passes when current field value deep-equals entry.before (mirror of inverse check)', () => {
    expect(canApplyForward(editEntry(), { nodes: [cardWith({ summary: 'old' })] }))
      .toEqual({ ok: true })
  })

  it('refuses when current field value diverged from entry.before', () => {
    expect(canApplyForward(editEntry(), {
      nodes: [cardWith({ summary: 'drifted' })],
    }).ok).toBe(false)
  })
})

describe('undoActions — editCardField applyInverse (NODE_FIELDS)', () => {
  it('summary: persists `before` via updateNode({ summary })', async () => {
    await applyInverse(editEntry(), {})
    expect(updateNode).toHaveBeenCalledWith('card-1', { summary: 'old' })
    expect(updateNodeSections).not.toHaveBeenCalled()
  })

  it('label: persists `before` via updateNode({ label })', async () => {
    await applyInverse(
      editEntry({ field: 'label', before: 'Old Title', after: 'New Title' }),
      {},
    )
    expect(updateNode).toHaveBeenCalledWith('card-1', { label: 'Old Title' })
  })

  it('avatar: maps to `avatarUrl` (the lib API name)', async () => {
    await applyInverse(
      editEntry({ field: 'avatar', before: 'path/old.webp', after: 'path/new.webp' }),
      {},
    )
    expect(updateNode).toHaveBeenCalledWith('card-1', { avatarUrl: 'path/old.webp' })
  })

  it('type: looks up typeId via useTypeStore.idByKey and writes that', async () => {
    useTypeStore.setState({
      types:   { character: {}, location: {} },
      idByKey: { character: 'type-uuid-character', location: 'type-uuid-location' },
    })
    await applyInverse(
      editEntry({ field: 'type', before: 'character', after: 'location' }),
      {},
    )
    expect(updateNode).toHaveBeenCalledWith('card-1', { typeId: 'type-uuid-character' })
  })

  it('type: throws when the key has no idByKey entry', async () => {
    useTypeStore.setState({ types: {}, idByKey: {} })
    await expect(applyInverse(
      editEntry({ field: 'type', before: 'unknown-key', after: 'character' }),
      {},
    )).rejects.toThrow(/no typeId/i)
  })

  it('optimistically rewrites the field on the target card via setNodes', async () => {
    const setNodes = vi.fn()
    await applyInverse(editEntry(), { setNodes })
    const updater = setNodes.mock.calls[0][0]
    const result = updater([
      { id: 'card-1', data: { summary: 'new', label: 'Strahd' } },
      { id: 'other',  data: { summary: 'untouched' } },
    ])
    expect(result[0].data).toEqual({ summary: 'old', label: 'Strahd' })
    expect(result[1].data).toEqual({ summary: 'untouched' })
  })
})

describe('undoActions — editCardField applyInverse (SECTION_FIELDS)', () => {
  it('storyNotes: writes `before` and merges other three sections from current state', async () => {
    const entry = editEntry({
      field: 'storyNotes',
      before: ['beat A'],
      after:  ['beat A', 'beat B'],
    })
    const target = cardWith({
      storyNotes: ['beat A', 'beat B'],
      hiddenLore: ['secret 1'],
      dmNotes:    ['note 1'],
      media:      ['m1'],
    })
    await applyInverse(entry, { nodes: [target] })

    expect(updateNodeSections).toHaveBeenCalledWith('card-1', {
      storyNotes: ['beat A'],          // recorded `before`
      hiddenLore: ['secret 1'],        // current state preserved
      dmNotes:    ['note 1'],          // current state preserved
      media:      ['m1'],              // current state preserved
    })
    expect(updateNode).not.toHaveBeenCalled()
  })

  it('media: handles an array of {path, alt, uploaded_at} objects', async () => {
    const beforeMedia = [{ path: 'p1.webp', alt: '', uploaded_at: 'iso-1' }]
    const afterMedia  = [
      { path: 'p1.webp', alt: '', uploaded_at: 'iso-1' },
      { path: 'p2.webp', alt: '', uploaded_at: 'iso-2' },
    ]
    const entry = editEntry({ field: 'media', before: beforeMedia, after: afterMedia })
    const target = cardWith({ media: afterMedia })
    await applyInverse(entry, { nodes: [target] })

    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      media: beforeMedia,
    }))
  })
})

describe('undoActions — editCardField applyForward', () => {
  it('writes `after` back via updateNode (mirror of inverse on summary)', async () => {
    await applyForward(editEntry(), {})
    expect(updateNode).toHaveBeenCalledWith('card-1', { summary: 'new' })
  })

  it('writes `after` back via updateNodeSections for section fields', async () => {
    const entry = editEntry({
      field: 'dmNotes',
      before: [],
      after:  ['restored note'],
    })
    const target = cardWith({ dmNotes: [] })
    await applyForward(entry, { nodes: [target] })
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      dmNotes: ['restored note'],
    }))
  })
})

describe('undoActions — deepEqual', () => {
  it('compares primitives, arrays, and plain objects structurally', () => {
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false)
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true) // key order
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(deepEqual([{ x: 1 }], [{ x: 1 }])).toBe(true)
    expect(deepEqual([{ x: 1 }], [{ x: 2 }])).toBe(false)
  })
})
