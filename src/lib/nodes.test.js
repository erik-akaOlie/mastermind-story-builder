// ============================================================================
// Tests for the DB <-> React marshaling layer.
// ----------------------------------------------------------------------------
// dbNodeToReactFlow is the most fragile function in the project: it translates
// a Postgres `nodes` row + a separate-kind-keyed map of section content into
// the flat React shape the canvas works with. Drift here causes silent data
// corruption — bullets ending up in the wrong section, sections disappearing,
// types defaulting incorrectly. These tests pin down the contract.
//
// Phase 7b adds bullet-shape normalization: narrative / hidden_lore / dm_notes
// JSONB stores `{id, value}[]` going forward; legacy `string[]` data is
// promoted lazily on read via normalizeBullets. The tests cover both shapes
// and the round-trip property.
//
// Run with: npm test
// ============================================================================

import { describe, it, expect } from 'vitest'
import { dbNodeToReactFlow, normalizeBullets } from './nodes.js'

const baseDbRow = {
  id: 'node-1',
  label: 'Strahd von Zarovich',
  summary: 'The vampire lord of Barovia',
  avatar_url: 'https://example.com/strahd.jpg',
  position_x: 100,
  position_y: 200,
  type_id: 'type-character-uuid',
}

const nodeTypesById = {
  'type-character-uuid': { key: 'character' },
  'type-location-uuid':  { key: 'location' },
}

// Test helper: assert the array is in the structured `{id, value}[]` shape
// with non-empty unique IDs and the expected sequence of values.
function expectStructuredBullets(arr, expectedValues) {
  expect(Array.isArray(arr)).toBe(true)
  expect(arr).toHaveLength(expectedValues.length)
  for (let i = 0; i < arr.length; i++) {
    expect(arr[i]).toEqual({ id: expect.any(String), value: expectedValues[i] })
    expect(arr[i].id).not.toBe('')
  }
  // No duplicate IDs.
  const ids = arr.map((b) => b.id)
  expect(new Set(ids).size).toBe(ids.length)
}

describe('dbNodeToReactFlow', () => {
  it('translates a full DB row + structured section input into the flat React shape', () => {
    const sections = {
      narrative: [
        { id: 'b1', value: 'Born ~1346' },
        { id: 'b2', value: 'Cursed in 1346' },
      ],
      hidden_lore: [{ id: 'b3', value: 'Truly believes Tatyana is reincarnating' }],
      dm_notes:    [{ id: 'b4', value: 'Voice: slow, deliberate' }],
      media:       ['https://example.com/portrait.jpg'],
    }

    const result = dbNodeToReactFlow(baseDbRow, sections, nodeTypesById)

    expect(result).toMatchObject({
      id: 'node-1',
      type: 'campaignNode',
      position: { x: 100, y: 200 },
      data: {
        id:          'node-1',
        label:       'Strahd von Zarovich',
        type:        'character',
        avatar:      'https://example.com/strahd.jpg',
        summary:     'The vampire lord of Barovia',
        storyNotes:  [
          { id: 'b1', value: 'Born ~1346' },
          { id: 'b2', value: 'Cursed in 1346' },
        ],
        hiddenLore:  [{ id: 'b3', value: 'Truly believes Tatyana is reincarnating' }],
        dmNotes:     [{ id: 'b4', value: 'Voice: slow, deliberate' }],
        media:       ['https://example.com/portrait.jpg'],
        locked:      false,
      },
    })
  })

  it('promotes legacy string[] bullet sections to {id, value}[] with fresh UUIDs', () => {
    const sections = {
      narrative:    ['Born ~1346', 'Cursed in 1346'],
      hidden_lore:  ['Truly believes Tatyana is reincarnating'],
      dm_notes:     ['Voice: slow, deliberate'],
      media:        ['https://example.com/portrait.jpg'],
    }
    const result = dbNodeToReactFlow(baseDbRow, sections, nodeTypesById)

    expectStructuredBullets(result.data.storyNotes, ['Born ~1346', 'Cursed in 1346'])
    expectStructuredBullets(result.data.hiddenLore, ['Truly believes Tatyana is reincarnating'])
    expectStructuredBullets(result.data.dmNotes,    ['Voice: slow, deliberate'])
    // Media isn't a bullet kind — it stays as-is.
    expect(result.data.media).toEqual(['https://example.com/portrait.jpg'])
  })

  it('defaults all four sections to empty arrays when none are provided (new node)', () => {
    const result = dbNodeToReactFlow(baseDbRow, {}, nodeTypesById)

    expect(result.data.storyNotes).toEqual([])
    expect(result.data.hiddenLore).toEqual([])
    expect(result.data.dmNotes).toEqual([])
    expect(result.data.media).toEqual([])
  })

  it("falls back to 'story' type when type_id isn't in the lookup map", () => {
    const orphanedRow = { ...baseDbRow, type_id: 'unknown-type-id' }
    const result = dbNodeToReactFlow(orphanedRow, {}, nodeTypesById)
    expect(result.data.type).toBe('story')
  })

  it('coerces string-shaped numerics from Postgres into real numbers for position', () => {
    // Supabase often serializes numeric columns as strings. The flat React
    // shape must always be { x: number, y: number } so React Flow renders.
    const stringPositionRow = { ...baseDbRow, position_x: '150.5', position_y: '300' }
    const result = dbNodeToReactFlow(stringPositionRow, {}, nodeTypesById)
    expect(result.position).toEqual({ x: 150.5, y: 300 })
    expect(typeof result.position.x).toBe('number')
    expect(typeof result.position.y).toBe('number')
  })

  it('keeps avatar null when avatar_url is null (no broken img src)', () => {
    const noAvatarRow = { ...baseDbRow, avatar_url: null }
    const result = dbNodeToReactFlow(noAvatarRow, {}, nodeTypesById)
    expect(result.data.avatar).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// normalizeBullets — phase 7b. The single source of truth for the bullet
// `{id, value}[]` shape contract. Every consumer that reads bullet content
// from a non-trusted source (DB rows, Realtime payloads, optimistic state
// from another tab) goes through this helper.
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeBullets', () => {
  it('returns an empty array for null / undefined / non-array input (defensive)', () => {
    expect(normalizeBullets(null)).toEqual([])
    expect(normalizeBullets(undefined)).toEqual([])
    expect(normalizeBullets({})).toEqual([])
    expect(normalizeBullets('not an array')).toEqual([])
  })

  it('promotes plain strings to {id, value} entries with fresh UUIDs', () => {
    const result = normalizeBullets(['A', 'B', 'C'])
    expectStructuredBullets(result, ['A', 'B', 'C'])
  })

  it('preserves stable IDs on already-structured input (no regeneration churn)', () => {
    const input = [
      { id: 'stable-1', value: 'A' },
      { id: 'stable-2', value: 'B' },
    ]
    const result = normalizeBullets(input)
    expect(result).toEqual(input)
    // Same ids back, in the same order.
    expect(result.map((b) => b.id)).toEqual(['stable-1', 'stable-2'])
  })

  it('mints fresh UUIDs for entries with missing or empty ids', () => {
    const result = normalizeBullets([
      { id: '',          value: 'A' },
      { id: undefined,   value: 'B' },
      { id: null,        value: 'C' },
      { /* no id */       value: 'D' },
    ])
    expectStructuredBullets(result, ['A', 'B', 'C', 'D'])
  })

  // Erik's specific scenario #1: duplicate text. Position-and-value matching
  // would treat these as the same item; ID-based identity must distinguish them.
  it("assigns distinct IDs to duplicate-text bullets (Erik's trust scenario #1)", () => {
    const result = normalizeBullets(['TODO', 'TODO', 'TODO'])
    expect(result).toHaveLength(3)
    const ids = result.map((b) => b.id)
    expect(new Set(ids).size).toBe(3) // all three IDs are distinct
    expect(result.map((b) => b.value)).toEqual(['TODO', 'TODO', 'TODO'])
  })

  it('coerces malformed entries to {id, value} without losing user data', () => {
    const result = normalizeBullets([
      'plain string',
      { id: 'good', value: 'structured' },
      42,                         // wrong type
      { value: 'no id at all' },  // missing id
      null,                       // really wrong
    ])
    expect(result).toHaveLength(5)
    expect(result.map((b) => b.value)).toEqual([
      'plain string', 'structured', '42', 'no id at all', '',
    ])
    // Every entry still has a non-empty id.
    expect(result.every((b) => typeof b.id === 'string' && b.id.length > 0)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Round-trip + identity-stability tests. Erik called these out in the 7b plan:
// generated IDs must stay stable once the data exists in structured form,
// across the typical mutations a per-item undo system will rely on (delete
// first, reorder, edit). 7c's per-item action types build directly on these
// stability guarantees.
// ─────────────────────────────────────────────────────────────────────────────

describe('phase 7b — bullet identity stability across array mutations', () => {
  // Erik's specific scenario #2: deleting the first bullet must not shuffle
  // identity onto the remaining bullets — those keep their original IDs.
  it('deleting the first bullet preserves IDs of the surviving bullets', () => {
    const bullets = [
      { id: 'b1', value: 'first' },
      { id: 'b2', value: 'middle' },
      { id: 'b3', value: 'last' },
    ]
    // Drop the first.
    const after = bullets.slice(1)
    // Re-normalize to simulate a Realtime echo / re-render path.
    const normalized = normalizeBullets(after)
    expect(normalized).toEqual([
      { id: 'b2', value: 'middle' },
      { id: 'b3', value: 'last' },
    ])
    // The IDs are exactly the same as the survivors had before — no
    // position-based re-keying.
  })

  // Erik's specific scenario #3: reordering must keep IDs attached to the
  // bullet that moved, NOT to the position they were at.
  it('reordering bullets carries IDs with their values', () => {
    const bullets = [
      { id: 'b1', value: 'first' },
      { id: 'b2', value: 'middle' },
      { id: 'b3', value: 'last' },
    ]
    // Drag 'first' to the end: [middle, last, first].
    const reordered = [bullets[1], bullets[2], bullets[0]]
    const normalized = normalizeBullets(reordered)
    expect(normalized).toEqual([
      { id: 'b2', value: 'middle' },
      { id: 'b3', value: 'last' },
      { id: 'b1', value: 'first' },
    ])
    // Each id is still attached to its original value, regardless of position.
  })

  it('round-trips the structured form unchanged (DB → React → write-back input)', () => {
    // Simulate the marshaling cycle: DB stores structured → dbNodeToReactFlow
    // produces React shape → consumer eventually writes the same shape back.
    const dbContent = [
      { id: 'b1', value: 'A' },
      { id: 'b2', value: 'B' },
    ]
    const react = dbNodeToReactFlow(
      baseDbRow,
      { narrative: dbContent, hidden_lore: [], dm_notes: [], media: [] },
      nodeTypesById,
    )
    expect(react.data.storyNotes).toEqual(dbContent)

    // Editing one value: id must follow the bullet, not get regenerated.
    const edited = react.data.storyNotes.map((b) =>
      b.id === 'b1' ? { ...b, value: 'A edited' } : b,
    )
    expect(edited).toEqual([
      { id: 'b1', value: 'A edited' },
      { id: 'b2', value: 'B' },
    ])
  })

  it('two normalizations of the same legacy input produce different IDs (lazy-not-deterministic)', () => {
    // Lazy normalize-on-read does NOT cache IDs across calls. This is by
    // design: once the structured form is persisted, every read receives
    // the persisted IDs. Until then, ID stability is session-local.
    //
    // 7c builds on this contract: per-item undo entries created in a
    // session that hasn't yet persisted the structured form become stale
    // on F5; canApplyInverse refuses, which is the right thing.
    const legacy = ['A', 'B']
    const a = normalizeBullets(legacy)
    const b = normalizeBullets(legacy)
    expect(a.map((x) => x.value)).toEqual(b.map((x) => x.value))
    expect(a.map((x) => x.id)).not.toEqual(b.map((x) => x.id))
  })
})
