// ============================================================================
// Sync Store
// ----------------------------------------------------------------------------
// Tracks the app's persistence health. Feeds the ambient "Edited just now"
// indicator and drives the lock overlay when writes fail systemically.
//
// Failure model:
//   - Each mutation is retried up to 3 times internally (see persistWrite in
//     src/lib/errorReporting.js). On the 3rd failure, consecutiveFailures
//     reaches 3 and the app locks.
//   - Going offline (navigator.onLine === false) also locks immediately.
//   - Any successful write (including a successful probe) resets
//     consecutiveFailures to 0 and unlocks.
// ============================================================================

import { create } from 'zustand'

export const useSyncStore = create((set) => ({
  inFlight: 0,
  lastSavedAt: null,                // Date of the most recent successful write
  lastError: null,                  // { error, context } of the most recent failure
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  consecutiveFailures: 0,

  startWrite: () =>
    set((s) => ({ inFlight: s.inFlight + 1 })),

  writeSucceeded: () =>
    set((s) => ({
      inFlight: Math.max(0, s.inFlight - 1),
      lastSavedAt: new Date(),
      consecutiveFailures: 0,
      lastError: null,
    })),

  writeFailed: (error, context) =>
    set((s) => ({
      inFlight: Math.max(0, s.inFlight - 1),
      lastError: { error, context },
      consecutiveFailures: s.consecutiveFailures + 1,
    })),

  setOffline: (offline) => set({ isOffline: offline }),
}))

// Lock is a derivation, not raw state — computed from isOffline + failure count.
// Use this as a selector: useSyncStore(selectLocked).
export const selectLocked = (s) => s.isOffline || s.consecutiveFailures >= 3
