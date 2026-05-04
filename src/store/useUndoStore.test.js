// Tests for useUndoStore — stack semantics, scope/hydration, sessionStorage
// persistence, and dispatcher-aware undo()/redo().
//
// The dispatcher (canApplyInverse / applyInverse / canApplyForward / applyForward)
// is mocked here so these tests stay focused on stack semantics and the store's
// own conflict + error handling. Real dispatcher behavior is covered in
// src/lib/undo/.

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/undo/index.js', () => ({
  ACTION_TYPES: {
    CREATE_CARD:        'createCard',
    EDIT_CARD_FIELD:    'editCardField',
    MOVE_CARD:          'moveCard',
    DELETE_CARD:        'deleteCard',
    ADD_CONNECTION:     'addConnection',
    REMOVE_CONNECTION:  'removeConnection',
    CREATE_TEXT_NODE:   'createTextNode',
    EDIT_TEXT_NODE:     'editTextNode',
    MOVE_TEXT_NODE:     'moveTextNode',
    DELETE_TEXT_NODE:   'deleteTextNode',
  },
  canApplyInverse: vi.fn(() => ({ ok: true })),
  canApplyForward: vi.fn(() => ({ ok: true })),
  applyInverse:    vi.fn(async () => {}),
  applyForward:    vi.fn(async () => {}),
}))

// Toast helpers — mocked so tests assert what got fired without rendering JSX.
vi.mock('../lib/feedbackToasts.jsx', () => ({
  toastUndoSuccess:  vi.fn(),
  toastRedoSuccess:  vi.fn(),
  toastUndoConflict: vi.fn(),
  toastRedoConflict: vi.fn(),
  toastSaveFailed:   vi.fn(),
}))

import { useUndoStore } from './useUndoStore'
import {
  canApplyInverse,
  canApplyForward,
  applyInverse,
  applyForward,
} from '../lib/undo/index.js'
import {
  toastUndoSuccess,
  toastRedoSuccess,
  toastUndoConflict,
  toastRedoConflict,
} from '../lib/feedbackToasts.jsx'

const A = { type: 'editCardField', label: 'Edit summary', cardId: 'a' }
const B = { type: 'moveCard',      label: 'Move card',    cardId: 'b' }

const KEY = 'mastermind:undo:u1:c1'

const s = () => useUndoStore.getState()

const setScope = (overrides = {}) =>
  s().setScope({ userId: 'u1', campaignId: 'c1', ...overrides })

beforeEach(() => {
  sessionStorage.clear()
  // Reset dispatcher mocks to permissive defaults.
  canApplyInverse.mockReset().mockReturnValue({ ok: true })
  canApplyForward.mockReset().mockReturnValue({ ok: true })
  applyInverse.mockReset().mockResolvedValue(undefined)
  applyForward.mockReset().mockResolvedValue(undefined)
  // Reset toast mocks between tests so call counts are scoped per-test.
  toastUndoSuccess.mockClear()
  toastRedoSuccess.mockClear()
  toastUndoConflict.mockClear()
  toastRedoConflict.mockClear()
  // Reset store to a clean slate between tests.
  useUndoStore.setState({
    userId: null,
    campaignId: null,
    past: [],
    future: [],
  })
})

describe('useUndoStore — recordAction', () => {
  it('pushes the entry onto past', () => {
    setScope()
    s().recordAction(A)
    expect(s().past).toEqual([A])
  })

  it('clears future when a new action is recorded', async () => {
    setScope()
    s().recordAction(A)
    await s().undo()
    // future = [A] now; recording B must wipe the redo path.
    s().recordAction(B)
    expect(s().past).toEqual([B])
    expect(s().future).toEqual([])
  })

  it('caps the stack at 75 — pushing the 76th drops the oldest', () => {
    setScope()
    const entries = Array.from({ length: 76 }, (_, i) => ({
      ...A,
      cardId: `card-${i}`,
    }))
    for (const e of entries) s().recordAction(e)

    const { past } = s()
    expect(past).toHaveLength(75)
    expect(past[0].cardId).toBe('card-1')                    // card-0 dropped
    expect(past[past.length - 1].cardId).toBe('card-75')     // newest at end
  })

  it('persists past + future to sessionStorage under the scoped key', () => {
    setScope()
    s().recordAction(A)
    const stored = JSON.parse(sessionStorage.getItem(KEY))
    expect(stored).toEqual({ past: [A], future: [] })
  })
})

describe('useUndoStore — undo / redo', () => {
  it('undo moves past[-1] onto future[-1]', async () => {
    setScope()
    s().recordAction(A)
    s().recordAction(B)
    await s().undo()
    expect(s().past).toEqual([A])
    expect(s().future).toEqual([B])
  })

  it('redo moves future[-1] back onto past[-1]', async () => {
    setScope()
    s().recordAction(A)
    await s().undo()
    await s().redo()
    expect(s().past).toEqual([A])
    expect(s().future).toEqual([])
  })

  it('undo on an empty past is a no-op', async () => {
    setScope()
    const result = await s().undo()
    expect(result.ok).toBe(false)
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
    expect(applyInverse).not.toHaveBeenCalled()
  })

  it('redo on an empty future is a no-op', async () => {
    setScope()
    const result = await s().redo()
    expect(result.ok).toBe(false)
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
    expect(applyForward).not.toHaveBeenCalled()
  })

  it('do-do-undo-undo-redo-redo replays in order: A, B, undo B, undo A, redo A, redo B', async () => {
    setScope()

    s().recordAction(A)
    expect(s().past).toEqual([A])
    expect(s().future).toEqual([])

    s().recordAction(B)
    expect(s().past).toEqual([A, B])
    expect(s().future).toEqual([])

    // First undo lifts B (the last action) off past, parks it at end of future.
    await s().undo()
    expect(s().past).toEqual([A])
    expect(s().future).toEqual([B])

    // Second undo lifts A; future order is [B, A] — A is the most-recently-undone.
    await s().undo()
    expect(s().past).toEqual([])
    expect(s().future).toEqual([B, A])

    // Redo replays the most-recently-undone first → A returns to past.
    await s().redo()
    expect(s().past).toEqual([A])
    expect(s().future).toEqual([B])

    // Then B.
    await s().redo()
    expect(s().past).toEqual([A, B])
    expect(s().future).toEqual([])
  })

  it('persists stack movement on undo and redo', async () => {
    setScope()
    s().recordAction(A)
    await s().undo()
    expect(JSON.parse(sessionStorage.getItem(KEY))).toEqual({
      past: [], future: [A],
    })
    await s().redo()
    expect(JSON.parse(sessionStorage.getItem(KEY))).toEqual({
      past: [A], future: [],
    })
  })

  it('passes the supplied context (nodes, edges, setters) to the dispatcher', async () => {
    setScope()
    s().recordAction(A)
    const ctx = { nodes: [{ id: 'a' }], edges: [], setNodes: vi.fn(), setEdges: vi.fn() }
    await s().undo(ctx)
    expect(canApplyInverse).toHaveBeenCalledWith(A, ctx)
    expect(applyInverse).toHaveBeenCalledWith(A, ctx)
  })
})

describe('useUndoStore — undo conflict + failure paths', () => {
  it('pops the orphan entry from past when canApplyInverse refuses', async () => {
    canApplyInverse.mockReturnValueOnce({ ok: false, reason: 'changed elsewhere' })
    setScope()
    s().recordAction(A)
    s().recordAction(B)

    const result = await s().undo()

    expect(result).toMatchObject({ ok: false, conflict: true, reason: 'changed elsewhere' })
    expect(s().past).toEqual([A])    // B was popped as orphan
    expect(s().future).toEqual([])   // never made it to future
    expect(applyInverse).not.toHaveBeenCalled()
  })

  it('pops the orphan entry from future when canApplyForward refuses', async () => {
    canApplyForward.mockReturnValueOnce({ ok: false, reason: 'card gone' })
    setScope()
    s().recordAction(A)
    await s().undo()              // future = [A]

    const result = await s().redo()

    expect(result).toMatchObject({ ok: false, conflict: true })
    expect(s().future).toEqual([])  // A was popped as orphan
    expect(s().past).toEqual([])    // and didn't return to past
    expect(applyForward).not.toHaveBeenCalled()
  })

  it('does not move stacks when applyInverse throws', async () => {
    applyInverse.mockRejectedValueOnce(new Error('db down'))
    setScope()
    s().recordAction(A)

    const result = await s().undo()

    expect(result.ok).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
    expect(s().past).toEqual([A])    // unchanged
    expect(s().future).toEqual([])
  })

  it('does not move stacks when applyForward throws', async () => {
    applyForward.mockRejectedValueOnce(new Error('db down'))
    setScope()
    s().recordAction(A)
    await s().undo()                // future = [A]

    const result = await s().redo()

    expect(result.ok).toBe(false)
    expect(s().past).toEqual([])
    expect(s().future).toEqual([A])  // unchanged
  })
})

describe('useUndoStore — popLastAction / popLastFutureAction', () => {
  it('popLastAction reverts the most recent recordAction', () => {
    setScope()
    s().recordAction(A)
    s().recordAction(B)
    s().popLastAction()
    expect(s().past).toEqual([A])
  })

  it('popLastAction persists the rolled-back state', () => {
    setScope()
    s().recordAction(A)
    s().popLastAction()
    expect(JSON.parse(sessionStorage.getItem(KEY))).toEqual({
      past: [], future: [],
    })
  })

  it('popLastFutureAction is the mirror of popLastAction (drops future[-1])', async () => {
    setScope()
    s().recordAction(A)
    s().recordAction(B)
    await s().undo()                  // future = [B]
    await s().undo()                  // future = [B, A]
    s().popLastFutureAction()         // drops A
    expect(s().future).toEqual([B])
  })

  it('popLastAction on empty past is a no-op', () => {
    setScope()
    s().popLastAction()
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
  })

  it('popLastFutureAction on empty future is a no-op', () => {
    setScope()
    s().popLastFutureAction()
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
  })
})

describe('useUndoStore — setScope hydration', () => {
  it('starts with empty stacks when sessionStorage has no entry for the scope', () => {
    setScope()
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
  })

  it('hydrates past + future from sessionStorage when present', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ past: [A, B], future: [A] }))
    setScope()
    expect(s().past).toEqual([A, B])
    expect(s().future).toEqual([A])
  })

  it('switching campaignId clears the in-memory stack and re-hydrates from the new key', () => {
    sessionStorage.setItem(
      'mastermind:undo:u1:c1',
      JSON.stringify({ past: [A], future: [] }),
    )
    sessionStorage.setItem(
      'mastermind:undo:u1:c2',
      JSON.stringify({ past: [B], future: [] }),
    )

    setScope({ campaignId: 'c1' })
    expect(s().past).toEqual([A])

    setScope({ campaignId: 'c2' })
    expect(s().past).toEqual([B])
  })

  it('switching userId clears the in-memory stack and re-hydrates from the new key', () => {
    sessionStorage.setItem(
      'mastermind:undo:u1:c1',
      JSON.stringify({ past: [A], future: [] }),
    )
    sessionStorage.setItem(
      'mastermind:undo:u2:c1',
      JSON.stringify({ past: [B], future: [] }),
    )

    setScope({ userId: 'u1' })
    expect(s().past).toEqual([A])

    setScope({ userId: 'u2' })
    expect(s().past).toEqual([B])
  })

  it('switching to a fresh scope produces empty stacks even if the prior scope had entries', () => {
    setScope({ campaignId: 'c1' })
    s().recordAction(A)
    expect(s().past).toEqual([A])

    setScope({ campaignId: 'c2' })
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
  })

  it('falls back to empty stacks when sessionStorage holds malformed JSON', () => {
    sessionStorage.setItem(KEY, '{not json')
    setScope()
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
  })
})

describe('useUndoStore — clear', () => {
  it('empties both stacks', async () => {
    setScope()
    s().recordAction(A)
    s().recordAction(B)
    await s().undo()
    s().clear()
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
  })

  it('removes the scoped sessionStorage entry', () => {
    setScope()
    s().recordAction(A)
    expect(sessionStorage.getItem(KEY)).not.toBeNull()

    s().clear()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('does not touch other scopes\' sessionStorage entries', () => {
    sessionStorage.setItem(
      'mastermind:undo:u1:c2',
      JSON.stringify({ past: [B], future: [] }),
    )
    setScope({ campaignId: 'c1' })
    s().recordAction(A)

    s().clear()

    expect(sessionStorage.getItem('mastermind:undo:u1:c1')).toBeNull()
    expect(sessionStorage.getItem('mastermind:undo:u1:c2')).not.toBeNull()
  })
})

// Phase 9: chip-style toasts on undo/redo. The store fires the right helper
// based on outcome; persist-write failure stays silent here because
// errorReporting.persistWrite owns its own toast (toastSaveFailed).
describe('useUndoStore — toasts on undo / redo outcomes', () => {
  it('fires toastUndoSuccess with the entry on a clean undo', async () => {
    setScope()
    s().recordAction(A)
    await s().undo()
    expect(toastUndoSuccess).toHaveBeenCalledTimes(1)
    expect(toastUndoSuccess).toHaveBeenCalledWith(A)
    expect(toastUndoConflict).not.toHaveBeenCalled()
  })

  it('fires toastRedoSuccess with the entry on a clean redo', async () => {
    setScope()
    s().recordAction(A)
    await s().undo()
    toastUndoSuccess.mockClear()  // ignore the prior undo toast

    await s().redo()
    expect(toastRedoSuccess).toHaveBeenCalledTimes(1)
    expect(toastRedoSuccess).toHaveBeenCalledWith(A)
    expect(toastRedoConflict).not.toHaveBeenCalled()
  })

  it('fires toastUndoConflict (and not success) when canApplyInverse refuses', async () => {
    canApplyInverse.mockReturnValueOnce({ ok: false, reason: 'changed elsewhere' })
    setScope()
    s().recordAction(A)
    await s().undo()
    expect(toastUndoConflict).toHaveBeenCalledTimes(1)
    expect(toastUndoSuccess).not.toHaveBeenCalled()
  })

  it('fires toastRedoConflict (and not success) when canApplyForward refuses', async () => {
    canApplyForward.mockReturnValueOnce({ ok: false, reason: 'card gone' })
    setScope()
    s().recordAction(A)
    await s().undo()
    toastUndoSuccess.mockClear()

    await s().redo()
    expect(toastRedoConflict).toHaveBeenCalledTimes(1)
    expect(toastRedoSuccess).not.toHaveBeenCalled()
  })

  it('does not fire any undo toast when applyInverse throws (persistWrite handles it)', async () => {
    applyInverse.mockRejectedValueOnce(new Error('db down'))
    setScope()
    s().recordAction(A)
    await s().undo()
    expect(toastUndoSuccess).not.toHaveBeenCalled()
    expect(toastUndoConflict).not.toHaveBeenCalled()
  })

  it('does not fire any redo toast when applyForward throws', async () => {
    applyForward.mockRejectedValueOnce(new Error('db down'))
    setScope()
    s().recordAction(A)
    await s().undo()
    toastUndoSuccess.mockClear()

    await s().redo()
    expect(toastRedoSuccess).not.toHaveBeenCalled()
    expect(toastRedoConflict).not.toHaveBeenCalled()
  })

  it('does not fire any toast on undo with empty past', async () => {
    setScope()
    await s().undo()
    expect(toastUndoSuccess).not.toHaveBeenCalled()
    expect(toastUndoConflict).not.toHaveBeenCalled()
  })

  it('does not fire any toast on redo with empty future', async () => {
    setScope()
    await s().redo()
    expect(toastRedoSuccess).not.toHaveBeenCalled()
    expect(toastRedoConflict).not.toHaveBeenCalled()
  })
})

// Phase 10: F5 rehydration. sessionStorage survives a tab refresh; the
// store's in-memory state does not. setScope rehydrates from storage on
// first run, so a refreshed tab continues with the same undo history.
describe('useUndoStore — F5 rehydrate end-to-end', () => {
  it('records actions, simulates a refresh, and undo still works on the rehydrated stack', async () => {
    // 1. Record two actions while signed in to a campaign.
    setScope()
    s().recordAction(A)
    s().recordAction(B)
    expect(s().past).toEqual([A, B])
    // sessionStorage now holds [A, B] under the scoped key.
    expect(JSON.parse(sessionStorage.getItem(KEY))).toEqual({ past: [A, B], future: [] })

    // 2. Simulate F5: blow away in-memory state. (sessionStorage survives a
    // refresh; module-level Zustand state does not.) After this point the
    // store looks the same as it does immediately after the page reloads,
    // before App.jsx → useCampaignData → setScope runs.
    useUndoStore.setState({
      userId: null,
      campaignId: null,
      past: [],
      future: [],
    })
    expect(s().past).toEqual([])
    expect(s().future).toEqual([])

    // 3. App boots back up, useCampaignData calls setScope with the same
    // (userId, campaignId). The store rehydrates from sessionStorage.
    setScope()
    expect(s().past).toEqual([A, B])
    expect(s().future).toEqual([])

    // 4. Undo on the rehydrated stack works: pops B onto future, runs
    // applyInverse.
    const result = await s().undo()
    expect(result.ok).toBe(true)
    expect(result.entry).toEqual(B)
    expect(applyInverse).toHaveBeenCalledWith(B, expect.anything())
    expect(s().past).toEqual([A])
    expect(s().future).toEqual([B])
  })
})

// Phase 10: sign-out cleanup. Wipes the in-memory stack AND every
// sessionStorage entry under the signing-out user's prefix so a different
// user signing in next on this tab can't inherit history.
describe('useUndoStore — clearAllForUser', () => {
  it('empties the in-memory stack regardless of current scope', () => {
    setScope({ userId: 'u1', campaignId: 'c1' })
    s().recordAction(A)
    s().recordAction(B)

    s().clearAllForUser('u1')

    expect(s().past).toEqual([])
    expect(s().future).toEqual([])
    expect(s().userId).toBeNull()
    expect(s().campaignId).toBeNull()
  })

  it('removes EVERY sessionStorage entry for that user across campaigns', () => {
    // Pre-populate two campaigns' worth of history for u1.
    sessionStorage.setItem('mastermind:undo:u1:c1', JSON.stringify({ past: [A], future: [] }))
    sessionStorage.setItem('mastermind:undo:u1:c2', JSON.stringify({ past: [B], future: [] }))
    sessionStorage.setItem('mastermind:undo:u1:c3', JSON.stringify({ past: [], future: [A] }))

    setScope({ userId: 'u1', campaignId: 'c1' })
    s().clearAllForUser('u1')

    expect(sessionStorage.getItem('mastermind:undo:u1:c1')).toBeNull()
    expect(sessionStorage.getItem('mastermind:undo:u1:c2')).toBeNull()
    expect(sessionStorage.getItem('mastermind:undo:u1:c3')).toBeNull()
  })

  it('does not touch entries for other users', () => {
    sessionStorage.setItem('mastermind:undo:u1:c1', JSON.stringify({ past: [A], future: [] }))
    sessionStorage.setItem('mastermind:undo:u2:c1', JSON.stringify({ past: [B], future: [] }))
    sessionStorage.setItem('mastermind:undo:u2:c2', JSON.stringify({ past: [B], future: [] }))

    s().clearAllForUser('u1')

    expect(sessionStorage.getItem('mastermind:undo:u1:c1')).toBeNull()
    expect(sessionStorage.getItem('mastermind:undo:u2:c1')).not.toBeNull()
    expect(sessionStorage.getItem('mastermind:undo:u2:c2')).not.toBeNull()
  })

  it('does not touch unrelated sessionStorage keys', () => {
    sessionStorage.setItem('some-other-app:state', '"hello"')
    sessionStorage.setItem('mastermind:undo:u1:c1', JSON.stringify({ past: [A], future: [] }))

    s().clearAllForUser('u1')

    expect(sessionStorage.getItem('some-other-app:state')).toBe('"hello"')
    expect(sessionStorage.getItem('mastermind:undo:u1:c1')).toBeNull()
  })

  it('is a no-op when called with a falsy userId', () => {
    sessionStorage.setItem('mastermind:undo:u1:c1', JSON.stringify({ past: [A], future: [] }))
    s().clearAllForUser(null)
    s().clearAllForUser(undefined)
    s().clearAllForUser('')
    // sessionStorage entries untouched
    expect(sessionStorage.getItem('mastermind:undo:u1:c1')).not.toBeNull()
  })
})
