// ============================================================================
// SyncIndicator tests — pin down the Chunk 3 phone-portrait rule: ONLY the
// passive "Edited Nm ago" state is hidden on phones; "Offline" and "Can't
// save" are trust-related warnings and must render on EVERY device. (Scope
// guard from Erik, 2026-07-16: never hide save warnings or errors.)
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import SyncIndicator from './SyncIndicator'
import { useSyncStore } from '../store/useSyncStore'

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
  useSyncStore.setState({
    isOffline: false,
    consecutiveFailures: 0,
    lastSavedAt: new Date(),
  })
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
})

describe('SyncIndicator', () => {
  it('desktop: shows the passive "Edited …" chip', () => {
    setMobilePortrait(false)
    render(<SyncIndicator />)
    expect(screen.getByText(/^Edited /)).toBeTruthy()
  })

  it('phone portrait: hides the passive "Edited …" chip', () => {
    setMobilePortrait(true)
    const { container } = render(<SyncIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('phone portrait: "Offline" still renders (trust-related, never hidden)', () => {
    setMobilePortrait(true)
    useSyncStore.setState({ isOffline: true })
    render(<SyncIndicator />)
    expect(screen.getByText('Offline')).toBeTruthy()
  })

  it('phone portrait: "Can\'t save" still renders (trust-related, never hidden)', () => {
    setMobilePortrait(true)
    useSyncStore.setState({ consecutiveFailures: 3 })
    render(<SyncIndicator />)
    expect(screen.getByText("Can't save")).toBeTruthy()
  })
})
