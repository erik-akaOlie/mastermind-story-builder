// editCardField — phase 4.
// One entry per changed field per modal session. NODE_FIELDS only:
//   NODE_FIELDS — label, summary, avatar, type → updateNode
// (Section fields were retired in E5, ADR-0016.)

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    updateNode: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './editCardField.js'
import { ACTION_TYPES } from './index.js'
import { updateNode } from '../nodes.js'
import { useTypeStore } from '../../store/useTypeStore.js'

beforeEach(() => {
  updateNode.mockClear()
})

const editEntry = (overrides = {}) => ({
  type: ACTION_TYPES.EDIT_CARD_FIELD,
  workspaceId: 'c1',
  label: 'Edit summary',
  timestamp: '2026-04-30T17:00:00.000Z',
  cardId: 'card-1',
  field: 'summary',
  before: 'old',
  after:  'new',
  ...overrides,
})

const cardWith = (fields = {}) => ({
  id: 'card-1',
  data: {
    label:   'Strahd',
    summary: 'new',
    avatar:  null,
    type:    'character',
    ...fields,
  },
})

describe('editCardField — canApplyInverse', () => {
  it('passes when current field value deep-equals entry.after', () => {
    expect(canApplyInverse(editEntry(), { nodes: [cardWith({ summary: 'new' })] }))
      .toEqual({ ok: true })
  })

  it('refuses when current field value diverged from entry.after', () => {
    const result = canApplyInverse(editEntry(), {
      nodes: [cardWith({ summary: 'something else' })],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/changed elsewhere/i)
  })

  it('refuses when the card no longer exists', () => {
    const result = canApplyInverse(editEntry(), { nodes: [] })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/no longer exists/i)
  })

  it('refuses for an unsupported field name', () => {
    const result = canApplyInverse(
      editEntry({ field: 'bogus', after: 'x' }),
      { nodes: [cardWith()] },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/unsupported field/i)
  })
})

describe('editCardField — canApplyForward', () => {
  it('passes when current field value deep-equals entry.before (mirror of inverse check)', () => {
    expect(canApplyForward(editEntry(), { nodes: [cardWith({ summary: 'old' })] }))
      .toEqual({ ok: true })
  })

  it('refuses when current field value diverged from entry.before', () => {
    expect(canApplyForward(editEntry(), {
      nodes: [cardWith({ summary: 'drifted' })],
    }).ok).toBe(false)
  })
})

describe('editCardField — applyInverse (NODE_FIELDS)', () => {
  it('summary: persists `before` via updateNode({ summary })', async () => {
    await applyInverse(editEntry(), {})
    expect(updateNode).toHaveBeenCalledWith('card-1', { summary: 'old' })
  })

  it('label: persists `before` via updateNode({ label })', async () => {
    await applyInverse(
      editEntry({ field: 'label', before: 'Old Title', after: 'New Title' }),
      {},
    )
    expect(updateNode).toHaveBeenCalledWith('card-1', { label: 'Old Title' })
  })

  it('avatar: maps to `avatarUrl` (the lib API name)', async () => {
    await applyInverse(
      editEntry({ field: 'avatar', before: 'path/old.webp', after: 'path/new.webp' }),
      {},
    )
    expect(updateNode).toHaveBeenCalledWith('card-1', { avatarUrl: 'path/old.webp' })
  })

  it('type: looks up typeId via useTypeStore.idByKey and writes that', async () => {
    useTypeStore.setState({
      types:   { character: {}, location: {} },
      idByKey: { character: 'type-uuid-character', location: 'type-uuid-location' },
    })
    await applyInverse(
      editEntry({ field: 'type', before: 'character', after: 'location' }),
      {},
    )
    expect(updateNode).toHaveBeenCalledWith('card-1', { typeId: 'type-uuid-character' })
  })

  it('type: throws when the key has no idByKey entry', async () => {
    useTypeStore.setState({ types: {}, idByKey: {} })
    await expect(applyInverse(
      editEntry({ field: 'type', before: 'unknown-key', after: 'character' }),
      {},
    )).rejects.toThrow(/no typeId/i)
  })

  it('optimistically rewrites the field on the target card via setNodes', async () => {
    const setNodes = vi.fn()
    await applyInverse(editEntry(), { setNodes })
    const updater = setNodes.mock.calls[0][0]
    const result = updater([
      { id: 'card-1', data: { summary: 'new', label: 'Strahd' } },
      { id: 'other',  data: { summary: 'untouched' } },
    ])
    expect(result[0].data).toEqual({ summary: 'old', label: 'Strahd' })
    expect(result[1].data).toEqual({ summary: 'untouched' })
  })
})

describe('editCardField — applyForward', () => {
  it('writes `after` back via updateNode (mirror of inverse on summary)', async () => {
    await applyForward(editEntry(), {})
    expect(updateNode).toHaveBeenCalledWith('card-1', { summary: 'new' })
  })
})
