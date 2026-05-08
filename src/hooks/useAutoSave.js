// ============================================================================
// useAutoSave
// ----------------------------------------------------------------------------
// Debounced auto-save with explicit flush.
//
// Pattern: a `doSave` callback reads from the latest state via closure each
// render. The hook schedules `doSave()` to run `delay` ms after `deps` change,
// canceling and rescheduling on subsequent changes. The returned `flush`
// function calls `doSave()` synchronously — useful for forcing a save on
// modal close, before navigation, etc.
//
// `doSave` is stored in a ref so the timer always calls the latest closure
// (with the latest state) — even if the timer was scheduled in a prior render.
// ============================================================================

import { useEffect, useRef, useCallback } from 'react'

export function useAutoSave({ doSave, deps, delay = 400 }) {
  const doSaveRef = useRef(null)
  doSaveRef.current = doSave

  useEffect(() => {
    const timer = setTimeout(() => doSaveRef.current?.(), delay)
    return () => clearTimeout(timer)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback(() => {
    doSaveRef.current?.()
  }, [])
}
