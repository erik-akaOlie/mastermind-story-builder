// ============================================================================
// Tests for the DB <-> React marshaling layer.
// ----------------------------------------------------------------------------
// dbNodeToReactFlow is the most fragile function in the project: it translates
// a Postgres `nodes` row + a separate-kind-keyed map of section content into
// the flat React shape the canvas works with. Drift here causes silent data
// corruption — bullets ending up in the wrong section, sections disappearing,
// types defaulting incorrectly. These tests pin down the contract.
//
// Run with: npm test
// ============================================================================

import { describe, it, expect } from 'vitest'
import { dbNodeToReactFlow } from './nodes.js'

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

describe('dbNodeToReactFlow', () => {
  it('translates a full DB row + all four section kinds into the flat React shape', () => {
    const sections = {
      narrative:    ['Born ~1346', 'Cursed in 1346'],
      hidden_lore:  ['Truly believes Tatyana is reincarnating'],
      dm_notes:     ['Voice: slow, deliberate'],
      media:        ['https://example.com/portrait.jpg'],
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
        storyNotes:  ['Born ~1346', 'Cursed in 1346'],
        hiddenLore:  ['Truly believes Tatyana is reincarnating'],
        dmNotes:     ['Voice: slow, deliberate'],
        media:       ['https://example.com/portrait.jpg'],
        locked:      false,
      },
    })
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
