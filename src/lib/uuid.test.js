// safeRandomUUID must produce usable ids in every context — including
// insecure origins (plain-HTTP LAN dev server) where crypto.randomUUID is
// undefined. Regression guard for the 2026-07-06 "Couldn't load campaign /
// crypto.randomUUID is not a function" failure on legacy-data workspaces.

import { describe, it, expect, afterEach } from 'vitest'
import { safeRandomUUID } from './uuid.js'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const originalCrypto = globalThis.crypto
afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
})

describe('safeRandomUUID', () => {
  it('returns a UUID via crypto.randomUUID when available', () => {
    const id = safeRandomUUID()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('falls back to a spec-shaped v4 UUID when randomUUID is missing (insecure context)', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
    })
    const id = safeRandomUUID()
    expect(id).toMatch(UUID_V4_RE)
  })

  it('fallback ids are unique across calls', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
    })
    const ids = new Set(Array.from({ length: 100 }, () => safeRandomUUID()))
    expect(ids.size).toBe(100)
  })

  it('never throws even with no crypto at all (counter last resort)', () => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
    const a = safeRandomUUID()
    const b = safeRandomUUID()
    expect(a).toMatch(/^mm-id-\d+$/)
    expect(b).not.toBe(a)
  })
})
