// ============================================================================
// CampaignNode — expanded-peek size is a constant, decoupled from the
// altitude-rail threshold (2026-07-20 fix)
// ----------------------------------------------------------------------------
// The bug these tests pin: a hover-expanded bead used to render its card form
// at "threshold size" (currentThresholdZoom), so dragging the altitude-rail
// slider silently changed how BIG the expanded reading card appeared —
// slider at the bottom made peeks gigantic, at the top unreadably tiny
// (Erik's 3-screenshot repro). The peek must render at a constant screen
// scale per platform (EXPANDED_PEEK_ZOOM / EXPANDED_PEEK_ZOOM_TOUCH), no
// matter where the threshold slider sits or how deep the zoom is.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import CampaignNode from './CampaignNode'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import {
  EXPANDED_PEEK_ZOOM,
  TOUCH_PEEK_MIN_ZOOM,
  TOUCH_PEEK_MAX_ZOOM,
  expandedPeekZoom,
} from '../utils/altitude'

// jsdom's innerWidth is 1024 by default; the touch peek reads it, so tests
// pin it per scenario (configurable so it can be redefined repeatedly).
function setViewportWidth(px) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px })
}

// Mutable viewport the reactflow mock serves — lets a test pick the zoom.
const viewport = vi.hoisted(() => ({ x: 0, y: 0, zoom: 0.25 }))

vi.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useViewport: () => ({ ...viewport }),
}))
vi.mock('../components/Lightbox', () => ({
  useLightbox: () => ({ open: vi.fn() }),
}))
vi.mock('../lib/useImageUrl', () => ({
  useImageUrl: () => null,
}))
vi.mock('../lib/CanvasOpsContext.jsx', () => ({
  useCanvasOps: () => ({}),
}))
vi.mock('./QuickConnectButtons.jsx', () => ({ default: () => null }))
vi.mock('./BlockPreview', () => ({ default: () => null }))

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// matchMedia override per suite (same pattern as CampaignNode.avatar.test.jsx).
let originalMatchMedia
function mockMatchMedia(matcher) {
  window.matchMedia = (query) => ({
    matches: matcher(query),
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

const DATA = {
  id: 'n1',
  label: 'Evergreen Candle Co.',
  type: 'character',
  avatar: null,
  summary: '',
  storyNotes: [],
  hiddenLore: [],
  dmNotes: [],
  media: [],
  connectionDots: [],
}

// Snapshot of the store fields the tests mutate, restored after each test.
let storeSnapshot

beforeEach(() => {
  originalMatchMedia = window.matchMedia
  const s = useCanvasUiStore.getState()
  storeSnapshot = {
    altitude: s.altitude,
    hoveredNodeId: s.hoveredNodeId,
    thresholdGridGapMm: s.thresholdGridGapMm,
  }
  // Bead View + this node hovered → isExpanded is true.
  useCanvasUiStore.setState({ altitude: 'beadView', hoveredNodeId: 'n1' })
  viewport.zoom = 0.25
})
afterEach(() => {
  window.matchMedia = originalMatchMedia
  useCanvasUiStore.setState(storeSnapshot)
})

// The expanded container carries `transform: ... scale(S)`. S = liftScale ×
// counterScale, where liftScale is the hover lift (1.03) and counterScale is
// the peek scale under test (peekZoom / zoom).
function renderedScale() {
  const { container, unmount } = render(
    <CampaignNode data={DATA} selected={false} xPos={0} yPos={0} />
  )
  const transform = container.firstChild.style.transform
  const m = /scale\(([\d.]+)\)/.exec(transform)
  unmount()
  expect(m).not.toBeNull()
  return Number(m[1])
}

function scaleAtThreshold(mm) {
  act(() => {
    useCanvasUiStore.setState({ thresholdGridGapMm: mm })
  })
  return renderedScale()
}

describe('expanded-peek scale — desktop (fine pointer)', () => {
  beforeEach(() => mockMatchMedia(() => false))

  it('renders the peek at EXPANDED_PEEK_ZOOM / zoom (± the 1.03 hover lift)', () => {
    const scale = renderedScale()
    const counter = EXPANDED_PEEK_ZOOM / viewport.zoom
    // Accept the lifted (1.03×) or unlifted value — the lift is not what
    // this suite pins; the counter-scale is.
    const matchesLifted   = Math.abs(scale - counter * 1.03) < 1e-6
    const matchesUnlifted = Math.abs(scale - counter) < 1e-6
    expect(matchesLifted || matchesUnlifted).toBe(true)
  })

  it('REGRESSION: peek scale is IDENTICAL wherever the threshold slider sits', () => {
    // Pre-fix, scale tracked currentThresholdZoom(thresholdMm) — these three
    // slider positions produced wildly different card sizes.
    const low  = scaleAtThreshold(1.0)   // slider near one end
    const mid  = scaleAtThreshold(2.65)  // default
    const high = scaleAtThreshold(8.0)   // slider near the other end
    expect(low).toBe(mid)
    expect(mid).toBe(high)
  })

  it('peek screen size is constant across zoom depths (scale ∝ 1/zoom)', () => {
    viewport.zoom = 0.25
    const a = renderedScale()
    viewport.zoom = 0.1
    const b = renderedScale()
    // screen size = scale × zoom → equal screen size ⇔ a×0.25 == b×0.1.
    expect(a * 0.25).toBeCloseTo(b * 0.1, 6)
  })
})

describe('expanded-peek scale — touch-primary (phones/tablets)', () => {
  beforeEach(() => mockMatchMedia((q) => q.includes('hover: none')))

  it('320-px viewport (display-zoomed Android): stays at the approved 0.5 scale', () => {
    setViewportWidth(320)
    const scale = renderedScale()
    const counter = 0.5 / viewport.zoom // 0.4 × 320 = 128 → 8-grid 128 → 128/256
    const matchesLifted   = Math.abs(scale - counter * 1.03) < 1e-6
    const matchesUnlifted = Math.abs(scale - counter) < 1e-6
    expect(matchesLifted || matchesUnlifted).toBe(true)
  })

  it('430-px viewport (QA iPhone): scales up to 176px base width (0.6875)', () => {
    setViewportWidth(430)
    const scale = renderedScale()
    const counter = 0.6875 / viewport.zoom // 0.4 × 430 = 172 → 8-grid 176 → 176/256
    const matchesLifted   = Math.abs(scale - counter * 1.03) < 1e-6
    const matchesUnlifted = Math.abs(scale - counter) < 1e-6
    expect(matchesLifted || matchesUnlifted).toBe(true)
  })

  it('REGRESSION: threshold slider position does not change the touch peek either', () => {
    setViewportWidth(430)
    const low  = scaleAtThreshold(1.0)
    const high = scaleAtThreshold(8.0)
    expect(low).toBe(high)
  })
})

describe('expandedPeekZoom (pure)', () => {
  it('desktop ignores the viewport entirely', () => {
    expect(expandedPeekZoom(false, 320)).toBe(EXPANDED_PEEK_ZOOM)
    expect(expandedPeekZoom(false, 4000)).toBe(EXPANDED_PEEK_ZOOM)
  })

  it("touch on Erik's Android viewport (320) is exactly the approved pre-rule scale", () => {
    expect(expandedPeekZoom(true, 320)).toBe(0.5)
  })

  it('touch on the QA iPhone viewport (430) lands on the 8-grid at 176px → 0.6875', () => {
    expect(expandedPeekZoom(true, 430)).toBe(0.6875)
  })

  it('clamps: tiny viewports floor at 0.5, tablets cap at desktop size', () => {
    expect(expandedPeekZoom(true, 220)).toBe(TOUCH_PEEK_MIN_ZOOM)
    expect(expandedPeekZoom(true, 768)).toBe(TOUCH_PEEK_MAX_ZOOM)
  })

  it('unknown viewport falls back to the floor (never NaN/undefined)', () => {
    expect(expandedPeekZoom(true, 0)).toBe(TOUCH_PEEK_MIN_ZOOM)
    expect(expandedPeekZoom(true, undefined)).toBe(TOUCH_PEEK_MIN_ZOOM)
  })

  it('every viewport produces an 8-grid base-card width within the clamps', () => {
    for (let vw = 260; vw <= 700; vw += 7) {
      const scale = expandedPeekZoom(true, vw)
      const width = scale * 256
      const clamped = scale === TOUCH_PEEK_MIN_ZOOM || scale === TOUCH_PEEK_MAX_ZOOM
      if (!clamped) expect(width % 8).toBe(0)
      expect(scale).toBeGreaterThanOrEqual(TOUCH_PEEK_MIN_ZOOM)
      expect(scale).toBeLessThanOrEqual(TOUCH_PEEK_MAX_ZOOM)
    }
  })
})
