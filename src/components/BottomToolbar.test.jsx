// ============================================================================
// BottomToolbar tests — pin down the toolbar behaviors:
//   - collapsed by default (64×52 tab), expands to 464×112 when the mouse
//     enters the hotspot (document-level mousemove hit-test)
//   - a drag passing through the hotspot (primary button held) does NOT
//     pop the tray open
//   - clicking Hand / Pointer switches the active tool in useToolStore
//   - spacebarHeld flips the DISPLAYED tool (temporary switch) without
//     touching activeTool, and effectiveTool() encodes the full rule —
//     including the Chunk 2 mid-gesture clause (placementGestureActive
//     makes the spacebar a no-op so a half-drawn line is never disturbed)
//   - creation tools ARM on click (Chunk 2 — placement itself lives in
//     useOneShotPlacement / LinePlacementOverlay)
//   - touch-primary renders nothing (mobile variant is Chunk 3)
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import BottomToolbar from './BottomToolbar'
import { useToolStore, effectiveTool } from '../store/useToolStore'

// useTouchPrimary asks matchMedia('(hover: none) and (pointer: coarse)').
// Same per-suite override pattern as CanvasContextMenu.test.jsx.
let originalMatchMedia
function setTouchPrimary(matches) {
  window.matchMedia = (query) => ({
    matches: query === '(hover: none) and (pointer: coarse)' ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

// jsdom reports a zero rect for every element, so the hotspot rect is the
// single point (0,0): a mousemove AT (0,0) is "inside", anywhere else is
// "outside". Good enough to drive the expand/collapse state machine.
const moveInside  = (buttons = 0) =>
  act(() => { fireEvent.mouseMove(document, { clientX: 0, clientY: 0, buttons }) })
const moveOutside = () =>
  act(() => { fireEvent.mouseMove(document, { clientX: 500, clientY: 500 }) })

const tray = (container) => container.firstChild.querySelector('.overflow-hidden')

beforeEach(() => {
  originalMatchMedia = window.matchMedia
  setTouchPrimary(false)
  useToolStore.setState({ activeTool: 'pointer', spacebarHeld: false, placementGestureActive: false })
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

describe('effectiveTool derivation', () => {
  it('returns the active tool when spacebar is up', () => {
    for (const t of ['pointer', 'hand', 'node', 'text', 'line']) {
      expect(effectiveTool(t, false)).toBe(t)
    }
  })
  it('spacebar flips every non-Hand tool to Hand', () => {
    for (const t of ['pointer', 'node', 'text', 'line']) {
      expect(effectiveTool(t, true)).toBe('hand')
    }
  })
  it('spacebar flips Hand to Pointer', () => {
    expect(effectiveTool('hand', true)).toBe('pointer')
  })
  it('a mid-flight placement gesture makes the spacebar a no-op', () => {
    for (const t of ['pointer', 'hand', 'node', 'text', 'line']) {
      expect(effectiveTool(t, true, true)).toBe(t)
    }
  })
})

describe('BottomToolbar', () => {
  it('renders the collapsed 48×44 tab by default', () => {
    const { container } = render(<BottomToolbar />)
    expect(tray(container).style.width).toBe('48px')
    expect(tray(container).style.height).toBe('44px')
  })

  it('expands to 288×72 when the mouse enters the hotspot, collapses on exit', () => {
    const { container } = render(<BottomToolbar />)
    moveInside()
    expect(tray(container).style.width).toBe('288px')
    expect(tray(container).style.height).toBe('72px')
    expect(screen.getAllByRole('button')).toHaveLength(5)
    moveOutside()
    expect(tray(container).style.width).toBe('48px')
  })

  it('does not pop open when a drag (primary button held) crosses the hotspot', () => {
    const { container } = render(<BottomToolbar />)
    moveInside(1)
    expect(tray(container).style.width).toBe('48px')
  })

  it('chip animates during the morph but SNAPS on tool selection (no slide)', () => {
    const { container } = render(<BottomToolbar />)
    const chip = () => container.querySelector('span[aria-hidden]')
    moveInside()
    // Render where `expanded` flipped → morph transition active
    expect(chip().className).toContain('transition-all')
    // Tool switch while expanded → chip moves instantly, no transition
    fireEvent.click(screen.getByRole('button', { name: /hand/i }))
    expect(chip().className).not.toContain('transition-all')
    expect(chip().style.left).toBe('64px')
  })

  it('clicking Hand selects the hand tool; clicking Pointer selects it back', () => {
    render(<BottomToolbar />)
    moveInside()
    fireEvent.click(screen.getByRole('button', { name: /hand/i }))
    expect(useToolStore.getState().activeTool).toBe('hand')
    fireEvent.click(screen.getByRole('button', { name: /pointer/i }))
    expect(useToolStore.getState().activeTool).toBe('pointer')
  })

  it('spacebarHeld shows Hand as the effective tool without changing activeTool', () => {
    render(<BottomToolbar />)
    moveInside()
    act(() => useToolStore.setState({ spacebarHeld: true }))
    expect(screen.getByRole('button', { name: /hand/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /pointer/i }).getAttribute('aria-pressed')).toBe('false')
    expect(useToolStore.getState().activeTool).toBe('pointer')
  })

  it('clicking a creation tool arms it (Chunk 2)', () => {
    render(<BottomToolbar />)
    moveInside()
    fireEvent.click(screen.getByRole('button', { name: /add node/i }))
    expect(useToolStore.getState().activeTool).toBe('node')
    fireEvent.click(screen.getByRole('button', { name: /add text block/i }))
    expect(useToolStore.getState().activeTool).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: /add line/i }))
    expect(useToolStore.getState().activeTool).toBe('line')
    // Clicking Pointer disarms — the tray is always clickable while armed.
    fireEvent.click(screen.getByRole('button', { name: /pointer/i }))
    expect(useToolStore.getState().activeTool).toBe('pointer')
  })

  it('chip does NOT flip to Hand on spacebar while a gesture is mid-flight', () => {
    render(<BottomToolbar />)
    moveInside()
    act(() => useToolStore.setState({ activeTool: 'line', spacebarHeld: true, placementGestureActive: true }))
    expect(screen.getByRole('button', { name: /add line/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /hand/i }).getAttribute('aria-pressed')).toBe('false')
  })

  it('recenters in the display area while the Inspector is docked', () => {
    const { container, rerender } = render(<BottomToolbar />)
    expect(container.firstChild.style.left).toBe('50%')
    rerender(<BottomToolbar inspectorDocked />)
    // (inspector band 496 − rail band 64) / 2 = 216px left of window center
    expect(container.firstChild.style.left).toBe('calc(50% - 216px)')
    rerender(<BottomToolbar />)
    expect(container.firstChild.style.left).toBe('50%')
  })

  it('renders nothing on touch-primary devices (mobile variant is Chunk 3)', () => {
    setTouchPrimary(true)
    const { container } = render(<BottomToolbar />)
    expect(container.firstChild).toBeNull()
  })
})
