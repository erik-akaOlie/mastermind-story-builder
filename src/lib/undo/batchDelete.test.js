// batchDelete undo handler — one entry restores (or re-deletes) a whole
// multi-selection. The headline case: two CONNECTED cards deleted together
// round-trip through undo with their shared connection restored exactly once.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../batchDelete.js', async () => {
  const actual = await vi.importActual('../batchDelete.js')
  return {
    ...actual,
    restoreBatchDelete: vi.fn(async () => {}),
    deleteBatch:        vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './batchDelete.js'
import { ACTION_TYPES } from './index.js'
import { restoreBatchDelete, deleteBatch } from '../batchDelete.js'
import { useTypeStore } from '../../store/useTypeStore.js'

beforeEach(() => {
  restoreBatchDelete.mockClear()
  deleteBatch.mockClear()
  useTypeStore.setState({
    types:   { character: { label: 'Character', color: '#0EA5E9' } },
    idByKey: { character: 'type-character-uuid' },
  })
})

// ── Fixture: two connected cards + one text node, deleted together ─────────

const cards = [
  {
    dbCardRow: {
      id: 'card-a', workspace_id: 'w1', type_id: 'type-character-uuid',
      label: 'Strahd', summary: '', avatar_url: null, position_x: 100, position_y: 200,
    },
    dbSectionRows: [
      { node_id: 'card-a', kind: 'narrative', content: ['born ~1346'], sort_order: 0 },
    ],
  },
  {
    dbCardRow: {
      id: 'card-b', workspace_id: 'w1', type_id: 'type-character-uuid',
      label: 'Ireena', summary: '', avatar_url: null, position_x: 300, position_y: 400,
    },
    dbSectionRows: [],
  },
]
// Deduped at capture time: the card-a ↔ card-b connection appears ONCE.
const connections = [
  { id: 'edge-shared', workspace_id: 'w1', source_node_id: 'card-a', target_node_id: 'card-b' },
  { id: 'edge-out',    workspace_id: 'w1', source_node_id: 'card-a', target_node_id: 'survivor' },
]
const textNodes = [
  {
    textNodeId: 'text-1',
    dbRow: {
      id: 'text-1', workspace_id: 'w1', content_html: '<p>hi</p>',
      position_x: 5, position_y: 6, width: 200, height: null, font_size: 18, align: 'left',
    },
  },
]

const batchEntry = (overrides = {}) => ({
  type: ACTION_TYPES.BATCH_DELETE,
  workspaceId: 'w1',
  label: 'Delete 3 items',
  timestamp: '2026-06-11T17:00:00.000Z',
  cards,
  connections,
  textNodes,
  ...overrides,
})

describe('batchDelete — canApply*', () => {
  it('canApplyInverse passes when every deleted id is currently absent', () => {
    expect(canApplyInverse(batchEntry(), { nodes: [{ id: 'survivor' }] }))
      .toEqual({ ok: true })
  })

  it('canApplyInverse refuses (all-or-nothing) if even one id already exists', () => {
    const result = canApplyInverse(batchEntry(), { nodes: [{ id: 'card-b' }] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already exists/i)
  })

  it('canApplyInverse refuses when a text-node id already exists', () => {
    expect(canApplyInverse(batchEntry(), { nodes: [{ id: 'text-1' }] }).ok).toBe(false)
  })

  it('canApplyForward passes when every item still exists', () => {
    const nodes = [{ id: 'card-a' }, { id: 'card-b' }, { id: 'text-1' }]
    expect(canApplyForward(batchEntry(), { nodes })).toEqual({ ok: true })
  })

  it('canApplyForward refuses when any item has been removed elsewhere', () => {
    const nodes = [{ id: 'card-a' }, { id: 'text-1' }]   // card-b gone
    expect(canApplyForward(batchEntry(), { nodes }).ok).toBe(false)
  })

  it('refuses malformed entries in both directions', () => {
    const bad = batchEntry({ cards: [{ dbCardRow: {} }] })
    expect(canApplyInverse(bad, { nodes: [] }).ok).toBe(false)
    expect(canApplyForward(bad, { nodes: [] }).ok).toBe(false)

    const empty = batchEntry({ cards: [], textNodes: [] })
    expect(canApplyInverse(empty, { nodes: [] }).ok).toBe(false)
  })
})

describe('batchDelete — applyInverse (one Ctrl+Z restores everything)', () => {
  it('persists the restore with the full snapshot (deduped connections intact)', async () => {
    await applyInverse(batchEntry(), {})
    expect(restoreBatchDelete).toHaveBeenCalledWith({ cards, connections, textNodes })
  })

  it('optimistically restores both cards AND the text node in one setNodes pass', async () => {
    const setNodes = vi.fn()
    await applyInverse(batchEntry(), { setNodes })

    const updater = setNodes.mock.calls[0][0]
    const result = updater([{ id: 'survivor' }])
    expect(result).toHaveLength(4)

    const strahd = result.find((n) => n.id === 'card-a')
    expect(strahd.position).toEqual({ x: 100, y: 200 })
    expect(strahd.data.type).toBe('character')
    expect(strahd.data.storyNotes.map((b) => b.value)).toEqual(['born ~1346'])

    const text = result.find((n) => n.id === 'text-1')
    expect(text.type).toBe('textNode')
    expect(text.data.text).toBe('<p>hi</p>')
    expect(text.data.fontSize).toBe(18)
  })

  it('restores the shared connection exactly once via setEdges (the connected-pair case)', async () => {
    const setEdges = vi.fn()
    await applyInverse(batchEntry(), { setEdges })

    const updater = setEdges.mock.calls[0][0]
    const result = updater([])
    expect(result.filter((e) => e.id === 'edge-shared')).toHaveLength(1)
    expect(result.map((e) => e.id).sort()).toEqual(['edge-out', 'edge-shared'])
  })

  it('is idempotent against the Realtime echo (no duplicate nodes/edges)', async () => {
    const setNodes = vi.fn()
    const setEdges = vi.fn()
    await applyInverse(batchEntry(), { setNodes, setEdges })

    const haveNodes = [{ id: 'card-a' }, { id: 'card-b' }, { id: 'text-1' }]
    expect(setNodes.mock.calls[0][0](haveNodes)).toBe(haveNodes)

    const haveEdges = [{ id: 'edge-shared' }, { id: 'edge-out' }]
    expect(setEdges.mock.calls[0][0](haveEdges)).toBe(haveEdges)
  })
})

describe('batchDelete — applyForward (redo re-deletes everything)', () => {
  it('removes all items + their edges optimistically and issues one batch delete', async () => {
    const setNodes = vi.fn()
    const setEdges = vi.fn()
    await applyForward(batchEntry(), { setNodes, setEdges })

    expect(setNodes.mock.calls[0][0]([
      { id: 'card-a' }, { id: 'card-b' }, { id: 'text-1' }, { id: 'survivor' },
    ])).toEqual([{ id: 'survivor' }])

    expect(setEdges.mock.calls[0][0]([
      { id: 'edge-shared', source: 'card-a', target: 'card-b' },
      { id: 'edge-out',    source: 'card-a', target: 'survivor' },
      { id: 'edge-other',  source: 'survivor', target: 'bystander' },
    ])).toEqual([{ id: 'edge-other', source: 'survivor', target: 'bystander' }])

    expect(deleteBatch).toHaveBeenCalledWith({
      cardIds:     ['card-a', 'card-b'],
      textNodeIds: ['text-1'],
    })
  })
})
