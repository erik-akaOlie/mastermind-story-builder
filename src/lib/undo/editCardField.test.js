// editCardField — phase 4.
// One entry per changed field per modal session. Two field families:
//   NODE_FIELDS    — label, summary, avatar, type → updateNode
//   SECTION_FIELDS — storyNotes, hiddenLore, dmNotes, media → updateNodeSections

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../nodes.js', async () => {
  const actual = await vi.importActual('../nodes.js')
  return {
    ...actual,
    updateNode:         vi.fn(async () => {}),
    updateNodeSections: vi.fn(async () => {}),
  }
})

import { canApplyInverse, canApplyForward, applyInverse, applyForward } from './editCardField.js'
import { ACTION_TYPES } from './index.js'
import { updateNode, updateNodeSections } from '../nodes.js'
import { useTypeStore } from '../../store/useTypeStore.js'

beforeEach(() => {
  updateNode.mockClear()
  updateNodeSections.mockClear()
})

const editEntry = (overrides = {}) => ({
  type: ACTION_TYPES.EDIT_CARD_FIELD,
  campaignId: 'c1',
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
    label:      'Strahd',
    summary:    'new',
    avatar:     null,
    type:       'character',
    storyNotes: ['beat 1'],
    hiddenLore: [],
    dmNotes:    [],
    media:      [],
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

  it('does deep-equality for array fields (storyNotes)', () => {
    const entry = editEntry({
      field: 'storyNotes',
      before: ['beat 1'],
      after:  ['beat 1', 'beat 2'],
    })
    expect(canApplyInverse(entry, {
      nodes: [cardWith({ storyNotes: ['beat 1', 'beat 2'] })],
    })).toEqual({ ok: true })
    // Different array contents → refuse.
    expect(canApplyInverse(entry, {
      nodes: [cardWith({ storyNotes: ['something else'] })],
    }).ok).toBe(false)
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
    expect(updateNodeSections).not.toHaveBeenCalled()
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

describe('editCardField — applyInverse (SECTION_FIELDS)', () => {
  it('storyNotes: writes `before` and merges other three sections from current state', async () => {
    const entry = editEntry({
      field: 'storyNotes',
      before: ['beat A'],
      after:  ['beat A', 'beat B'],
    })
    const target = cardWith({
      storyNotes: ['beat A', 'beat B'],
      hiddenLore: ['secret 1'],
      dmNotes:    ['note 1'],
      media:      ['m1'],
    })
    await applyInverse(entry, { nodes: [target] })

    expect(updateNodeSections).toHaveBeenCalledWith('card-1', {
      storyNotes: ['beat A'],          // recorded `before`
      hiddenLore: ['secret 1'],        // current state preserved
      dmNotes:    ['note 1'],          // current state preserved
      media:      ['m1'],              // current state preserved
    })
    expect(updateNode).not.toHaveBeenCalled()
  })

  it('media: handles an array of {path, alt, uploaded_at} objects', async () => {
    const beforeMedia = [{ path: 'p1.webp', alt: '', uploaded_at: 'iso-1' }]
    const afterMedia  = [
      { path: 'p1.webp', alt: '', uploaded_at: 'iso-1' },
      { path: 'p2.webp', alt: '', uploaded_at: 'iso-2' },
    ]
    const entry = editEntry({ field: 'media', before: beforeMedia, after: afterMedia })
    const target = cardWith({ media: afterMedia })
    await applyInverse(entry, { nodes: [target] })

    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      media: beforeMedia,
    }))
  })
})

describe('editCardField — applyForward', () => {
  it('writes `after` back via updateNode (mirror of inverse on summary)', async () => {
    await applyForward(editEntry(), {})
    expect(updateNode).toHaveBeenCalledWith('card-1', { summary: 'new' })
  })

  it('writes `after` back via updateNodeSections for section fields', async () => {
    const entry = editEntry({
      field: 'dmNotes',
      before: [],
      after:  ['restored note'],
    })
    const target = cardWith({ dmNotes: [] })
    await applyForward(entry, { nodes: [target] })
    expect(updateNodeSections).toHaveBeenCalledWith('card-1', expect.objectContaining({
      dmNotes: ['restored note'],
    }))
  })
})
