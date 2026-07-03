// Tests for setExpandedNode's geometry hygiene (2026-07-02 mobile
// white-screen fix). Three layers, tested independently:
//   1. Non-finite gate — NaN/Infinity never enters the map.
//   2. Sub-pixel deadband — changes smaller than ~0.2% of the published
//      width are "no change": no new Map, no subscriber notification.
//      This is what starves the clamp/repulsion floating-point feedback
//      loop (observed: centerX flapping 0.31–0.63 canvas units, 41 updates
//      in ~150ms → "maximum update depth exceeded").
//   3. Oscillation circuit-breaker — a burst of REAL changes on one id
//      throws (dev) with a message naming the flapping fields.

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasUiStore } from './useCanvasUiStore'

const REC = {
  centerX: 500, centerY: 300,
  natCenterX: 480, natCenterY: 290,
  width: 680, height: 480,       // ~canvas units for an expanded card
  boxWidth: 256, boxHeight: 180,
}

const setNode = (id, patch) =>
  useCanvasUiStore.getState().setExpandedNode(id, patch ? { ...REC, ...patch } : null)

const getMap = () => useCanvasUiStore.getState().expandedNodes

beforeEach(() => {
  // Clear every entry between tests (fresh Map, no cross-test bleed).
  for (const id of [...getMap().keys()]) setNode(id, null)
})

describe('setExpandedNode — non-finite gate', () => {
  it('drops records containing NaN', () => {
    setNode('a', { centerX: NaN })
    expect(getMap().has('a')).toBe(false)
  })

  it('drops records containing Infinity (zero-zoom division)', () => {
    setNode('a', { width: Infinity })
    expect(getMap().has('a')).toBe(false)
  })

  it('keeps the previous good record when a bad one arrives', () => {
    setNode('a', {})
    setNode('a', { centerY: NaN })
    expect(getMap().get('a').centerY).toBe(REC.centerY)
  })
})

describe('setExpandedNode — sub-pixel deadband', () => {
  it('a sub-pixel centerX change is NOT a new state (no Map identity change)', () => {
    setNode('a', {})
    const before = getMap()
    // The observed on-device flap: 0.63 canvas units on a ~680-wide card
    // (deadband ε = 680 × 0.002 = 1.36).
    setNode('a', { centerX: REC.centerX + 0.63 })
    expect(getMap()).toBe(before) // same Map reference → zero notifications
  })

  it('a rapid sub-pixel two-value oscillation produces zero updates', () => {
    setNode('a', {})
    const before = getMap()
    for (let i = 0; i < 100; i++) {
      setNode('a', { centerX: REC.centerX + (i % 2 ? 0.31 : -0.31) })
    }
    expect(getMap()).toBe(before) // the loop starves on its first cycle
  })

  it('a real movement still updates', () => {
    setNode('a', {})
    setNode('a', { centerX: REC.centerX + 40 })
    expect(getMap().get('a').centerX).toBe(REC.centerX + 40)
  })
})

describe('setExpandedNode — oscillation circuit-breaker', () => {
  it('a rapid burst of REAL geometry changes throws with the flapping field named', () => {
    // Alternate centerX by well over the deadband so every write is "real".
    expect(() => {
      for (let i = 0; i < 60; i++) {
        setNode('burst', { centerX: REC.centerX + (i % 2 ? 100 : -100) })
      }
    }).toThrow(/expandedNode oscillation.*centerX/s)
  })

  it('slow real changes never trip the breaker', () => {
    // Far fewer than 40 changes — normal interaction volume.
    expect(() => {
      for (let i = 0; i < 30; i++) {
        setNode('calm', { centerX: REC.centerX + i * 50 })
      }
    }).not.toThrow()
  })
})
