import { describe, it, expect } from 'vitest'
import {
  MORPH_BELOW_GRID_GAP_MM,
  MORPH_HYSTERESIS_RATIO,
  gridGapMmAtZoom,
  zoomAtGridGapMm,
  currentThresholdZoom,
  nextAltitude,
  computeMinZoom,
  DEFAULT_MIN_ZOOM,
  BIRDS_EYE_VIEWPORT_FILL,
} from './altitude'

// ── Conversion helpers ─────────────────────────────────────────────────────
describe('gridGapMmAtZoom / zoomAtGridGapMm', () => {
  it('round-trips exactly', () => {
    for (const z of [0.1, 0.25, 0.5, 1.0, 2.0, 5.0]) {
      expect(zoomAtGridGapMm(gridGapMmAtZoom(z))).toBeCloseTo(z, 6)
    }
  })

  it('production threshold (2.65 mm) maps near zoom 0.5', () => {
    expect(zoomAtGridGapMm(2.65)).toBeCloseTo(0.5, 2)
  })
})

// ── currentThresholdZoom ───────────────────────────────────────────────────
describe('currentThresholdZoom', () => {
  it('defaults to the production constant when no arg is passed', () => {
    expect(currentThresholdZoom()).toBeCloseTo(zoomAtGridGapMm(MORPH_BELOW_GRID_GAP_MM), 6)
  })

  it('honors a caller-supplied threshold mm', () => {
    expect(currentThresholdZoom(5.0)).toBeCloseTo(zoomAtGridGapMm(5.0), 6)
    expect(currentThresholdZoom(1.0)).toBeCloseTo(zoomAtGridGapMm(1.0), 6)
  })

  it('arg-driven path is independent of the module-level default', () => {
    // The same call with two different args returns two different values.
    const a = currentThresholdZoom(2.0)
    const b = currentThresholdZoom(4.0)
    expect(b).toBeGreaterThan(a)
  })
})

// ── nextAltitude ───────────────────────────────────────────────────────────
describe('nextAltitude', () => {
  it('defaults to the production threshold when no arg is passed', () => {
    // Zoom well above the default threshold → stay in cardView.
    expect(nextAltitude('cardView', 1.0)).toBe('cardView')
    // Zoom well below the default threshold → flip to beadView.
    expect(nextAltitude('cardView', 0.2)).toBe('beadView')
  })

  it('respects a custom threshold parameter (lower mm → triggers at deeper zoom)', () => {
    // Threshold lowered to 1.0 mm (≈ zoom 0.189). At zoom 0.4 (still above
    // the new threshold), we should stay in cardView even though the
    // default threshold would have triggered beadView at this zoom.
    expect(nextAltitude('cardView', 0.4, 1.0)).toBe('cardView')
    // At zoom 0.1 (below the new threshold) it flips.
    expect(nextAltitude('cardView', 0.1, 1.0)).toBe('beadView')
  })

  it('respects a custom threshold parameter (higher mm → triggers earlier)', () => {
    // Threshold raised to 5.0 mm (≈ zoom 0.94). Zoom 0.8 (below) → flip.
    expect(nextAltitude('cardView', 0.8, 5.0)).toBe('beadView')
    // Zoom 1.0 (above) → stay.
    expect(nextAltitude('cardView', 1.0, 5.0)).toBe('cardView')
  })

  it('hysteresis ratio is honored at custom thresholds', () => {
    // At threshold = 2.65 mm, return-to-card requires gap > 2.65 × 1.15 = 3.05 mm.
    // gap at zoom 0.5 = 2.65 mm (below return threshold) → stay in beadView.
    expect(nextAltitude('beadView', 0.5)).toBe('beadView')
    // gap at zoom 0.6 ≈ 3.18 mm (above return threshold) → flip back.
    expect(nextAltitude('beadView', 0.6)).toBe('cardView')
    expect(MORPH_HYSTERESIS_RATIO).toBe(1.15) // documenting the constant
  })

  it('hysteresis ratio scales with the custom threshold', () => {
    // Threshold = 1.0 mm. Return-to-card requires gap > 1.15 mm.
    // gap at zoom 0.2 ≈ 1.06 mm (below 1.15 return threshold) → stay in beadView.
    expect(nextAltitude('beadView', 0.2, 1.0)).toBe('beadView')
    // gap at zoom 0.25 ≈ 1.32 mm (above 1.15) → flip back to cardView.
    expect(nextAltitude('beadView', 0.25, 1.0)).toBe('cardView')
  })

  it('inside the hysteresis dead-band, altitude is preserved', () => {
    // gap at zoom 0.55 ≈ 2.91 mm — below the trigger (2.65 mm × 1.15 = 3.05),
    // above the trigger itself (2.65). Both directions should NOT flip.
    expect(nextAltitude('cardView', 0.55)).toBe('cardView')
    expect(nextAltitude('beadView', 0.55)).toBe('beadView')
  })
})

// ── computeMinZoom ─────────────────────────────────────────────────────────
describe('computeMinZoom', () => {
  const VW = 1920
  const VH = 1080

  it('returns DEFAULT_MIN_ZOOM for an empty node list', () => {
    expect(computeMinZoom({ nodes: [], viewportWidth: VW, viewportHeight: VH }))
      .toBe(DEFAULT_MIN_ZOOM)
  })

  it('returns DEFAULT_MIN_ZOOM for a single-node workspace', () => {
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, width: 256, height: 180 }]
    expect(computeMinZoom({ nodes, viewportWidth: VW, viewportHeight: VH }))
      .toBe(DEFAULT_MIN_ZOOM)
  })

  it('caps at DEFAULT_MIN_ZOOM for a small bounding box', () => {
    const nodes = [
      { id: 'a', position: { x: 0,   y: 0   }, width: 256, height: 180 },
      { id: 'b', position: { x: 300, y: 200 }, width: 256, height: 180 },
    ]
    expect(computeMinZoom({ nodes, viewportWidth: VW, viewportHeight: VH }))
      .toBe(DEFAULT_MIN_ZOOM)
  })

  it('returns a value below DEFAULT_MIN_ZOOM for a wide-spread workspace', () => {
    const nodes = [
      { id: 'a', position: { x: 0,    y: 0    }, width: 256, height: 180 },
      { id: 'b', position: { x: 5000, y: 3000 }, width: 256, height: 180 },
    ]
    const result = computeMinZoom({ nodes, viewportWidth: VW, viewportHeight: VH })
    expect(result).toBeLessThan(DEFAULT_MIN_ZOOM)
    // Sanity: height should be the binding axis here.
    const bbH = 3000 + 180
    expect(result).toBeCloseTo((BIRDS_EYE_VIEWPORT_FILL * VH) / bbH, 4)
  })

  it('handles missing width/height by falling back to type-appropriate defaults', () => {
    // Nodes without measured dimensions still produce a finite, non-NaN result.
    const nodes = [
      { id: 'a', position: { x: 0,    y: 0    } },              // unmeasured
      { id: 'b', position: { x: 4000, y: 2000 } },              // unmeasured
    ]
    const result = computeMinZoom({ nodes, viewportWidth: VW, viewportHeight: VH })
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(0)
  })

  it('returns the same value when card nodes are measured as beads or as cards', () => {
    // Bbox-stability invariant: a card-type node's contribution to the
    // bounding box must NOT depend on whether RF currently measures it
    // at card dims (256 × 180) or bead dims (160 × 160 etc). Otherwise
    // the altitude rail's threshold marker would scoot up and down as
    // the user zooms across the morph boundary.
    const positions = [
      { id: 'a', position: { x: 0,    y: 0    } },
      { id: 'b', position: { x: 5000, y: 3000 } },
    ]
    const asCards = positions.map((n) => ({ ...n, width: 256, height: 180 }))
    const asBeads = positions.map((n) => ({ ...n, width: 160, height: 160 }))
    const cardResult = computeMinZoom({ nodes: asCards, viewportWidth: VW, viewportHeight: VH })
    const beadResult = computeMinZoom({ nodes: asBeads, viewportWidth: VW, viewportHeight: VH })
    expect(beadResult).toBe(cardResult)
  })

  it('respects measured dimensions for text nodes (which are user-resizable)', () => {
    // Text nodes don't morph, so their actual measured size SHOULD count.
    // Geometry is chosen so the y-axis is the binding one — only then does a
    // change in text-node height affect minZoom. (If x were binding the
    // text-node's height wouldn't matter and the test wouldn't exercise the
    // measurement-respecting branch at all.)
    const small = [
      { id: 't', type: 'textNode', position: { x: 0, y: 0 }, width: 200, height:   50 },
      { id: 'b', position: { x: 200, y: 0 }, width: 256, height: 180 },
    ]
    const tall = [
      { id: 't', type: 'textNode', position: { x: 0, y: 0 }, width: 200, height: 5000 },
      { id: 'b', position: { x: 200, y: 0 }, width: 256, height: 180 },
    ]
    const smallResult = computeMinZoom({ nodes: small, viewportWidth: VW, viewportHeight: VH })
    const tallResult  = computeMinZoom({ nodes: tall,  viewportWidth: VW, viewportHeight: VH })
    expect(tallResult).toBeLessThan(smallResult)
  })
})
