// ============================================================================
// viewportFraming.test — the virtual envelope + entry-viewport math (MB-8)
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  graphBounds,
  computeEnvelope,
  computeEntryViewport,
  computeEnvelopeFitZoom,
  computeFocusViewport,
  nodeCenter,
  FOCUS_ZOOM,
  STARTER_ROOM_WIDTH,
  STARTER_ROOM_HEIGHT,
  ENVELOPE_MARGIN_RATIO,
} from './viewportFraming.js'

const card = (x, y, id = 'n') => ({ id, type: 'campaignNode', position: { x, y } })
const textNode = (x, y, width, height) => ({
  id: 't', type: 'textNode', position: { x, y }, width, height,
})

describe('graphBounds', () => {
  it('returns null for an empty workspace', () => {
    expect(graphBounds([])).toBeNull()
    expect(graphBounds(null)).toBeNull()
  })

  it('uses canonical 256×180 for card nodes', () => {
    expect(graphBounds([card(100, 50)])).toEqual({
      minX: 100, minY: 50, maxX: 356, maxY: 230,
    })
  })

  it('uses stored dimensions for text nodes', () => {
    expect(graphBounds([textNode(0, 0, 400, 120)])).toEqual({
      minX: 0, minY: 0, maxX: 400, maxY: 120,
    })
  })

  it('skips nodes without a numeric position', () => {
    const bad = { id: 'x', type: 'campaignNode', position: { x: undefined, y: 5 } }
    expect(graphBounds([bad])).toBeNull()
  })
})

describe('computeEnvelope', () => {
  it('centers the starter room on the origin for an empty workspace', () => {
    expect(computeEnvelope([])).toEqual({
      x: -STARTER_ROOM_WIDTH / 2,
      y: -STARTER_ROOM_HEIGHT / 2,
      width: STARTER_ROOM_WIDTH,
      height: STARTER_ROOM_HEIGHT,
    })
  })

  it('centers the starter room on a single node (balloon: mostly empty)', () => {
    const env = computeEnvelope([card(1000, 2000)])
    // Node center = (1128, 2090); the starter room centers there.
    expect(env.width).toBe(STARTER_ROOM_WIDTH)
    expect(env.height).toBe(STARTER_ROOM_HEIGHT)
    expect(env.x + env.width / 2).toBe(1128)
    expect(env.y + env.height / 2).toBe(2090)
  })

  it('locks to graph bounds + margin once the graph outgrows the room', () => {
    // Two cards spanning 10000 px horizontally — far past the starter room.
    const env = computeEnvelope([card(0, 0), card(10000 - 256, 0)])
    expect(env.width).toBeCloseTo(10000 * (1 + 2 * ENVELOPE_MARGIN_RATIO))
    // Vertical extent (180) is still tiny: starter height keeps the
    // breathing room on the unbound axis (per-axis max).
    expect(env.height).toBe(STARTER_ROOM_HEIGHT)
  })

  it('is continuous at the crossover (no pop)', () => {
    // Graph width exactly at the crossover: bounds * (1 + 2m) == room width.
    const spanW = STARTER_ROOM_WIDTH / (1 + 2 * ENVELOPE_MARGIN_RATIO)
    const env = computeEnvelope([card(0, 0), card(spanW - 256, 0)])
    expect(env.width).toBeCloseTo(STARTER_ROOM_WIDTH)
  })
})

describe('computeEntryViewport', () => {
  const envelope = { x: -1280, y: -900, width: 2560, height: 1800 } // origin-centered

  it('fits and centers the envelope in the full window when nothing is reserved', () => {
    const vp = computeEntryViewport({
      envelope, viewportWidth: 1280, viewportHeight: 900,
    })
    expect(vp.zoom).toBeCloseTo(0.5) // 1280/2560 = 900/1800 = 0.5
    // Envelope center (0,0) maps to the window center.
    expect(vp.x).toBeCloseTo(640)
    expect(vp.y).toBeCloseTo(450)
  })

  it('centers in the work area between the rail and Inspector bands', () => {
    const vp = computeEntryViewport({
      envelope, viewportWidth: 1920, viewportHeight: 1080,
      reservedLeftPx: 64, reservedRightPx: 496,
    })
    // Available area = 1920 - 64 - 496 = 1360 wide → zoom bound by width.
    expect(vp.zoom).toBeCloseTo(1360 / 2560)
    // Envelope center maps to the available-area center: 64 + 1360/2 = 744.
    expect(vp.x).toBeCloseTo(744)
  })

  it('never floor-clamps: a very wide envelope still fully fits the window', () => {
    // The whole graph must fit no matter what (Erik, 2026-07-06 QA) — the
    // floor follows this zoom down via App's dynamic-minZoom composition.
    const vp = computeEntryViewport({
      envelope, viewportWidth: 400, viewportHeight: 800,
    })
    expect(vp.zoom).toBeCloseTo(400 / 2560)
    // Envelope's left edge maps inside the window (nothing cut off).
    expect(vp.x + envelope.x * vp.zoom).toBeGreaterThanOrEqual(0)
  })

  it('clamps entry zoom down to zoom-level 1 (never opens nose-to-card)', () => {
    const tiny = { x: 0, y: 0, width: 256, height: 180 }
    const vp = computeEntryViewport({
      envelope: tiny, viewportWidth: 1920, viewportHeight: 1080,
    })
    expect(vp.zoom).toBe(1)
  })

  it('falls back to the full window when the reserves exceed the window', () => {
    const vp = computeEntryViewport({
      envelope, viewportWidth: 400, viewportHeight: 800,
      reservedLeftPx: 64, reservedRightPx: 496,
    })
    // 400 - 560 < 0 → use the full 400px width, no left inset.
    expect(vp.zoom).toBeCloseTo(400 / 2560)
    expect(vp.x).toBeCloseTo(200)
  })

  it('returns a safe identity viewport for degenerate input', () => {
    expect(computeEntryViewport({ envelope: null, viewportWidth: 800, viewportHeight: 600 }))
      .toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('computeEnvelopeFitZoom', () => {
  const envelope = { x: 0, y: 0, width: 2560, height: 1800 }

  it('matches the zoom computeEntryViewport frames with (shared insets)', () => {
    const args = {
      envelope, viewportWidth: 1920, viewportHeight: 1080,
      reservedLeftPx: 64, reservedRightPx: 496,
    }
    expect(computeEnvelopeFitZoom(args)).toBeCloseTo(computeEntryViewport(args).zoom)
  })

  it('caps at maxZoom (default 1) for tiny envelopes', () => {
    expect(computeEnvelopeFitZoom({
      envelope: { x: 0, y: 0, width: 100, height: 100 },
      viewportWidth: 1920, viewportHeight: 1080,
    })).toBe(1)
  })

  it('drops below the legacy 0.5 floor for wide graphs (floor follows the frame)', () => {
    const wide = { x: 0, y: 0, width: 10000, height: 1000 }
    expect(computeEnvelopeFitZoom({
      envelope: wide, viewportWidth: 1920, viewportHeight: 1080,
      reservedLeftPx: 64, reservedRightPx: 496,
    })).toBeCloseTo(1360 / 10000)
  })
})

describe('nodeCenter', () => {
  it('uses the canonical card footprint for card nodes', () => {
    expect(nodeCenter(card(100, 50))).toEqual({ x: 228, y: 140 })
  })

  it('uses stored dimensions for text nodes', () => {
    expect(nodeCenter(textNode(0, 0, 400, 120))).toEqual({ x: 200, y: 60 })
  })
})

describe('computeFocusViewport', () => {
  it('centers the point in the work area between the reserved bands', () => {
    const vp = computeFocusViewport({
      center: { x: 500, y: 300 },
      viewportWidth: 1920, viewportHeight: 1080,
      reservedLeftPx: 64, reservedRightPx: 496,
    })
    // Work area: x 64..1424 (1360 wide) → its center is 64 + 680 = 744.
    // Screen position of the node center = vp.x + 500 * zoom — must be 744.
    expect(vp.zoom).toBe(FOCUS_ZOOM)
    expect(vp.x + 500 * vp.zoom).toBeCloseTo(744)
    expect(vp.y + 300 * vp.zoom).toBeCloseTo(540)
  })

  it('centers in the full window when no bands are reserved (phone)', () => {
    const vp = computeFocusViewport({
      center: { x: 500, y: 300 },
      viewportWidth: 390, viewportHeight: 844,
    })
    expect(vp.x + 500 * vp.zoom).toBeCloseTo(195)
    expect(vp.y + 300 * vp.zoom).toBeCloseTo(422)
  })

  it('falls back to the full window when reserves exceed the window', () => {
    const vp = computeFocusViewport({
      center: { x: 0, y: 0 },
      viewportWidth: 400, viewportHeight: 800,
      reservedLeftPx: 64, reservedRightPx: 496,
    })
    expect(vp.x).toBeCloseTo(200)
    expect(vp.y).toBeCloseTo(400)
  })

  it('returns a safe identity viewport for degenerate input', () => {
    expect(computeFocusViewport({ center: null, viewportWidth: 800, viewportHeight: 600 }))
      .toEqual({ x: 0, y: 0, zoom: FOCUS_ZOOM })
  })
})
