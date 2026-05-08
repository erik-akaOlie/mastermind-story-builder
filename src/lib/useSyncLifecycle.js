// ============================================================================
// Sync Lifecycle Hooks
// ----------------------------------------------------------------------------
// Two hooks that keep useSyncStore in sync with the outside world:
//
//   useOnlineListener()  — mirrors navigator.onLine into the store so the
//                          offline state drives the lock immediately.
//
//   useProbeLoop()       — while locked (due to failures or offline), fires
//                          a lightweight read every 3s. A successful probe
//                          resets consecutiveFailures to 0, which unlocks
//                          the UI automatically.
//
// Both hooks are no-ops when nothing relevant changes. Mount once at the top
// of the tree (see main.jsx / App.jsx).
// ============================================================================

import { useEffect } from 'react'
import { supabase } from './supabase.js'
import { useSyncStore, selectLocked } from '../store/useSyncStore.js'

const PROBE_INTERVAL_MS = 3000

export function useOnlineListener() {
  useEffect(() => {
    const goOnline = () => useSyncStore.getState().setOffline(false)
    const goOffline = () => useSyncStore.getState().setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    useSyncStore.getState().setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
}

export function useProbeLoop() {
  const locked = useSyncStore(selectLocked)

  useEffect(() => {
    if (!locked) return

    let cancelled = false
    async function probe() {
      if (cancelled) return
      const { error } = await supabase.from('campaigns').select('id').limit(1)
      if (cancelled) return
      if (!error) {
        // Probe succeeded — pretend a real write just landed so the store
        // resets failures and clears lastError cleanly.
        useSyncStore.setState({
          consecutiveFailures: 0,
          lastError: null,
          lastSavedAt: new Date(),
        })
      }
    }

    probe()
    const id = setInterval(probe, PROBE_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [locked])
}
