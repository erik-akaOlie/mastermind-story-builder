// ============================================================================
// useFtueStore.test — the FTUE completed-flag semantics (Figma 225-1971)
//
// The product rules under test (Erik, 2026-07-16):
//   - a LOCAL successful create marks the intro done
//   - UNDOING the only item's creation rewinds (intro returns)
//   - undoing a create that does NOT empty the canvas never rewinds
//   - undoing a non-create (e.g. a delete restore) never rewinds
//   - REDOING a create marks done again (forward motion)
//   - remote inserts never reach these helpers at all (they're only called
//     from App's local create / undo / redo sites)
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/analytics.js', () => ({ track: vi.fn() }))

import {
  useFtueStore,
  readFtueDone,
  writeFtueDone,
  noteLocalCreate,
  noteUndoResult,
  noteRedoResult,
  CREATE_ACTION_TYPES,
} from './useFtueStore.js'
import { ACTION_TYPES } from '../lib/undo/index.js'
import { track } from '../lib/analytics.js'

const WS = 'ws-123'
const OTHER = 'ws-other'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  useFtueStore.setState({ workspaceId: null, done: true })
})

describe('storage helpers', () => {
  it('defaults to done (never show) without a workspace id', () => {
    expect(readFtueDone(null)).toBe(true)
    expect(readFtueDone(undefined)).toBe(true)
  })

  it('round-trips the flag per workspace', () => {
    expect(readFtueDone(WS)).toBe(false) // fresh workspace: not done → show
    writeFtueDone(WS, true)
    expect(readFtueDone(WS)).toBe(true)
    expect(readFtueDone(OTHER)).toBe(false) // scoped per workspace
    writeFtueDone(WS, false)
    expect(readFtueDone(WS)).toBe(false)
  })
})

describe('scope + reactive flag', () => {
  it('setScope hydrates done from storage', () => {
    writeFtueDone(WS, true)
    useFtueStore.getState().setScope(WS)
    expect(useFtueStore.getState().done).toBe(true)

    useFtueStore.getState().setScope(OTHER)
    expect(useFtueStore.getState().done).toBe(false)
  })

  it('markDone / rewind update storage AND the active scope', () => {
    useFtueStore.getState().setScope(WS)
    useFtueStore.getState().markDone(WS)
    expect(useFtueStore.getState().done).toBe(true)
    expect(readFtueDone(WS)).toBe(true)

    useFtueStore.getState().rewind(WS)
    expect(useFtueStore.getState().done).toBe(false)
    expect(readFtueDone(WS)).toBe(false)
  })

  it('writes for a NON-active workspace touch storage but not the live flag', () => {
    useFtueStore.getState().setScope(WS)
    useFtueStore.getState().markDone(OTHER)
    expect(readFtueDone(OTHER)).toBe(true)
    expect(useFtueStore.getState().done).toBe(false)
  })
})

describe('noteLocalCreate', () => {
  it('marks done and fires ftue_completed for the first item on an empty canvas', () => {
    useFtueStore.getState().setScope(WS)
    noteLocalCreate({ workspaceId: WS, kind: 'node', wasEmpty: true })
    expect(useFtueStore.getState().done).toBe(true)
    expect(readFtueDone(WS)).toBe(true)
    expect(track).toHaveBeenCalledWith('ftue_completed', { kind: 'node' })
  })

  it('marks done WITHOUT the analytics event when the canvas already had content', () => {
    useFtueStore.getState().setScope(WS)
    noteLocalCreate({ workspaceId: WS, kind: 'text', wasEmpty: false })
    expect(readFtueDone(WS)).toBe(true)
    expect(track).not.toHaveBeenCalled()
  })

  it('does not re-fire ftue_completed once already done', () => {
    writeFtueDone(WS, true)
    useFtueStore.getState().setScope(WS)
    noteLocalCreate({ workspaceId: WS, kind: 'node', wasEmpty: true })
    expect(track).not.toHaveBeenCalled()
  })
})

describe('noteUndoResult (the rewind rule)', () => {
  const createEntry = { type: ACTION_TYPES.CREATE_CARD, workspaceId: WS }

  beforeEach(() => {
    writeFtueDone(WS, true)
    useFtueStore.getState().setScope(WS)
  })

  it('rewinds when undoing a create left the canvas empty', () => {
    noteUndoResult({ ok: true, entry: createEntry }, 1)
    expect(useFtueStore.getState().done).toBe(false)
    expect(readFtueDone(WS)).toBe(false)
    expect(track).toHaveBeenCalledWith('ftue_rewound')
  })

  it('covers all three create families', () => {
    expect(CREATE_ACTION_TYPES.has(ACTION_TYPES.CREATE_CARD)).toBe(true)
    expect(CREATE_ACTION_TYPES.has(ACTION_TYPES.CREATE_TEXT_NODE)).toBe(true)
    expect(CREATE_ACTION_TYPES.has(ACTION_TYPES.CREATE_LINE)).toBe(true)
  })

  it('ignores undoing a create when other content remains', () => {
    noteUndoResult({ ok: true, entry: createEntry }, 3)
    expect(readFtueDone(WS)).toBe(true)
  })

  it('ignores non-create undos (delete-to-empty stays done)', () => {
    noteUndoResult({ ok: true, entry: { type: ACTION_TYPES.MOVE_CARD, workspaceId: WS } }, 1)
    expect(readFtueDone(WS)).toBe(true)
  })

  it('ignores failed / conflicted / empty results', () => {
    noteUndoResult({ ok: false, conflict: true, entry: createEntry }, 1)
    noteUndoResult({ ok: false, reason: 'empty' }, 1)
    noteUndoResult(undefined, 1)
    expect(readFtueDone(WS)).toBe(true)
  })
})

describe('noteRedoResult (forward motion)', () => {
  it('marks done again when a create is redone', () => {
    useFtueStore.getState().setScope(WS)
    expect(useFtueStore.getState().done).toBe(false)
    noteRedoResult({ ok: true, entry: { type: ACTION_TYPES.CREATE_TEXT_NODE, workspaceId: WS } })
    expect(useFtueStore.getState().done).toBe(true)
    expect(readFtueDone(WS)).toBe(true)
  })

  it('ignores non-create redos and failures', () => {
    useFtueStore.getState().setScope(WS)
    noteRedoResult({ ok: true, entry: { type: ACTION_TYPES.MOVE_CARD, workspaceId: WS } })
    noteRedoResult({ ok: false, entry: { type: ACTION_TYPES.CREATE_CARD, workspaceId: WS } })
    expect(readFtueDone(WS)).toBe(false)
  })
})
