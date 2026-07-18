// ============================================================================
// FtueIntro tests — the handwritten first-run introduction (chunk 1):
//   - ftueModeFor: creation tools → placement copy, everything else → welcome
//   - welcome state renders the Figma 225-1971 copy
//   - arming Node / Text Block / Line swaps to the per-tool placement copy
//   - phone portrait renders the MOBILE variant (Figma 265:229); tablets /
//     phone landscape (touch-primary without portrait) render nothing —
//     there is no toolbar to point at there
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
  asideLeftPxFor,
  shouldShowAside,
  ASIDE_MIN_GAP_PX,
} from './FtueIntro'
import { useToolStore } from '../store/useToolStore'
import { track } from '../lib/analytics.js'

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'
const MOBILE_QUERY =
  '(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

let originalMatchMedia
function setMedia({ touch = false, mobilePortrait = false, reduced = true }) {
  window.matchMedia = (query) => ({
    matches:
      query === MOBILE_QUERY ? mobilePortrait :
      query === TOUCH_QUERY ? touch :
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

describe('hide-before-collision (responsive desktop pass)', () => {
  it('mirrors the CSS min(): centered offset wide, right-edge clamp narrow', () => {
    expect(asideLeftPxFor(1920)).toBe(1280)  // 1920/2 + 320
    expect(asideLeftPxFor(1366)).toBe(950)   // clamp: 1366 − 416
  })

  it('shows the aside when the gap to the instruction is ≥ the minimum', () => {
    // 1366 window, instruction right edge at 859 (the measured laptop
    // value): gap 91 ≥ 48 → shown.
    expect(shouldShowAside(1366, 859)).toBe(true)
  })

  it('hides the aside before it can overlap the instruction', () => {
    // Narrowed window: aside left (window − 416) crosses inside the
    // instruction's right edge + minimum gap → hidden.
    expect(shouldShowAside(1100, 700)).toBe(false)
    // Exactly at the threshold stays visible; one px closer hides.
    const w = 1366
    expect(shouldShowAside(w, asideLeftPxFor(w) - ASIDE_MIN_GAP_PX)).toBe(true)
    expect(shouldShowAside(w, asideLeftPxFor(w) - ASIDE_MIN_GAP_PX + 1)).toBe(false)
  })

  it('drops the aside from the DOM when the rule says hide', () => {
    // jsdom: innerWidth 1024 → aside left 608; force a collision by
    // narrowing the window below the aside block + gap.
    window.innerWidth = 300 // aside left → −116 < 0 + 48 → hidden
    render(<FtueIntro visible />)
    expect(screen.queryByText('You can also:')).toBeNull()
    window.innerWidth = 1024
  })
})

describe('guidance states', () => {
  it('shows the welcome copy when no creation tool is armed', () => {
    render(<FtueIntro visible />)
    expect(screen.getByText('Welcome to your new workspace')).toBeTruthy()
    expect(screen.getByText('You can also:')).toBeTruthy()
    expect(track).toHaveBeenCalledWith('ftue_shown')
  })

  it.each([
    ['node', 'Now place the node wherever you like on the canvas'],
    ['text', 'Now place the text block wherever you like on the canvas'],
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
    // Mission line uses a hard <br/>, so match on the fragments.
    expect(container.textContent).toContain('Use these tools to')
    expect(container.textContent).toContain('build your workspace')
    // The tool legend: content vs structure, with the Labels term
    // (Erik's re-identification of text blocks as an organizing tool).
    // Descriptors carry hard <br/> breaks — match on fragments.
    expect(container.textContent).toContain('add content')
    expect(screen.getByText('Nodes')).toBeTruthy()
    expect(container.textContent).toContain('structure and')
    expect(container.textContent).toContain('organize with')
    expect(screen.getByText('Labels & Lines')).toBeTruthy()
    // The desktop copy does NOT render on mobile.
    expect(screen.queryByText('You can also:')).toBeNull()
    expect(container.textContent).not.toContain('Get started')
  })

  it('mobile placement copy says LABEL for the text tool (FTUE-only term, Erik 2026-07-17)', () => {
    setMedia({ touch: true, mobilePortrait: true })
    useToolStore.setState({ activeTool: 'text' })
    render(<FtueIntro visible />)
    expect(
      screen.getByText('Now place the label wherever you like on the canvas'),
    ).toBeTruthy()
  })

  it('desktop placement copy still says text block (no product rename)', () => {
    useToolStore.setState({ activeTool: 'text' })
    render(<FtueIntro visible />)
    expect(
      screen.getByText('Now place the text block wherever you like on the canvas'),
    ).toBeTruthy()
  })

  it('does not throw when the toolbar targets are absent from the DOM', () => {
    expect(() => render(<FtueIntro visible />)).not.toThrow()
  })
})
