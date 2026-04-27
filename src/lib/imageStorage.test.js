// ============================================================================
// Tests for the pure helpers in imageStorage.js.
// ----------------------------------------------------------------------------
// transcodeImage and the upload/delete functions need a real browser
// (Canvas API + Supabase) and are exercised by manual verification. These
// tests cover the parts that are pure and can fail silently in unsubtle ways:
//   - slugify: produces filesystem-safe slugs with stable fallbacks
//   - buildImagePath: composes the documented path structure exactly
//   - pathForVariant: round-trips between thumb and full
//   - shape detectors: tell legacy base64, external URL, and Storage paths apart
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  slugify,
  buildImagePath,
  pathForVariant,
  isBase64DataUri,
  isStoragePath,
} from './imageStorage.js'

describe('slugify', () => {
  it('produces a kebab-case slug from a normal label', () => {
    expect(slugify('Strahd von Zarovich')).toBe('strahd-von-zarovich')
  })

  it("falls back to 'untitled-card' for empty or whitespace-only input", () => {
    expect(slugify('')).toBe('untitled-card')
    expect(slugify('   ')).toBe('untitled-card')
    expect(slugify(null)).toBe('untitled-card')
    expect(slugify(undefined)).toBe('untitled-card')
  })

  it('strips punctuation and accents', () => {
    expect(slugify("Castle Ravenloft!?")).toBe('castle-ravenloft')
    expect(slugify('Façade')).toBe('facade')
  })

  it('collapses consecutive whitespace and dashes', () => {
    expect(slugify('Vistani  Camp -- East')).toBe('vistani-camp-east')
  })

  it('truncates very long labels at 60 chars', () => {
    const long = 'a'.repeat(120)
    expect(slugify(long).length).toBe(60)
  })
})

describe('buildImagePath', () => {
  it('composes the exact ADR-0005 path structure', () => {
    const path = buildImagePath({
      campaignId: 'c8a',
      cardId:     'strahd-uuid',
      section:    'avatar',
      slug:       'strahd-von-zarovich',
      timestamp:  1714247531000,
      variant:    'full',
    })
    expect(path).toBe('c8a/strahd-uuid/avatar-1714247531000-strahd-von-zarovich.full.webp')
  })
})

describe('pathForVariant', () => {
  it('rewrites a .full.webp path into a .thumb.webp path', () => {
    const full = 'c8a/strahd-uuid/avatar-1714247531000-strahd.full.webp'
    expect(pathForVariant(full, 'thumb')).toBe(
      'c8a/strahd-uuid/avatar-1714247531000-strahd.thumb.webp'
    )
  })

  it('rewrites a .thumb.webp path into a .full.webp path', () => {
    const thumb = 'c8a/strahd-uuid/avatar-1714247531000-strahd.thumb.webp'
    expect(pathForVariant(thumb, 'full')).toBe(
      'c8a/strahd-uuid/avatar-1714247531000-strahd.full.webp'
    )
  })

  it('returns null when given null', () => {
    expect(pathForVariant(null, 'thumb')).toBeNull()
  })
})

describe('shape detectors', () => {
  it('isBase64DataUri identifies data URIs and rejects everything else', () => {
    expect(isBase64DataUri('data:image/png;base64,AAAA')).toBe(true)
    expect(isBase64DataUri('https://example.com/cat.jpg')).toBe(false)
    expect(isBase64DataUri('c8a/strahd-uuid/avatar-x.full.webp')).toBe(false)
    expect(isBase64DataUri(null)).toBe(false)
  })

  it('isStoragePath identifies bucket-relative paths and rejects URIs/URLs', () => {
    expect(isStoragePath('c8a/strahd-uuid/avatar-x.full.webp')).toBe(true)
    expect(isStoragePath('data:image/png;base64,AAAA')).toBe(false)
    expect(isStoragePath('https://example.com/cat.jpg')).toBe(false)
    expect(isStoragePath('http://localhost/cat.jpg')).toBe(false)
    expect(isStoragePath('')).toBe(false)
    expect(isStoragePath(null)).toBe(false)
  })
})
