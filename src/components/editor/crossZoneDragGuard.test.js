// Tests for the cross-zone drag guard's pure decision core (F5g). The DOM event
// wiring (window capture listeners) is verified manually in the browser; this pins
// the logic that decides WHEN to block: only a BlockNote block-drag that started in
// a zone editor and is now over a different zone editor (or outside any).

import { describe, it, expect } from 'vitest'
import { shouldBlockCrossZone } from './crossZoneDragGuard.js'

const A = { id: 'zoneA' } // stand-ins for two distinct .mm-zone-editor elements
const B = { id: 'zoneB' }

describe('shouldBlockCrossZone', () => {
  it('does not block when the drag did not start in a zone editor', () => {
    expect(shouldBlockCrossZone({ originEl: null, destEl: B, isBlockDrag: true })).toBe(false)
  })

  it('does not block non-BlockNote drags (no blocknote/html)', () => {
    expect(shouldBlockCrossZone({ originEl: A, destEl: B, isBlockDrag: false })).toBe(false)
  })

  it('ALLOWS within-zone reorder (same editor)', () => {
    expect(shouldBlockCrossZone({ originEl: A, destEl: A, isBlockDrag: true })).toBe(false)
  })

  it('BLOCKS a cross-zone move (different editor)', () => {
    expect(shouldBlockCrossZone({ originEl: A, destEl: B, isBlockDrag: true })).toBe(true)
  })

  it('BLOCKS a drop outside any zone editor (would delete the source into the void)', () => {
    expect(shouldBlockCrossZone({ originEl: A, destEl: null, isBlockDrag: true })).toBe(true)
  })
})
