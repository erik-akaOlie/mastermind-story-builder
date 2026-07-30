// ============================================================================
// FtueIntro tests — the handwritten first-run introduction:
//   - ftueModeFor: creation tools → placement copy, everything else → welcome
//   - welcome state renders the content-vs-structure composition on BOTH
//     variants (desktop: Figma 286-148; mobile: Figma 265:229)
//   - arming Node / Text Block / Line swaps to the per-tool placement copy
//     ("label" for the text tool — FTUE-only term, both variants)
//   - phone portrait renders the MOBILE variant; tablets / phone landscape
//     (touch-primary without portrait) render nothing — there is no
//     toolbar to point at there
//   - visible=false unmounts (synchronously under reduced motion)
//   - missing [data-ftue-target] buttons degrade to text-only (no throw)
//   - hand-drawn path helpers emit valid SVG path data
//
// Geometry (arrow endpoints landing on the real toolbar buttons) is jsdom-
// invisible (zero rects) — that's Erik's visual QA across window sizes.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../lib/analytics.js', () => ({ track: vi.fn() }))

import FtueIntro, {
  ftueModeFor,
  handArrowPath,
  handArrowPathWavy,
  arrowheadPath,
  ftueScaleFor,
  ftuePx,
  FTUE_LADDER,
} from './FtueIntro'
import { useToolStore } from '../store/useToolStore'
import { track } from '../lib/analytics.js'

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'
const MOBILE_QUERY =
  '(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)'
const NARROW_QUERY = '(max-width: 640px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

let originalMatchMedia
function setMedia({ touch = false, mobilePortrait = false, narrow = false, reduced = true }) {
  window.matchMedia = (query) => ({
    matches:
      query === MOBILE_QUERY ? mobilePortrait :
      query === TOUCH_QUERY ? touch :
      query === NARROW_QUERY ? narrow || mobilePortrait :
      query === REDUCED_QUERY ? reduced :
      false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

beforeEach(() => {
  originalMatchMedia = window.matchMedia
  // reduced motion ON by default → fades are synchronous in tests.
  setMedia({})
  useToolStore.setState({ activeTool: 'pointer', spacebarHeld: false, placementGestureActive: false })
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

describe('ftueModeFor', () => {
  it('maps creation tools to placement, navigation tools to welcome', () => {
    expect(ftueModeFor('node')).toBe('placement')
    expect(ftueModeFor('text')).toBe('placement')
    expect(ftueModeFor('line')).toBe('placement')
    expect(ftueModeFor('pointer')).toBe('welcome')
    expect(ftueModeFor('hand')).toBe('welcome')
  })
})

describe('path helpers', () => {
  it('handArrowPath emits a cubic from tail to tip', () => {
    const d = handArrowPath({ x: 0, y: 0 }, { x: 100, y: 50 })
    expect(d.startsWith('M 0 0 C ')).toBe(true)
    expect(d.endsWith('100 50')).toBe(true)
    expect(d).not.toMatch(/NaN/)
  })

  it('arrowheadPath emits two barbs meeting at the tip', () => {
    const d = arrowheadPath({ x: 0, y: 0 }, { x: 100, y: 0 })
    expect(d.match(/L 100 0/g)).toHaveLength(2)
    expect(d).not.toMatch(/NaN/)
  })

  it('tolerates a zero-length arrow (no NaN)', () => {
    expect(handArrowPath({ x: 5, y: 5 }, { x: 5, y: 5 })).not.toMatch(/NaN/)
    expect(arrowheadPath({ x: 5, y: 5 }, { x: 5, y: 5 })).not.toMatch(/NaN/)
  })

  it('mobile variant: ONE cubic (two broad motions) + a straight aimed arrival (pass 3)', () => {
    const tail = { x: 0, y: 0 }
    const tip = { x: 120, y: 300 }
    const aim = { x: 120, y: 340 } // straight below the tip
    const d = handArrowPathWavy(tail, tip, 32, aim)
    expect(d.startsWith('M 0 0 ')).toBe(true)
    expect(d.endsWith('L 120 300')).toBe(true)      // ends with the straight run
    expect(d.match(/C /g)).toHaveLength(1)          // one cubic — NOT a chained S
    expect(d).not.toMatch(/NaN/)
    // The straight run enters along the aim direction: its start point
    // (the curve's endpoint) sits directly above the tip.
    const pre = d.match(/([\d.-]+) ([\d.-]+) L 120 300$/)
    expect(parseFloat(pre[1])).toBeCloseTo(120)     // same x as tip
    expect(parseFloat(pre[2])).toBeCloseTo(280)     // 20px short of the tip
    expect(handArrowPathWavy(tail, tail, 32, null)).not.toMatch(/NaN/)
  })

  it('mobile variant: startDir pins the departure direction (tail attaches to text)', () => {
    const tail = { x: 200, y: 100 }
    const tip = { x: 80, y: 300 }
    const aim = { x: 80, y: 340 }
    const startDir = { x: -0.92, y: 0.39 }
    const d = handArrowPathWavy(tail, tip, 24, aim, startDir)
    // First control point lies along startDir from the tail: left of and
    // slightly below the tail — the strong bend AWAY from the text.
    const c1 = d.match(/C ([\d.-]+) ([\d.-]+),/)
    expect(parseFloat(c1[1])).toBeLessThan(200)
    expect(parseFloat(c1[2])).toBeGreaterThan(100)
    // Departure slope matches the requested direction.
    const slope = (parseFloat(c1[2]) - 100) / (parseFloat(c1[1]) - 200)
    expect(slope).toBeCloseTo(0.39 / -0.92, 2)
    expect(d).not.toMatch(/NaN/)
  })

  it('aims the arrival tangent at the target when aim is given (design QA)', () => {
    // Tail up-left, tip directly above an icon center: the aimed head must
    // point straight DOWN at the icon — barbs symmetric about x=100, above
    // the tip — regardless of where the curve came from.
    const tail = { x: 0, y: 0 }
    const tip = { x: 100, y: 80 }
    const aim = { x: 100, y: 120 }
    const d = arrowheadPath(tail, tip, 24, 12, aim)
    const barbs = [...d.matchAll(/M ([\d.-]+) ([\d.-]+)/g)].map((m) => ({
      x: Number(m[1]), y: Number(m[2]),
    }))
    expect(barbs).toHaveLength(2)
    expect(barbs[0].x + barbs[1].x).toBeCloseTo(200) // symmetric about x=100
    expect(barbs[0].y).toBeLessThan(80)              // both barbs sit above the tip
    expect(barbs[1].y).toBeLessThan(80)
    // The curve itself still runs tail → tip, NaN-free.
    const curve = handArrowPath(tail, tip, 24, aim)
    expect(curve.startsWith('M 0 0 C ')).toBe(true)
    expect(curve.endsWith('100 80')).toBe(true)
    expect(curve).not.toMatch(/NaN/)
  })
})

describe('two-dimensional scale model (pass 3)', () => {
  const L = FTUE_LADDER

  it('kW: 0 at the 640 breakpoint, 1 from 1440 up, monotonic between', () => {
    expect(ftueScaleFor(640, 900).kW).toBe(0)
    expect(ftueScaleFor(400, 900).kW).toBe(0)
    expect(ftueScaleFor(1440, 900).kW).toBe(1)
    expect(ftueScaleFor(1920, 900).kW).toBe(1)
    const mid = ftueScaleFor(1040, 900).kW
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('cH: uncompressed at laptop heights, floored at 0.5 on tiny ones', () => {
    expect(ftueScaleFor(1920, 720).cH).toBe(1)
    expect(ftueScaleFor(1920, 1080).cH).toBe(1)
    expect(ftueScaleFor(1920, 400).cH).toBe(0.5)
    expect(ftueScaleFor(1920, 200).cH).toBe(0.5)
    const mid = ftueScaleFor(1920, 560).cH
    expect(mid).toBeGreaterThan(0.5)
    expect(mid).toBeLessThan(1)
  })

  it('HEIGHT governs a short-but-wide window (the pass-2 failure case)', () => {
    const short = ftueScaleFor(1600, 500)
    const tall = ftueScaleFor(1600, 900)
    expect(ftuePx(L.hero, short)).toBeLessThan(ftuePx(L.hero, tall))
    // The arrow zone compresses too — and can never exceed its designed max.
    expect(ftuePx(L.arrowZone, short)).toBeLessThan(ftuePx(L.arrowZone, tall))
    expect(ftuePx(L.arrowZone, tall)).toBe(112)
  })

  it('desktop values converge to the mobile-system-at-640 values at the boundary', () => {
    const s = ftueScaleFor(641, 800)
    expect(ftuePx(L.hero, s)).toBeCloseTo(104, 0)
    expect(ftuePx(L.mission, s)).toBeCloseTo(28, 0)
    expect(ftuePx(L.nodesName, s)).toBeCloseTo(24, 0)
    expect(ftuePx(L.contentDesc, s)).toBeCloseTo(16, 0)
    expect(ftuePx(L.arrowZone, s)).toBeCloseTo(56, 0)
  })

  it('the hierarchy never flattens or inverts at any window shape', () => {
    const widths = [660, 900, 1200, 1440, 1920, 2560]
    const heights = [401, 500, 720, 900, 1200]
    for (const w of widths) {
      for (const h of heights) {
        const s = ftueScaleFor(w, h)
        const hero = ftuePx(L.hero, s)
        const mission = ftuePx(L.mission, s)
        const nodes = ftuePx(L.nodesName, s)
        const orgName = ftuePx(L.orgName, s)
        const contentDesc = ftuePx(L.contentDesc, s)
        const orgDesc = ftuePx(L.orgDesc, s)
        expect(hero).toBeGreaterThan(mission)
        expect(mission).toBeGreaterThanOrEqual(nodes)
        expect(nodes).toBeGreaterThanOrEqual(orgName)
        expect(orgName).toBeGreaterThan(contentDesc)
        expect(contentDesc).toBeGreaterThanOrEqual(orgDesc)
      }
    }
  })

  it('ftuePx honors floors', () => {
    expect(ftuePx({ full: 112, mobileEnd: 56, floor: 48 }, { kW: 0, cH: 0.5 })).toBe(48)
  })
})

describe('guidance states', () => {
  it('shows the desktop welcome composition (Figma 286-148: hero, mission, legend)', () => {
    const { container } = render(<FtueIntro visible />)
    expect(screen.getByText('Welcome')).toBeTruthy()
    // Mission + descriptors carry hard <br/> breaks — match on fragments.
    expect(container.textContent).toContain('Use the tools below to build')
    expect(container.textContent).toContain('your workspace')
    expect(container.textContent).toContain('add content')
    expect(screen.getByText('Nodes')).toBeTruthy()
    expect(container.textContent).toContain('structure and')
    expect(container.textContent).toContain('organize with')
    // The name row is span-composed (Labels / & / Lines) — fragments.
    expect(container.textContent).toContain('Labels')
    expect(container.textContent).toContain('Lines')
    // The pre-286-148 desktop copy is gone.
    expect(container.textContent).not.toContain('Get started')
    expect(screen.queryByText('You can also:')).toBeNull()
    expect(track).toHaveBeenCalledWith('ftue_shown')
  })

  it.each([
    ['node', 'Now place the node wherever you like on the canvas'],
    ['text', 'Now place the label wherever you like on the canvas'],
    ['line', 'Now draw a line wherever you like on the canvas'],
  ])('arming %s shows its placement copy', (tool, copy) => {
    useToolStore.setState({ activeTool: tool })
    render(<FtueIntro visible />)
    expect(screen.getByText(copy)).toBeTruthy()
  })

  it('derives placement from activeTool, so a held spacebar does not flip the copy', () => {
    useToolStore.setState({ activeTool: 'node', spacebarHeld: true })
    render(<FtueIntro visible />)
    expect(
      screen.getByText('Now place the node wherever you like on the canvas'),
    ).toBeTruthy()
  })
})

describe('visibility gating', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(<FtueIntro visible={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('unmounts when visible flips off (reduced motion → synchronous)', () => {
    const { container, rerender } = render(<FtueIntro visible />)
    expect(container.firstChild).not.toBeNull()
    rerender(<FtueIntro visible={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing on touch-primary WITHOUT phone portrait (tablets / landscape)', () => {
    setMedia({ touch: true })
    const { container } = render(<FtueIntro visible />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the mobile welcome on phone portrait (pass-4 mockup: content vs structure)', () => {
    setMedia({ touch: true, mobilePortrait: true })
    const { container } = render(<FtueIntro visible />)
    expect(screen.getByText('Welcome')).toBeTruthy()
    // Canonical mission copy (Erik 2026-07-29) — same sentence as
    // desktop, phone line break. Match on fragments across the <br/>.
    expect(container.textContent).toContain('Use the tools below')
    expect(container.textContent).toContain('to build your workspace')
    // The tool legend: content vs structure, with the Labels term
    // (Erik's re-identification of text blocks as an organizing tool).
    // Descriptors carry hard <br/> breaks — match on fragments.
    expect(container.textContent).toContain('add content')
    expect(screen.getByText('Nodes')).toBeTruthy()
    expect(container.textContent).toContain('structure and')
    expect(container.textContent).toContain('organize with')
    expect(screen.getByText('Labels & Lines')).toBeTruthy()
    // Desktop's phrasing of the mission break does NOT render on mobile
    // (desktop breaks after "build"; the sentence itself is shared).
    expect(container.textContent).not.toContain('Use the tools below to build')
  })

  it('a phone-narrow window renders the MOBILE layout even without touch (Erik QA 2026-07-29)', () => {
    // Narrowing a desktop browser to ≤640px resolves to the mobile
    // composition — never an invented intermediate desktop layout. The
    // discriminator is the single-text-node name row ('Labels & Lines'
    // is span-composed on desktop, one node on mobile).
    setMedia({ narrow: true })
    const { container } = render(<FtueIntro visible />)
    expect(container.textContent).toContain('Use the tools below')
    expect(screen.getByText('Labels & Lines')).toBeTruthy()
  })

  it.each([
    ['mobile', { touch: true, mobilePortrait: true }],
    ['desktop', {}],
  ])('%s placement copy says LABEL for the text tool (FTUE-only term; desktop adopted the legend 2026-07-29)', (_variant, media) => {
    setMedia(media)
    useToolStore.setState({ activeTool: 'text' })
    render(<FtueIntro visible />)
    expect(
      screen.getByText('Now place the label wherever you like on the canvas'),
    ).toBeTruthy()
  })

  it('does not throw when the toolbar targets are absent from the DOM', () => {
    expect(() => render(<FtueIntro visible />)).not.toThrow()
  })
})
