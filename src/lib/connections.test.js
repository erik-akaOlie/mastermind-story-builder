// connections data layer — the one-line-per-pair invariant's client half.
// Migration 009 adds a DB unique index on the unordered (source, target)
// pair; createConnection must treat the resulting 23505 insert violation as
// a benign no-op (return null), NOT an error — otherwise persistWrite would
// retry a write that can never succeed and raise the save-failure overlay.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase.js', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./errorReporting.js', () => ({
  persistWrite: vi.fn((fn) => fn()),
}))

import { createConnection } from './connections.js'
import { supabase } from './supabase.js'

function mockInsertResult(result) {
  supabase.from.mockReturnValue({
    insert: () => ({
      select: () => ({
        single: async () => result,
      }),
    }),
  })
}

describe('createConnection — unique-pair handling', () => {
  it('returns the React Flow edge on a normal insert', async () => {
    mockInsertResult({
      data: { id: 'c1', source_node_id: 'a', target_node_id: 'b' },
      error: null,
    })
    expect(await createConnection({ workspaceId: 'w1', sourceNodeId: 'a', targetNodeId: 'b' }))
      .toEqual({ id: 'c1', source: 'a', target: 'b', type: 'floating' })
  })

  it('returns null (benign no-op) when the pair is already connected (23505)', async () => {
    mockInsertResult({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    expect(await createConnection({ workspaceId: 'w1', sourceNodeId: 'a', targetNodeId: 'b' }))
      .toBeNull()
  })

  it('still throws on any other insert error', async () => {
    mockInsertResult({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })
    await expect(
      createConnection({ workspaceId: 'w1', sourceNodeId: 'a', targetNodeId: 'b' })
    ).rejects.toMatchObject({ code: '42501' })
  })
})
