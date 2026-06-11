// quickConnect helpers — drop-target hit-testing + validation rules for the
// canvas quick-connect gesture.

import { describe, it, expect, vi } from 'vitest'
import {
  findNodeIdAtPoint,
  connectionExists,
  validateQuickConnectTarget,
} from './quickConnect.js'

const nodes = [
  { id: 'card-a', type: 'campaignNode' },
  { id: 'card-b', type: 'campaignNode' },
  { id: 'card-c', type: 'campaignNode' },
  { id: 'text-1', type: 'textNode' },
]
const edges = [
  { id: 'e1', source: 'card-a', target: 'card-b' },
]

describe('findNodeIdAtPoint', () => {
  function docWithElementAt(el) {
    return { elementFromPoint: vi.fn(() => el) }
  }

  it('resolves a click inside a node wrapper to its data-id', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'react-flow__node'
    wrapper.setAttribute('data-id', 'card-b')
    const inner = document.createElement('span')
    wrapper.appendChild(inner)

    expect(findNodeIdAtPoint(10, 10, docWithElementAt(inner))).toBe('card-b')
  })

  it('returns null over empty canvas / non-node UI', () => {
    const pane = document.createElement('div')
    expect(findNodeIdAtPoint(10, 10, docWithElementAt(pane))).toBeNull()
    expect(findNodeIdAtPoint(10, 10, docWithElementAt(null))).toBeNull()
  })
})

describe('connectionExists', () => {
  it('finds a connection in either direction', () => {
    expect(connectionExists(edges, 'card-a', 'card-b')).toBe(true)
    expect(connectionExists(edges, 'card-b', 'card-a')).toBe(true)
  })

  it('returns false for unconnected pairs', () => {
    expect(connectionExists(edges, 'card-a', 'card-c')).toBe(false)
  })
})

describe('validateQuickConnectTarget', () => {
  const base = { nodes, edges, sourceId: 'card-a' }

  it('accepts an unconnected card', () => {
    expect(validateQuickConnectTarget({ ...base, targetId: 'card-c' }))
      .toEqual({ ok: true })
  })

  it('rejects no target (released over empty canvas)', () => {
    expect(validateQuickConnectTarget({ ...base, targetId: null }).ok).toBe(false)
  })

  it('rejects the source itself (self-connection)', () => {
    expect(validateQuickConnectTarget({ ...base, targetId: 'card-a' }).ok).toBe(false)
  })

  it('rejects text blocks — connections only attach to cards', () => {
    const result = validateQuickConnectTarget({ ...base, targetId: 'text-1' })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/cards/i)
  })

  it('rejects an already-connected pair, in either direction', () => {
    expect(validateQuickConnectTarget({ ...base, targetId: 'card-b' }).ok).toBe(false)
    expect(validateQuickConnectTarget({ ...base, sourceId: 'card-b', targetId: 'card-a' }).ok).toBe(false)
  })

  it('rejects a target id that is not in local state', () => {
    expect(validateQuickConnectTarget({ ...base, targetId: 'ghost' }).ok).toBe(false)
  })
})
