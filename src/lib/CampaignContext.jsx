// ============================================================================
// CampaignContext
// ----------------------------------------------------------------------------
// Tracks which campaign is currently "active" (the one whose canvas is being
// edited). Persists the active campaign ID to localStorage so refreshes
// don't bounce the user back to the picker.
//
// Also fetches the active campaign's row when the id changes, so the rest of
// the UI can reach for data.name without re-querying Supabase.
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react'
import { getCampaign } from './campaigns.js'

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

  const [activeCampaign, setActiveCampaign] = useState(null)

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

  // Fetch the active campaign row whenever the id changes.
  useEffect(() => {
    let cancelled = false
    if (!activeCampaignId) {
      setActiveCampaign(null)
      return
    }
    getCampaign(activeCampaignId)
      .then((row) => { if (!cancelled) setActiveCampaign(row) })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load active campaign', err)
          setActiveCampaign(null)
        }
      })
    return () => { cancelled = true }
  }, [activeCampaignId])

  return (
    <CampaignContext.Provider value={{ activeCampaignId, activeCampaign, setActiveCampaignId }}>
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
