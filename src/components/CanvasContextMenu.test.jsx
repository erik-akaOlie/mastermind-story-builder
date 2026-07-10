// ============================================================================
// CanvasContextMenu tests — MB-3 (Canvas Tool Menu tap support)
// ----------------------------------------------------------------------------
// Pins down the two input models:
//   Desktop (hover-capable): click "Add node" quick-adds the first type;
//     hovering it opens the side-panel type submenu.
//   Touch-primary: tapping "Add node" expands the type list INLINE instead
//     of silently quick-adding; synthetic hover events from taps must NOT
//     open the desktop side panel.
// (Relabeled "Add card" to "Add node" + equal-rows grouping, 2026-07-10.)
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CanvasContextMenu from './CanvasContextMenu'

vi.mock('../store/useTypeStore', () => ({
  useNodeTypes: () => ({
    character: { label: 'Character', color: '#ef4444', icon: null },
    location:  { label: 'Location',  color: '#3b82f6', icon: null },
    item:      { label: 'Item',      color: '#f59e0b', icon: null },
  }),
}))

// useTouchPrimary asks matchMedia('(hover: none) and (pointer: coarse)').
// Override matchMedia per suite; restore after so other suites are unaffected.
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

beforeEach(() => { originalMatchMedia = window.matchMedia })
afterEach(() => { window.matchMedia = originalMatchMedia })

function renderMenu() {
  const props = {
    x: 100,
    y: 100,
    onAddCard: vi.fn(),
    onAddText: vi.fn(),
    onAddLine: vi.fn(),
    onClose: vi.fn(),
  }
  render(<CanvasContextMenu {...props} />)
  return props
}

const addNodeButton = () => screen.getByRole('button', { name: /add node/i })

describe('CanvasContextMenu — desktop (hover-capable)', () => {
  beforeEach(() => mockMatchMedia(() => false))

  it('click on "Add node" quick-adds the first type and closes', () => {
    const props = renderMenu()
    fireEvent.click(addNodeButton())
    expect(props.onAddCard).toHaveBeenCalledWith('character')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not show the type list before hover', () => {
    renderMenu()
    expect(screen.queryByText('Character')).not.toBeInTheDocument()
  })

  it('hover opens the type submenu; clicking a type adds it', () => {
    const props = renderMenu()
    fireEvent.mouseEnter(addNodeButton().parentElement)
    expect(screen.getByText('Location')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Location'))
    expect(props.onAddCard).toHaveBeenCalledWith('location')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('menu container does not scroll-clip (the hover submenu must render outside it)', () => {
    // Regression (2026-07-08): MB-3's overflowY:auto guard on the container
    // forced overflow-x out of `visible` too, clipping the absolutely-
    // positioned hover submenu and showing both scrollbars on desktop.
    // The guard must be touch-only.
    renderMenu()
    const menuEl = addNodeButton().closest('div.fixed')
    expect(menuEl.style.overflowY).toBe('')
    expect(menuEl.style.maxHeight).toBe('')
  })

  it('"Add line" fires onAddLine and closes', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /add line/i }))
    expect(props.onAddLine).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('the three creation rows are equal peers — no divider between them (Erik 2026-07-10)', () => {
    renderMenu()
    const menuEl = addNodeButton().closest('div.fixed')
    expect(menuEl.querySelector('.border-t')).toBeNull()
  })
})

describe('CanvasContextMenu — touch-primary (MB-3)', () => {
  beforeEach(() => mockMatchMedia((q) => q.includes('hover: none')))

  it('tap on "Add node" expands the inline type list instead of quick-adding', () => {
    const props = renderMenu()
    fireEvent.click(addNodeButton())
    expect(props.onAddCard).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Character')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Item')).toBeInTheDocument()
  })

  it('tapping a type in the expanded list adds that type and closes', () => {
    const props = renderMenu()
    fireEvent.click(addNodeButton())
    fireEvent.click(screen.getByText('Item'))
    expect(props.onAddCard).toHaveBeenCalledWith('item')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('second tap on "Add node" collapses the list again', () => {
    renderMenu()
    fireEvent.click(addNodeButton())
    expect(screen.getByText('Character')).toBeInTheDocument()
    fireEvent.click(addNodeButton())
    expect(screen.queryByText('Character')).not.toBeInTheDocument()
  })

  it('synthetic hover (fired by taps on touch) does not open the side panel', () => {
    renderMenu()
    fireEvent.mouseEnter(addNodeButton().parentElement)
    expect(screen.queryByText('Character')).not.toBeInTheDocument()
  })

  it('menu container keeps the scroll guard (long inline type lists must scroll, not clip)', () => {
    renderMenu()
    const menuEl = addNodeButton().closest('div.fixed')
    expect(menuEl.style.overflowY).toBe('auto')
    expect(menuEl.style.maxHeight).not.toBe('')
  })

  it('"Add text" still works with a single tap', () => {
    const props = renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /add text/i }))
    expect(props.onAddText).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
