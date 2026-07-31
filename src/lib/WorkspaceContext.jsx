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
import { useAuth } from './AuthContext.jsx'
import { getWorkspace, touchWorkspaceOpened } from './workspaces.js'

const WORKSPACE_PARAM = 'w'

// Upper bound on the leave-workspace snapshot capture. If the capture hasn't
// finished within this window, we navigate anyway so a slow/hung capture can
// never trap the user on the "Saving changes…" spinner.
const LEAVE_CAPTURE_TIMEOUT_MS = 10000

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
// to wherever the user came from — e.g. the picker. `replace: true` swaps the
// CURRENT history entry instead — used by invalid-workspace recovery so Back
// can never return to a dead `?w=` URL and loop.
function writeWorkspaceToUrl(id, { replace = false } = {}) {
  try {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set(WORKSPACE_PARAM, id)
    else url.searchParams.delete(WORKSPACE_PARAM)
    if (url.href !== window.location.href) {
      if (replace) window.history.replaceState(null, '', url.toString())
      else window.history.pushState(null, '', url.toString())
    }
  } catch {
    // URL/history can throw in exotic environments — non-fatal; state still set.
  }
}

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const { session, loading: authLoading } = useAuth()
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => readWorkspaceFromUrl())
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  // One-shot user-facing notice set by invalid-workspace recovery; the picker
  // renders it. Cleared whenever a workspace is activated.
  const [workspaceNotice, setWorkspaceNotice] = useState(null)

  // One-time cleanup of the abandoned localStorage keys.
  useEffect(() => {
    try { LEGACY_KEYS.forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
  }, [])

  // Public setter: update state AND reflect into the URL so the active
  // workspace is bookmarkable and survives refresh. Signature unchanged, so
  // all existing callers (picker, UserMenu) work as-is.
  const setActiveWorkspaceId = (id) => {
    if (id) setWorkspaceNotice(null)
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

  // Manual dismissal for the recovery notice (the picker's × control). The
  // notice ALSO self-clears when any workspace is activated — the next
  // meaningful action is the natural end of its relevance.
  const clearWorkspaceNotice = useCallback(() => setWorkspaceNotice(null), [])

  const leaveWorkspace = useCallback(async (nextId = null) => {
    const current = activeIdRef.current
    const handler = beforeLeaveRef.current
    if (current && current !== nextId && handler) {
      setLeaving(true)
      // The handler captures + uploads a canvas snapshot. It must NEVER trap the
      // user on the spinner: if it errors OR hangs (e.g. a stuck image render),
      // we navigate anyway. Its own .catch keeps a late rejection from going
      // unhandled while it finishes in the background.
      const handlerDone = Promise.resolve()
        .then(() => handler(current))
        .catch((err) => console.error('beforeLeave handler failed', err))
      const timeout = new Promise((resolve) => setTimeout(resolve, LEAVE_CAPTURE_TIMEOUT_MS))
      try {
        await Promise.race([handlerDone, timeout])
      } finally {
        setLeaving(false)
      }
    }
    if (nextId) setWorkspaceNotice(null)
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

  // Record "opened" once per workspace activation. Opening a workspace counts
  // as activity for the "Recently active" ordering (picker + switcher), so the
  // one you just opened leads even before you edit anything. The ref guards
  // against duplicate writes from re-renders, same-value state churn, and the
  // dev StrictMode double-invoke — only a genuine id change records an open.
  const lastOpenRecordedRef = useRef(null)
  useEffect(() => {
    if (!activeWorkspaceId) return
    if (lastOpenRecordedRef.current === activeWorkspaceId) return
    lastOpenRecordedRef.current = activeWorkspaceId
    touchWorkspaceOpened(activeWorkspaceId).catch((err) =>
      console.error('Failed to record workspace open', err))
  }, [activeWorkspaceId])

  // Fetch the active workspace row whenever the id changes — and RECOVER
  // from an unavailable one (bug-2 fix, 2026-07-31). getWorkspace uses
  // .maybeSingle(), so the three outcomes are cleanly distinguishable:
  //   row     → workspace is real and visible to this user
  //   null    → DEFINITIVELY unavailable to this user (deleted, or access
  //             lost — RLS filters both the same way, which is why the
  //             notice says "no longer available", never "deleted")
  //   throws  → transient fetch/network failure → keep today's behavior; a
  //             flaky connection must never eject the user from a real
  //             workspace.
  // Recovery on null: clear the id (Root falls back to the picker), REPLACE
  // the dead `?w=` URL in history so Back can't loop into it, and set a
  // one-shot notice the picker renders. GATED on a settled, signed-in
  // session: pre-auth, RLS returns null for EVERY workspace, and a deep
  // link to `?w=<id>` must survive the sign-in round-trip (documented
  // behavior) — so without a session we don't fetch or interpret at all.
  // KNOWN LIMITATION (documented, unresolved): this covers ENTERING or
  // RELOADING an unavailable workspace. A tab whose canvas is already open
  // when the workspace is deleted elsewhere gets no live signal (the
  // workspaces table isn't in the Realtime publication) and discovers via
  // failing writes.
  useEffect(() => {
    let cancelled = false
    if (!activeWorkspaceId) {
      setActiveWorkspace(null)
      return
    }
    if (authLoading || !session) return
    getWorkspace(activeWorkspaceId)
      .then((row) => {
        if (cancelled) return
        if (row) {
          setActiveWorkspace(row)
          return
        }
        setActiveWorkspace(null)
        // Wording (Erik, 2026-07-31): acknowledges what the user was TRYING
        // to do (dominant path: browser Back after a delete) without being
        // Back-specific — reload, bookmark, and deep link all read naturally.
        // Never says "deleted" (RLS can't distinguish deletion from lost
        // access), and explains the recovery the app performed.
        setWorkspaceNotice(
          'The workspace you were trying to reach is no longer available, so we’ve returned you to your library.',
        )
        setActiveWorkspaceIdState(null)
        writeWorkspaceToUrl(null, { replace: true })
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load active workspace', err)
          setActiveWorkspace(null)
        }
      })
    return () => { cancelled = true }
  }, [activeWorkspaceId, session, authLoading])

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspaceId,
        activeWorkspace,
        setActiveWorkspaceId,
        leaveWorkspace,
        registerBeforeLeave,
        workspaceNotice,
        clearWorkspaceNotice,
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
