// Unit tests for the long-press context-menu trigger (iPhone QA Finding A).
// These exercise the timer / cancel / dedupe state machine with synthetic
// DOM events under fake timers. Real touch behavior (iOS Safari event
// ordering, Android's native contextmenu timing, gesture arbitration) is
// verified on-device against production, per the session's
// verification-honesty rule.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useLongPressContextMenu,
  LONG_PRESS_MS,
  MOVE_SLOP_PX,
  NATIVE_DEDUPE_MS,
} from './useLongPressContextMenu'

// jsdom has no PointerEvent constructor — build a MouseEvent and graft the
// pointer fields on. Listeners are document-level and events bubble, so
// dispatching on the target element is equivalent to a real pointer press.
function firePointer(type, target, { pointerId = 1, pointerType = 'touch', isPrimary = true, x = 0, y = 0 } = {}) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'pointerId', { value: pointerId })
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  Object.defineProperty(e, 'isPrimary', { value: isPrimary })
  target.dispatchEvent(e)
  return e
}

function fireTouchStart(target, touchCount) {
  const e = new Event('touchstart', { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'touches', { value: new Array(touchCount).fill({}) })
  target.dispatchEvent(e)
  return e
}

function fireContextMenu(target, { x = 0, y = 0 } = {}) {
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })
  target.dispatchEvent(e)
  return e
}

describe('useLongPressContextMenu', () => {
  let pane, nodeEl, editableEl, onLongPressPane, onLongPressNode, hook

  beforeEach(() => {
    vi.useFakeTimers()
    pane = document.createElement('div')
    pane.className = 'react-flow__pane'
    document.body.appendChild(pane)

    nodeEl = document.createElement('div')
    nodeEl.className = 'react-flow__node'
    nodeEl.setAttribute('data-id', 'node-42')
    document.body.appendChild(nodeEl)

    editableEl = document.createElement('div')
    editableEl.setAttribute('contenteditable', 'true')
    nodeEl.appendChild(editableEl)

    onLongPressPane = vi.fn()
    onLongPressNode = vi.fn()
    hook = renderHook(() => useLongPressContextMenu({ onLongPressPane, onLongPressNode }))
  })

  afterEach(() => {
    hook.unmount()
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('fires the pane callback after a stationary hold on empty canvas', () => {
    firePointer('pointerdown', pane, { x: 120, y: 240 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressPane).toHaveBeenCalledWith({ x: 120, y: 240 })
    expect(onLongPressNode).not.toHaveBeenCalled()
  })

  it('fires the node callback with the node id after a stationary hold on a node', () => {
    firePointer('pointerdown', nodeEl, { x: 50, y: 60 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressNode).toHaveBeenCalledWith('node-42', { x: 50, y: 60 })
    expect(onLongPressPane).not.toHaveBeenCalled()
  })

  it('does not fire when the finger lifts before the delay', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS - 100)
    firePointer('pointerup', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(200)
    expect(onLongPressPane).not.toHaveBeenCalled()
  })

  it('cancels when the finger moves past the slop threshold (a drag, not a hold)', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    firePointer('pointermove', pane, { x: 10 + MOVE_SLOP_PX + 5, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressPane).not.toHaveBeenCalled()
  })

  it('survives finger jitter within the slop threshold', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    firePointer('pointermove', pane, { x: 14, y: 12 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressPane).toHaveBeenCalledTimes(1)
  })

  it('cancels when a second finger lands (two-finger pan/zoom)', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    fireTouchStart(pane, 2)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressPane).not.toHaveBeenCalled()
  })

  it('ignores mouse pointers (desktop right-click already works)', () => {
    firePointer('pointerdown', pane, { pointerType: 'mouse', x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressPane).not.toHaveBeenCalled()
  })

  it('ignores presses inside contenteditable (text-block inline editing)', () => {
    firePointer('pointerdown', editableEl, { x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressNode).not.toHaveBeenCalled()
  })

  it('ignores presses on unrelated UI (neither pane nor node)', () => {
    firePointer('pointerdown', document.body, { x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressPane).not.toHaveBeenCalled()
    expect(onLongPressNode).not.toHaveBeenCalled()
  })

  it('stands down when a native contextmenu arrives first (Android wins the race)', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS - 50)
    const native = fireContextMenu(pane, { x: 10, y: 10 })
    // Native event must pass through untouched so React Flow's own handler opens the menu.
    expect(native.defaultPrevented).toBe(false)
    vi.advanceTimersByTime(200)
    expect(onLongPressPane).not.toHaveBeenCalled()
  })

  it('swallows a native contextmenu that arrives just after our timer fired (no double-open)', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLongPressPane).toHaveBeenCalledTimes(1)
    const native = fireContextMenu(pane, { x: 10, y: 10 })
    expect(native.defaultPrevented).toBe(true)
    // And the menu was not asked to open a second time.
    expect(onLongPressPane).toHaveBeenCalledTimes(1)
  })

  it('lets a native contextmenu through once the dedupe window has passed', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    firePointer('pointerup', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(NATIVE_DEDUPE_MS + 100)
    const native = fireContextMenu(pane, { x: 10, y: 10 })
    expect(native.defaultPrevented).toBe(false)
  })

  it('suppresses the click synthesized after a fired long-press (release must not close the menu)', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    firePointer('pointerup', pane, { x: 10, y: 10 })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    pane.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    // Only the one click — the next tap goes through normally.
    const click2 = new MouseEvent('click', { bubbles: true, cancelable: true })
    pane.dispatchEvent(click2)
    expect(click2.defaultPrevented).toBe(false)
  })

  it('does not suppress the click after a hold that never fired', () => {
    firePointer('pointerdown', pane, { x: 10, y: 10 })
    vi.advanceTimersByTime(100)
    firePointer('pointerup', pane, { x: 10, y: 10 })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    pane.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
  })
})
