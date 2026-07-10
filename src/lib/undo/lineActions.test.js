// Line undo family — createLine / moveLine / editLine / deleteLine.
// Mirrors the text-node family tests (same conflict-aware contract).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lines.js', async () => {
  const actual = await vi.importActual('../lines.js')
  return {
    ...actual,
    createLine: vi.fn(async (args) => ({
      id: args.id ?? 'mock-line-uuid',
      type: 'lineNode',
      position: actual.linePositionFor(args),
      draggable: true,
      data: {
        ax: args.ax, ay: args.ay, bx: args.bx, by: args.by,
        weight: args.weight, dashed: args.dashed,
        dashLength: args.dashLength, dashGap: args.dashGap,
        color: args.color,
      },
    })),
    updateLine: vi.fn(async () => {}),
    deleteLine: vi.fn(async () => {}),
    restoreLine: vi.fn(async () => {}),
  }
})

import * as createLineAction from './createLine.js'
import * as moveLineAction from './moveLine.js'
import * as editLineAction from './editLine.js'
import * as deleteLineAction from './deleteLine.js'
import { ACTION_TYPES } from './index.js'
import { createLine, updateLine, deleteLine, restoreLine, LINE_PAD } from '../lines.js'

beforeEach(() => {
  createLine.mockClear()
  updateLine.mockClear()
  deleteLine.mockClear()
  restoreLine.mockClear()
})

const lineNode = (id, dataOverrides = {}) => ({
  id,
  type: 'lineNode',
  position: { x: 100 - LINE_PAD, y: 200 - LINE_PAD },
  draggable: true,
  data: {
    ax: 100, ay: 400, bx: 300, by: 200,
    weight: 4, dashed: false, dashLength: 12, dashGap: 8,
    color: '#9CA3AF',
    ...dataOverrides,
  },
})

const lnDbRow = (overrides = {}) => ({
  id:           'ln-1',
  workspace_id: 'ws-1',
  a_x: 100, a_y: 400, b_x: 300, b_y: 200,
  stroke_width: 4,
  dashed:       false,
  dash_length:  12,
  dash_gap:     8,
  color:        '#9CA3AF',
  ...overrides,
})

describe('createLine action', () => {
  const entry = {
    type: ACTION_TYPES.CREATE_LINE,
    workspaceId: 'ws-1',
    label: 'Add line',
    timestamp: '2026-07-10T00:00:00Z',
    lineId: 'ln-1',
    dbRow: lnDbRow(),
  }

  it('canApplyInverse requires the line to still exist', () => {
    expect(createLineAction.canApplyInverse(entry, { nodes: [lineNode('ln-1')] })).toEqual({ ok: true })
    expect(createLineAction.canApplyInverse(entry, { nodes: [] }).ok).toBe(false)
  })

  it('canApplyForward requires the id to be absent', () => {
    expect(createLineAction.canApplyForward(entry, { nodes: [] })).toEqual({ ok: true })
    expect(createLineAction.canApplyForward(entry, { nodes: [lineNode('ln-1')] }).ok).toBe(false)
  })

  it('applyInverse removes optimistically and persists deleteLine', async () => {
    const setNodes = vi.fn()
    await createLineAction.applyInverse(entry, { setNodes })
    expect(deleteLine).toHaveBeenCalledWith('ln-1')
    const updater = setNodes.mock.calls[0][0]
    expect(updater([lineNode('ln-1'), lineNode('other')])).toEqual([lineNode('other')])
  })

  it('applyForward recreates at the recorded UUID with the recorded style', async () => {
    const setNodes = vi.fn()
    await createLineAction.applyForward(entry, { setNodes })
    expect(createLine).toHaveBeenCalledWith({
      id: 'ln-1', workspaceId: 'ws-1',
      ax: 100, ay: 400, bx: 300, by: 200,
      weight: 4, dashed: false, dashLength: 12, dashGap: 8, color: '#9CA3AF',
    })
    const updater = setNodes.mock.calls[0][0]
    expect(updater([])).toHaveLength(1)
    // Idempotent when the Realtime echo landed first.
    expect(updater([lineNode('ln-1')])).toEqual([lineNode('ln-1')])
  })
})

describe('moveLine action', () => {
  const entry = {
    type: ACTION_TYPES.MOVE_LINE,
    workspaceId: 'ws-1',
    lineId: 'ln-1',
    before: { ax: 100, ay: 400, bx: 300, by: 200 },
    after:  { ax: 150, ay: 450, bx: 350, by: 250 },
  }

  it('canApplyInverse refuses when the anchors drifted from `after`', () => {
    const moved = lineNode('ln-1', { ax: 150, ay: 450, bx: 350, by: 250 })
    expect(moveLineAction.canApplyInverse(entry, { nodes: [moved] })).toEqual({ ok: true })
    expect(moveLineAction.canApplyInverse(entry, { nodes: [lineNode('ln-1')] }).ok).toBe(false)
  })

  it('applyInverse restores `before` anchors AND re-derives the box position', async () => {
    const setNodes = vi.fn()
    await moveLineAction.applyInverse(entry, { setNodes })
    expect(updateLine).toHaveBeenCalledWith('ln-1', { ax: 100, ay: 400, bx: 300, by: 200 })
    const updater = setNodes.mock.calls[0][0]
    const moved = lineNode('ln-1', { ax: 150, ay: 450, bx: 350, by: 250 })
    const [result] = updater([moved])
    expect(result.data).toMatchObject({ ax: 100, ay: 400, bx: 300, by: 200 })
    expect(result.position).toEqual({ x: 100 - LINE_PAD, y: 200 - LINE_PAD })
  })
})

describe('editLine action', () => {
  const styleEntry = {
    type: ACTION_TYPES.EDIT_LINE,
    workspaceId: 'ws-1',
    lineId: 'ln-1',
    before: { dashed: false },
    after:  { dashed: true },
  }

  it('field drift check compares only the recorded fields', () => {
    // Weight changed elsewhere — dashed (the recorded field) still matches.
    const heavier = lineNode('ln-1', { weight: 8, dashed: true })
    expect(editLineAction.canApplyInverse(styleEntry, { nodes: [heavier] })).toEqual({ ok: true })
    // dashed itself drifted → refuse.
    expect(editLineAction.canApplyInverse(styleEntry, { nodes: [lineNode('ln-1')] }).ok).toBe(false)
  })

  it('applyInverse writes only the changed fields and keeps position for style-only edits', async () => {
    const setNodes = vi.fn()
    await editLineAction.applyInverse(styleEntry, { setNodes })
    expect(updateLine).toHaveBeenCalledWith('ln-1', { dashed: false })
    const updater = setNodes.mock.calls[0][0]
    const dashedLine = lineNode('ln-1', { dashed: true })
    const [result] = updater([dashedLine])
    expect(result.data.dashed).toBe(false)
    expect(result.position).toBe(dashedLine.position)   // untouched
  })

  it('anchor edits re-derive the box position', async () => {
    const entry = {
      ...styleEntry,
      before: { bx: 300, by: 200 },
      after:  { bx: 500, by: 100 },
    }
    const setNodes = vi.fn()
    await editLineAction.applyForward(entry, { setNodes })
    const updater = setNodes.mock.calls[0][0]
    const [result] = updater([lineNode('ln-1')])
    expect(result.data).toMatchObject({ bx: 500, by: 100 })
    expect(result.position).toEqual({ x: 100 - LINE_PAD, y: 100 - LINE_PAD })
  })
})

describe('deleteLine action', () => {
  const entry = {
    type: ACTION_TYPES.DELETE_LINE,
    workspaceId: 'ws-1',
    lineId: 'ln-1',
    dbRow: lnDbRow({ dashed: true, dash_length: 20 }),
  }

  it('canApplyInverse requires the id to be absent (another tab may have restored it)', () => {
    expect(deleteLineAction.canApplyInverse(entry, { nodes: [] })).toEqual({ ok: true })
    expect(deleteLineAction.canApplyInverse(entry, { nodes: [lineNode('ln-1')] }).ok).toBe(false)
  })

  it('applyInverse restores the exact row (style included) via restoreLine', async () => {
    const setNodes = vi.fn()
    await deleteLineAction.applyInverse(entry, { setNodes })
    expect(restoreLine).toHaveBeenCalledWith(entry.dbRow)
    const updater = setNodes.mock.calls[0][0]
    const [restored] = updater([])
    expect(restored.data).toMatchObject({ dashed: true, dashLength: 20 })
  })

  it('applyForward deletes again', async () => {
    const setNodes = vi.fn()
    await deleteLineAction.applyForward(entry, { setNodes })
    expect(deleteLine).toHaveBeenCalledWith('ln-1')
    const updater = setNodes.mock.calls[0][0]
    expect(updater([lineNode('ln-1')])).toEqual([])
  })
})
