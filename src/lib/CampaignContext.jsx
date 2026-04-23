// ============================================================================
// CampaignContext
// ----------------------------------------------------------------------------
// Tracks which campaign is currently "active" (the one whose canvas is being
// edited). Persists the active campaign ID to localStorage so refreshes
// don't bounce the user back to the picker.
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react'

const ACTIVE_KEY = 'mastermind:activeCampaignId'

const CampaignContext = createContext(null)

export function CampaignProvider({ children }) {
  const [activeCampaignId, setActiveCampaignIdState] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) || null
    } catch {
      return null
    }
  })

  // Wrap the setter to also mirror into localStorage.
  const setActiveCampaignId = (id) => {
    setActiveCampaignIdState(id)
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id)
      else localStorage.removeItem(ACTIVE_KEY)
    } catch {
      // localStorage can throw in private mode / quota-exceeded — ignore.
    }
  }

  // When the user signs out of Supabase elsewhere, we want to clear
  // the active campaign on the next mount. (The onAuthStateChange in
  // AuthContext already drives the Login screen; this is defense in depth
  // for refreshes between signed-in sessions.)
  useEffect(() => {
    // No-op right now; kept as the hook-shaped home for future cleanups.
  }, [])

  return (
    <CampaignContext.Provider value={{ activeCampaignId, setActiveCampaignId }}>
      {children}
    </CampaignContext.Provider>
  )
}

export function useCampaign() {
  const ctx = useContext(CampaignContext)
  if (!ctx) {
    throw new Error('useCampaign must be used inside <CampaignProvider>')
  }
  return ctx
}
