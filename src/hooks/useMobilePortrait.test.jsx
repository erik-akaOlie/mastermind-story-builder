// ============================================================================
// useMobilePortrait tests — pin down the conservative mobile detection
// (toolbar Chunk 3): true ONLY when the combined phone-portrait media query
// matches (touch-primary AND portrait AND ≤640px); tracks rotation/resize
// via the change event. jsdom has no real media engine, so the mock answers
// the exact query string — which also pins the query itself against
// accidental edits.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useMobilePortrait } from './useMobilePortrait'

const QUERY =
  '(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)'

let latest
function Harness() {
  latest = useMobilePortrait()
  return null
}

let originalMatchMedia
let listeners

function mockMatchMedia(matches) {
  listeners = []
  window.matchMedia = (query) => ({
    matches: query === QUERY ? matches : false,
    media: query,
    addEventListener: (_, fn) => listeners.push(fn),
    removeEventListener: (_, fn) => {
      listeners = listeners.filter((l) => l !== fn)
    },
  })
}

beforeEach(() => {
  originalMatchMedia = window.matchMedia
  latest = undefined
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

describe('useMobilePortrait', () => {
  it('false when the phone-portrait query does not match (desktop, tablet, landscape)', () => {
    mockMatchMedia(false)
    render(<Harness />)
    expect(latest).toBe(false)
  })

  it('true when the phone-portrait query matches', () => {
    mockMatchMedia(true)
    render(<Harness />)
    expect(latest).toBe(true)
  })

  it('tracks the change event (rotation / resize across the boundary)', () => {
    mockMatchMedia(true)
    render(<Harness />)
    expect(latest).toBe(true)
    act(() => listeners.forEach((fn) => fn({ matches: false })))
    expect(latest).toBe(false)
    act(() => listeners.forEach((fn) => fn({ matches: true })))
    expect(latest).toBe(true)
  })
})
