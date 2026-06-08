// Tests for the duplicate block-ID document-integrity helpers (F5f, Checkpoint 1).
// These pin the contract the live plugin (Checkpoint 2) also relies on:
// regenerate ONLY duplicates, preserve content + order, no-op clean docs, work for
// ALL block types, and recurse into children with first-occurrence-wins.

import { describe, it, expect } from 'vitest'
import {
  dedupeBlockIds,
  collectDuplicateBlockIds,
  hasDuplicateBlockIds,
  generateBlockId,
} from './blockIds.js'

const b = (id, type = 'paragraph', extra = {}) => ({
  id,
  type,
  props: {},
  content: [{ type: 'text', text: id ? `text-${id}` : 'no-id', styles: {} }],
  children: [],
  ...extra,
})

describe('generateBlockId', () => {
  it('produces unique, non-empty string IDs', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateBlockId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(typeof id).toBe('string')
  })
})

describe('collectDuplicateBlockIds / hasDuplicateBlockIds', () => {
  it('reports no duplicates for a clean document', () => {
    const doc = [b('a'), b('b'), b('c')]
    expect(hasDuplicateBlockIds(doc)).toBe(false)
    expect(collectDuplicateBlockIds(doc).size).toBe(0)
  })

  it('finds duplicates at the top level', () => {
    const doc = [b('a'), b('b'), b('a')]
    expect(hasDuplicateBlockIds(doc)).toBe(true)
    expect([...collectDuplicateBlockIds(doc)]).toEqual(['a'])
  })

  it('finds duplicates nested in children', () => {
    const doc = [b('a', 'paragraph', { children: [b('a')] })]
    expect(hasDuplicateBlockIds(doc)).toBe(true)
    expect([...collectDuplicateBlockIds(doc)]).toEqual(['a'])
  })

  it('ignores blocks without an id', () => {
    const doc = [b(null), b(null), b('x')]
    expect(hasDuplicateBlockIds(doc)).toBe(false)
  })
})

describe('dedupeBlockIds', () => {
  it('no-ops a clean document by returning the SAME reference (no churn)', () => {
    const doc = [b('a'), b('b'), b('c')]
    const out = dedupeBlockIds(doc)
    expect(out).toBe(doc) // identical reference
  })

  it('regenerates ONLY the duplicate, keeping the first occurrence', () => {
    const doc = [b('dup'), b('other'), b('dup')]
    const out = dedupeBlockIds(doc)

    expect(out).not.toBe(doc) // changed → new array
    expect(out[0].id).toBe('dup') // first occurrence preserved
    expect(out[1].id).toBe('other') // untouched
    expect(out[2].id).not.toBe('dup') // duplicate regenerated
    // All IDs now unique:
    expect(new Set(out.map((x) => x.id)).size).toBe(3)
    expect(hasDuplicateBlockIds(out)).toBe(false)
  })

  it('preserves content and order; only the offending id changes', () => {
    const doc = [b('dup'), b('mid'), b('dup')]
    const out = dedupeBlockIds(doc)

    expect(out.map((x) => x.type)).toEqual(['paragraph', 'paragraph', 'paragraph'])
    // Untouched blocks keep their exact object reference:
    expect(out[0]).toBe(doc[0])
    expect(out[1]).toBe(doc[1])
    // The regenerated block keeps content + type, only id differs:
    expect(out[2].content).toEqual(doc[2].content)
    expect(out[2].type).toBe(doc[2].type)
    expect(out[2].props).toEqual(doc[2].props)
  })

  it('is type-agnostic — works across all block types', () => {
    const doc = [
      b('x', 'heading', { props: { level: 1 } }),
      b('x', 'imageAlbum', { props: { images: '[]' }, content: undefined }),
      b('x', 'bulletListItem'),
    ]
    const out = dedupeBlockIds(doc)
    expect(out[0].id).toBe('x')
    expect(out[1].id).not.toBe('x')
    expect(out[2].id).not.toBe('x')
    expect(new Set(out.map((o) => o.id)).size).toBe(3)
    // Types + props untouched:
    expect(out[1].type).toBe('imageAlbum')
    expect(out[1].props).toEqual({ images: '[]' })
  })

  it('regenerates duplicates inside children (first-occurrence-wins, depth-first)', () => {
    const doc = [
      b('p', 'paragraph', { children: [b('p'), b('q')] }),
      b('q'),
    ]
    const out = dedupeBlockIds(doc)

    expect(out[0].id).toBe('p') // first 'p' kept
    expect(out[0].children[0].id).not.toBe('p') // child 'p' regenerated
    expect(out[0].children[1].id).toBe('q') // first 'q' kept (in child)
    expect(out[1].id).not.toBe('q') // later top-level 'q' regenerated
    expect(hasDuplicateBlockIds(out)).toBe(false)
  })

  it('leaves a clean child subtree by the SAME reference', () => {
    const cleanChild = [b('c1'), b('c2')]
    const doc = [b('dup', 'paragraph', { children: cleanChild }), b('dup')]
    const out = dedupeBlockIds(doc)
    // The first block's clean children must not be rebuilt:
    expect(out[0].children).toBe(cleanChild)
  })

  it('passes non-array input through untouched', () => {
    expect(dedupeBlockIds(null)).toBe(null)
    expect(dedupeBlockIds(undefined)).toBe(undefined)
  })

  it('handles a realistic two-gallery collision (the reported bug)', () => {
    // gm_only doc where a moved gallery collided with the seeded one (same id).
    const doc = [
      { id: 'h', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Inspiration', styles: {} }], children: [] },
      { id: 'gal', type: 'imageAlbum', props: { images: '[]' }, children: [] },
      { id: 'gal', type: 'imageAlbum', props: { images: JSON.stringify([{ path: 'p/keep.webp', alt: '', uploaded_at: '' }]) }, children: [] },
    ]
    const out = dedupeBlockIds(doc)
    expect(out).not.toBe(doc)
    // Both galleries survive, now with distinct ids, content intact:
    expect(out[1].id).not.toBe(out[2].id)
    expect(out[2].props.images).toContain('keep.webp')
    expect(hasDuplicateBlockIds(out)).toBe(false)
  })
})
