// ============================================================================
// LockOverlay
// ----------------------------------------------------------------------------
// Full-screen soft modal that prevents further editing when the app is in a
// state where writes can't be trusted. Two triggers: being offline, or 3+
// consecutive persistence failures.
//
// The canvas remains visible at reduced opacity behind the modal so the user
// keeps their spatial context. Offline state auto-dismisses when online +
// probe succeeds; failure state offers a Refresh action since retrying the
// original edits isn't safe (see ADR candidate: probe-vs-requeue).
// ============================================================================

import { useSyncStore, selectLocked } from '../store/useSyncStore.js'

export default function LockOverlay() {
  const locked = useSyncStore(selectLocked)
  const isOffline = useSyncStore((s) => s.isOffline)

  if (!locked) return null

  const title = isOffline ? 'Paused' : "Couldn't save your last change"
  const body = isOffline
    ? "You're offline. Editing is paused and will resume automatically when you're back online."
    : "Something's preventing changes from saving. We're retrying in the background. If you need to get back to editing now, refresh the page — recent unsaved changes may be lost."

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 pointer-events-auto" />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 pointer-events-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">{body}</p>
        {!isOffline && (
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 px-4 bg-sky-600 text-white rounded hover:bg-sky-700 text-sm font-medium"
          >
            Refresh now
          </button>
        )}
      </div>
    </div>
  )
}
