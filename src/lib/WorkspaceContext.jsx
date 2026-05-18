// ============================================================================
// WorkspaceContext
// ----------------------------------------------------------------------------
// Tracks which workspace is currently "active" (the one whose canvas is being
// edited). Persists the active workspace ID to localStorage so refreshes
// don't bounce the user back to the picker.
//
// Also fetches the active workspace's row when the id changes, so the rest
// of the UI can reach for data.name without re-querying Supabase.
//
// "Workspace" replaces the prior "campaign" terminology (see ADR-0012);
// the localStorage key still uses the old name until commit 4/6 in the
// rename series swaps it with a backwards-compatibility shim.
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react'
import { getWorkspace } from './workspaces.js'

const ACTIVE_KEY = 'mastermind:activeCampaignId'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) || null
    } catch {
      return null
    }
  })

  const [activeWorkspace, setActiveWorkspace] = useState(null)

  // Wrap the setter to also mirror into localStorage.
  const setActiveWorkspaceId = (id) => {
    setActiveWorkspaceIdState(id)
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id)
      else localStorage.removeItem(ACTIVE_KEY)
    } catch {
      // localStorage can throw in private mode / quota-exceeded — ignore.
    }
  }

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
    <WorkspaceContext.Provider value={{ activeWorkspaceId, activeWorkspace, setActiveWorkspaceId }}>
      {children}
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
