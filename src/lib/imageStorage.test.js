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
  hasAlphaInImageData,
  canTypeHaveAlpha,
  selectPrintableFormat,
  printableExtension,
  printableMimeType,
  collectImagePathsToDelete,
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
      workspaceId: 'c8a',
      cardId:     'strahd-uuid',
      section:    'avatar',
      slug:       'strahd-von-zarovich',
      timestamp:  1714247531000,
      variant:    'full',
    })
    expect(path).toBe('c8a/strahd-uuid/avatar-1714247531000-strahd-von-zarovich.full.webp')
  })

  it('defaults the extension to webp for display variants', () => {
    const path = buildImagePath({
      workspaceId: 'c8a', cardId: 'card', section: 'inspiration',
      slug: 'castle', timestamp: 1714247612482, variant: 'thumb',
    })
    expect(path).toBe('c8a/card/inspiration-1714247612482-castle.thumb.webp')
  })

  it('honors an explicit ext for the printable variant (jpg / png)', () => {
    const base = {
      workspaceId: 'c8a', cardId: 'card', section: 'inspiration',
      slug: 'castle', timestamp: 1714247612482, variant: 'printable',
    }
    expect(buildImagePath({ ...base, ext: 'jpg' }))
      .toBe('c8a/card/inspiration-1714247612482-castle.printable.jpg')
    expect(buildImagePath({ ...base, ext: 'png' }))
      .toBe('c8a/card/inspiration-1714247612482-castle.printable.png')
  })
})

// rgba(...counts) builds a flat RGBA byte array: pairs of [count, alpha]
// produce `count` pixels each at the given alpha (rgb left at 0).
function rgbaWithAlphas(...alphas) {
  const out = []
  for (const a of alphas) out.push(0, 0, 0, a)
  return new Uint8ClampedArray(out)
}

describe('hasAlphaInImageData (transparency detection)', () => {
  it('returns false when every pixel is fully opaque', () => {
    expect(hasAlphaInImageData(rgbaWithAlphas(255, 255, 255))).toBe(false)
  })

  it('returns true when any pixel is non-opaque', () => {
    expect(hasAlphaInImageData(rgbaWithAlphas(255, 255, 0))).toBe(true)
    expect(hasAlphaInImageData(rgbaWithAlphas(254))).toBe(true)
  })

  it('returns false for empty / missing data', () => {
    expect(hasAlphaInImageData(new Uint8ClampedArray([]))).toBe(false)
    expect(hasAlphaInImageData(null)).toBe(false)
    expect(hasAlphaInImageData(undefined)).toBe(false)
  })
})

describe('canTypeHaveAlpha (scan fast-path)', () => {
  it('returns false for types that cannot carry alpha', () => {
    expect(canTypeHaveAlpha('image/jpeg')).toBe(false)
    expect(canTypeHaveAlpha('image/jpg')).toBe(false)
  })

  it('returns true for alpha-capable types', () => {
    expect(canTypeHaveAlpha('image/png')).toBe(true)
    expect(canTypeHaveAlpha('image/webp')).toBe(true)
    expect(canTypeHaveAlpha('image/gif')).toBe(true)
  })

  it('returns true (scan to be safe) for unknown / empty type', () => {
    expect(canTypeHaveAlpha('')).toBe(true)
    expect(canTypeHaveAlpha(undefined)).toBe(true)
    expect(canTypeHaveAlpha(null)).toBe(true)
  })
})

describe('printable format selection', () => {
  it('selects PNG when transparent, JPEG when opaque', () => {
    expect(selectPrintableFormat(true)).toBe('png')
    expect(selectPrintableFormat(false)).toBe('jpeg')
  })

  it('maps format → file extension', () => {
    expect(printableExtension('png')).toBe('png')
    expect(printableExtension('jpeg')).toBe('jpg')
  })

  it('maps format → MIME type', () => {
    expect(printableMimeType('png')).toBe('image/png')
    expect(printableMimeType('jpeg')).toBe('image/jpeg')
  })
})

describe('collectImagePathsToDelete', () => {
  const full = 'c8a/card/inspiration-1-castle.full.webp'
  const thumb = 'c8a/card/inspiration-1-castle.thumb.webp'

  it('legacy / UI-identity string path → removes full + thumb', () => {
    expect(collectImagePathsToDelete(full)).toEqual([full, thumb])
  })

  it('derives full + thumb even when handed the thumb path', () => {
    expect(collectImagePathsToDelete(thumb)).toEqual([full, thumb])
  })

  it('content entry WITH printable → removes full + thumb + printable', () => {
    const printable = 'c8a/card/inspiration-1-castle.printable.jpg'
    expect(collectImagePathsToDelete({ path: full, printable_path: printable }))
      .toEqual([full, thumb, printable])
  })

  it('content entry WITHOUT printable → removes full + thumb only (no break)', () => {
    expect(collectImagePathsToDelete({ path: full })).toEqual([full, thumb])
    expect(collectImagePathsToDelete({ path: full, printable_path: null })).toEqual([full, thumb])
  })

  it('transparent (PNG) entry → derives .png display variants + PNG printable', () => {
    const fullPng = 'c8a/card/inspiration-1-logo.full.png'
    const thumbPng = 'c8a/card/inspiration-1-logo.thumb.png'
    const printablePng = 'c8a/card/inspiration-1-logo.printable.png'
    expect(collectImagePathsToDelete({ path: fullPng, printable_path: printablePng }))
      .toEqual([fullPng, thumbPng, printablePng])
  })

  it('returns nothing for garbage / empty input', () => {
    expect(collectImagePathsToDelete(null)).toEqual([])
    expect(collectImagePathsToDelete(undefined)).toEqual([])
    expect(collectImagePathsToDelete('')).toEqual([])
    expect(collectImagePathsToDelete({})).toEqual([])
    expect(collectImagePathsToDelete({ printable_path: 'x.printable.png' }))
      .toEqual(['x.printable.png'])
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

  it('preserves a .png extension when swapping display variants (transparent images)', () => {
    const full = 'c8a/card/inspiration-1-logo.full.png'
    expect(pathForVariant(full, 'thumb')).toBe('c8a/card/inspiration-1-logo.thumb.png')
    expect(pathForVariant('c8a/card/inspiration-1-logo.thumb.png', 'full'))
      .toBe('c8a/card/inspiration-1-logo.full.png')
  })

  it('does NOT rewrite a printable path (explicit, variable extension)', () => {
    expect(pathForVariant('c8a/card/inspiration-1-logo.printable.jpg', 'full'))
      .toBe('c8a/card/inspiration-1-logo.printable.jpg')
    expect(pathForVariant('c8a/card/inspiration-1-logo.printable.png', 'thumb'))
      .toBe('c8a/card/inspiration-1-logo.printable.png')
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
