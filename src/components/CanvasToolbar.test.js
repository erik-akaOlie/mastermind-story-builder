// ============================================================================
// placeDropdown tests — pin down the QA-1 dropdown fix (2026-07-16): a menu
// hanging off a floating-toolbar control prefers opening BELOW its anchor,
// flips ABOVE when the bottom of the window would clip it, and always clamps
// fully in-window. (placeFloatingToolbar predates this file and is pinned
// indirectly by the TextNode/Alignment/LineStyle toolbars' behavior.)
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { placeDropdown } from './CanvasToolbar.jsx'

const anchor = ({ left = 100, top = 500, bottom = 520 } = {}) => ({ left, top, bottom })
const MENU = { w: 48, h: 200 }

beforeEach(() => {
  vi.stubGlobal('innerWidth', 375)
  vi.stubGlobal('innerHeight', 812)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('placeDropdown', () => {
  it('opens below the anchor when there is room', () => {
    const p = placeDropdown(anchor(), MENU)
    expect(p.top).toBe(524)   // bottom 520 + gap 4
    expect(p.left).toBe(100)
  })

  it('flips above the anchor when the bottom would clip (the QA-1 case)', () => {
    const p = placeDropdown(anchor({ top: 700, bottom: 720 }), MENU)
    expect(p.top).toBe(700 - 4 - 200)   // above, gap 4
  })

  it('clamps horizontally so the menu never leaves the window', () => {
    const right = placeDropdown(anchor({ left: 360 }), MENU)
    expect(right.left).toBe(375 - 48 - 8)   // vw - w - margin
    const left = placeDropdown(anchor({ left: -20 }), MENU)
    expect(left.left).toBe(8)               // margin
  })

  it('clamps vertically even when neither side fully fits (tiny window)', () => {
    vi.stubGlobal('innerHeight', 180)
    const p = placeDropdown(anchor({ top: 90, bottom: 110 }), MENU)
    expect(p.top).toBeGreaterThanOrEqual(-28)  // clamped to vh - h - margin
    expect(p.top).toBe(180 - 200 - 8)
  })
})
