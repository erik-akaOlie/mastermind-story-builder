// ============================================================================
// Tests for the pure parts of clipboardImage.js — candidate selection and
// data-URI extraction. The DOM/async bits (gather, inspect, navigator.clipboard
// reads) need a real browser + real clipboard and are verified manually.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { chooseBestImageCandidate, extractDataUriImages, pasteHasImage } from './clipboardImage.js'

describe('chooseBestImageCandidate', () => {
  it('returns null when there are no valid candidates', () => {
    expect(chooseBestImageCandidate([])).toBeNull()
    expect(chooseBestImageCandidate(null)).toBeNull()
    expect(chooseBestImageCandidate([{ width: 0, height: 0, hasAlpha: true }])).toBeNull()
  })

  it('prefers a candidate with real alpha over a larger opaque one', () => {
    const opaqueBig = { id: 'opaque', width: 4000, height: 4000, hasAlpha: false }
    const alphaSmall = { id: 'alpha', width: 500, height: 500, hasAlpha: true }
    expect(chooseBestImageCandidate([opaqueBig, alphaSmall]).id).toBe('alpha')
  })

  it('among alpha candidates, prefers the highest resolution', () => {
    const alphaLo = { id: 'lo', width: 500, height: 500, hasAlpha: true }
    const alphaHi = { id: 'hi', width: 2000, height: 2000, hasAlpha: true }
    expect(chooseBestImageCandidate([alphaLo, alphaHi]).id).toBe('hi')
  })

  it('with no alpha anywhere, falls back to the highest resolution', () => {
    const lo = { id: 'lo', width: 500, height: 800, hasAlpha: false }
    const hi = { id: 'hi', width: 1920, height: 1080, hasAlpha: false }
    expect(chooseBestImageCandidate([lo, hi]).id).toBe('hi')
  })

  it('ignores zero-dimension entries', () => {
    const bad = { id: 'bad', width: 0, height: 100, hasAlpha: true }
    const good = { id: 'good', width: 100, height: 100, hasAlpha: false }
    expect(chooseBestImageCandidate([bad, good]).id).toBe('good')
  })
})

describe('extractDataUriImages', () => {
  it('returns nothing for empty or image-less HTML', () => {
    expect(extractDataUriImages('')).toEqual([])
    expect(extractDataUriImages('<p>hello</p>')).toEqual([])
  })

  it('ignores remote http(s) <img> sources (deferred URL-paste, CORS)', () => {
    expect(extractDataUriImages('<img src="https://example.com/cat.png">')).toEqual([])
  })

  it('extracts an inline data:image PNG as a Blob', () => {
    // 1x1 transparent PNG
    const dataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const blobs = extractDataUriImages(`<img src="${dataUri}">`)
    expect(blobs.length).toBe(1)
    expect(blobs[0].type).toBe('image/png')
    expect(blobs[0].size).toBeGreaterThan(0)
  })
})

describe('pasteHasImage', () => {
  it('is false for a null/empty event', () => {
    expect(pasteHasImage(null)).toBe(false)
    expect(pasteHasImage({})).toBe(false)
  })

  it('is true when clipboardData has an image file item', () => {
    const e = {
      clipboardData: {
        files: [],
        items: [{ kind: 'file', type: 'image/png' }],
        getData: () => '',
      },
    }
    expect(pasteHasImage(e)).toBe(true)
  })

  it('is true when clipboard HTML carries an inline data:image', () => {
    const e = {
      clipboardData: {
        files: [],
        items: [],
        getData: (t) => (t === 'text/html' ? '<img src="data:image/png;base64,AAAA">' : ''),
      },
    }
    expect(pasteHasImage(e)).toBe(true)
  })

  it('is false for a text-only paste', () => {
    const e = {
      clipboardData: {
        files: [],
        items: [{ kind: 'string', type: 'text/plain' }],
        getData: () => 'just text',
      },
    }
    expect(pasteHasImage(e)).toBe(false)
  })
})
