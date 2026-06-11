// Dispatcher tests — catalog (every action type registered), routing
// behavior on unknown / malformed entries, and the universal `deepEqual`
// helper exported from `_shared.js`.
//
// Per-type behavior lives in the sibling <type>.test.js files. This file
// only checks what `index.js` itself owns: the Map<type, handlers> lookup
// and the early-out paths.

import { describe, it, expect } from 'vitest'

import {
  ACTION_TYPES,
  canApplyInverse,
  canApplyForward,
  applyInverse,
  applyForward,
  deepEqual,
} from './index.js'

const KNOWN = Object.values(ACTION_TYPES)

describe('undo dispatcher — exports + catalog', () => {
  it('exposes the four dispatcher functions', () => {
    expect(typeof canApplyInverse).toBe('function')
    expect(typeof canApplyForward).toBe('function')
    expect(typeof applyInverse).toBe('function')
    expect(typeof applyForward).toBe('function')
  })

  it('catalogs the ADR-0006 §1 baseline ten plus batchDelete', () => {
    expect(KNOWN).toEqual(
      expect.arrayContaining([
        // ADR §1 baseline ten
        'createCard', 'editCardField', 'moveCard', 'deleteCard',
        'addConnection', 'removeConnection',
        'createTextNode', 'editTextNode', 'moveTextNode', 'deleteTextNode',
        // Multi-delete (2026-06-11): one entry restores a whole deleted
        // selection — cards + text nodes + deduped shared connections.
        'batchDelete',
      ]),
    )
    expect(KNOWN).toHaveLength(11)
    // The phase-7c list-item families (add/remove/edit/reorderListItem) were
    // retired in E5 (ADR-0016) along with the legacy fielded editor.
    expect(KNOWN).not.toContain('addListItem')
  })
})

describe('undo dispatcher — unknown / malformed entries', () => {
  it('canApplyInverse rejects unknown / missing types with a reason', () => {
    expect(canApplyInverse({ type: 'bogus' })).toMatchObject({ ok: false })
    expect(canApplyInverse(null)).toMatchObject({ ok: false })
    expect(canApplyInverse(undefined)).toMatchObject({ ok: false })
  })

  it('canApplyForward rejects unknown / missing types with a reason', () => {
    expect(canApplyForward({ type: 'bogus' })).toMatchObject({ ok: false })
    expect(canApplyForward(null)).toMatchObject({ ok: false })
  })

  it('applyInverse throws "unknown action type" for unknown types', async () => {
    await expect(applyInverse({ type: 'bogus' })).rejects.toThrow(/unknown action type/i)
    await expect(applyInverse(null)).rejects.toThrow(/unknown action type/i)
  })

  it('applyForward throws "unknown action type" for unknown types', async () => {
    await expect(applyForward({ type: 'bogus' })).rejects.toThrow(/unknown action type/i)
  })
})

describe('undo dispatcher — deepEqual', () => {
  it('compares primitives, arrays, and plain objects structurally', () => {
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false)
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true) // key order
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(deepEqual([{ x: 1 }], [{ x: 1 }])).toBe(true)
    expect(deepEqual([{ x: 1 }], [{ x: 2 }])).toBe(false)
  })
})
