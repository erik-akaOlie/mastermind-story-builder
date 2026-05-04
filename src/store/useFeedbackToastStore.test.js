// Tests for useFeedbackToastStore — push semantics, no-stacking exit on
// supersession, sticky-id replace, pause/resume, lifecycle phase transitions
// (visible → exiting → removed).
//
// Lifecycle timers run on real setTimeout via vi.useFakeTimers() so we can
// advance time deterministically. The component-side animation behavior
// (slide-in keyframes, fadeout opacity transitions, mid-fadeout pause) is
// tested indirectly here through the `exiting` flag and `paused` flag the
// store exposes; CSS transition behavior itself is browser-driven and out
// of scope for unit tests.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useFeedbackToastStore,
  FADEOUT_MS,
  DEFAULT_DURATION_MS,
} from './useFeedbackToastStore'

const s = () => useFeedbackToastStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  s()._resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFeedbackToastStore — push', () => {
  it('returns the toast id', () => {
    const id = s().push({ variant: 'info', content: 'x' })
    expect(typeof id).toBe('string')
    expect(s().toasts[0].id).toBe(id)
  })

  it('uses DEFAULT_DURATION_MS when durationMs is not specified', () => {
    s().push({ variant: 'info', content: 'x' })
    // Just before the default duration, still visible.
    vi.advanceTimersByTime(DEFAULT_DURATION_MS - 1)
    expect(s().toasts[0].exiting).toBe(false)
    // One tick later, exiting flips on.
    vi.advanceTimersByTime(1)
    expect(s().toasts[0].exiting).toBe(true)
  })

  it('respects custom durationMs', () => {
    s().push({ variant: 'info', content: 'x', durationMs: 500 })
    vi.advanceTimersByTime(499)
    expect(s().toasts[0].exiting).toBe(false)
    vi.advanceTimersByTime(1)
    expect(s().toasts[0].exiting).toBe(true)
  })
})

describe('useFeedbackToastStore — no-stacking on supersession', () => {
  it('a second push transitions the first toast into the exiting phase', () => {
    s().push({ variant: 'info', content: 'first' })
    s().push({ variant: 'info', content: 'second' })
    const { toasts } = s()
    expect(toasts).toHaveLength(2)
    expect(toasts[0].content).toBe('second')
    expect(toasts[0].exiting).toBe(false)
    expect(toasts[1].content).toBe('first')
    expect(toasts[1].exiting).toBe(true)
  })

  it('the superseded toast removes after FADEOUT_MS, leaving the new one visible', () => {
    s().push({ variant: 'info', content: 'first', durationMs: 5000 })
    s().push({ variant: 'info', content: 'second', durationMs: 5000 })
    vi.advanceTimersByTime(FADEOUT_MS)
    const remaining = s().toasts.map((t) => t.content)
    expect(remaining).toEqual(['second'])
    expect(s().toasts[0].exiting).toBe(false)
  })

  it('a third push supersedes the second; first is already gone', () => {
    s().push({ variant: 'info', content: 'a', durationMs: 5000 })
    s().push({ variant: 'info', content: 'b', durationMs: 5000 })
    vi.advanceTimersByTime(FADEOUT_MS)         // a removed, b is the only live toast
    s().push({ variant: 'info', content: 'c', durationMs: 5000 })
    expect(s().toasts.map((t) => t.content)).toEqual(['c', 'b'])
    expect(s().toasts[0].exiting).toBe(false)  // c is fresh
    expect(s().toasts[1].exiting).toBe(true)   // b just got superseded
  })

  it('the new toast runs its full visible phase regardless of how recently the previous one was superseded', () => {
    s().push({ variant: 'info', content: 'first', durationMs: 5000 })
    s().push({ variant: 'info', content: 'second', durationMs: 5000 })
    // Advance only into the new toast's visible phase. Without a buggy
    // shared timer, second should still be visible.
    vi.advanceTimersByTime(4999)
    expect(s().toasts[0].content).toBe('second')
    expect(s().toasts[0].exiting).toBe(false)
    vi.advanceTimersByTime(1)
    expect(s().toasts[0].exiting).toBe(true)
  })
})

describe('useFeedbackToastStore — sticky id', () => {
  it('replaces an existing sticky-id toast in place rather than stacking', () => {
    s().push({ stickyId: 'persist-fail', variant: 'error', content: 'first' })
    s().push({ stickyId: 'persist-fail', variant: 'error', content: 'second' })
    const { toasts } = s()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].content).toBe('second')
    expect(toasts[0].exiting).toBe(false)       // sticky replace, no fade
  })

  it('resets the dismiss timer when a sticky-id toast is replaced', () => {
    s().push({ stickyId: 'persist-fail', variant: 'error', content: 'first', durationMs: 1000 })
    vi.advanceTimersByTime(900)
    s().push({ stickyId: 'persist-fail', variant: 'error', content: 'second', durationMs: 1000 })
    // 900ms in is well before the new toast's exit. If the old timer were
    // still alive, exiting would flip after another 100ms. With reset,
    // we need the FULL 1000ms.
    vi.advanceTimersByTime(100)
    expect(s().toasts[0].exiting).toBe(false)
    vi.advanceTimersByTime(900)
    expect(s().toasts[0].exiting).toBe(true)
  })
})

describe('useFeedbackToastStore — lifecycle phases', () => {
  it('visible → exiting after durationMs', () => {
    s().push({ variant: 'info', content: 'x', durationMs: 500 })
    expect(s().toasts[0].exiting).toBe(false)
    vi.advanceTimersByTime(500)
    expect(s().toasts[0].exiting).toBe(true)
  })

  it('exiting → removed after FADEOUT_MS', () => {
    s().push({ variant: 'info', content: 'x', durationMs: 500 })
    vi.advanceTimersByTime(500)              // → exiting
    expect(s().toasts).toHaveLength(1)
    vi.advanceTimersByTime(FADEOUT_MS)       // → removed
    expect(s().toasts).toHaveLength(0)
  })
})

describe('useFeedbackToastStore — pause / resume', () => {
  it('pause freezes the timer in the visible phase', () => {
    const id = s().push({ variant: 'info', content: 'x', durationMs: 1000 })
    vi.advanceTimersByTime(400)
    s().pause(id)
    // 600ms more would have fired exit — but we're paused. No phase change.
    vi.advanceTimersByTime(10_000)
    expect(s().toasts[0].exiting).toBe(false)
    expect(s().toasts[0].paused).toBe(true)
  })

  it('resume continues from the remaining time', () => {
    const id = s().push({ variant: 'info', content: 'x', durationMs: 1000 })
    vi.advanceTimersByTime(400)
    s().pause(id)
    vi.advanceTimersByTime(5000)             // arbitrary wait while paused
    s().resume(id)
    // 599ms more should still be visible (600ms remaining at pause)
    vi.advanceTimersByTime(599)
    expect(s().toasts[0].exiting).toBe(false)
    // One more tick → exit
    vi.advanceTimersByTime(1)
    expect(s().toasts[0].exiting).toBe(true)
  })

  it('pause during exiting freezes the fadeout removal', () => {
    const id = s().push({ variant: 'info', content: 'x', durationMs: 200 })
    vi.advanceTimersByTime(200)              // → exiting
    expect(s().toasts[0].exiting).toBe(true)

    vi.advanceTimersByTime(100)              // partway through fadeout
    s().pause(id)
    // Without pause, 200ms more would remove. With pause, no removal.
    vi.advanceTimersByTime(10_000)
    expect(s().toasts).toHaveLength(1)
    expect(s().toasts[0].paused).toBe(true)
  })

  it('resume after exiting-phase pause completes the fadeout removal', () => {
    const id = s().push({ variant: 'info', content: 'x', durationMs: 200 })
    vi.advanceTimersByTime(200)
    vi.advanceTimersByTime(100)              // 100ms into 300ms fadeout
    s().pause(id)
    vi.advanceTimersByTime(5000)             // arbitrary wait
    s().resume(id)
    // 199ms remaining of fadeout
    vi.advanceTimersByTime(199)
    expect(s().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(s().toasts).toHaveLength(0)
  })

  it('pause is a no-op for an unknown id', () => {
    s().push({ variant: 'info', content: 'x' })
    expect(() => s().pause('nonexistent')).not.toThrow()
    expect(s().toasts[0].paused).toBe(false)
  })

  it('resume is a no-op when not paused', () => {
    const id = s().push({ variant: 'info', content: 'x', durationMs: 1000 })
    vi.advanceTimersByTime(200)
    s().resume(id)                            // not paused → no-op
    vi.advanceTimersByTime(800)
    expect(s().toasts[0].exiting).toBe(true)  // normal lifecycle continued
  })

  it('a paused-visible toast that gets superseded transitions to exiting (paused) and resumes correctly', () => {
    const idA = s().push({ variant: 'info', content: 'a', durationMs: 1000 })
    vi.advanceTimersByTime(400)
    s().pause(idA)                            // pause a (visible, 600ms remaining)

    s().push({ variant: 'info', content: 'b' })
    // a should now be marked exiting AND still paused — its fadeout timer
    // is deferred until resume() fires.
    const a = s().toasts.find((t) => t.id === idA)
    expect(a.exiting).toBe(true)
    expect(a.paused).toBe(true)

    // Time advances arbitrarily while paused; a stays put.
    vi.advanceTimersByTime(10_000)
    expect(s().toasts.find((t) => t.id === idA)).toBeTruthy()

    // Resume — fadeout (FADEOUT_MS) starts now.
    s().resume(idA)
    vi.advanceTimersByTime(FADEOUT_MS)
    expect(s().toasts.find((t) => t.id === idA)).toBeUndefined()
  })
})
