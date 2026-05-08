// Test environment setup — runs once before any test file.
// Registers @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveValue, toHaveClass, etc.) and provides minimal jsdom polyfills
// for browser APIs that components depend on.

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount any rendered components between tests to prevent state leaks.
afterEach(() => {
  cleanup()
})

// Polyfills for jsdom — browser APIs that aren't implemented by default
// but that components/libraries call into.

// crypto.randomUUID — used by EditModal.newItem() to assign bullet ids.
if (!globalThis.crypto) globalThis.crypto = {}
if (!globalThis.crypto.randomUUID) {
  let counter = 0
  globalThis.crypto.randomUUID = () => `test-uuid-${++counter}`
}

// matchMedia — referenced by some Tailwind/animation libs and DnD utilities.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
