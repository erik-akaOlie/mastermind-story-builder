// Dispatcher tests. Phase 3 wired moveCard; phase 4 wired editCardField;
// phase 5 wires createCard + deleteCard. Remaining cases are skeleton
// (canApply* return ok:true, apply* throw notWired).
//
// All Supabase-touching helpers are mocked. useTypeStore is the live Zustand
// store; tests seed it with idByKey lookups via setState as needed for the
// 'type' field path and the deleteCard React-shape rebuild.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./nodes.js', async () => {
  // Pull in the real dbNodeToReactFlow so the deleteCard inverse rebuild
  // exercises the real DB→React marshaling (it's a pure function with no
  // Supabase dependency).
  const actual = await vi.importActual('./nodes.js')
  return {
    ...actual,
    createNode:                 vi.fn(async () => ({ id: 'mock-react-node' })),
    deleteNode:                 vi.fn(async () => {}),
    updateNode:                 vi.fn(async () => {}),
    updateNodeSections:         vi.fn(async () => {}),
    restoreCardWithDependents:  vi.fn(async () => {}),
  }
})

vi.mock('./connections.js', () => ({
  createConnection: vi.fn(async ({ id, sourceNodeId, targetNodeId }) => ({
    id, source: sourceNodeId, target: targetNodeId, type: 'floating',
  })),
  deleteConnection: vi.fn(async () => {}),
}))

import {
  ACTION_TYPES,
  canApplyInverse,
  canApplyForward,
  applyInverse,
  applyForward,
  deepEqual,
} from './undoActions'
import {
  createNode,
  deleteNode,
  updateNode,
  updateNodeSections,
  restoreCardWithDependents,
} from './nodes.js'
import { createConnection, deleteConnection } from './connections.js'
import { useTypeStore } from '../store/useTypeStore.js'

const KNOWN = Object.values(ACTION_TYPES)

// Action types still skeleton (no real validation / implementation).
// Phases 3-7 wired everything except the four text-node ops (phase 8).
const TEXT_NODE_TYPES = new Set([
  ACTION_TYPES.CREATE_TEXT_NODE,
  ACTION_TYPES.EDIT_TEXT_NODE,
  ACTION_TYPES.MOVE_TEXT_NODE,
  ACTION_TYPES.DELETE_TEXT_NODE,
])
const UNWIRED = KNOWN.filter((t) => TEXT_NODE_TYPES.has(t))

beforeEach(() => {
  createNode.mockClear()
  deleteNode.mockClear()
  updateNode.mockClear()
  updateNodeSections.mockClear()
  restoreCardWithDependents.mockClear()
  createConnection.mockClear()
  deleteConnection.mockClear()
})

describe('undoActions — exports + catalog', () => {
  it('exposes the four dispatcher functions', () => {
    expect(typeof canApplyInverse).toBe('function')
    expect(typeof canApplyForward).toBe('function')
    expect(typeof applyInverse).toBe('function')
    expect(typeof applyForward).toBe('function')
  })

  it('catalogs the ten action types from ADR-0006 §1 plus phase-7c list-item four', () => {
    expect(KNOWN).toEqual(
      expect.arrayContaining([
        // ADR §1 baseline ten
        'createCard', 'editCardField', 'moveCard', 'deleteCard',
        'addConnection', 'removeConnection',
        'createTextNode', 'editTextNode', 'moveTextNode', 'deleteTextNode',
        // Phase 7c additions: list-item granularity for storyNotes /
        // hiddenLore / dmNotes / media so an undo can never silently
        // bundle multiple bullets together.
        'addListItem', 'removeListItem', 'editListItem', 'reorderListItem',
      ]),
    )
    expect(KNOWN).toHaveLength(14)
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

  it('applyInverse throws "not wired" for unwired known types (e.g. createTextNode)', async () => {
    await expect(applyInverse({ type: ACTION_TYPES.CREATE_TEXT_NODE })).rejects.toThrow(/not wired/i)
  })

  it('applyForward throws "not wired" for unwired known types', async () => {
    await expect(applyForward({ type: ACTION_TYPES.CREATE_TEXT_NODE })).rejects.toThrow(/not wired/i)
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

// ─────────────────────────────────────────────────────────────────────────────
// createCard — phase 5.
// Entry shape: { type, cardId, dbRow: { typeId, typeKey, label, summary,
// avatarUrl, positionX, positionY }, campaignId, label, timestamp }.
// Inverse = deleteNode(cardId). Forward = createNode({ id: cardId, ... }).
// ─────────────────────────────────────────────────────────────────────────────

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

describe('undoActions — createCard canApply*', () => {
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

describe('undoActions — createCard applyInverse', () => {
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

describe('undoActions — createCard applyForward', () => {
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

// ─────────────────────────────────────────────────────────────────────────────
// deleteCard — phase 5 (the hard one).
// Entry carries the full DB-shape snapshot of the card + sections + edges
// captured before deletion. Inverse rebuilds React state from snapshot then
// calls restoreCardWithDependents. Forward = deleteNode + optimistic filter.
// ─────────────────────────────────────────────────────────────────────────────

const dbCardRow = {
  id:          'card-doomed',
  campaign_id: 'c1',
  type_id:     'type-character-uuid',
  label:       'Strahd',
  summary:     'Vampire lord',
  avatar_url:  'avatars/strahd.webp',
  position_x:  300,
  position_y:  400,
}
const dbSectionRows = [
  { node_id: 'card-doomed', kind: 'narrative',   content: ['born ~1346'], sort_order: 0 },
  { node_id: 'card-doomed', kind: 'hidden_lore', content: ['truly believes'], sort_order: 1 },
  { node_id: 'card-doomed', kind: 'dm_notes',    content: ['voice: slow'], sort_order: 2 },
  { node_id: 'card-doomed', kind: 'media',       content: [], sort_order: 3 },
]
const dbConnectionRows = [
  { id: 'edge-1', campaign_id: 'c1', source_node_id: 'card-doomed', target_node_id: 'ireena' },
]
const deleteEntry = (overrides = {}) => ({
  type: ACTION_TYPES.DELETE_CARD,
  campaignId: 'c1',
  label: 'Delete "Strahd"',
  timestamp: '2026-04-30T17:00:00.000Z',
  dbCardRow,
  dbSectionRows,
  dbConnectionRows,
  ...overrides,
})

describe('undoActions — deleteCard canApply*', () => {
  it('canApplyInverse passes when the card id is currently absent (about to recreate)', () => {
    expect(canApplyInverse(deleteEntry(), { nodes: [{ id: 'other' }] }))
      .toEqual({ ok: true })
  })

  it('canApplyInverse refuses if something already holds that id', () => {
    const result = canApplyInverse(deleteEntry(), { nodes: [{ id: 'card-doomed' }] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already exists/i)
  })

  it('canApplyForward passes when the card still exists (about to delete again)', () => {
    expect(canApplyForward(deleteEntry(), { nodes: [{ id: 'card-doomed' }] }))
      .toEqual({ ok: true })
  })

  it('canApplyForward refuses when the card has already been removed elsewhere', () => {
    expect(canApplyForward(deleteEntry(), { nodes: [] }).ok).toBe(false)
  })
})

describe('undoActions — deleteCard applyInverse (the hard one)', () => {
  beforeEach(() => {
    // Seed the type lookup so dbNodeToReactFlow can resolve type_id → key
    // for the optimistic React-shape rebuild.
    useTypeStore.setState({
      types:   { character: { label: 'Character', color: '#0EA5E9' } },
      idByKey: { character: 'type-character-uuid' },
    })
  })

  it('persists the restore via restoreCardWithDependents with the snapshot intact', async () => {
    await applyInverse(deleteEntry(), {})
    expect(restoreCardWithDependents).toHaveBeenCalledWith({
      dbCardRow,
      dbSectionRows,
      dbConnectionRows,
    })
  })

  it('optimistically appends a React-shaped card to setNodes (with sections marshaled)', async () => {
    const setNodes = vi.fn()
    await applyInverse(deleteEntry(), { setNodes })

    const updater = setNodes.mock.calls[0][0]
    const result = updater([{ id: 'unrelated' }])
    expect(result).toHaveLength(2)

    const restored = result.find((n) => n.id === 'card-doomed')
    expect(restored).toBeTruthy()
    expect(restored.position).toEqual({ x: 300, y: 400 })
    expect(restored.data.label).toBe('Strahd')
    expect(restored.data.type).toBe('character')
    // Phase 7b: bullets restored as structured `{id, value}[]` because
    // dbNodeToReactFlow normalizes the legacy string[] in dbSectionRows
    // on the way back into React state.
    expect(restored.data.storyNotes.map((b) => b.value)).toEqual(['born ~1346'])
    expect(restored.data.hiddenLore.map((b) => b.value)).toEqual(['truly believes'])
    expect(restored.data.dmNotes.map((b) => b.value)).toEqual(['voice: slow'])
  })

  it('optimistically restores connection edges via setEdges (idempotent on duplicates)', async () => {
    const setEdges = vi.fn()
    await applyInverse(deleteEntry(), { setEdges })

    const updater = setEdges.mock.calls[0][0]
    expect(updater([{ id: 'unrelated' }])).toEqual([
      { id: 'unrelated' },
      { id: 'edge-1', source: 'card-doomed', target: 'ireena', type: 'floating' },
    ])

    // If the edge id is already present (Realtime echo), the updater no-ops.
    const have = [{ id: 'edge-1', source: 'card-doomed', target: 'ireena' }]
    expect(updater(have)).toBe(have)
  })

  it('does not append the node when an entry with the same id is already in state', async () => {
    const setNodes = vi.fn()
    await applyInverse(deleteEntry(), { setNodes })
    const updater = setNodes.mock.calls[0][0]
    const have = [{ id: 'card-doomed' }]
    expect(updater(have)).toBe(have)
  })
})

describe('undoActions — deleteCard applyForward', () => {
  it('removes the card optimistically and re-issues the delete', async () => {
    const setNodes = vi.fn()
    const setEdges = vi.fn()
    await applyForward(deleteEntry(), { setNodes, setEdges })

    const nodeUpdater = setNodes.mock.calls[0][0]
    expect(nodeUpdater([
      { id: 'card-doomed' }, { id: 'other' },
    ])).toEqual([{ id: 'other' }])

    const edgeUpdater = setEdges.mock.calls[0][0]
    expect(edgeUpdater([
      { id: 'e1', source: 'card-doomed', target: 'ireena' },
      { id: 'e2', source: 'a', target: 'b' },
    ])).toEqual([{ id: 'e2', source: 'a', target: 'b' }])

    expect(deleteNode).toHaveBeenCalledWith('card-doomed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// addConnection / removeConnection — phase 7. Symmetric pair: each side's
// inverse calls the other's lib helper. canApply* on the recreate path
// checks BOTH source and target nodes still exist locally.
// ─────────────────────────────────────────────────────────────────────────────

const connectionEntry = (type, overrides = {}) => ({
  type,
  campaignId: 'c1',
  label: type === ACTION_TYPES.ADD_CONNECTION ? 'Add connection' : 'Remove connection',
  timestamp: '2026-04-30T17:00:00.000Z',
  connectionId: 'edge-1',
  sourceNodeId: 'card-a',
  targetNodeId: 'card-b',
  ...overrides,
})

describe('undoActions — addConnection canApply*', () => {
  it('canApplyInverse passes when the connection is still in edges (about to delete it)', () => {
    expect(canApplyInverse(connectionEntry(ACTION_TYPES.ADD_CONNECTION), {
      edges: [{ id: 'edge-1', source: 'card-a', target: 'card-b' }],
    })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the connection was already removed elsewhere', () => {
    const result = canApplyInverse(connectionEntry(ACTION_TYPES.ADD_CONNECTION), { edges: [] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer exists/i)
  })

  it('canApplyForward passes when both endpoints exist and the connection is absent', () => {
    expect(canApplyForward(connectionEntry(ACTION_TYPES.ADD_CONNECTION), {
      nodes: [{ id: 'card-a' }, { id: 'card-b' }],
      edges: [],
    })).toEqual({ ok: true })
  })

  it('canApplyForward refuses when the connection already exists', () => {
    const result = canApplyForward(connectionEntry(ACTION_TYPES.ADD_CONNECTION), {
      nodes: [{ id: 'card-a' }, { id: 'card-b' }],
      edges: [{ id: 'edge-1', source: 'card-a', target: 'card-b' }],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already exists/i)
  })

  it('canApplyForward refuses when source node is gone', () => {
    const result = canApplyForward(connectionEntry(ACTION_TYPES.ADD_CONNECTION), {
      nodes: [{ id: 'card-b' }],
      edges: [],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/source.*no longer exists/i)
  })

  it('canApplyForward refuses when target node is gone', () => {
    const result = canApplyForward(connectionEntry(ACTION_TYPES.ADD_CONNECTION), {
      nodes: [{ id: 'card-a' }],
      edges: [],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/target.*no longer exists/i)
  })
})

describe('undoActions — addConnection apply*', () => {
  it('applyInverse calls deleteConnection and filters the edge optimistically', async () => {
    const setEdges = vi.fn()
    await applyInverse(connectionEntry(ACTION_TYPES.ADD_CONNECTION), { setEdges })

    expect(deleteConnection).toHaveBeenCalledWith('edge-1')
    const updater = setEdges.mock.calls[0][0]
    expect(updater([
      { id: 'edge-1' }, { id: 'edge-2' },
    ])).toEqual([{ id: 'edge-2' }])
  })

  it('applyForward calls createConnection with the recorded id and appends the edge', async () => {
    const setEdges = vi.fn()
    await applyForward(connectionEntry(ACTION_TYPES.ADD_CONNECTION), { setEdges })

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
    await applyForward(connectionEntry(ACTION_TYPES.ADD_CONNECTION), { setEdges })

    const updater = setEdges.mock.calls[0][0]
    const have = [{ id: 'edge-1', source: 'card-a', target: 'card-b' }]
    expect(updater(have)).toBe(have)   // unchanged — no double-insert
  })
})

describe('undoActions — removeConnection canApply* (mirror of addConnection)', () => {
  it('canApplyInverse passes when both endpoints exist and the connection is absent', () => {
    expect(canApplyInverse(connectionEntry(ACTION_TYPES.REMOVE_CONNECTION), {
      nodes: [{ id: 'card-a' }, { id: 'card-b' }],
      edges: [],
    })).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when source has been deleted (FK would fail)', () => {
    const result = canApplyInverse(connectionEntry(ACTION_TYPES.REMOVE_CONNECTION), {
      nodes: [{ id: 'card-b' }],
      edges: [],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/source/i)
  })

  it('canApplyForward passes when the connection still exists', () => {
    expect(canApplyForward(connectionEntry(ACTION_TYPES.REMOVE_CONNECTION), {
      edges: [{ id: 'edge-1' }],
    })).toEqual({ ok: true })
  })

  it('canApplyForward refuses when the connection has already been removed', () => {
    expect(canApplyForward(connectionEntry(ACTION_TYPES.REMOVE_CONNECTION), {
      edges: [],
    }).ok).toBe(false)
  })
})

describe('undoActions — removeConnection apply*', () => {
  it('applyInverse calls createConnection at the original id', async () => {
    await applyInverse(connectionEntry(ACTION_TYPES.REMOVE_CONNECTION), {})
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
    await applyForward(connectionEntry(ACTION_TYPES.REMOVE_CONNECTION), { setEdges })
    expect(deleteConnection).toHaveBeenCalledWith('edge-1')
    expect(createConnection).not.toHaveBeenCalled()

    // And filters the edge from local state.
    const updater = setEdges.mock.calls[0][0]
    expect(updater([{ id: 'edge-1' }, { id: 'other' }])).toEqual([{ id: 'other' }])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// List-item ops — phase 7c. Per-item granularity for the four list-shaped
// fields (storyNotes / hiddenLore / dmNotes / media). Each entry identifies
// its target by stable id (bullets via {id, value}; media via storage path).
// Position is recorded but used only as a hint and a drift check.
// ─────────────────────────────────────────────────────────────────────────────

const listEntry = (type, overrides = {}) => ({
  type,
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

describe('undoActions — addListItem canApply*', () => {
  it('canApplyInverse passes when the item is still in the list (by id)', () => {
    expect(canApplyInverse(
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
      { nodes: [cardWithBullets([
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
        { id: 'b3', value: 'C' },
      ])] },
    )).toEqual({ ok: true })
  })

  it('canApplyInverse refuses when the item id is no longer in the list', () => {
    const result = canApplyInverse(
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
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
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
      { nodes: [cardWithBullets([{ id: 'b1', value: 'A' }])] },
    )).toEqual({ ok: true })
  })

  it('canApplyForward refuses when the item id is already present', () => {
    expect(canApplyForward(
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
      { nodes: [cardWithBullets([
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
      ])] },
    ).ok).toBe(false)
  })

  it('refuses entries for unsupported list fields', () => {
    expect(canApplyInverse(
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        field: 'label',
        item: { id: 'x', value: '' },
      }),
      { nodes: [cardWithBullets([])] },
    ).ok).toBe(false)
  })
})

describe('undoActions — addListItem apply*', () => {
  it('applyInverse removes the item by id (not position) and persists merged sections', async () => {
    const card = cardWithBullets([
      { id: 'b1', value: 'A' },
      { id: 'b2', value: 'B' },
      { id: 'b3', value: 'C' },
    ])
    await applyInverse(
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
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
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
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
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
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
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 99, item: { id: 'b2', value: 'B' },
      }),
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
      listEntry(ACTION_TYPES.ADD_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'B' },
      }),
      { nodes: [card], setNodes },
    )
    const updater = setNodes.mock.calls[0][0]
    const result = updater([card, { id: 'other', data: {} }])
    expect(result[0].data.storyNotes).toEqual([{ id: 'b1', value: 'A' }])
    expect(result[1]).toEqual({ id: 'other', data: {} })
  })
})

describe('undoActions — removeListItem', () => {
  // Erik's scenario: distinguishing duplicate-text bullets by id.
  it('canApplyInverse passes when the recorded id is currently absent (we are about to re-insert)', () => {
    expect(canApplyInverse(
      listEntry(ACTION_TYPES.REMOVE_LIST_ITEM, {
        position: 1, item: { id: 'b-gone', value: 'TODO' },
      }),
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
      listEntry(ACTION_TYPES.REMOVE_LIST_ITEM, {
        position: 1, item: { id: 'b2', value: 'TODO' },
      }),
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
      listEntry(ACTION_TYPES.REMOVE_LIST_ITEM, {
        position: 0, item: { id: 'b1', value: 'first' },
      }),
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
      listEntry(ACTION_TYPES.REMOVE_LIST_ITEM, {
        position: 0, item: { id: 'b1', value: 'first' },
      }),
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

describe('undoActions — editListItem', () => {
  const editEntry = listEntry(ACTION_TYPES.EDIT_LIST_ITEM, {
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
      listEntry(ACTION_TYPES.EDIT_LIST_ITEM, {
        field: 'media', itemId: 'm1', before: 'a', after: 'b',
      }),
      { nodes: [cardWithBullets([])] },
    )).rejects.toThrow(/not supported for media/i)
  })
})

describe('undoActions — reorderListItem', () => {
  // Erik's scenario #3: reordering must keep IDs attached to values, not positions.
  const reorderEntry = listEntry(ACTION_TYPES.REORDER_LIST_ITEM, {
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
      listEntry(ACTION_TYPES.REORDER_LIST_ITEM, {
        itemId: 'b1', from: 0, to: 0,
      }),
      { nodes: [card] },
    )
    expect(updateNodeSections).not.toHaveBeenCalled()
  })
})
