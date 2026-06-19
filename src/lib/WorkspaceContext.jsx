// ============================================================================
// WorkspaceContext
// ----------------------------------------------------------------------------
// Tracks which workspace is currently "active" (the one whose canvas is being
// edited).
//
// The active workspace is encoded in the URL QUERY STRING as `?w=<id>`. This
// is the single source of truth, which gives us three things for free:
//   - A bare load (no `?w=…`) lands on the picker ("home") instead of
//     auto-reopening the last workspace. (This intentionally drops the prior
//     localStorage auto-reopen behavior — see #1B.)
//   - A bookmark / deep link to `?w=<id>` opens that workspace directly,
//     even across a fresh sign-in.
//   - Refresh and browser back/forward Just Work.
//
// Why the query string and not the hash: the hash is already in use for
// overlay routes (#profile, #migrate, …) in main.jsx. Putting the workspace
// in `?w` keeps the two axes independent, so opening #profile over a workspace
// doesn't drop the workspace from the URL. `/?w=<id>#profile` composes cleanly.
//
// Also fetches the active workspace's row when the id changes, so the rest
// of the UI can reach for data.name without re-querying Supabase.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getWorkspace } from './workspaces.js'

const WORKSPACE_PARAM = 'w'

// Abandoned localStorage keys from the prior persist-and-auto-reopen model.
// Cleared once on mount so they don't linger; nothing reads them anymore.
const LEGACY_KEYS = ['mastermind:activeWorkspaceId', 'mastermind:activeCampaignId']

function readWorkspaceFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get(WORKSPACE_PARAM) || null
  } catch {
    return null
  }
}

// Reflect the active id into `?w=…` while preserving the hash (overlay routes)
// and any other query params. pushState (not replace) so browser back returns
// to wherever the user came from — e.g. the picker.
function writeWorkspaceToUrl(id) {
  try {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set(WORKSPACE_PARAM, id)
    else url.searchParams.delete(WORKSPACE_PARAM)
    if (url.href !== window.location.href) {
      window.history.pushState(null, '', url.toString())
    }
  } catch {
    // URL/history can throw in exotic environments — non-fatal; state still set.
  }
}

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => readWorkspaceFromUrl())
  const [activeWorkspace, setActiveWorkspace] = useState(null)

  // One-time cleanup of the abandoned localStorage keys.
  useEffect(() => {
    try { LEGACY_KEYS.forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
  }, [])

  // Public setter: update state AND reflect into the URL so the active
  // workspace is bookmarkable and survives refresh. Signature unchanged, so
  // all existing callers (picker, UserMenu) work as-is.
  const setActiveWorkspaceId = (id) => {
    setActiveWorkspaceIdState(id)
    writeWorkspaceToUrl(id)
  }

  // ── Leave-the-workspace hook ──────────────────────────────────────────────
  // A consumer (App) registers a "before leave" handler that captures the
  // canvas snapshot. leaveWorkspace() runs it (behind a blocking spinner, since
  // the capture needs the canvas still mounted) BEFORE switching away. Entering
  // a workspace from the picker still uses setActiveWorkspaceId directly — no
  // snapshot to take on the way in.
  const activeIdRef = useRef(activeWorkspaceId)
  useEffect(() => { activeIdRef.current = activeWorkspaceId }, [activeWorkspaceId])

  const beforeLeaveRef = useRef(null)
  const registerBeforeLeave = useCallback((fn) => {
    beforeLeaveRef.current = fn
    return () => { if (beforeLeaveRef.current === fn) beforeLeaveRef.current = null }
  }, [])

  const [leaving, setLeaving] = useState(false)

  const leaveWorkspace = useCallback(async (nextId = null) => {
    const current = activeIdRef.current
    const handler = beforeLeaveRef.current
    if (current && current !== nextId && handler) {
      setLeaving(true)
      try {
        await handler(current)
      } catch (err) {
        console.error('beforeLeave handler failed', err) // non-fatal: still navigate
      } finally {
        setLeaving(false)
      }
    }
    setActiveWorkspaceIdState(nextId)
    writeWorkspaceToUrl(nextId)
  }, [])

  // React to browser back/forward (popstate fires only for those, not for our
  // own pushState calls). Re-read `?w` and re-sync state on a real change.
  useEffect(() => {
    const onPopState = () => {
      const fromUrl = readWorkspaceFromUrl()
      setActiveWorkspaceIdState((cur) => (cur === fromUrl ? cur : fromUrl))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Fetch the active workspace row whenever the id changes.
  useEffect(() => {
    let cancelled = false
    if (!activeWorkspaceId) {
      setActiveWorkspace(null)
      return
    }
    getWorkspace(activeWorkspaceId)
      .then((row) => { if (!cancelled) setActiveWorkspace(row) })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load active workspace', err)
          setActiveWorkspace(null)
        }
      })
    return () => { cancelled = true }
  }, [activeWorkspaceId])

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspaceId,
        activeWorkspace,
        setActiveWorkspaceId,
        leaveWorkspace,
        registerBeforeLeave,
      }}
    >
      {children}
      {leaving && (
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
          <span className="text-white text-sm font-medium">Saving changes…</span>
        </div>
      )}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  }
  return ctx
}
