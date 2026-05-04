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

  it('catalogs the ten action types from ADR-0006 §1 plus phase-7c list-item four', () => {
    expect(KNOWN).toEqual(
      expect.arrayContaining([
        // ADR §1 baseline ten
        'createCard', 'editCardField', 'moveCard', 'deleteCard',
        'addConnection', 'removeConnection',
        'createTextNode', 'editTextNode', 'moveTextNode', 'deleteTextNode',
        // Phase 7c additions: list-item granularity for storyNotes /
        // hiddenLore / dmNotes / media so an undo can never silently
        // bundle multiple bullets together.
        'addListItem', 'removeListItem', 'editListItem', 'reorderListItem',
      ]),
    )
    expect(KNOWN).toHaveLength(14)
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
