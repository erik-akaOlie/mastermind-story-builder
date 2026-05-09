// ============================================================================
// ProfileContext
// ----------------------------------------------------------------------------
// Single source of truth for the signed-in user's public.profiles row.
// Loaded once when auth state changes; consumers (Profile page, UserAvatar,
// future display-name surfaces) subscribe via useProfile() and stay in sync
// with optimistic updates.
//
// Why a context instead of per-component fetches: when the Profile page
// updates the avatar, the UserAvatar chip in the top-left needs to reflect
// the change immediately — without a shared store, it would render stale
// initials until the next page load.
//
// Mirrors the existing AuthProvider / CampaignProvider patterns.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getProfile } from './profile.js'
import { useAuth } from './AuthContext.jsx'

const ProfileContext = createContext(null)

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>')
  return ctx
}

export function ProfileProvider({ children }) {
  const { user } = useAuth()

  // profile: { id, avatar_path, display_name, ... } or null when no row
  // has been loaded yet (or when the user signs out).
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Reload whenever the signed-in user changes (sign-in, account switch,
  // or sign-out clears it).
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getProfile()
      .then((p) => {
        if (cancelled) return
        setProfile(p)
        setLoading(false)
      })
      .catch((err) => {
        console.error('ProfileProvider: load failed', err)
        if (cancelled) return
        setError(err)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [user?.id])

  // Optimistic patch — for callers that have already written to the DB
  // and just need the local cache to reflect the change.
  const updateProfile = useCallback((patch) => {
    setProfile((p) => (p ? { ...p, ...patch } : p))
  }, [])

  // Force a re-fetch from the DB. Useful after an out-of-band change
  // (e.g. Realtime sync) — not currently wired but available for callers.
  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const next = await getProfile()
      setProfile(next)
      setError(null)
    } catch (err) {
      console.error('ProfileProvider: refresh failed', err)
      setError(err)
    }
  }, [user?.id])

  const value = { profile, loading, error, updateProfile, refresh }

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  )
}
