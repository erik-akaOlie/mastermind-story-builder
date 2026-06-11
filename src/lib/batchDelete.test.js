// batchDelete data layer — snapshot building (with the connected-pair
// connection de-duplication this module exists for), batch delete, and the
// FK-ordered restore.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase.js', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./errorReporting.js', () => ({
  persistWrite: vi.fn((fn) => fn()),
}))
// buildBatchDeleteSnapshot delegates per-card capture to the existing
// single-card snapshot builder; its own DB read is covered by nodes.test.js.
vi.mock('./nodes.js', () => ({
  buildDeleteCardSnapshot: vi.fn(),
}))

import {
  buildBatchDeleteSnapshot,
  buildTextNodeDbRow,
  deleteBatch,
  restoreBatchDelete,
} from './batchDelete.js'
import { buildDeleteCardSnapshot } from './nodes.js'
import { supabase } from './supabase.js'

// ── Fixtures: two connected cards + a text node ─────────────────────────────

const cardNode = (id) => ({
  id,
  type: 'campaignNode',
  position: { x: 10, y: 20 },
  data: { id, label: id, type: 'character' },
})

const textNode = {
  id: 'text-1',
  type: 'textNode',
  position: { x: 5, y: 6 },
  data: { text: '<p>hi</p>', width: 200, height: null, fontSize: 18, align: 'left' },
}

// The shared connection between the two doomed cards — appears in BOTH
// per-card snapshots, exactly as buildDeleteCardSnapshot produces them.
const sharedConn = { id: 'edge-shared', workspace_id: 'w1', source_node_id: 'card-a', target_node_id: 'card-b' }
// A connection from card-a to a survivor outside the selection.
const survivorConn = { id: 'edge-out', workspace_id: 'w1', source_node_id: 'card-a', target_node_id: 'survivor' }

const snapA = {
  dbCardRow: { id: 'card-a', workspace_id: 'w1', label: 'A', position_x: 10, position_y: 20 },
  dbSectionRows: [{ node_id: 'card-a', kind: 'card_view', content: {}, sort_order: 0 }],
  dbConnectionRows: [sharedConn, survivorConn],
}
const snapB = {
  dbCardRow: { id: 'card-b', workspace_id: 'w1', label: 'B', position_x: 30, position_y: 40 },
  dbSectionRows: [{ node_id: 'card-b', kind: 'card_view', content: {}, sort_order: 0 }],
  dbConnectionRows: [sharedConn],
}

const ctx = {
  nodes: [cardNode('card-a'), cardNode('card-b'), textNode, cardNode('survivor')],
  edges: [],
  workspaceId: 'w1',
  typeIdByKey: { character: 'type-character-uuid' },
}

beforeEach(() => {
  vi.clearAllMocks()
  buildDeleteCardSnapshot.mockImplementation(async (id) => {
    if (id === 'card-a') return snapA
    if (id === 'card-b') return snapB
    return null
  })
})

describe('buildTextNodeDbRow', () => {
  it('marshals a React text node to the DB row shape', () => {
    expect(buildTextNodeDbRow(textNode, 'w1')).toEqual({
      id: 'text-1',
      workspace_id: 'w1',
      content_html: '<p>hi</p>',
      position_x: 5,
      position_y: 6,
      width: 200,
      height: null,
      font_size: 18,
      align: 'left',
    })
  })
})

describe('buildBatchDeleteSnapshot', () => {
  it('classifies the selection into cards and text nodes', async () => {
    const snap = await buildBatchDeleteSnapshot(new Set(['card-a', 'card-b', 'text-1']), ctx)
    expect(snap.cards.map((c) => c.dbCardRow.id)).toEqual(['card-a', 'card-b'])
    expect(snap.textNodes).toEqual([{ textNodeId: 'text-1', dbRow: buildTextNodeDbRow(textNode, 'w1') }])
  })

  it('THE connected-pair invariant: a connection shared by two deleted cards appears exactly once', async () => {
    const snap = await buildBatchDeleteSnapshot(new Set(['card-a', 'card-b']), ctx)
    const ids = snap.connections.map((c) => c.id)
    expect(ids.filter((id) => id === 'edge-shared')).toHaveLength(1)
    // The survivor-facing connection is kept too (restore relinks it).
    expect(ids).toContain('edge-out')
    expect(snap.connections).toHaveLength(2)
  })

  it('lifts connections OUT of the per-card snapshots (no per-card connection rows survive)', async () => {
    const snap = await buildBatchDeleteSnapshot(new Set(['card-a', 'card-b']), ctx)
    for (const card of snap.cards) {
      expect(card).not.toHaveProperty('dbConnectionRows')
      expect(card.dbSectionRows.length).toBeGreaterThan(0)
    }
  })

  it('skips ids that are not in local state and returns null when nothing resolves', async () => {
    expect(await buildBatchDeleteSnapshot(new Set(['ghost-1', 'ghost-2']), ctx)).toBeNull()
  })

  it('fails closed: a per-card capture failure propagates (caller aborts the delete)', async () => {
    buildDeleteCardSnapshot.mockRejectedValueOnce(new Error('section fetch failed'))
    await expect(
      buildBatchDeleteSnapshot(new Set(['card-a', 'card-b']), ctx)
    ).rejects.toThrow('section fetch failed')
  })
})

// ── DB call recording for deleteBatch / restoreBatchDelete ─────────────────

function recordSupabaseCalls() {
  const calls = []
  supabase.from.mockImplementation((table) => ({
    insert: async (rows) => {
      calls.push({ op: 'insert', table, rows })
      return { error: null }
    },
    delete: () => ({
      in: async (col, ids) => {
        calls.push({ op: 'delete', table, col, ids })
        return { error: null }
      },
    }),
  }))
  return calls
}

describe('deleteBatch', () => {
  it('deletes cards and text nodes by id list (cascade handles sections + connections)', async () => {
    const calls = recordSupabaseCalls()
    await deleteBatch({ cardIds: ['card-a', 'card-b'], textNodeIds: ['text-1'] })
    expect(calls).toEqual([
      { op: 'delete', table: 'nodes',      col: 'id', ids: ['card-a', 'card-b'] },
      { op: 'delete', table: 'text_nodes', col: 'id', ids: ['text-1'] },
    ])
  })

  it('skips empty groups', async () => {
    const calls = recordSupabaseCalls()
    await deleteBatch({ cardIds: [], textNodeIds: ['text-1'] })
    expect(calls).toEqual([
      { op: 'delete', table: 'text_nodes', col: 'id', ids: ['text-1'] },
    ])
  })
})

describe('restoreBatchDelete', () => {
  it('inserts in FK order: nodes → node_sections → connections → text_nodes', async () => {
    const calls = recordSupabaseCalls()
    await restoreBatchDelete({
      cards: [
        { dbCardRow: snapA.dbCardRow, dbSectionRows: snapA.dbSectionRows },
        { dbCardRow: snapB.dbCardRow, dbSectionRows: snapB.dbSectionRows },
      ],
      connections: [sharedConn, survivorConn],
      textNodes: [{ textNodeId: 'text-1', dbRow: buildTextNodeDbRow(textNode, 'w1') }],
    })

    expect(calls.map((c) => c.table)).toEqual(['nodes', 'node_sections', 'connections', 'text_nodes'])
    expect(calls[0].rows.map((r) => r.id)).toEqual(['card-a', 'card-b'])
    expect(calls[1].rows.map((r) => r.node_id)).toEqual(['card-a', 'card-b'])
    expect(calls[2].rows.map((r) => r.id)).toEqual(['edge-shared', 'edge-out'])
    expect(calls[3].rows.map((r) => r.id)).toEqual(['text-1'])
  })

  it('skips empty groups (text-only batch issues a single insert)', async () => {
    const calls = recordSupabaseCalls()
    await restoreBatchDelete({
      cards: [],
      connections: [],
      textNodes: [{ textNodeId: 'text-1', dbRow: buildTextNodeDbRow(textNode, 'w1') }],
    })
    expect(calls.map((c) => c.table)).toEqual(['text_nodes'])
  })
})
