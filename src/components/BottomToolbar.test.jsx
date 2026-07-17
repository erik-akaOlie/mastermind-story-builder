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
//   - touch-primary WITHOUT phone-portrait renders nothing (tablets /
//     landscape — out of scope for the Chunk 3 first cut)
//   - phone portrait (Chunk 3): always-expanded creation-only tray (Node ·
//     Text Block · Line), tap arms / tap-again disarms, armed Line button
//     carries data-placement-cancel (the mobile Esc stand-in)
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import BottomToolbar from './BottomToolbar'
import { useToolStore, effectiveTool } from '../store/useToolStore'
import { useUndoStore } from '../store/useUndoStore'

// useTouchPrimary asks matchMedia('(hover: none) and (pointer: coarse)');
// useMobilePortrait asks the combined phone-portrait query. Same per-suite
// override pattern as CanvasContextMenu.test.jsx.
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'
const MOBILE_QUERY =
  '(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)'

let originalMatchMedia
function setMedia({ touch = false, mobilePortrait = false }) {
  window.matchMedia = (query) => ({
    matches:
      query === MOBILE_QUERY ? mobilePortrait :
      query === TOUCH_QUERY ? touch :
      false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}
function setTouchPrimary(matches) {
  setMedia({ touch: matches })
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

  it('renders nothing on touch-primary devices that are NOT phone portrait (tablets / landscape)', () => {
    setTouchPrimary(true)
    const { container } = render(<BottomToolbar />)
    expect(container.firstChild).toBeNull()
  })
})

describe('BottomToolbar — phone portrait (Chunk 3)', () => {
  beforeEach(() => {
    setMedia({ touch: true, mobilePortrait: true })
    useUndoStore.setState({ past: [], future: [] })
  })

  it('renders the always-expanded tray: Node · Text Block · Line · divider · Undo · Redo', () => {
    const { container } = render(<BottomToolbar />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
    expect(screen.getByRole('button', { name: /add node/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /add text block/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /add line/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^undo$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^redo$/i })).toBeTruthy()
    // No Pointer / Hand on phones (MB-1 touch model needs no visible mode)
    expect(screen.queryByRole('button', { name: /pointer/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /hand/i })).toBeNull()
    // Always visible — no hover needed, tray box present at its full width
    // (QA-2 FINAL geometry, Erik on-device: 40px buttons FLUSH, gaps only
    // around the divider, 8px pad → 233 total; fits a 320px SE)
    expect(container.firstChild.style.width).toBe('233px')
  })

  it('Undo/Redo are disabled on a fresh workspace (nothing to undo or redo)', () => {
    render(<BottomToolbar />)
    expect(screen.getByRole('button', { name: /^undo$/i }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /^redo$/i }).disabled).toBe(true)
  })

  it('an edit enables Undo; an undo enables Redo (store-driven, no separate history)', () => {
    const onUndo = () => {}
    const onRedo = () => {}
    render(<BottomToolbar onUndo={onUndo} onRedo={onRedo} />)
    act(() => useUndoStore.setState({ past: [{ type: 'moveCard' }], future: [] }))
    expect(screen.getByRole('button', { name: /^undo$/i }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /^redo$/i }).disabled).toBe(true)
    act(() => useUndoStore.setState({ past: [], future: [{ type: 'moveCard' }] }))
    expect(screen.getByRole('button', { name: /^undo$/i }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /^redo$/i }).disabled).toBe(false)
  })

  it('tapping enabled Undo/Redo fires the App-supplied callbacks', () => {
    let undos = 0, redos = 0
    render(<BottomToolbar onUndo={() => { undos += 1 }} onRedo={() => { redos += 1 }} />)
    act(() => useUndoStore.setState({ past: [{ type: 'moveCard' }], future: [{ type: 'moveCard' }] }))
    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^redo$/i }))
    expect(undos).toBe(1)
    expect(redos).toBe(1)
  })

  it('tap arms a tool; tapping the armed tool again disarms (mobile Esc stand-in)', () => {
    render(<BottomToolbar />)
    const nodeBtn = screen.getByRole('button', { name: /add node/i })
    fireEvent.click(nodeBtn)
    expect(useToolStore.getState().activeTool).toBe('node')
    expect(nodeBtn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(nodeBtn)
    expect(useToolStore.getState().activeTool).toBe('pointer')
    expect(nodeBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('switching directly between creation tools works without disarming first', () => {
    render(<BottomToolbar />)
    fireEvent.click(screen.getByRole('button', { name: /add node/i }))
    fireEvent.click(screen.getByRole('button', { name: /add line/i }))
    expect(useToolStore.getState().activeTool).toBe('line')
  })

  it('ONLY the armed Line button carries data-placement-cancel', () => {
    render(<BottomToolbar />)
    const lineBtn = screen.getByRole('button', { name: /add line/i })
    const nodeBtn = screen.getByRole('button', { name: /add node/i })
    expect(lineBtn.hasAttribute('data-placement-cancel')).toBe(false)
    fireEvent.click(lineBtn)
    expect(lineBtn.hasAttribute('data-placement-cancel')).toBe(true)
    expect(nodeBtn.hasAttribute('data-placement-cancel')).toBe(false)
    fireEvent.click(lineBtn)  // disarm
    expect(lineBtn.hasAttribute('data-placement-cancel')).toBe(false)
  })
})
