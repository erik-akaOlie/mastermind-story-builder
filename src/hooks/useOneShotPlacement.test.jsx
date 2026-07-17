// ============================================================================
// useOneShotPlacement tests — pin down the Chunk 2 placement interaction:
//   - an armed Node/Text tool places on a canvas (.react-flow__pane) click,
//     converting screen → flow coords via the RF instance
//   - clicks on app chrome (anything outside the pane) are untouched
//   - right-button presses are untouched (right-click is NOT a cancel)
//   - spacebar suspension (pre-gesture) detaches placement so the click pans
//   - the one-shot latch prevents a double placement in the revert gap
//   - Esc cancels ANY armed creation tool back to Pointer (the only cancel)
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useOneShotPlacement } from './useOneShotPlacement'
import { useToolStore } from '../store/useToolStore'

function Harness({ rfInstanceRef, onPlaceNode, onPlaceText }) {
  useOneShotPlacement({ rfInstanceRef, onPlaceNode, onPlaceText })
  return null
}

// A stand-in canvas: the hook only cares about .react-flow__pane ancestry.
function makePane() {
  const pane = document.createElement('div')
  pane.className = 'react-flow__pane'
  document.body.appendChild(pane)
  return pane
}
function makeChrome() {
  const chrome = document.createElement('button')
  chrome.className = 'some-toolbar-button'
  document.body.appendChild(chrome)
  return chrome
}

const rfInstanceRef = {
  current: {
    screenToFlowPosition: ({ x, y }) => ({ x: x + 1000, y: y + 2000 }),
  },
}

let pane, chrome, onPlaceNode, onPlaceText

beforeEach(() => {
  useToolStore.setState({ activeTool: 'pointer', spacebarHeld: false, placementGestureActive: false })
  pane = makePane()
  chrome = makeChrome()
  onPlaceNode = vi.fn()
  onPlaceText = vi.fn()
})
afterEach(() => {
  cleanup()
  pane.remove()
  chrome.remove()
})

const renderHook = () =>
  render(<Harness rfInstanceRef={rfInstanceRef} onPlaceNode={onPlaceNode} onPlaceText={onPlaceText} />)

describe('useOneShotPlacement', () => {
  it('armed Node tool: a pane click places at the flow position', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    expect(onPlaceNode).toHaveBeenCalledWith({ x: 1010, y: 2020 })
    expect(onPlaceText).not.toHaveBeenCalled()
  })

  it('armed Text tool: a pane click places a text block', () => {
    useToolStore.setState({ activeTool: 'text' })
    renderHook()
    fireEvent.pointerDown(pane, { button: 0, clientX: 5, clientY: 6 })
    expect(onPlaceText).toHaveBeenCalledWith({ x: 1005, y: 2006 })
  })

  it('Pointer tool active: pane clicks are not intercepted', () => {
    renderHook()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    expect(onPlaceNode).not.toHaveBeenCalled()
    expect(onPlaceText).not.toHaveBeenCalled()
  })

  it('clicks on chrome (outside the pane) never place', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    fireEvent.pointerDown(chrome, { button: 0, clientX: 10, clientY: 20 })
    expect(onPlaceNode).not.toHaveBeenCalled()
  })

  it('right-button presses are untouched (right-click is not a cancel)', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    const notCancelled = fireEvent.pointerDown(pane, { button: 2, clientX: 10, clientY: 20 })
    expect(onPlaceNode).not.toHaveBeenCalled()
    expect(notCancelled).toBe(true)                         // no preventDefault
    expect(useToolStore.getState().activeTool).toBe('node') // still armed
  })

  it('spacebar suspension detaches placement (the click should pan)', () => {
    useToolStore.setState({ activeTool: 'node', spacebarHeld: true })
    renderHook()
    const notCancelled = fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    expect(onPlaceNode).not.toHaveBeenCalled()
    expect(notCancelled).toBe(true)
  })

  it('one-shot latch: a second pointerdown in the revert gap does not place twice', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 20 })
    fireEvent.pointerDown(pane, { button: 0, clientX: 30, clientY: 40 })
    expect(onPlaceNode).toHaveBeenCalledTimes(1)
  })

  it('Esc cancels any armed creation tool back to Pointer', () => {
    for (const tool of ['node', 'text', 'line']) {
      useToolStore.setState({ activeTool: tool })
      const { unmount } = renderHook()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(useToolStore.getState().activeTool).toBe('pointer')
      unmount()
    }
  })

  it('Esc stays live during spacebar suspension', () => {
    useToolStore.setState({ activeTool: 'text', spacebarHeld: true })
    renderHook()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useToolStore.getState().activeTool).toBe('pointer')
  })
})

// Chunk 3 touch adaptation: a finger places on LIFT, not press — moving past
// the slop or a second finger joining abandons the placement (tool stays
// armed) so pan/zoom while armed never drops an accidental node.
describe('useOneShotPlacement — touch (place on lift)', () => {
  const touch = (extra) => ({ button: 0, pointerType: 'touch', pointerId: 1, ...extra })

  it('a touch press alone does not place and is NOT swallowed (RF gestures stay live)', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    const notCancelled = fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    expect(notCancelled).toBe(true)   // no preventDefault
    expect(onPlaceNode).not.toHaveBeenCalled()
  })

  it('a stationary tap places at the lift point', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerUp(pane, touch({ clientX: 12, clientY: 21 }))  // < slop
    expect(onPlaceNode).toHaveBeenCalledWith({ x: 1012, y: 2021 })
  })

  it('a drag past the slop abandons the placement; the tool stays armed', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerMove(document, touch({ clientX: 40, clientY: 20 }))  // > 10px
    fireEvent.pointerUp(pane, touch({ clientX: 40, clientY: 20 }))
    expect(onPlaceNode).not.toHaveBeenCalled()
    expect(useToolStore.getState().activeTool).toBe('node')
  })

  it('a second finger abandons the placement (pan/zoom intent); the tool stays armed', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerDown(pane, touch({ pointerId: 2, clientX: 60, clientY: 80 }))
    fireEvent.pointerUp(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerUp(pane, touch({ pointerId: 2, clientX: 60, clientY: 80 }))
    expect(onPlaceNode).not.toHaveBeenCalled()
    expect(useToolStore.getState().activeTool).toBe('node')
  })

  it('pointercancel clears the pending tap without placing', () => {
    useToolStore.setState({ activeTool: 'text' })
    renderHook()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerCancel(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerUp(pane, touch({ clientX: 10, clientY: 20 }))
    expect(onPlaceText).not.toHaveBeenCalled()
    expect(useToolStore.getState().activeTool).toBe('text')
  })

  it('after an abandoned tap, the next clean tap still places (one-shot not burned)', () => {
    useToolStore.setState({ activeTool: 'node' })
    renderHook()
    fireEvent.pointerDown(pane, touch({ clientX: 10, clientY: 20 }))
    fireEvent.pointerMove(document, touch({ clientX: 40, clientY: 20 }))
    fireEvent.pointerUp(pane, touch({ clientX: 40, clientY: 20 }))
    fireEvent.pointerDown(pane, touch({ clientX: 30, clientY: 30 }))
    fireEvent.pointerUp(pane, touch({ clientX: 30, clientY: 30 }))
    expect(onPlaceNode).toHaveBeenCalledTimes(1)
    expect(onPlaceNode).toHaveBeenCalledWith({ x: 1030, y: 2030 })
  })
})
