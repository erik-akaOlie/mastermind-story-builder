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

import { describe, it, expect, vi, beforeEach } from 'vitest'

// buildDeleteCardSnapshot reads section content from the DB; mock the client.
// The pure functions (dbNodeToReactFlow / normalizeBullets) don't touch it.
vi.mock('./supabase.js', () => ({ supabase: { from: vi.fn() } }))

import { dbNodeToReactFlow, normalizeBullets, buildDeleteCardSnapshot, duplicateCard, updateNodeSections } from './nodes.js'
import { supabase } from './supabase.js'

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

  it("returns a null type and logs an error when type_id can't be resolved", () => {
    // Previously this case fell back to a hardcoded 'story' label, which
    // silently relabeled a data-integrity problem as a real card type.
    // Per ADR-0014 discipline #1 (no hardcoded type-name defaults), we now
    // surface the corruption: type is null, and an error is logged so the
    // condition is visible in dev.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const orphanedRow = { ...baseDbRow, type_id: 'unknown-type-id' }
    const result = dbNodeToReactFlow(orphanedRow, {}, nodeTypesById)
    expect(result.data.type).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('unresolved type_id=unknown-type-id'),
    )
    errorSpy.mockRestore()
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

// ─────────────────────────────────────────────────────────────────────────────
// buildDeleteCardSnapshot — content-complete, fail-closed capture for the
// undo-delete round-trip (ADR-0016 Chunk E1). The snapshot must read SECTION
// content from the DB (so the GM zone, which is never in canvas memory, is
// captured) and must THROW on a fetch error so the caller can refuse the delete
// rather than leave the user with an un-undoable removal.
// ─────────────────────────────────────────────────────────────────────────────

describe('buildDeleteCardSnapshot — content-complete, fail-closed capture', () => {
  const cardId = 'card-1'
  // The in-memory node carries deliberately STALE section content. The snapshot
  // must ignore it and read the DB instead.
  const nodes = [{
    id: cardId,
    position: { x: 10, y: 20 },
    data: {
      type: 'character',
      label: 'Strahd',
      summary: 'Vampire lord',
      avatar: 'avatars/strahd.webp',
      storyNotes: [{ id: 'x', value: 'STALE in-memory note' }],
    },
  }]
  const edges = [
    { id: 'e1', source: cardId, target: 'ireena' },
    { id: 'e2', source: 'unrelated-a', target: 'unrelated-b' },
  ]
  const opts = () => ({
    nodes, edges, workspaceId: 'ws-1', typeIdByKey: { character: 'type-char' },
  })

  // Build the chained supabase mock: from('node_sections').select(...).eq(...) → result.
  function mockSectionFetch(result) {
    const eq = vi.fn().mockResolvedValue(result)
    const select = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ select })
    return { select, eq }
  }

  beforeEach(() => {
    supabase.from.mockReset()
  })

  it('reads ALL section kinds from the DB — incl. gm_only, never from canvas memory', async () => {
    mockSectionFetch({
      data: [
        { kind: 'card_view', content: { blocks: 'cv' }, sort_order: 0 },
        { kind: 'gm_only',   content: { blocks: 'gm' }, sort_order: 1 },
        { kind: 'narrative', content: ['legacy bullet'], sort_order: 0 },
      ],
      error: null,
    })

    const snap = await buildDeleteCardSnapshot(cardId, opts())

    // gm_only (never in canvas memory) is present and lossless.
    expect(snap.dbSectionRows).toEqual([
      { node_id: cardId, kind: 'card_view', content: { blocks: 'cv' }, sort_order: 0 },
      { node_id: cardId, kind: 'gm_only',   content: { blocks: 'gm' }, sort_order: 1 },
      { node_id: cardId, kind: 'narrative', content: ['legacy bullet'], sort_order: 0 },
    ])
    // The stale in-memory storyNotes never leak into the snapshot.
    expect(JSON.stringify(snap.dbSectionRows)).not.toContain('STALE in-memory note')
  })

  it('captures the card row from state plus only this card\'s connections', async () => {
    mockSectionFetch({ data: [], error: null })

    const snap = await buildDeleteCardSnapshot(cardId, opts())

    expect(snap.dbCardRow).toMatchObject({
      id: cardId, workspace_id: 'ws-1', type_id: 'type-char',
      label: 'Strahd', avatar_url: 'avatars/strahd.webp',
      position_x: 10, position_y: 20,
    })
    // e2 (unrelated) is excluded; only edges touching this card survive.
    expect(snap.dbConnectionRows).toEqual([
      { id: 'e1', workspace_id: 'ws-1', source_node_id: cardId, target_node_id: 'ireena' },
    ])
  })

  // The fail-closed proof: a fetch error must propagate so onDeleteNode aborts.
  it('THROWS when the section fetch errors (caller fails closed — no delete, no undo entry)', async () => {
    mockSectionFetch({ data: null, error: { message: 'network down' } })

    await expect(buildDeleteCardSnapshot(cardId, opts()))
      .rejects.toEqual({ message: 'network down' })
  })

  it('returns null without touching the DB when the card is not in local state', async () => {
    const snap = await buildDeleteCardSnapshot('ghost-id', opts())
    expect(snap).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// duplicateCard — content-complete copy, kind-agnostic, no connections
// (ADR-0016 Chunk E2). Copies EVERY source section row (incl. the new block
// zones, which never live in canvas memory) from the DB under the new id.
// Connections are not copied; a duplicate enters the graph unconnected.
// ─────────────────────────────────────────────────────────────────────────────

describe('duplicateCard — content-complete copy, no connections', () => {
  // Route the chained supabase calls per table:
  //   nodes.insert(row).select().single()           → new card row
  //   node_sections.select(...).eq('node_id', src)  → the source's section rows
  //   node_sections.insert(copies)                  → captured for assertions
  function mockBackend({ sourceSections }) {
    const captured = { sectionInsert: null }
    supabase.from.mockImplementation((table) => {
      if (table === 'nodes') {
        return {
          insert: (row) => ({
            select: () => ({
              single: async () => ({ data: { id: 'dup-id', ...row }, error: null }),
            }),
          }),
        }
      }
      if (table === 'node_sections') {
        return {
          select: () => ({ eq: async () => ({ data: sourceSections, error: null }) }),
          insert: async (rows) => { captured.sectionInsert = rows; return { error: null } },
        }
      }
      throw new Error(`unexpected table ${table}`)
    })
    return captured
  }

  beforeEach(() => { supabase.from.mockReset() })

  const baseArgs = {
    sourceId: 'src-1',
    workspaceId: 'ws-1',
    typeId: 'type-character-uuid',
    typeKey: 'character',
    label: 'Strahd',
    summary: 'Vampire lord',
    avatarUrl: 'avatars/strahd.webp',
    positionX: 340,
    positionY: 440,
  }

  it('copies EVERY source section kind (card_view + gm_only + legacy) under the new id', async () => {
    const captured = mockBackend({
      sourceSections: [
        { kind: 'card_view', content: { blocks: 'cv' }, sort_order: 0 },
        { kind: 'gm_only',   content: { blocks: 'gm' }, sort_order: 1 },
        { kind: 'narrative', content: ['a bullet'],     sort_order: 0 },
      ],
    })

    const dup = await duplicateCard(baseArgs)

    // Every kind copied, re-pointed at the new node id, content + sort_order intact.
    expect(captured.sectionInsert).toEqual([
      { node_id: 'dup-id', kind: 'card_view', content: { blocks: 'cv' }, sort_order: 0 },
      { node_id: 'dup-id', kind: 'gm_only',   content: { blocks: 'gm' }, sort_order: 1 },
      { node_id: 'dup-id', kind: 'narrative', content: ['a bullet'],     sort_order: 0 },
    ])
    // The returned React node carries the player-facing zone so the canvas
    // preview renders immediately, plus the copied core fields.
    expect(dup.id).toBe('dup-id')
    expect(dup.data.cardView).toEqual({ blocks: 'cv' })
    expect(dup.data.label).toBe('Strahd')
    expect(dup.position).toEqual({ x: 340, y: 440 })
  })

  it('handles a source with no section rows (brand-new / blank card) without inserting', async () => {
    const captured = mockBackend({ sourceSections: [] })

    const dup = await duplicateCard(baseArgs)

    expect(captured.sectionInsert).toBeNull()   // no section insert issued
    expect(dup.id).toBe('dup-id')
    expect(dup.data.cardView).toBeNull()        // falls back to legacy/empty render
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// updateNodeSections — must NEVER wipe the block-editor zones (ADR-0016
// coexistence bugfix). The legacy auto-save (onUpdateNode → updateNodeSections
// → writeSections) used to delete EVERY node_sections row for the card and
// rewrite only the four legacy kinds, destroying card_view / gm_only and
// causing sporadic content loss. The delete must be scoped to the legacy kinds.
// ─────────────────────────────────────────────────────────────────────────────

describe('updateNodeSections — legacy save never deletes block-editor zones', () => {
  beforeEach(() => { supabase.from.mockReset() })

  it("scopes its delete to legacy kinds only — card_view / gm_only untouched", async () => {
    // Capture the delete chain: delete().eq('node_id', id).in('kind', KINDS)
    const inFilter = vi.fn().mockResolvedValue({ error: null })
    const eqFilter = vi.fn().mockReturnValue({ in: inFilter })
    const del = vi.fn().mockReturnValue({ eq: eqFilter })
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ delete: del, insert })

    await updateNodeSections('n1', {
      storyNotes: [], hiddenLore: [], dmNotes: [], media: [],
    })

    expect(eqFilter).toHaveBeenCalledWith('node_id', 'n1')
    // The decisive assertion: the delete is filtered to the four legacy kinds,
    // so the block zones (card_view / gm_only) are never in the delete's scope.
    expect(inFilter).toHaveBeenCalledWith('kind', ['narrative', 'hidden_lore', 'dm_notes', 'media'])
  })
})
