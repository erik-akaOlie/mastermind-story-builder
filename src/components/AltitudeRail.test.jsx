// ============================================================================
// AltitudeRail tests — pin down the mobile-portrait touch model (2026-07-16)
// and the desktop hover behavior it must not disturb:
//   - mobile: tap the touch strip OPENS the tool deterministically (no
//     hover/fake-hover involved) and the opening tap does NOT jump zoom
//   - mobile closed state: the old 64px container no longer intercepts
//     (pointer-events none) — only the narrow strip does (the dead-column
//     regression guard)
//   - mobile: fake tap-hover (synthetic mouseenter) can NOT open the rail
//   - mobile: tap outside closes WITHOUT swallowing the outside tap
//   - mobile open state: strip tap = jump zoom; scrim widens deliberately
//   - desktop: hover in/out expands/collapses exactly as before
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AltitudeRail from './AltitudeRail'
import { useCanvasUiStore } from '../store/useCanvasUiStore'

const MOBILE_QUERY =
  '(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)'

let originalMatchMedia
function setMobilePortrait(matches) {
  window.matchMedia = (query) => ({
    matches: query === MOBILE_QUERY ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

beforeEach(() => {
  originalMatchMedia = window.matchMedia
  useCanvasUiStore.setState({
    currentZoom: 1,
    dynamicMinZoom: 0.5,
    thresholdGridGapMm: 2.65,
    altitude: 'cardView',
  })
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

// render() wraps the component's fragment: children[0] = backdrop scrim,
// children[1] = the rail container (holds icons/track/strip/thumb).
const scrimOf = (container) => container.children[0]
const railOf = (container) => container.children[1]
const thumb = () => screen.getByRole('slider')

describe('AltitudeRail — mobile portrait (explicit touch model)', () => {
  beforeEach(() => setMobilePortrait(true))

  it('closed by default: thumb hidden, container NOT intercepting, only the 24px strip is', () => {
    const { container } = render(<AltitudeRail onZoomTo={() => {}} />)
    expect(thumb().style.opacity).toBe('0')
    // The dead-column regression guard: the 64px container passes taps through
    expect(railOf(container).style.pointerEvents).toBe('none')
    const strip = screen.getByRole('button', { name: /open zoom tool/i })
    expect(strip.style.width).toBe('24px')
    expect(strip.style.pointerEvents).toBe('auto')
    // Narrow closed gradient
    expect(scrimOf(container).style.width).toBe('40px')
  })

  it('closed visuals match the Figma mockup: hairline rail + centered notch (265-226)', () => {
    const { container } = render(<AltitudeRail onZoomTo={() => {}} />)
    // Hairline rail (2px, vs desktop rest 4px)
    const track = screen.getByLabelText(/click to jump zoom/i)
    expect(track.style.width).toBe('2px')
    // Indicator notch: 8px bar CENTERED on the SVG center (= rail center),
    // not trailing right from it
    const bar = container.querySelector('svg line')
    expect(bar.getAttribute('x1')).toBe('16')  // 40/2 − 4
    expect(bar.getAttribute('x2')).toBe('24')  // 40/2 + 4
    // Arrowhead tip pulled in to 8px right of the rail center
    const chevrons = container.querySelectorAll('svg polyline')
    const rightChev = chevrons[chevrons.length - 1]
    expect(rightChev.getAttribute('points').split(' ')[1]).toBe('28,8')  // tip = 20+8, midY 8
  })

  it('tapping the strip opens the tool and does NOT jump zoom', () => {
    const onZoomTo = vi.fn()
    const { container } = render(<AltitudeRail onZoomTo={onZoomTo} />)
    fireEvent.click(screen.getByRole('button', { name: /open zoom tool/i }))
    expect(thumb().style.opacity).toBe('1')
    expect(onZoomTo).not.toHaveBeenCalled()
    // Open-state widths: strip grows over the active track, scrim widens
    expect(screen.getByRole('button', { name: /tap to jump zoom/i }).style.width).toBe('48px')
    expect(scrimOf(container).style.width).toBe('96px')
  })

  it('fake tap-hover (synthetic mouseenter) can NOT open the rail', () => {
    const { container } = render(<AltitudeRail onZoomTo={() => {}} />)
    fireEvent.mouseEnter(railOf(container))
    fireEvent.mouseOver(railOf(container))
    expect(thumb().style.opacity).toBe('0')
  })

  it('while open, a strip tap jumps zoom (the desktop track-click)', () => {
    const origRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      return { top: 0, left: 0, right: 24, bottom: 400, width: 24, height: 400 }
    }
    const onZoomTo = vi.fn()
    render(<AltitudeRail onZoomTo={onZoomTo} />)
    fireEvent.click(screen.getByRole('button', { name: /open zoom tool/i }))
    fireEvent.click(screen.getByRole('button', { name: /tap to jump zoom/i }), { clientY: 200 })
    expect(onZoomTo).toHaveBeenCalledTimes(1)
    expect(Number.isFinite(onZoomTo.mock.calls[0][0])).toBe(true)
    Element.prototype.getBoundingClientRect = origRect
  })

  it('tap outside closes the rail WITHOUT swallowing the outside tap', () => {
    render(<AltitudeRail onZoomTo={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /open zoom tool/i }))
    expect(thumb().style.opacity).toBe('1')
    // A pointerdown inside the rail (the strip) does NOT close it
    fireEvent.pointerDown(screen.getByRole('button', { name: /tap to jump zoom/i }))
    expect(thumb().style.opacity).toBe('1')
    // Outside pointerdown closes — and is not preventDefault-ed (canvas
    // interaction underneath proceeds normally)
    const notCancelled = fireEvent.pointerDown(document.body)
    expect(notCancelled).toBe(true)
    expect(thumb().style.opacity).toBe('0')
  })
})

describe('AltitudeRail — desktop (hover model unchanged)', () => {
  beforeEach(() => setMobilePortrait(false))

  it('container intercepts (hover discoverability) and there is no touch strip', () => {
    const { container } = render(<AltitudeRail onZoomTo={() => {}} />)
    expect(railOf(container).style.pointerEvents).toBe('auto')
    expect(screen.queryByRole('button', { name: /open zoom tool/i })).toBeNull()
    expect(scrimOf(container).style.width).toBe('96px')  // desktop rest width
  })

  it('mouse enter expands (thumb visible, scrim widens); mouse leave collapses', () => {
    const { container } = render(<AltitudeRail onZoomTo={() => {}} />)
    expect(thumb().style.opacity).toBe('0')
    fireEvent.mouseEnter(railOf(container))
    expect(thumb().style.opacity).toBe('1')
    expect(scrimOf(container).style.width).toBe('160px')
    fireEvent.mouseLeave(railOf(container))
    expect(thumb().style.opacity).toBe('0')
    expect(scrimOf(container).style.width).toBe('96px')
  })
})
