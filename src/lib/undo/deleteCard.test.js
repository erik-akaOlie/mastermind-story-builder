// deleteCard — phase 5 (the hard one).
// Entry carries the full DB-shape snapshot of the card + sections + edges
// captured before deletion. Inverse rebuilds React state from snapshot then
// calls restoreCardWithDependents. Forward = deleteNode + optimistic filter.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  // Pull in the real dbNodeToReactFlow so the deleteCard inverse rebuild
  // exercises the real DB→React marshaling (it's a pure function with no
  // Supabase dependency).
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    deleteNode:                 vi.fn(async () => {}),
    restoreCardWithDependents:  vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './deleteCard.js'
import { ACTION_TYPES } from './index.js'
import { deleteNode, restoreCardWithDependents } from '../nodes.js'
import { useTypeStore } from '../../store/useTypeStore.js'

beforeEach(() => {
  deleteNode.mockClear()
  restoreCardWithDependents.mockClear()
})

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

describe('deleteCard — canApply*', () => {
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

describe('deleteCard — applyInverse (the hard one)', () => {
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

describe('deleteCard — applyForward', () => {
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
