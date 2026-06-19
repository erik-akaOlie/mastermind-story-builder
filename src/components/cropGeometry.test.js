// ============================================================================
// Tests for cropGeometry.js — the pure math behind the crop-box ImageCropper.
// Covers the load-bearing pieces: fit-contain, initial box, move-clamp,
// source-pixel mapping, output sizing per mode, and aspect-locked resize.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  THUMBNAIL_OUT,
  PROFILE_OUT,
  CONTENT_MAX_EDGE,
  aspectForMode,
  fixedOutputForMode,
  fitContain,
  initialCropBox,
  clampBoxToRect,
  boxCorner,
  resizeCropBox,
  cropBoxToSourceRect,
  outputSizeForMode,
} from './cropGeometry.js'

describe('aspectForMode / fixedOutputForMode', () => {
  it('locks UI-identity modes to their output aspect; content is free', () => {
    expect(aspectForMode('thumbnail')).toBeCloseTo(560 / 448)
    expect(aspectForMode('profile-avatar')).toBe(1)
    expect(aspectForMode('image-section')).toBeNull()
  })

  it('returns fixed output dims for UI-identity, null for content', () => {
    expect(fixedOutputForMode('thumbnail')).toEqual(THUMBNAIL_OUT)
    expect(fixedOutputForMode('profile-avatar')).toEqual(PROFILE_OUT)
    expect(fixedOutputForMode('image-section')).toBeNull()
  })
})

describe('fitContain', () => {
  const area = { x: 0, y: 0, w: 1000, h: 600 }

  it('shrinks a large image and centers it', () => {
    const r = fitContain(2000, 1000, area) // ratio 2:1, width-bound
    expect(r.scale).toBeCloseTo(0.5)        // 1000/2000
    expect(r.w).toBeCloseTo(1000)
    expect(r.h).toBeCloseTo(500)
    expect(r.left).toBeCloseTo(0)
    expect(r.top).toBeCloseTo(50)           // (600-500)/2
  })

  it('upscales a small image to fill the work area', () => {
    const r = fitContain(100, 100, area)    // height-bound: 600/100 = 6
    expect(r.scale).toBeCloseTo(6)
    expect(r.w).toBeCloseTo(600)
    expect(r.h).toBeCloseTo(600)
    expect(r.left).toBeCloseTo(200)         // (1000-600)/2
  })
})

describe('initialCropBox', () => {
  const rect = { left: 10, top: 20, w: 800, h: 400, scale: 1 }

  it('free aspect selects the whole image', () => {
    expect(initialCropBox(rect, null)).toEqual({ x: 10, y: 20, w: 800, h: 400 })
  })

  it('square aspect inside a wide rect is height-limited and centered', () => {
    const box = initialCropBox(rect, 1)
    expect(box.w).toBeCloseTo(400)
    expect(box.h).toBeCloseTo(400)
    expect(box.x).toBeCloseTo(10 + (800 - 400) / 2) // 210
    expect(box.y).toBeCloseTo(20)
  })

  it('wide aspect inside a square-ish rect is width-limited', () => {
    const sq = { left: 0, top: 0, w: 400, h: 400, scale: 1 }
    const box = initialCropBox(sq, 2) // 2:1
    expect(box.w).toBeCloseTo(400)
    expect(box.h).toBeCloseTo(200)
    expect(box.y).toBeCloseTo(100)
  })
})

describe('clampBoxToRect', () => {
  const rect = { left: 0, top: 0, w: 1000, h: 800 }

  it('pulls a box back inside when dragged past edges', () => {
    expect(clampBoxToRect({ x: -50, y: -30, w: 200, h: 100 }, rect)).toEqual({ x: 0, y: 0, w: 200, h: 100 })
    expect(clampBoxToRect({ x: 950, y: 780, w: 200, h: 100 }, rect)).toEqual({ x: 800, y: 700, w: 200, h: 100 })
  })

  it('leaves an in-bounds box untouched', () => {
    expect(clampBoxToRect({ x: 100, y: 100, w: 200, h: 100 }, rect)).toEqual({ x: 100, y: 100, w: 200, h: 100 })
  })
})

describe('cropBoxToSourceRect', () => {
  // Image 4000×2000 displayed at scale 0.25 → 1000×500, at offset (50,30).
  const displayRect = { left: 50, top: 30, w: 1000, h: 500, scale: 0.25 }

  it('a box covering the whole displayed image maps to the full source', () => {
    const box = { x: 50, y: 30, w: 1000, h: 500 }
    expect(cropBoxToSourceRect(box, displayRect, 4000, 2000)).toEqual({
      srcX: 0, srcY: 0, srcW: 4000, srcH: 2000,
    })
  })

  it('a centered quarter-size box maps to a centered quarter of the source', () => {
    const box = { x: 50 + 250, y: 30 + 125, w: 500, h: 250 }
    const r = cropBoxToSourceRect(box, displayRect, 4000, 2000)
    expect(r.srcX).toBeCloseTo(1000)
    expect(r.srcY).toBeCloseTo(500)
    expect(r.srcW).toBeCloseTo(2000)
    expect(r.srcH).toBeCloseTo(1000)
  })

  it('clamps a box that spills past the image to source bounds', () => {
    const box = { x: 0, y: 0, w: 2000, h: 1000 } // left/top before the image
    const r = cropBoxToSourceRect(box, displayRect, 4000, 2000)
    expect(r.srcX).toBe(0)
    expect(r.srcY).toBe(0)
    expect(r.srcW).toBeLessThanOrEqual(4000)
    expect(r.srcH).toBeLessThanOrEqual(2000)
  })
})

describe('outputSizeForMode', () => {
  it('UI-identity modes ignore the crop size and use fixed dims', () => {
    expect(outputSizeForMode('thumbnail', 999, 12)).toEqual({ outW: 560, outH: 448 })
    expect(outputSizeForMode('profile-avatar', 3000, 3000)).toEqual({ outW: 512, outH: 512 })
  })

  it('content under the cap keeps the source crop resolution', () => {
    expect(outputSizeForMode('image-section', 2765, 4096)).toEqual({ outW: 2765, outH: 4096 })
  })

  it('content over the cap scales down to CONTENT_MAX_EDGE on the long edge', () => {
    const { outW, outH } = outputSizeForMode('image-section', 8000, 4000)
    expect(Math.max(outW, outH)).toBe(CONTENT_MAX_EDGE)
    expect(outW).toBe(4096)
    expect(outH).toBe(2048) // ratio preserved
  })
})

describe('resizeCropBox — corners', () => {
  const rect = { left: 0, top: 0, w: 1000, h: 1000, scale: 1 }
  const startBox = { x: 100, y: 100, w: 200, h: 200 } // tl(100,100) br(300,300)

  it('free aspect: dragging br pins the tl corner and follows the cursor', () => {
    const box = resizeCropBox({
      handle: 'br', cursor: { x: 400, y: 250 }, startBox, aspect: null, rect,
    })
    expect(box).toEqual({ x: 100, y: 100, w: 300, h: 150 })
  })

  it('free aspect: clamps the dragged corner to the rect bounds', () => {
    const box = resizeCropBox({
      handle: 'br', cursor: { x: 5000, y: 5000 }, startBox, aspect: null, rect,
    })
    expect(box.x + box.w).toBeLessThanOrEqual(1000)
    expect(box.y + box.h).toBeLessThanOrEqual(1000)
  })

  it('Shift (lockAspect) locks to the start box ratio while resizing', () => {
    const square = { x: 100, y: 100, w: 200, h: 200 } // ratio 1
    const box = resizeCropBox({
      handle: 'br', cursor: { x: 500, y: 320 }, startBox: square,
      aspect: null, lockAspect: true, rect,
    })
    expect(box.w / box.h).toBeCloseTo(1)
  })

  it('Ctrl/Alt (symmetric) scales about the center, both sides move', () => {
    const box = resizeCropBox({
      handle: 'br', cursor: { x: 300, y: 300 }, startBox, // center (200,200)
      aspect: null, symmetric: true, rect,
    })
    // half-extent = |300-200| = 100 → full = 200, centered on (200,200)
    expect(box).toEqual({ x: 100, y: 100, w: 200, h: 200 })
  })

  it('fixed aspect: maintains the ratio (cover) regardless of cursor drift', () => {
    const box = resizeCropBox({
      handle: 'br', cursor: { x: 500, y: 130 }, startBox, aspect: 2, rect, // 2:1
    })
    expect(box.w / box.h).toBeCloseTo(2)
  })

  it('fixed aspect: never shrinks below the minimum and stays in bounds', () => {
    const box = resizeCropBox({
      handle: 'tl', cursor: { x: 999, y: 999 }, startBox, aspect: 1, rect, minPx: 48,
    })
    expect(box.w).toBeGreaterThanOrEqual(48)
    expect(box.h).toBeGreaterThanOrEqual(48)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
  })
})

describe('resizeCropBox — edge handles (free-aspect content)', () => {
  const rect = { left: 0, top: 0, w: 1000, h: 1000, scale: 1 }
  const startBox = { x: 200, y: 200, w: 400, h: 200 } // center (400,300)

  it("right edge adjusts width only, pinning the left edge", () => {
    const box = resizeCropBox({
      handle: 'r', cursor: { x: 700, y: 999 }, startBox, aspect: null, rect,
    })
    expect(box.x).toBe(200)           // left pinned
    expect(box.w).toBe(500)           // 700 - 200
    expect(box.y).toBe(200)           // height untouched
    expect(box.h).toBe(200)
  })

  it('bottom edge adjusts height only, pinning the top edge', () => {
    const box = resizeCropBox({
      handle: 'b', cursor: { x: 0, y: 520 }, startBox, aspect: null, rect,
    })
    expect(box.y).toBe(200)
    expect(box.h).toBe(320)           // 520 - 200
    expect(box.x).toBe(200)
    expect(box.w).toBe(400)
  })

  it('right edge + symmetric grows width about the center (both sides)', () => {
    const box = resizeCropBox({
      handle: 'r', cursor: { x: 600, y: 0 }, startBox, aspect: null, symmetric: true, rect,
    })
    // half-width = |600-400| = 200 → width 400, centered on cx=400
    expect(box.w).toBe(400)
    expect(box.x).toBe(200)
    expect(box.h).toBe(200)           // perpendicular axis untouched
  })

  it('right edge + Shift grows height proportionally, centered on the perpendicular axis', () => {
    const box = resizeCropBox({
      handle: 'r', cursor: { x: 600, y: 0 }, startBox, aspect: null, lockAspect: true, rect,
    })
    expect(box.w).toBe(400)                       // 600 - 200
    expect(box.w / box.h).toBeCloseTo(400 / 200)  // start ratio 2:1 preserved
    expect(box.x).toBe(200)                       // left pinned
    // height (200) grows centered on cy=300 → stays 200..400; here h==200
    expect(box.y).toBeCloseTo(300 - box.h / 2)
  })
})

describe('boxCorner', () => {
  it('returns each corner position', () => {
    expect(boxCorner({ x: 10, y: 20, w: 100, h: 50 }, 'br')).toEqual({ x: 110, y: 70 })
    expect(boxCorner({ x: 10, y: 20, w: 100, h: 50 }, 'tl')).toEqual({ x: 10, y: 20 })
    expect(boxCorner({ x: 10, y: 20, w: 100, h: 50 }, 'tr')).toEqual({ x: 110, y: 20 })
    expect(boxCorner({ x: 10, y: 20, w: 100, h: 50 }, 'bl')).toEqual({ x: 10, y: 70 })
  })
})
