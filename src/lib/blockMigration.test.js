// Tests for the migration VERIFIER and its support helpers. The verifier is the
// load-bearing safety check behind the "saved data survived the database
// round-trip" claim — so these tests prove it actually CATCHES loss, not just
// that it passes clean data. A verifier that never fails is worse than none.
//
// The Supabase I/O (loadCards / writeMigrated / verifyMigrated / runBlockMigration)
// is exercised live by Erik through the #migrate-blocks tool — it is auth-gated
// and not unit-tested here. The pure logic below is what we can prove offline.

import { describe, it, expect } from 'vitest'
import { jsonEqual, checkNoLoss, classifyCard } from './blockMigration.js'
import { migrateCardToBlocks } from './migrateCardToBlocks.js'

const bullet = (value) => ({ id: crypto.randomUUID(), value })

function sampleSource() {
  return {
    summary: 'A brooding vampire lord who rules Barovia.',
    storyNotes: [bullet('Rules the valley'), bullet('Obsessed with Tatyana')],
    hiddenLore: [bullet('Fears the dawn')],
    dmNotes: [bullet('Voice: slow and formal')],
    media: [
      { path: 'ws-1/card-1/insp-a.full.webp', alt: '', uploaded_at: '2026-01-01T00:00:00.000Z' },
      'https://example.com/legacy.png',
    ],
  }
}

describe('jsonEqual', () => {
  it('treats objects with reordered keys as equal (survives JSONB round-trip)', () => {
    expect(jsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(jsonEqual([{ x: 1, y: 2 }], [{ y: 2, x: 1 }])).toBe(true)
  })
  it('keeps array order significant', () => {
    expect(jsonEqual([1, 2], [2, 1])).toBe(false)
  })
  it('distinguishes different values, shapes, and null/undefined', () => {
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(jsonEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(jsonEqual(null, undefined)).toBe(false)
    expect(jsonEqual('x', 'x')).toBe(true)
  })
})

describe('checkNoLoss — passes intact migrations', () => {
  it('reports zero issues when saved zones match the converter output', () => {
    const source = sampleSource()
    const { card_view, gm_only } = migrateCardToBlocks(source)
    expect(checkNoLoss(source, card_view, gm_only)).toEqual([])
  })

  it('passes an empty card (only a Connections block in the GM zone)', () => {
    const source = { summary: '', storyNotes: [], hiddenLore: [], dmNotes: [], media: [] }
    const { card_view, gm_only } = migrateCardToBlocks(source)
    expect(checkNoLoss(source, card_view, gm_only)).toEqual([])
  })
})

describe('checkNoLoss — CATCHES loss (the point of the verifier)', () => {
  it('flags a missing card_view zone', () => {
    const source = sampleSource()
    const { gm_only } = migrateCardToBlocks(source)
    const issues = checkNoLoss(source, null, gm_only)
    expect(issues.join(' ')).toMatch(/card_view/)
  })

  it('flags a dropped Story Note', () => {
    const source = sampleSource()
    const { card_view, gm_only } = migrateCardToBlocks(source)
    const lossy = card_view.filter((b) => b.type !== 'bulletListItem') // strip Discoverable Lore bullets
    expect(checkNoLoss(source, lossy, gm_only)).toContain('Discoverable Lore bullets do not match Story Notes')
  })

  it('flags lost Hidden Lore / DM Notes', () => {
    const source = sampleSource()
    const { card_view, gm_only } = migrateCardToBlocks(source)
    const lossy = gm_only.filter((b) => b.type !== 'bulletListItem')
    expect(checkNoLoss(source, card_view, lossy)).toContain('Notes bullets do not match Hidden Lore + DM Notes')
  })

  it('flags missing Image Album when there were Image Section images', () => {
    const source = sampleSource()
    const { card_view, gm_only } = migrateCardToBlocks(source)
    const lossy = gm_only.filter((b) => b.type !== 'imageAlbum')
    expect(checkNoLoss(source, card_view, lossy)).toContain('Image Album missing despite Image Section images')
  })

  it('flags an Image Album whose images were altered', () => {
    const source = sampleSource()
    const { card_view, gm_only } = migrateCardToBlocks(source)
    const tampered = gm_only.map((b) =>
      b.type === 'imageAlbum' ? { ...b, props: { images: JSON.stringify([{ path: 'WRONG' }]) } } : b
    )
    expect(checkNoLoss(source, card_view, tampered)).toContain('Image Album images do not match Image Section')
  })

  it('flags a missing Connections block', () => {
    const source = sampleSource()
    const { card_view, gm_only } = migrateCardToBlocks(source)
    const lossy = gm_only.filter((b) => b.type !== 'connections')
    expect(checkNoLoss(source, card_view, lossy)).toContain('Connections block missing from GM zone')
  })

  it('flags a lost Summary', () => {
    const source = sampleSource()
    const { card_view, gm_only } = migrateCardToBlocks(source)
    const lossy = card_view.filter((b) => !(b.type === 'paragraph')) // drop the summary paragraph
    expect(checkNoLoss(source, lossy, gm_only)).toContain('Summary text not found in Card View')
  })
})

describe('classifyCard — idempotency decision (B1)', () => {
  it('marks an un-migrated card as needing migration', () => {
    const source = sampleSource()
    const { upToDate, fresh } = classifyCard({ source, existing: { card_view: null, gm_only: null } })
    expect(upToDate).toBe(false)
    expect(Array.isArray(fresh.card_view)).toBe(true)
  })

  it('marks a card whose saved rows match current output as up-to-date (skip on re-run)', () => {
    const source = sampleSource()
    const fresh = migrateCardToBlocks(source)
    const { upToDate } = classifyCard({ source, existing: { card_view: fresh.card_view, gm_only: fresh.gm_only } })
    expect(upToDate).toBe(true)
  })

  it('marks a card with stale saved rows as needing migration (re-apply converter change)', () => {
    const source = sampleSource()
    const { upToDate } = classifyCard({
      source,
      existing: { card_view: [{ type: 'paragraph', content: 'old output' }], gm_only: [{ type: 'connections', props: {} }] },
    })
    expect(upToDate).toBe(false)
  })
})
