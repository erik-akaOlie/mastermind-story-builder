// ============================================================================
// LinePlacementOverlay tests — pin down the Chunk 2 line gesture:
//   - click-move-click on the canvas completes with FLOW coords for A and B
//   - anchor A raises placementGestureActive; complete/unmount clears it
//   - pre-anchor: right-click passes through (normal menus), chrome clicks
//     pass through (toolbar stays live), so the tool can be switched
//   - mid-gesture: right-click is swallowed (no menu, no cancel) and chrome
//     clicks neither complete nor kill the half-drawn line
//   - drag-draw (press, drag ≥ 8px, lift on canvas) completes at the lift
// Edge-pan (RAF camera drift at the window edge) is exercised in Erik's
// hands-on QA — jsdom has no real layout/frame loop worth asserting against.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import LinePlacementOverlay from './LinePlacementOverlay'
import { useToolStore } from '../store/useToolStore'

// Flow space = screen space × 2 — asymmetric enough to prove conversion.
const rfInstanceRef = {
  current: {
    screenToFlowPosition: ({ x, y }) => ({ x: x * 2, y: y * 2 }),
    flowToScreenPosition: ({ x, y }) => ({ x: x / 2, y: y / 2 }),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport: vi.fn(),
  },
}

let pane, chrome, onComplete

beforeEach(() => {
  useToolStore.setState({ activeTool: 'line', spacebarHeld: false, placementGestureActive: false })
  pane = document.createElement('div')
  pane.className = 'react-flow__pane'
  document.body.appendChild(pane)
  chrome = document.createElement('button')
  document.body.appendChild(chrome)
  onComplete = vi.fn()
})
afterEach(() => {
  cleanup()
  pane.remove()
  chrome.remove()
})

const renderOverlay = () =>
  render(<LinePlacementOverlay rfInstanceRef={rfInstanceRef} onComplete={onComplete} />)

const gestureActive = () => useToolStore.getState().placementGestureActive

describe('LinePlacementOverlay', () => {
  it('click-move-click completes with flow coords for both anchors', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    expect(gestureActive()).toBe(true)
    fireEvent.pointerMove(document, { clientX: 50, clientY: 60 })
    fireEvent.pointerDown(pane, { button: 0, clientX: 50, clientY: 60 })
    expect(onComplete).toHaveBeenCalledWith({ ax: 20, ay: 40, bx: 100, by: 120 })
  })

  it('drag-draw: press, drag ≥ 8px, lift on the canvas completes at the lift', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    fireEvent.pointerMove(document, { clientX: 40, clientY: 20 })
    fireEvent.pointerUp(pane, { button: 0, clientX: 40, clientY: 20 })
    expect(onComplete).toHaveBeenCalledWith({ ax: 20, ay: 40, bx: 80, by: 40 })
  })

  it('a stationary tap stays armed awaiting the second click (no zero-length line)', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    fireEvent.pointerUp(pane, { button: 0, clientX: 12, clientY: 21 })  // < 8px
    expect(onComplete).not.toHaveBeenCalled()
    expect(gestureActive()).toBe(true)
  })

  it('pre-anchor: right-click passes through untouched (normal context menus)', () => {
    renderOverlay()
    const notCancelled = fireEvent.contextMenu(pane, { clientX: 10, clientY: 20 })
    expect(notCancelled).toBe(true)   // no preventDefault → RF menu path runs
    expect(gestureActive()).toBe(false)
  })

  it('mid-gesture: right-click is swallowed — no cancel, gesture survives', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    const notCancelled = fireEvent.contextMenu(pane, { clientX: 30, clientY: 40 })
    expect(notCancelled).toBe(false)  // preventDefault → no menu
    expect(gestureActive()).toBe(true)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('pre-anchor: clicks on chrome pass through (toolbar stays live)', () => {
    renderOverlay()
    const notCancelled = fireEvent.pointerDown(chrome, { button: 0, clientX: 5, clientY: 5 })
    expect(notCancelled).toBe(true)
    expect(gestureActive()).toBe(false)
  })

  it('mid-gesture: clicks on chrome are ignored — the half-line survives', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    const notCancelled = fireEvent.pointerDown(chrome, { button: 0, clientX: 5, clientY: 5 })
    expect(notCancelled).toBe(false)  // swallowed
    expect(onComplete).not.toHaveBeenCalled()
    expect(gestureActive()).toBe(true)
  })

  it('preview re-projects anchor A when the camera moves (flow-space preview)', () => {
    // Simulate a camera pan by shifting what flowToScreenPosition returns —
    // the anchor dot must follow the canvas, not stay pinned to the screen.
    let panX = 0
    rfInstanceRef.current.flowToScreenPosition = ({ x, y }) => ({ x: x / 2 - panX, y: y / 2 })
    const { container } = renderOverlay()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    fireEvent.pointerMove(document, { clientX: 50, clientY: 60 })
    expect(container.querySelector('circle').getAttribute('cx')).toBe('10')
    panX = 100                                               // camera slides 100px
    fireEvent.pointerMove(document, { clientX: 51, clientY: 60 })  // any re-render
    expect(container.querySelector('circle').getAttribute('cx')).toBe('-90')
    rfInstanceRef.current.flowToScreenPosition = ({ x, y }) => ({ x: x / 2, y: y / 2 })
  })

  it('unmount clears placementGestureActive (Esc-cancel path)', () => {
    const { unmount } = renderOverlay()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    expect(gestureActive()).toBe(true)
    unmount()
    expect(gestureActive()).toBe(false)
  })
})
