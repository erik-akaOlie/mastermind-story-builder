// ============================================================================
// feedbackToasts tests — the honest-cause rule for save-failure copy
// ----------------------------------------------------------------------------
// Bug-2 QA (Erik, 2026-07-31) surfaced "Can't save … — check your connection"
// for a failure that had nothing to do with connectivity. The rule now pinned
// here: the connection is named ONLY when the browser itself reports offline
// (navigator.onLine === false); otherwise the copy reports the failure
// without inventing a cause.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { toastSaveFailed } from './feedbackToasts.jsx'
import { useFeedbackToastStore } from '../store/useFeedbackToastStore.js'

const originalOnLine = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(navigator),
  'onLine',
)

function setOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

function newestToast() {
  const { toasts } = useFeedbackToastStore.getState()
  return toasts[toasts.length - 1]
}

describe('toastSaveFailed — honest-cause copy', () => {
  beforeEach(() => {
    useFeedbackToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    // Restore the real navigator.onLine so other tests see jsdom's default.
    delete navigator.onLine
    if (originalOnLine) {
      Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', originalOnLine)
    }
  })

  it('reports the failure neutrally when the browser is not known to be offline', () => {
    setOnLine(true)
    toastSaveFailed('your new card')
    expect(newestToast().content).toBe("Couldn't save your new card.")
    expect(newestToast().content).not.toMatch(/connection|offline/i)
  })

  it('names the connection only when the browser itself reports offline', () => {
    setOnLine(false)
    toastSaveFailed('your text block')
    expect(newestToast().content).toBe(
      "Can't save your text block — you appear to be offline.",
    )
  })
})
