import { describe, it, expect, beforeEach } from 'vitest'
import {
  sortWorkspaces,
  readSortId,
  writeSortId,
  getSortOption,
  DEFAULT_SORT_ID,
} from './workspaceSort.js'

const rows = [
  { id: 'a', name: 'The Zephyr', created_at: '2026-01-01T00:00:00Z', last_activity_at: '2026-06-10T00:00:00Z' },
  { id: 'b', name: 'apple',      created_at: '2026-03-01T00:00:00Z', last_activity_at: '2026-06-01T00:00:00Z' },
  { id: 'c', name: 'Mango',      created_at: '2026-02-01T00:00:00Z', last_activity_at: '2026-06-18T00:00:00Z' },
]
const ids = (arr) => arr.map((r) => r.id)

describe('sortWorkspaces', () => {
  it('never mutates the input array', () => {
    const copy = [...rows]
    sortWorkspaces(rows, 'alphabetical')
    expect(rows).toEqual(copy)
  })

  it('Alphabetical: A→Z, case-insensitive, ignoring a leading "The "', () => {
    // apple, Mango, (The) Zephyr
    expect(ids(sortWorkspaces(rows, 'alphabetical'))).toEqual(['b', 'c', 'a'])
  })

  it('Date created: oldest → newest', () => {
    expect(ids(sortWorkspaces(rows, 'created'))).toEqual(['a', 'c', 'b'])
  })

  it('Recently active: newest → oldest (default)', () => {
    expect(DEFAULT_SORT_ID).toBe('modified')
    expect(ids(sortWorkspaces(rows, 'modified'))).toEqual(['c', 'a', 'b'])
  })

  it('falls back to the default option for an unknown id', () => {
    expect(getSortOption('bogus')).toBe(getSortOption(DEFAULT_SORT_ID))
  })

  it('breaks timestamp ties deterministically by name', () => {
    const tied = [
      { id: 'x', name: 'Beta',  last_activity_at: '2026-06-01T00:00:00Z' },
      { id: 'y', name: 'Alpha', last_activity_at: '2026-06-01T00:00:00Z' },
    ]
    expect(ids(sortWorkspaces(tied, 'modified'))).toEqual(['y', 'x'])
  })
})

describe('sort persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns the default when nothing is stored', () => {
    expect(readSortId()).toBe(DEFAULT_SORT_ID)
  })

  it('round-trips a valid id and rejects a bad one', () => {
    writeSortId('alphabetical')
    expect(readSortId()).toBe('alphabetical')
    localStorage.setItem('mastermind:workspace-sort', 'garbage')
    expect(readSortId()).toBe(DEFAULT_SORT_ID)
  })
})
