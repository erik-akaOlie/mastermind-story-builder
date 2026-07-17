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

// Chunk 3 touch additions: second-finger cancel while drag-drawing, the
// mobile Line-button cancel pass-through, and pointercancel fallback.
describe('LinePlacementOverlay — touch (Chunk 3)', () => {
  const touch = (extra) => ({ button: 0, pointerType: 'touch', pointerId: 1, ...extra })

  it('a second finger while drag-drawing discards the gesture (pan intent, tool stays armed)', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    expect(gestureActive()).toBe(true)
    const notCancelled = fireEvent.pointerDown(pane, touch({ pointerId: 2, clientX: 60, clientY: 80 }))
    expect(notCancelled).toBe(false)  // swallowed — finger 2 never anchors B
    expect(gestureActive()).toBe(false)
    expect(onComplete).not.toHaveBeenCalled()
    // Lifting the fingers afterwards neither places nor crashes
    fireEvent.pointerUp(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerUp(pane, touch({ pointerId: 2, clientX: 60, clientY: 80 }))
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('sequential taps (tap A, lift, tap B — different pointerIds) complete normally', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerUp(pane, touch({ clientX: 11, clientY: 20 }))  // stationary → stay armed
    expect(gestureActive()).toBe(true)
    fireEvent.pointerDown(pane, touch({ pointerId: 2, clientX: 50, clientY: 60 }))
    expect(onComplete).toHaveBeenCalledWith({ ax: 20, ay: 40, bx: 100, by: 120 })
  })

  it('mid-gesture, a press on the armed Line button (data-placement-cancel) passes through', () => {
    const cancelBtn = document.createElement('button')
    cancelBtn.setAttribute('data-placement-cancel', '')
    document.body.appendChild(cancelBtn)
    renderOverlay()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerUp(pane, touch({ clientX: 10, clientY: 20 }))  // stationary tap → armed
    const notCancelled = fireEvent.pointerDown(cancelBtn, touch({ pointerId: 2, clientX: 5, clientY: 5 }))
    expect(notCancelled).toBe(true)   // NOT swallowed → its click can disarm the tool
    expect(onComplete).not.toHaveBeenCalled()
    cancelBtn.remove()
  })

  it('pointercancel of the drawing finger falls back to click-move-click (no stuck gesture)', () => {
    renderOverlay()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerCancel(pane, touch({ clientX: 10, clientY: 20 }))
    expect(gestureActive()).toBe(true)  // anchor A survives
    // A later tap completes at that tap, exactly like click-move-click
    fireEvent.pointerDown(pane, touch({ pointerId: 2, clientX: 50, clientY: 60 }))
    expect(onComplete).toHaveBeenCalledWith({ ax: 20, ay: 40, bx: 100, by: 120 })
  })

  // QA-1 regression (2026-07-16): RF's drag plumbing is d3-based and listens
  // to TOUCHSTART — swallowing only pointer events let a touch-draw whose
  // anchor A landed on an existing line GRAB that line and drag it along.
  it('REGRESSION: canvas-targeted touchstart never reaches element drag handlers while armed', () => {
    renderOverlay()
    // A stand-in for an existing line's hit-stroke: a pane child with a
    // touchstart listener, exactly where RF's node-drag would listen.
    const lineHit = document.createElement('div')
    pane.appendChild(lineHit)
    let dragStarted = 0
    lineHit.addEventListener('touchstart', () => { dragStarted += 1 })

    // Pre-anchor press over the existing line (touch fires BOTH events)
    fireEvent.pointerDown(lineHit, touch({ clientX: 10, clientY: 20 }))
    fireEvent.touchStart(lineHit)
    expect(dragStarted).toBe(0)      // swallowed — the line is never grabbed
    expect(gestureActive()).toBe(true)

    // Mid-gesture touches over canvas elements are equally owned
    fireEvent.touchStart(lineHit)
    expect(dragStarted).toBe(0)
    lineHit.remove()
  })

  it('touchstart on chrome passes through pre-anchor; the cancel button passes mid-gesture', () => {
    const cancelBtn = document.createElement('button')
    cancelBtn.setAttribute('data-placement-cancel', '')
    document.body.appendChild(cancelBtn)
    renderOverlay()
    let chromeTouches = 0
    chrome.addEventListener('touchstart', () => { chromeTouches += 1 })
    let cancelTouches = 0
    cancelBtn.addEventListener('touchstart', () => { cancelTouches += 1 })

    // Pre-anchor: chrome touches are untouched (toolbar stays live)
    fireEvent.touchStart(chrome)
    expect(chromeTouches).toBe(1)

    // Mid-gesture: chrome is owned by the gesture, EXCEPT the cancel button
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.touchStart(chrome)
    expect(chromeTouches).toBe(1)    // swallowed
    fireEvent.touchStart(cancelBtn)
    expect(cancelTouches).toBe(1)    // passes — its tap must be able to cancel
    cancelBtn.remove()
  })
})
