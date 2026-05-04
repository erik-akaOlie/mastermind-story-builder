// ============================================================================
// AuthContext
// ----------------------------------------------------------------------------
// Wraps the Supabase auth state in a React Context so any component can
// - read the current session / user
// - call signIn / signUp / signOut
// - know when auth state has initialized (to avoid flashing the login screen
//   before the stored session is hydrated on first load)
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { useUndoStore } from '../store/useUndoStore.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Hydrate from any stored session when the app first mounts.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // 2. Subscribe to future auth state changes (sign in, sign out, refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp: (email, password) =>
      supabase.auth.signUp({ email, password }),
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signOut: () => {
      // Per ADR-0006 §3 (sign-out cleanup): wipe the in-memory undo stack
      // AND every sessionStorage entry under the signing-out user's prefix
      // BEFORE Supabase clears the session, so a different user signing in
      // next on this tab can't inherit the prior user's history. Capture
      // the userId here while it's still available.
      useUndoStore.getState().clearAllForUser(session?.user?.id)
      return supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
