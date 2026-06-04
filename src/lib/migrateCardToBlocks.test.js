// No-loss migration test (written BEFORE the migration logic, per the Phase-1
// plan). This is the correctness gate for converting a card's existing fielded
// content into the two BlockNote block-JSON zones of the new editor:
//
//   Card View   (kind 'card_view') ← Summary + Discoverable Lore (was Story Notes)
//   GM's Eyes Only (kind 'gm_only') ← Notes (Hidden Lore then DM Notes, merged)
//                                     + Image Album (the Image Section images)
//                                     + a Connections block (reads live rows)
//
// The hard requirement is ZERO content loss. Every assertion here exists to
// prove a specific field survives the round-trip:
//   - Summary text                          → somewhere in card_view
//   - Story Notes bullets                   → "Discoverable Lore" bullets, in order
//   - Hidden Lore + DM Notes bullets        → "Notes" bullets, hidden-lore-first
//   - Image Section images                  → an Image Album block, byte-for-byte
//   - Connections                           → NOT copied into content; a live
//                                             Connections block is emitted and the
//                                             connections table is left untouched
//
// `migrateCardToBlocks` is a PURE function: (card content) → { card_view, gm_only }.
// It does not touch Supabase and does not receive connection rows, so it
// structurally cannot lose or duplicate a connection. The one-shot migration
// tool (built next) wraps this and persists the result.

import { describe, it, expect } from 'vitest'
import { migrateCardToBlocks } from './migrateCardToBlocks.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
// Tolerant extractors over BlockNote block JSON. They accept both the string
// shorthand (`content: 'text'`) and the canonical inline-array form
// (`content: [{ type: 'text', text, styles }]`) so the implementation is free
// to emit either — the contract is about content preserved, not exact shape.

function inlineText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((it) => {
      if (it.type === 'text') return it.text ?? ''
      if (it.type === 'nodeLink') return it.props?.label ?? ''
      return ''
    })
    .join('')
}

const blocksOfType = (blocks, type) => blocks.filter((b) => b.type === type)
const headingTexts = (blocks) => blocksOfType(blocks, 'heading').map((b) => inlineText(b.content))
const bulletTexts = (blocks) => blocksOfType(blocks, 'bulletListItem').map((b) => inlineText(b.content))
const allText = (blocks) => blocks.map((b) => inlineText(b.content)).join('\n')

// A bullet in the canonical app shape (post-normalizeBullets).
const bullet = (value) => ({ id: crypto.randomUUID(), value })

// A fully-populated card touching every migrated field.
function sampleCard() {
  return {
    summary: 'A brooding vampire lord who rules Barovia.',
    storyNotes: [bullet('Rules the valley of Barovia'), bullet('Obsessed with Tatyana')],
    hiddenLore: [bullet('Fears the dawn'), bullet('Cursed by the Dark Powers')],
    dmNotes: [bullet('Voice: slow and formal'), bullet('Reveal his heart in Act 3')],
    media: [
      { path: 'ws-1/card-1/insp-a.full.webp', alt: '', uploaded_at: '2026-01-01T00:00:00.000Z' },
      'https://example.com/legacy-inspiration.png',
    ],
  }
}

describe('migrateCardToBlocks — no-loss field migration', () => {
  it('returns two block-JSON documents, one per zone', () => {
    const { card_view, gm_only } = migrateCardToBlocks(sampleCard())
    expect(Array.isArray(card_view)).toBe(true)
    expect(Array.isArray(gm_only)).toBe(true)
    // Every entry is a valid partial block (has a type).
    for (const b of [...card_view, ...gm_only]) {
      expect(typeof b.type).toBe('string')
      expect(b.type.length).toBeGreaterThan(0)
    }
  })

  // ── Card View ──────────────────────────────────────────────────────────────
  it('preserves the Summary in the Card View zone', () => {
    const { card_view } = migrateCardToBlocks(sampleCard())
    expect(allText(card_view)).toContain('A brooding vampire lord who rules Barovia.')
  })

  it('migrates Story Notes into a "Discoverable Lore" heading + bullets, in order', () => {
    const { card_view } = migrateCardToBlocks(sampleCard())
    expect(headingTexts(card_view)).toContain('Discoverable Lore')
    expect(bulletTexts(card_view)).toEqual([
      'Rules the valley of Barovia',
      'Obsessed with Tatyana',
    ])
  })

  it('puts the Summary before the Discoverable Lore heading', () => {
    const { card_view } = migrateCardToBlocks(sampleCard())
    const summaryIdx = card_view.findIndex((b) => inlineText(b.content).includes('brooding vampire lord'))
    const headingIdx = card_view.findIndex((b) => b.type === 'heading' && inlineText(b.content) === 'Discoverable Lore')
    expect(summaryIdx).toBeGreaterThanOrEqual(0)
    expect(headingIdx).toBeGreaterThan(summaryIdx)
  })

  // ── GM's Eyes Only ───────────────────────────────────────────────────────────
  it('merges Hidden Lore + DM Notes into a single "Notes" section, hidden-lore-first', () => {
    const { gm_only } = migrateCardToBlocks(sampleCard())
    expect(headingTexts(gm_only)).toContain('Notes')
    // Order is the locked default: all Hidden Lore bullets, then all DM Notes.
    expect(bulletTexts(gm_only)).toEqual([
      'Fears the dawn',
      'Cursed by the Dark Powers',
      'Voice: slow and formal',
      'Reveal his heart in Act 3',
    ])
  })

  it('preserves every Image Section image byte-for-byte in an Image Album block', () => {
    const card = sampleCard()
    const { gm_only } = migrateCardToBlocks(card)
    const album = gm_only.find((b) => b.type === 'imageAlbum')
    expect(album).toBeTruthy()
    // BlockNote block props are primitives only, so the image list is a JSON
    // string. Round-tripping it must reproduce the original media array exactly,
    // including structured { path, alt, uploaded_at } entries AND legacy strings.
    expect(JSON.parse(album.props.images)).toEqual(card.media)
  })

  it('does NOT emit connections into block content (they live in a fixed panel)', () => {
    const { card_view, gm_only } = migrateCardToBlocks(sampleCard())
    // ADR-0016 (revised): connections are not document content at all — they
    // render in a fixed, non-removable panel that reads the connections table
    // live. Nothing connection-shaped should appear in either zone's blocks.
    expect(card_view.some((b) => b.type === 'connections')).toBe(false)
    expect(gm_only.some((b) => b.type === 'connections')).toBe(false)
  })

  // ── Zone isolation — nothing leaks across the player/GM boundary ─────────────
  it('keeps GM-only content out of the Card View zone', () => {
    const { card_view } = migrateCardToBlocks(sampleCard())
    const cardText = allText(card_view)
    expect(cardText).not.toContain('Fears the dawn') // hidden lore
    expect(cardText).not.toContain('Voice: slow and formal') // dm notes
    expect(headingTexts(card_view)).not.toContain('Notes')
    expect(card_view.some((b) => b.type === 'imageAlbum')).toBe(false)
    expect(card_view.some((b) => b.type === 'connections')).toBe(false)
  })

  // ── Aggregate no-loss guarantee ──────────────────────────────────────────────
  it('drops nothing: every bullet from all four sources appears exactly once', () => {
    const card = sampleCard()
    const { card_view, gm_only } = migrateCardToBlocks(card)
    const everyBullet = [...bulletTexts(card_view), ...bulletTexts(gm_only)]
    const expected = [
      ...card.storyNotes.map((b) => b.value),
      ...card.hiddenLore.map((b) => b.value),
      ...card.dmNotes.map((b) => b.value),
    ]
    // Same multiset — no duplication, no omission.
    expect([...everyBullet].sort()).toEqual([...expected].sort())
    expect(everyBullet.length).toBe(expected.length)
  })
})

describe('migrateCardToBlocks — edge cases', () => {
  it('handles a completely empty card without throwing or inventing content', () => {
    const { card_view, gm_only } = migrateCardToBlocks({
      summary: '',
      storyNotes: [],
      hiddenLore: [],
      dmNotes: [],
      media: [],
    })
    expect(Array.isArray(card_view)).toBe(true)
    expect(Array.isArray(gm_only)).toBe(true)
    expect(bulletTexts(card_view)).toEqual([])
    expect(bulletTexts(gm_only)).toEqual([])
    // No images → no album block (nothing to preserve).
    expect(gm_only.some((b) => b.type === 'imageAlbum')).toBe(false)
    // Connections are a fixed panel, never block content — an empty card emits
    // no connections block.
    expect(gm_only.some((b) => b.type === 'connections')).toBe(false)
  })

  it('tolerates legacy string bullets (pre-normalizeBullets data)', () => {
    const { card_view, gm_only } = migrateCardToBlocks({
      summary: 'Legacy card.',
      storyNotes: ['Plain string story note'],
      hiddenLore: ['Plain string secret'],
      dmNotes: [],
      media: [],
    })
    expect(bulletTexts(card_view)).toEqual(['Plain string story note'])
    expect(bulletTexts(gm_only)).toEqual(['Plain string secret'])
  })

  it('omits a zone heading when that zone has no bullets (no empty "Notes"/"Discoverable Lore")', () => {
    const { card_view, gm_only } = migrateCardToBlocks({
      summary: 'Only a summary.',
      storyNotes: [],
      hiddenLore: [],
      dmNotes: [],
      media: [],
    })
    expect(headingTexts(card_view)).not.toContain('Discoverable Lore')
    expect(headingTexts(gm_only)).not.toContain('Notes')
  })

  it('tolerates missing fields (defaults everything to empty)', () => {
    expect(() => migrateCardToBlocks({})).not.toThrow()
    const { card_view, gm_only } = migrateCardToBlocks({})
    expect(Array.isArray(card_view)).toBe(true)
    expect(Array.isArray(gm_only)).toBe(true)
    expect(gm_only.some((b) => b.type === 'connections')).toBe(false)
  })
})
