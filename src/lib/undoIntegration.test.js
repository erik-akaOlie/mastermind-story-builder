// ============================================================================
// Integration tests for the undo / redo system (ADR-0006 §11)
// ----------------------------------------------------------------------------
// These tests run the REAL dispatcher (canApply* / apply*) against MOCKED
// lib/*.js calls that mutate an in-memory mockDb. Together with React state
// holders (nodes / edges / setNodes / setEdges), this lets each test assert
// the round-trip property:
//
//   pre-action state === post-(action + inverse) state
//
// Why an integration test on top of unit tests in undoActions.test.js +
// useUndoStore.test.js: the unit tests verify each layer independently with
// the layer below mocked. They can't catch missing-dependent failures —
// e.g. if a future feature adds a new field to nodes' data and
// buildDeleteCardSnapshot doesn't capture it, the unit tests still pass
// because they only assert on what they're told to look at. This file's
// "delete + undo restores everything" test compares the WHOLE React shape
// before/after, so a missing field fails loudly.
//
// Also covers the chained-operation regression for the bug found during
// phase-5 manual smoke: create → edit → delete → undo×3 → redo×3 must
// replay the exact same field values, in order. (Earlier, EditModal's
// persist-time `'' → 'Untitled'` fold corrupted the chain so redo-edit
// silently no-op'd.)
//
// Cap-at-75, sessionStorage hydration, sign-out cleanup, and stack
// semantics are NOT re-tested here — useUndoStore.test.js owns those.
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── In-memory mock DB ─────────────────────────────────────────────────────
// Mirrors the three Postgres tables the undo system reads from / writes to.
// Every mocked lib/*.js call below mutates this; tests assert on its shape.

const mockDb = {
  nodes:         new Map(),  // id → DB-shape row
  node_sections: new Map(),  // node_id → { narrative, hidden_lore, dm_notes, media }
  connections:   new Map(),  // id → DB-shape row
}

// ── lib/nodes.js mocks (stateful) ─────────────────────────────────────────
// importActual brings in the real dbNodeToReactFlow + buildDeleteCardSnapshot
// (pure functions with no Supabase dependency); the persistence functions
// below intercept all writes.

vi.mock('./nodes.js', async () => {
  const actual = await vi.importActual('./nodes.js')
  return {
    ...actual,

    createNode: vi.fn(async (args) => {
      const {
        id, campaignId, typeId, typeKey,
        label = '', summary = '', avatarUrl = null,
        positionX = 0, positionY = 0,
        storyNotes = [], hiddenLore = [], dmNotes = [], media = [],
      } = args
      const newId = id || `mock-uuid-${Math.random().toString(36).slice(2)}`
      const row = {
        id:           newId,
        campaign_id:  campaignId,
        type_id:      typeId,
        label, summary,
        avatar_url:   avatarUrl,
        position_x:   positionX,
        position_y:   positionY,
      }
      mockDb.nodes.set(newId, row)
      mockDb.node_sections.set(newId, {
        narrative: storyNotes, hidden_lore: hiddenLore, dm_notes: dmNotes, media,
      })
      return actual.dbNodeToReactFlow(
        row,
        mockDb.node_sections.get(newId),
        { [typeId]: { key: typeKey } },
      )
    }),

    deleteNode: vi.fn(async (id) => {
      mockDb.nodes.delete(id)
      mockDb.node_sections.delete(id)
      // Postgres cascades — connections touching the deleted node go too.
      for (const [edgeId, edge] of mockDb.connections) {
        if (edge.source_node_id === id || edge.target_node_id === id) {
          mockDb.connections.delete(edgeId)
        }
      }
    }),

    updateNode: vi.fn(async (id, patch) => {
      const row = mockDb.nodes.get(id)
      if (!row) return
      if (patch.label     !== undefined) row.label      = patch.label
      if (patch.summary   !== undefined) row.summary    = patch.summary
      if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl
      if (patch.positionX !== undefined) row.position_x = patch.positionX
      if (patch.positionY !== undefined) row.position_y = patch.positionY
      if (patch.typeId    !== undefined) row.type_id    = patch.typeId
    }),

    updateNodeSections: vi.fn(async (nodeId, { storyNotes, hiddenLore, dmNotes, media }) => {
      mockDb.node_sections.set(nodeId, {
        narrative: storyNotes, hidden_lore: hiddenLore, dm_notes: dmNotes, media,
      })
    }),

    restoreCardWithDependents: vi.fn(async ({ dbCardRow, dbSectionRows = [], dbConnectionRows = [] }) => {
      mockDb.nodes.set(dbCardRow.id, { ...dbCardRow })
      const sections = { narrative: [], hidden_lore: [], dm_notes: [], media: [] }
      for (const s of dbSectionRows) sections[s.kind] = s.content
      mockDb.node_sections.set(dbCardRow.id, sections)
      for (const c of dbConnectionRows) {
        mockDb.connections.set(c.id, { ...c })
      }
    }),
  }
})

vi.mock('./connections.js', () => ({
  createConnection: vi.fn(async ({ id, campaignId, sourceNodeId, targetNodeId }) => {
    const newId = id || `mock-edge-${Math.random().toString(36).slice(2)}`
    const row = {
      id:             newId,
      campaign_id:    campaignId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
    }
    mockDb.connections.set(newId, row)
    return { id: newId, source: sourceNodeId, target: targetNodeId, type: 'floating' }
  }),
  deleteConnection: vi.fn(async (id) => {
    mockDb.connections.delete(id)
  }),
}))

// ── REAL imports (post-mock) ──────────────────────────────────────────────
// The dispatcher under test, plus marshaling helpers, plus the live store.

import {
  ACTION_TYPES,
  applyInverse,
  applyForward,
} from './undoActions.js'
import {
  dbNodeToReactFlow,
  buildDeleteCardSnapshot,
} from './nodes.js'
import { useTypeStore } from '../store/useTypeStore.js'
import { useUndoStore } from '../store/useUndoStore.js'

// ── Test scaffolding ──────────────────────────────────────────────────────

const TYPE_ID  = 'type-character-uuid'
const TYPE_KEY = 'character'
const CAMPAIGN = 'c1'

// Mutable React-state holder. Mirrors the (nodes, edges, setNodes, setEdges)
// quartet App.jsx passes to the dispatcher via useUndoShortcuts.
function makeReactState(initialNodes = [], initialEdges = []) {
  const state = { nodes: initialNodes, edges: initialEdges }
  const setNodes = (updater) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater
  }
  const setEdges = (updater) => {
    state.edges = typeof updater === 'function' ? updater(state.edges) : updater
  }
  return {
    state,
    setNodes,
    setEdges,
    // The context the dispatcher reads each tick — re-built on demand so
    // its `nodes` / `edges` references stay fresh after each setNodes call.
    ctx() {
      return { nodes: state.nodes, edges: state.edges, setNodes, setEdges }
    },
  }
}

// Snapshot the React + DB state for round-trip equality assertions.
// Deep-clones EVERYTHING so subsequent mutations to the live mockDb (or to
// React state held by reference) can't leak into a previously-captured
// snapshot. Without the full clone, in-place property assignments later
// in the test (e.g. `mockDb.node_sections.get(id)[kind] = after`) would
// retroactively mutate the "before" snapshot through the shared reference.
//
// Nodes and edges are sorted by id — order doesn't matter for round-trip
// equivalence, and the deleteCard inverse appends to setNodes (so a
// restored middle-of-array card lands at the end). Sort lets the equality
// check focus on data, not insertion order.
function snapshotState(rs) {
  return JSON.parse(JSON.stringify({
    nodes: [...rs.state.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...rs.state.edges].sort((a, b) => a.id.localeCompare(b.id)),
    db: {
      nodes:         [...mockDb.nodes.entries()].sort(([a], [b]) => a.localeCompare(b)),
      node_sections: [...mockDb.node_sections.entries()].sort(([a], [b]) => a.localeCompare(b)),
      connections:   [...mockDb.connections.entries()].sort(([a], [b]) => a.localeCompare(b)),
    },
  }))
}

// Seed a card straight into the DB + React state. Bypasses createNode to
// avoid muddying createNode's call count for tests that care about it.
//
// Phase 7b: bullets are stored as `{id, value}[]` going forward. Callers
// can pass either legacy `string[]` or structured input; seedCard runs
// the same normalize-on-read path production uses (via dbNodeToReactFlow)
// and writes the resulting structured form back into mockDb so both sides
// agree from the start. This way the round-trip equality assertions
// (which compare both React state AND mockDb contents) don't see a fake
// shape diff just because seedCard's inputs were legacy.
function seedCard(rs, {
  id, label = '', summary = '', avatarUrl = null,
  positionX = 0, positionY = 0,
  storyNotes = [], hiddenLore = [], dmNotes = [], media = [],
}) {
  const dbRow = {
    id, campaign_id: CAMPAIGN, type_id: TYPE_ID,
    label, summary, avatar_url: avatarUrl,
    position_x: positionX, position_y: positionY,
  }
  const reactNode = dbNodeToReactFlow(
    dbRow,
    { narrative: storyNotes, hidden_lore: hiddenLore, dm_notes: dmNotes, media },
    { [TYPE_ID]: { key: TYPE_KEY } },
  )
  mockDb.nodes.set(id, dbRow)
  mockDb.node_sections.set(id, {
    narrative:   reactNode.data.storyNotes,
    hidden_lore: reactNode.data.hiddenLore,
    dm_notes:    reactNode.data.dmNotes,
    media:       reactNode.data.media,
  })
  rs.setNodes((nds) => [...nds, reactNode])
  return reactNode
}

function seedConnection(rs, { id, sourceNodeId, targetNodeId }) {
  const dbRow = {
    id, campaign_id: CAMPAIGN,
    source_node_id: sourceNodeId,
    target_node_id: targetNodeId,
  }
  mockDb.connections.set(id, dbRow)
  rs.setEdges((eds) => [...eds, { id, source: sourceNodeId, target: targetNodeId, type: 'floating' }])
  return dbRow
}

beforeEach(() => {
  mockDb.nodes.clear()
  mockDb.node_sections.clear()
  mockDb.connections.clear()
  // Seed the type store the dispatcher reads via useTypeStore.getState().
  useTypeStore.setState({
    types:   { [TYPE_KEY]: { label: 'Character', color: '#0EA5E9' } },
    idByKey: { [TYPE_KEY]: TYPE_ID },
  })
  // Reset undo store between tests.
  useUndoStore.setState({ userId: null, campaignId: null, past: [], future: [] })
  sessionStorage.clear()
})

// ──────────────────────────────────────────────────────────────────────────
// Round-trip property: action → inverse → state matches starting snapshot.
// ──────────────────────────────────────────────────────────────────────────

describe('round-trip — moveCard', () => {
  it('drag → undo restores positions; undo → redo replays them', async () => {
    const rs = makeReactState()
    seedCard(rs, { id: 'card-a', label: 'A', positionX: 10, positionY: 20 })
    seedCard(rs, { id: 'card-b', label: 'B', positionX: 50, positionY: 60 })

    const before = snapshotState(rs)

    const entry = {
      type: ACTION_TYPES.MOVE_CARD,
      campaignId: CAMPAIGN,
      label: 'Move 2 cards',
      cards: [
        { cardId: 'card-a', before: { x: 10, y: 20 }, after: { x: 100, y: 200 } },
        { cardId: 'card-b', before: { x: 50, y: 60 }, after: { x: 150, y: 160 } },
      ],
    }
    // Simulate the original drag (would normally come from onNodeDragStop).
    rs.setNodes((nds) => nds.map((n) => {
      const c = entry.cards.find((c) => c.cardId === n.id)
      return c ? { ...n, position: { ...c.after } } : n
    }))
    mockDb.nodes.get('card-a').position_x = 100; mockDb.nodes.get('card-a').position_y = 200
    mockDb.nodes.get('card-b').position_x = 150; mockDb.nodes.get('card-b').position_y = 160

    await applyInverse(entry, rs.ctx())

    expect(snapshotState(rs)).toEqual(before)

    // Redo replays the move forward.
    await applyForward(entry, rs.ctx())
    expect(rs.state.nodes.find((n) => n.id === 'card-a').position).toEqual({ x: 100, y: 200 })
    expect(rs.state.nodes.find((n) => n.id === 'card-b').position).toEqual({ x: 150, y: 160 })
  })
})

describe('round-trip — editCardField', () => {
  // Each field family — we want one test per field type to catch shape
  // drift if (e.g.) someone changes the typeId lookup or section persist
  // path without updating the dispatcher.
  // Bullet kinds (storyNotes / hiddenLore / dmNotes) carry stable ids in
  // their entries — the structured form the dispatcher reads from React
  // state. We use fixed ids in the fixtures so the round-trip assertion
  // can compare exactly without flakiness from generated UUIDs.
  const fields = [
    ['label',      'Strahd',        'Strahd the Damned'],
    ['summary',    'Vampire lord',  'Lord of Castle Ravenloft'],
    ['avatar',     'old.webp',      'new.webp'],
    ['storyNotes',
      [{ id: 'sn-1', value: 'beat 1' }],
      [{ id: 'sn-1', value: 'beat 1' }, { id: 'sn-2', value: 'beat 2' }]],
    ['hiddenLore',
      [{ id: 'hl-1', value: 'secret 1' }],
      [{ id: 'hl-1', value: 'secret 1' }, { id: 'hl-2', value: 'secret 2' }]],
    ['dmNotes',
      [{ id: 'dm-1', value: 'note 1' }],
      [{ id: 'dm-2', value: 'note 2' }]],
    ['media',
      [{ path: 'p1.webp', alt: '', uploaded_at: 'iso-1' }],
      [{ path: 'p1.webp', alt: '', uploaded_at: 'iso-1' },
       { path: 'p2.webp', alt: '', uploaded_at: 'iso-2' }]],
  ]

  it.each(fields)('%s: edit → undo restores; redo replays', async (field, before, after) => {
    const rs = makeReactState()
    const seedFields =
      field === 'storyNotes' ? { storyNotes: before } :
      field === 'hiddenLore' ? { hiddenLore: before } :
      field === 'dmNotes'    ? { dmNotes: before } :
      field === 'media'      ? { media: before } :
      field === 'avatar'     ? { avatarUrl: before } :
                               { [field]: before }
    seedCard(rs, { id: 'card-1', label: 'Strahd', summary: 'Vampire lord', ...seedFields })
    const startSnapshot = snapshotState(rs)

    // Apply the forward edit (skipping App.jsx's onUpdate; we just mutate state).
    rs.setNodes((nds) => nds.map((n) =>
      n.id === 'card-1' ? { ...n, data: { ...n.data, [field]: after } } : n
    ))
    if (field === 'avatar') {
      mockDb.nodes.get('card-1').avatar_url = after
    } else if (['label', 'summary'].includes(field)) {
      mockDb.nodes.get('card-1')[field] = after
    } else if (['storyNotes', 'hiddenLore', 'dmNotes', 'media'].includes(field)) {
      const kind = { storyNotes: 'narrative', hiddenLore: 'hidden_lore', dmNotes: 'dm_notes', media: 'media' }[field]
      mockDb.node_sections.get('card-1')[kind] = after
    }

    const entry = {
      type: ACTION_TYPES.EDIT_CARD_FIELD,
      campaignId: CAMPAIGN,
      cardId: 'card-1',
      field,
      before,
      after,
    }
    await applyInverse(entry, rs.ctx())
    expect(snapshotState(rs)).toEqual(startSnapshot)

    await applyForward(entry, rs.ctx())
    expect(rs.state.nodes.find((n) => n.id === 'card-1').data[field]).toEqual(after)
  })

  it('type: round-trips through useTypeStore.idByKey for the typeId lookup', async () => {
    useTypeStore.setState({
      types:   { character: {}, location: {} },
      idByKey: { character: 'type-character', location: 'type-location' },
    })
    const rs = makeReactState()
    // Seed manually so type_id matches the lookup.
    const dbRow = {
      id: 'card-1', campaign_id: CAMPAIGN, type_id: 'type-character',
      label: 'Strahd', summary: '', avatar_url: null,
      position_x: 0, position_y: 0,
    }
    mockDb.nodes.set('card-1', dbRow)
    mockDb.node_sections.set('card-1', { narrative: [], hidden_lore: [], dm_notes: [], media: [] })
    rs.setNodes(() => [dbNodeToReactFlow(dbRow, mockDb.node_sections.get('card-1'), {
      'type-character': { key: 'character' },
      'type-location':  { key: 'location' },
    })])
    const startSnapshot = snapshotState(rs)

    // Forward edit: change to location.
    rs.setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, type: 'location' } })))
    mockDb.nodes.get('card-1').type_id = 'type-location'

    const entry = {
      type: ACTION_TYPES.EDIT_CARD_FIELD,
      campaignId: CAMPAIGN,
      cardId: 'card-1',
      field: 'type',
      before: 'character',
      after:  'location',
    }
    await applyInverse(entry, rs.ctx())

    // React shape back to character; DB row's type_id back to type-character.
    expect(rs.state.nodes[0].data.type).toBe('character')
    expect(mockDb.nodes.get('card-1').type_id).toBe('type-character')
    expect(snapshotState(rs)).toEqual(startSnapshot)
  })
})

describe('round-trip — createCard', () => {
  it('undo deletes the card; redo recreates it at the same UUID', async () => {
    const rs = makeReactState()
    // Forward: simulate addCardNode having just created a card.
    const dbRow = {
      id: 'created-uuid', campaign_id: CAMPAIGN, type_id: TYPE_ID,
      label: '', summary: '', avatar_url: null, position_x: 100, position_y: 200,
    }
    mockDb.nodes.set('created-uuid', dbRow)
    mockDb.node_sections.set('created-uuid', { narrative: [], hidden_lore: [], dm_notes: [], media: [] })
    rs.setNodes(() => [dbNodeToReactFlow(dbRow, mockDb.node_sections.get('created-uuid'), { [TYPE_ID]: { key: TYPE_KEY } })])

    const entry = {
      type: ACTION_TYPES.CREATE_CARD,
      campaignId: CAMPAIGN,
      cardId: 'created-uuid',
      dbRow: {
        typeId: TYPE_ID, typeKey: TYPE_KEY,
        label: '', summary: '', avatarUrl: null,
        positionX: 100, positionY: 200,
      },
    }

    // Undo: card removed from React state AND DB.
    await applyInverse(entry, rs.ctx())
    expect(rs.state.nodes).toEqual([])
    expect(mockDb.nodes.has('created-uuid')).toBe(false)

    // Redo: card returns at the same UUID with the recorded field values.
    await applyForward(entry, rs.ctx())
    expect(rs.state.nodes).toHaveLength(1)
    expect(rs.state.nodes[0].id).toBe('created-uuid')
    expect(rs.state.nodes[0].position).toEqual({ x: 100, y: 200 })
    expect(mockDb.nodes.get('created-uuid')).toMatchObject({
      id: 'created-uuid', label: '', position_x: 100, position_y: 200,
    })
  })
})

describe('round-trip — deleteCard (the discipline test)', () => {
  // The canonical case from ADR §11. Card with avatar + all four section
  // kinds + multiple connections (incoming and outgoing). Delete + undo
  // must restore everything. If a future schema change adds a card-related
  // field that buildDeleteCardSnapshot doesn't capture, this test fails.
  it('restores card + avatar + position + 4 section kinds + N connections', async () => {
    const rs = makeReactState()
    seedCard(rs, { id: 'card-doomed',
      label: 'Strahd', summary: 'Vampire lord',
      avatarUrl: 'avatars/strahd.webp',
      positionX: 300, positionY: 400,
      storyNotes: ['born ~1346', 'cursed'],
      hiddenLore: ['truly believes Tatyana'],
      dmNotes:    ['voice: slow, deliberate'],
      media:      [{ path: 'inspo/portrait.webp', alt: '', uploaded_at: 'iso-1' }],
    })
    seedCard(rs, { id: 'card-ireena', label: 'Ireena' })
    seedCard(rs, { id: 'card-rahadin', label: 'Rahadin' })

    seedConnection(rs, { id: 'edge-1', sourceNodeId: 'card-doomed',  targetNodeId: 'card-ireena' })
    seedConnection(rs, { id: 'edge-2', sourceNodeId: 'card-rahadin', targetNodeId: 'card-doomed' })

    const before = snapshotState(rs)

    // Build the snapshot the way App.jsx does, then simulate the delete.
    const snapshot = buildDeleteCardSnapshot('card-doomed', {
      nodes: rs.state.nodes,
      edges: rs.state.edges,
      campaignId: CAMPAIGN,
      typeIdByKey: { [TYPE_KEY]: TYPE_ID },
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot.dbConnectionRows).toHaveLength(2)
    expect(snapshot.dbSectionRows).toHaveLength(4)

    // Optimistic React removal + DB cascade.
    rs.setNodes((nds) => nds.filter((n) => n.id !== 'card-doomed'))
    rs.setEdges((eds) => eds.filter((e) => e.source !== 'card-doomed' && e.target !== 'card-doomed'))
    mockDb.nodes.delete('card-doomed')
    mockDb.node_sections.delete('card-doomed')
    mockDb.connections.delete('edge-1')
    mockDb.connections.delete('edge-2')

    // Undo: applyInverse rebuilds React shape AND calls restoreCardWithDependents.
    const entry = {
      type: ACTION_TYPES.DELETE_CARD,
      campaignId: CAMPAIGN,
      label: 'Delete "Strahd"',
      ...snapshot,
    }
    await applyInverse(entry, rs.ctx())

    // The whole-state equality is the discipline check. Adds a new
    // node-related field? You'd lose it here unless buildDeleteCardSnapshot
    // captures it.
    expect(snapshotState(rs)).toEqual(before)
  })

  it('redo deletes again, returning to the post-delete state', async () => {
    const rs = makeReactState()
    seedCard(rs, { id: 'card-doomed', label: 'Strahd' })
    seedConnection(rs, { id: 'edge-1', sourceNodeId: 'card-doomed', targetNodeId: 'card-other' })

    const snapshot = buildDeleteCardSnapshot('card-doomed', {
      nodes: rs.state.nodes,
      edges: rs.state.edges,
      campaignId: CAMPAIGN,
      typeIdByKey: { [TYPE_KEY]: TYPE_ID },
    })
    const entry = { type: ACTION_TYPES.DELETE_CARD, campaignId: CAMPAIGN, ...snapshot }

    // Forward (= the original delete).
    await applyForward(entry, rs.ctx())

    expect(rs.state.nodes.find((n) => n.id === 'card-doomed')).toBeUndefined()
    expect(rs.state.edges.find((e) => e.id === 'edge-1')).toBeUndefined()
    expect(mockDb.nodes.has('card-doomed')).toBe(false)
    expect(mockDb.connections.has('edge-1')).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Chained-operation regression (the bug Erik hit during phase-5 smoke)
// ──────────────────────────────────────────────────────────────────────────

describe('chained operation through useUndoStore', () => {
  it('create empty card → edit title → delete: undo×3 reverses; redo×3 replays cleanly', async () => {
    // This is the exact sequence that broke before the empty-label fold fix.
    // It uses the REAL store + REAL dispatcher to lock the regression in.
    const rs = makeReactState()
    useUndoStore.getState().setScope({ userId: 'u1', campaignId: CAMPAIGN })

    // 1) Forward: create empty card.
    const dbRow = {
      id: 'new-card', campaign_id: CAMPAIGN, type_id: TYPE_ID,
      label: '', summary: '', avatar_url: null, position_x: 0, position_y: 0,
    }
    mockDb.nodes.set('new-card', dbRow)
    mockDb.node_sections.set('new-card', { narrative: [], hidden_lore: [], dm_notes: [], media: [] })
    rs.setNodes(() => [dbNodeToReactFlow(dbRow, mockDb.node_sections.get('new-card'), { [TYPE_ID]: { key: TYPE_KEY } })])
    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.CREATE_CARD,
      campaignId: CAMPAIGN,
      cardId: 'new-card',
      dbRow: { typeId: TYPE_ID, typeKey: TYPE_KEY, label: '', summary: '', avatarUrl: null, positionX: 0, positionY: 0 },
    })

    // 2) Forward: edit title (empty → 'My Title'), matching the EditModal close-time diff.
    rs.setNodes((nds) => nds.map((n) =>
      n.id === 'new-card' ? { ...n, data: { ...n.data, label: 'My Title' } } : n
    ))
    mockDb.nodes.get('new-card').label = 'My Title'
    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.EDIT_CARD_FIELD,
      campaignId: CAMPAIGN,
      cardId: 'new-card',
      field: 'label',
      before: '',          // raw, post-fold-fix — used to be 'Untitled'
      after:  'My Title',
    })

    // 3) Forward: delete the card.
    const snapshot = buildDeleteCardSnapshot('new-card', {
      nodes: rs.state.nodes,
      edges: rs.state.edges,
      campaignId: CAMPAIGN,
      typeIdByKey: { [TYPE_KEY]: TYPE_ID },
    })
    rs.setNodes((nds) => nds.filter((n) => n.id !== 'new-card'))
    mockDb.nodes.delete('new-card')
    mockDb.node_sections.delete('new-card')
    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.DELETE_CARD,
      campaignId: CAMPAIGN,
      ...snapshot,
    })

    // ── Ctrl+Z × 3 ────────────────────────────────────────────────────────
    // 1: undo delete → card returns with label 'My Title'
    let res = await useUndoStore.getState().undo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(rs.state.nodes.find((n) => n.id === 'new-card').data.label).toBe('My Title')

    // 2: undo edit → label back to ''
    res = await useUndoStore.getState().undo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(rs.state.nodes.find((n) => n.id === 'new-card').data.label).toBe('')

    // 3: undo create → card gone
    res = await useUndoStore.getState().undo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(rs.state.nodes.find((n) => n.id === 'new-card')).toBeUndefined()

    // ── Ctrl+Shift+Z × 3 ──────────────────────────────────────────────────
    // 1: redo create → card recreated empty
    res = await useUndoStore.getState().redo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(rs.state.nodes.find((n) => n.id === 'new-card').data.label).toBe('')

    // 2: redo edit → label back to 'My Title' (the regression — used to
    // silently no-op because before='Untitled' didn't match current='').
    res = await useUndoStore.getState().redo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(res.conflict).toBeFalsy()
    expect(rs.state.nodes.find((n) => n.id === 'new-card').data.label).toBe('My Title')

    // 3: redo delete → card gone again.
    res = await useUndoStore.getState().redo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(rs.state.nodes.find((n) => n.id === 'new-card')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Drift refusal — real conflicts, not mocked. The dispatcher's canApply*
// reads context.nodes; if the world has drifted, it refuses.
// ──────────────────────────────────────────────────────────────────────────

describe('round-trip — addConnection / removeConnection', () => {
  it('addConnection: connect → undo removes the edge; redo recreates at same id', async () => {
    const rs = makeReactState()
    seedCard(rs, { id: 'card-a' })
    seedCard(rs, { id: 'card-b' })

    const before = snapshotState(rs)

    // Forward: simulate the user adding a connection via EditModal +
    // App.jsx's onUpdateNode (DB-assigned id).
    const edge = { id: 'edge-1', source: 'card-a', target: 'card-b', type: 'floating' }
    rs.setEdges(() => [edge])
    mockDb.connections.set('edge-1', {
      id: 'edge-1', campaign_id: CAMPAIGN,
      source_node_id: 'card-a', target_node_id: 'card-b',
    })

    const entry = {
      type: ACTION_TYPES.ADD_CONNECTION,
      campaignId: CAMPAIGN,
      connectionId: 'edge-1',
      sourceNodeId: 'card-a',
      targetNodeId: 'card-b',
    }

    await applyInverse(entry, rs.ctx())
    expect(snapshotState(rs)).toEqual(before)

    await applyForward(entry, rs.ctx())
    expect(rs.state.edges).toContainEqual(edge)
    expect(mockDb.connections.has('edge-1')).toBe(true)
  })

  it('removeConnection: disconnect → undo recreates at same id; redo deletes again', async () => {
    const rs = makeReactState()
    seedCard(rs, { id: 'card-a' })
    seedCard(rs, { id: 'card-b' })
    seedConnection(rs, { id: 'edge-1', sourceNodeId: 'card-a', targetNodeId: 'card-b' })

    const before = snapshotState(rs)

    // Forward: user removed the connection.
    rs.setEdges((eds) => eds.filter((e) => e.id !== 'edge-1'))
    mockDb.connections.delete('edge-1')

    const entry = {
      type: ACTION_TYPES.REMOVE_CONNECTION,
      campaignId: CAMPAIGN,
      connectionId: 'edge-1',
      sourceNodeId: 'card-a',
      targetNodeId: 'card-b',
    }

    await applyInverse(entry, rs.ctx())
    expect(snapshotState(rs)).toEqual(before)

    await applyForward(entry, rs.ctx())
    expect(rs.state.edges.find((e) => e.id === 'edge-1')).toBeUndefined()
    expect(mockDb.connections.has('edge-1')).toBe(false)
  })

  it('removeConnection inverse refuses when source card has been deleted (FK guard)', async () => {
    const rs = makeReactState()
    // Note: only target card exists. If we tried to recreate the edge, the
    // FK insert would fail. canApplyInverse should refuse before that.
    seedCard(rs, { id: 'card-b' })

    const entry = {
      type: ACTION_TYPES.REMOVE_CONNECTION,
      campaignId: CAMPAIGN,
      connectionId: 'edge-1',
      sourceNodeId: 'card-a',     // gone
      targetNodeId: 'card-b',
    }
    useUndoStore.getState().setScope({ userId: 'u1', campaignId: CAMPAIGN })
    useUndoStore.getState().recordAction(entry)

    const result = await useUndoStore.getState().undo(rs.ctx())
    expect(result).toMatchObject({ ok: false, conflict: true })
    expect(result.reason).toMatch(/source/i)
  })
})

describe('drift refusal at the dispatcher level', () => {
  it('refuses to undo an editCardField when the field has changed elsewhere', async () => {
    const rs = makeReactState()
    seedCard(rs, { id: 'card-1', summary: 'drifted text' })

    const entry = {
      type: ACTION_TYPES.EDIT_CARD_FIELD,
      campaignId: CAMPAIGN,
      cardId: 'card-1',
      field: 'summary',
      before: 'old',
      after:  'new',          // current state is 'drifted text', not 'new'
    }
    useUndoStore.getState().setScope({ userId: 'u1', campaignId: CAMPAIGN })
    useUndoStore.getState().recordAction(entry)

    const result = await useUndoStore.getState().undo(rs.ctx())

    expect(result).toMatchObject({ ok: false, conflict: true })
    // The orphan entry is popped so the next Ctrl+Z addresses the action over.
    expect(useUndoStore.getState().past).toHaveLength(0)
    expect(rs.state.nodes[0].data.summary).toBe('drifted text')   // unchanged
  })

  it('refuses to redo a createCard when something else recreated the id', async () => {
    const rs = makeReactState()
    // Pre-existing card holding the id we're about to "redo create" over.
    seedCard(rs, { id: 'created-uuid', label: 'pre-existing' })

    const entry = {
      type: ACTION_TYPES.CREATE_CARD,
      campaignId: CAMPAIGN,
      cardId: 'created-uuid',
      dbRow: { typeId: TYPE_ID, typeKey: TYPE_KEY, label: '', summary: '', avatarUrl: null, positionX: 0, positionY: 0 },
    }
    useUndoStore.getState().setScope({ userId: 'u1', campaignId: CAMPAIGN })
    // Park the entry on the future stack as if we'd just undone the create.
    useUndoStore.setState({ past: [], future: [entry] })

    const result = await useUndoStore.getState().redo(rs.ctx())

    expect(result).toMatchObject({ ok: false, conflict: true })
    expect(rs.state.nodes[0].data.label).toBe('pre-existing')      // untouched
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Per-item bullet undo round-trips — phase 7c. The trust-preservation
// scenarios Erik called out: each bullet is its own undo step and identity
// is the bullet's stable id (from phase 7b's data model). Position is a
// drift check, never the primary identifier.
// ─────────────────────────────────────────────────────────────────────────────

describe('round-trip — per-item bullet ops (phase 7c)', () => {
  it("Erik's scenario #1: deleting one of three duplicate-text bullets restores the right one", async () => {
    const rs = makeReactState()
    seedCard(rs, {
      id: 'card-1',
      storyNotes: [
        { id: 'b1', value: 'TODO' },
        { id: 'b2', value: 'TODO' },
        { id: 'b3', value: 'TODO' },
      ],
    })
    const before = snapshotState(rs)

    // Delete the middle TODO (id 'b2'). Without stable IDs, position +
    // value alone couldn't distinguish which TODO to restore.
    rs.setNodes((nds) => nds.map((n) =>
      n.id === 'card-1' ? {
        ...n,
        data: { ...n.data, storyNotes: [
          { id: 'b1', value: 'TODO' },
          { id: 'b3', value: 'TODO' },
        ] },
      } : n,
    ))
    mockDb.node_sections.set('card-1', {
      ...mockDb.node_sections.get('card-1'),
      narrative: [{ id: 'b1', value: 'TODO' }, { id: 'b3', value: 'TODO' }],
    })

    const entry = {
      type: ACTION_TYPES.REMOVE_LIST_ITEM,
      campaignId: CAMPAIGN, cardId: 'card-1',
      field: 'storyNotes',
      position: 1,
      item: { id: 'b2', value: 'TODO' },
    }
    await applyInverse(entry, rs.ctx())
    expect(snapshotState(rs)).toEqual(before)

    await applyForward(entry, rs.ctx())
    expect(rs.state.nodes[0].data.storyNotes).toEqual([
      { id: 'b1', value: 'TODO' },
      { id: 'b3', value: 'TODO' },
    ])
  })

  it("Erik's scenario #2: deleting the first bullet → undo restores it; surviving IDs unchanged", async () => {
    const rs = makeReactState()
    seedCard(rs, {
      id: 'card-1',
      storyNotes: [
        { id: 'b1', value: 'first' },
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
      ],
    })
    const before = snapshotState(rs)

    // User deletes 'first'.
    rs.setNodes((nds) => nds.map((n) =>
      n.id === 'card-1' ? {
        ...n,
        data: { ...n.data, storyNotes: [
          { id: 'b2', value: 'middle' },
          { id: 'b3', value: 'last' },
        ] },
      } : n,
    ))
    mockDb.node_sections.set('card-1', {
      ...mockDb.node_sections.get('card-1'),
      narrative: [
        { id: 'b2', value: 'middle' },
        { id: 'b3', value: 'last' },
      ],
    })

    const entry = {
      type: ACTION_TYPES.REMOVE_LIST_ITEM,
      campaignId: CAMPAIGN, cardId: 'card-1',
      field: 'storyNotes',
      position: 0,
      item: { id: 'b1', value: 'first' },
    }
    await applyInverse(entry, rs.ctx())
    expect(snapshotState(rs)).toEqual(before)

    // Survivors carry their original IDs through the round-trip.
    expect(rs.state.nodes[0].data.storyNotes[1].id).toBe('b2')
    expect(rs.state.nodes[0].data.storyNotes[2].id).toBe('b3')
  })

  it("Erik's scenario #3: reorder → undo moves the bullet back, IDs preserved", async () => {
    const rs = makeReactState()
    seedCard(rs, {
      id: 'card-1',
      storyNotes: [
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
        { id: 'b3', value: 'C' },
      ],
    })
    const before = snapshotState(rs)

    // Drag 'A' to the end: [B, C, A].
    rs.setNodes((nds) => nds.map((n) =>
      n.id === 'card-1' ? {
        ...n,
        data: { ...n.data, storyNotes: [
          { id: 'b2', value: 'B' },
          { id: 'b3', value: 'C' },
          { id: 'b1', value: 'A' },
        ] },
      } : n,
    ))
    mockDb.node_sections.set('card-1', {
      ...mockDb.node_sections.get('card-1'),
      narrative: [
        { id: 'b2', value: 'B' },
        { id: 'b3', value: 'C' },
        { id: 'b1', value: 'A' },
      ],
    })

    const entry = {
      type: ACTION_TYPES.REORDER_LIST_ITEM,
      campaignId: CAMPAIGN, cardId: 'card-1',
      field: 'storyNotes',
      itemId: 'b1', from: 0, to: 2,
    }
    await applyInverse(entry, rs.ctx())
    expect(snapshotState(rs)).toEqual(before)
  })

  it("Erik's add-then-move scenario: two undo steps reverse independently", async () => {
    // Forward: starting from [{A}], user clicks +Add → [{A}, {B-fresh}],
    // then drags B to position 0 → [{B}, {A}]. Two log entries: addListItem
    // (with B-fresh's id and value) and reorderListItem (B from 1 to 0).
    // Stack push order: add, then reorder. Undo unwinds in reverse.
    const rs = makeReactState()
    seedCard(rs, {
      id: 'card-1',
      storyNotes: [{ id: 'a-orig', value: 'A' }],
    })

    // Apply the forward sequence to the world (simulates the user's actions).
    rs.setNodes((nds) => nds.map((n) =>
      n.id === 'card-1' ? {
        ...n,
        data: { ...n.data, storyNotes: [
          { id: 'b-new', value: 'B' },     // moved
          { id: 'a-orig', value: 'A' },
        ] },
      } : n,
    ))
    mockDb.node_sections.set('card-1', {
      ...mockDb.node_sections.get('card-1'),
      narrative: [
        { id: 'b-new', value: 'B' },
        { id: 'a-orig', value: 'A' },
      ],
    })

    // Push the two entries through the live store, then walk back.
    useUndoStore.getState().setScope({ userId: 'u1', campaignId: CAMPAIGN })
    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.ADD_LIST_ITEM,
      campaignId: CAMPAIGN, cardId: 'card-1',
      field: 'storyNotes', position: 1,
      item: { id: 'b-new', value: 'B' },
    })
    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.REORDER_LIST_ITEM,
      campaignId: CAMPAIGN, cardId: 'card-1',
      field: 'storyNotes', itemId: 'b-new', from: 1, to: 0,
    })

    // Ctrl+Z #1: top of stack = reorder. B moves back to position 1.
    let res = await useUndoStore.getState().undo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(rs.state.nodes[0].data.storyNotes).toEqual([
      { id: 'a-orig', value: 'A' },
      { id: 'b-new', value: 'B' },
    ])

    // Ctrl+Z #2: top = add. B is removed.
    res = await useUndoStore.getState().undo(rs.ctx())
    expect(res.ok).toBe(true)
    expect(rs.state.nodes[0].data.storyNotes).toEqual([
      { id: 'a-orig', value: 'A' },
    ])
  })

  it('editListItem round-trip: type into a bullet, undo restores prior text by id', async () => {
    const rs = makeReactState()
    seedCard(rs, {
      id: 'card-1',
      storyNotes: [
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B' },
      ],
    })
    const before = snapshotState(rs)

    // User edits b2 from 'B' → 'B edited'.
    rs.setNodes((nds) => nds.map((n) =>
      n.id === 'card-1' ? {
        ...n,
        data: { ...n.data, storyNotes: [
          { id: 'b1', value: 'A' },
          { id: 'b2', value: 'B edited' },
        ] },
      } : n,
    ))
    mockDb.node_sections.set('card-1', {
      ...mockDb.node_sections.get('card-1'),
      narrative: [
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'B edited' },
      ],
    })

    const entry = {
      type: ACTION_TYPES.EDIT_LIST_ITEM,
      campaignId: CAMPAIGN, cardId: 'card-1',
      field: 'storyNotes',
      itemId: 'b2', before: 'B', after: 'B edited',
    }
    await applyInverse(entry, rs.ctx())
    expect(snapshotState(rs)).toEqual(before)
    // ID survives the round-trip.
    expect(rs.state.nodes[0].data.storyNotes[1].id).toBe('b2')
  })

  it('drift refusal: undoing a removeListItem refuses if the id is already back in the list', async () => {
    const rs = makeReactState()
    seedCard(rs, {
      id: 'card-1',
      // Some other tab "restored" the bullet via Realtime before this tab undid.
      storyNotes: [
        { id: 'b1', value: 'A' },
        { id: 'b2', value: 'restored from elsewhere' },
      ],
    })

    const entry = {
      type: ACTION_TYPES.REMOVE_LIST_ITEM,
      campaignId: CAMPAIGN, cardId: 'card-1',
      field: 'storyNotes', position: 1,
      item: { id: 'b2', value: 'B' },   // we recorded 'B' but world has 'restored'
    }
    useUndoStore.getState().setScope({ userId: 'u1', campaignId: CAMPAIGN })
    useUndoStore.getState().recordAction(entry)

    const result = await useUndoStore.getState().undo(rs.ctx())
    expect(result).toMatchObject({ ok: false, conflict: true })
    expect(result.reason).toMatch(/already present/i)
  })
})
