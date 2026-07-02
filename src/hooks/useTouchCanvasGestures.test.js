// Unit tests for the pure two-finger gesture math (MB-1, mobile beta
// hardening). computeTwoFingerViewport keeps the canvas point that sat under
// the fingers' midpoint at gesture start pinned under the midpoint as it
// moves, while scaling zoom by the finger-distance ratio.
//
// These tests cover the math only — real touch behavior (event ordering,
// preventDefault, browser gesture arbitration) is verified on-device
// against production, per the session's verification-honesty rule.

import { describe, it, expect } from 'vitest'
import { computeTwoFingerViewport } from './useTouchCanvasGestures'

// A session as onTouchStart builds it: viewport {x:0, y:0, zoom:1}, fingers'
// midpoint at screen (100, 100) → anchorFlow = (100, 100).
const baseSession = {
  startZoom: 1,
  startDist: 200,
  anchorFlow: { x: 100, y: 100 },
}

describe('computeTwoFingerViewport', () => {
  it('pure pan: midpoint moves, distance constant → viewport translates, zoom unchanged', () => {
    const next = computeTwoFingerViewport(
      baseSession,
      { x: 150, y: 80 }, // midpoint moved +50x, -20y
      200,               // same distance
      0.1,
      2
    )
    expect(next.zoom).toBe(1)
    // anchor (100,100) must now sit under screen (150,80):
    // vp.x = 150 - 100*1 = 50 ; vp.y = 80 - 100*1 = -20
    expect(next.x).toBe(50)
    expect(next.y).toBe(-20)
  })

  it('pure zoom: fingers spread 2×, midpoint still → zoom doubles, anchor stays put', () => {
    const next = computeTwoFingerViewport(
      baseSession,
      { x: 100, y: 100 }, // midpoint unchanged
      400,                // distance doubled
      0.1,
      2
    )
    expect(next.zoom).toBe(2)
    // anchor (100,100) at zoom 2 must still sit under screen (100,100):
    // vp.x = 100 - 100*2 = -100
    expect(next.x).toBe(-100)
    expect(next.y).toBe(-100)
  })

  it('combined pan+zoom in one gesture (Google-Maps style)', () => {
    const next = computeTwoFingerViewport(
      baseSession,
      { x: 200, y: 150 },
      300, // 1.5× spread
      0.1,
      2
    )
    expect(next.zoom).toBe(1.5)
    expect(next.x).toBe(200 - 100 * 1.5) // 50
    expect(next.y).toBe(150 - 100 * 1.5) // 0
  })

  it('clamps zoom to maxZoom while still following the midpoint', () => {
    const next = computeTwoFingerViewport(
      baseSession,
      { x: 120, y: 100 },
      2000, // 10× spread → raw zoom 10, clamped to 2
      0.1,
      2
    )
    expect(next.zoom).toBe(2)
    expect(next.x).toBe(120 - 100 * 2)
  })

  it('clamps zoom to minZoom (the altitude system\'s dynamic floor)', () => {
    const next = computeTwoFingerViewport(
      baseSession,
      { x: 100, y: 100 },
      20, // 0.1× pinch → raw zoom 0.1, clamped to 0.5
      0.5,
      2
    )
    expect(next.zoom).toBe(0.5)
  })

  it('non-1 start zoom: ratios compose from the gesture-start zoom, not absolute', () => {
    const session = { startZoom: 0.8, startDist: 100, anchorFlow: { x: 50, y: 50 } }
    const next = computeTwoFingerViewport(session, { x: 60, y: 60 }, 150, 0.1, 2)
    expect(next.zoom).toBeCloseTo(1.2) // 0.8 * 1.5
    expect(next.x).toBeCloseTo(60 - 50 * 1.2)
    expect(next.y).toBeCloseTo(60 - 50 * 1.2)
  })
})
