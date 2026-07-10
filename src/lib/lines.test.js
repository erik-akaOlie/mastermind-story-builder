// Pure marshaling helpers for line annotations (lib/lines.js).

import { describe, it, expect } from 'vitest'
import { dbLineToReactFlow, buildLineDbRow, linePositionFor, snapToAxis, LINE_PAD, LINE_DEFAULTS } from './lines.js'

const dbRow = (overrides = {}) => ({
  id:           'ln-1',
  workspace_id: 'ws-1',
  a_x:          100,
  a_y:          400,
  b_x:          300,
  b_y:          200,
  stroke_width: 4,
  dashed:       false,
  dash_length:  12,
  dash_gap:     8,
  color:        '#9CA3AF',
  ...overrides,
})

describe('linePositionFor', () => {
  it('is the padded top-left of the anchor bounding box', () => {
    expect(linePositionFor({ ax: 100, ay: 400, bx: 300, by: 200 }))
      .toEqual({ x: 100 - LINE_PAD, y: 200 - LINE_PAD })
  })

  it('is translation-invariant (whole-line drag maps 1:1 onto anchors)', () => {
    const a = linePositionFor({ ax: 100, ay: 400, bx: 300, by: 200 })
    const b = linePositionFor({ ax: 150, ay: 470, bx: 350, by: 270 })
    expect(b).toEqual({ x: a.x + 50, y: a.y + 70 })
  })
})

describe('dbLineToReactFlow ↔ buildLineDbRow', () => {
  it('marshals a DB row into the lineNode React shape', () => {
    const n = dbLineToReactFlow(dbRow())
    expect(n).toEqual({
      id: 'ln-1',
      type: 'lineNode',
      position: { x: 100 - LINE_PAD, y: 200 - LINE_PAD },
      draggable: true,
      data: {
        ax: 100, ay: 400, bx: 300, by: 200,
        weight: 4, dashed: false, dashLength: 12, dashGap: 8,
        color: '#9CA3AF',
      },
    })
  })

  it('round-trips: buildLineDbRow(dbLineToReactFlow(row)) preserves every field', () => {
    const row = dbRow({ dashed: true, dash_length: 20, dash_gap: 10, stroke_width: 8 })
    const back = buildLineDbRow(dbLineToReactFlow(row), 'ws-1')
    expect(back).toEqual(row)
  })

  it('coerces numeric strings from Postgres numeric columns', () => {
    const n = dbLineToReactFlow(dbRow({ a_x: '100.5', b_y: '200.25' }))
    expect(n.data.ax).toBe(100.5)
    expect(n.data.by).toBe(200.25)
  })
})

describe('defaults', () => {
  it('new lines default to weight 8 (Erik 2026-07-10)', () => {
    expect(LINE_DEFAULTS.weight).toBe(8)
  })
})

describe('snapToAxis (Shift-constrained drawing)', () => {
  const O = { x: 100, y: 100 }

  it('snaps a near-horizontal drag to exactly horizontal, preserving length', () => {
    const p = snapToAxis(O, { x: 300, y: 110 })
    expect(p.y).toBeCloseTo(100, 6)
    expect(Math.hypot(p.x - O.x, p.y - O.y)).toBeCloseTo(Math.hypot(200, 10), 6)
  })

  it('snaps a near-vertical drag to exactly vertical (both directions)', () => {
    expect(snapToAxis(O, { x: 108, y: 300 }).x).toBeCloseTo(100, 6)
    expect(snapToAxis(O, { x: 92, y: -300 }).x).toBeCloseTo(100, 6)
  })

  it('snaps to the 45° diagonals when closer to them', () => {
    const p = snapToAxis(O, { x: 200, y: 190 })   // ~42° → 45°
    expect(p.x - O.x).toBeCloseTo(p.y - O.y, 6)
    const q = snapToAxis(O, { x: 200, y: 10 })    // ~-42° → -45°
    expect(q.x - O.x).toBeCloseTo(-(q.y - O.y), 6)
  })

  it('covers all four axes / eight directions across the circle', () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180
      const p = snapToAxis(O, { x: O.x + Math.cos(rad) * 100, y: O.y + Math.sin(rad) * 100 })
      const snappedDeg = ((Math.atan2(p.y - O.y, p.x - O.x) * 180) / Math.PI + 360) % 360
      expect(snappedDeg % 45).toBeCloseTo(0, 4)
    }
  })

  it('degenerate zero-length input returns the point unchanged', () => {
    expect(snapToAxis(O, { x: 100, y: 100 })).toEqual({ x: 100, y: 100 })
  })
})
