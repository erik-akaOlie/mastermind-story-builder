// ============================================================================
// AnalyticsBootstrap
// ----------------------------------------------------------------------------
// One-shot effect that fires initAnalytics(profile) when the signed-in
// user's profile loads. Lives as a sibling component (not inside
// ProfileContext) so the analytics module stays decoupled from the
// context layer — easy to swap out, easy to remove later if the research
// stage ends.
//
// Renders nothing. Mounted inside <ProfileProvider> in main.jsx.
//
// Why an effect tied to profile.id + profile.is_test_user:
//   - Effect re-fires if Erik flips his own is_test_user from false to
//     true mid-session (after refresh — ProfileContext re-fetches on
//     auth changes; not on Supabase column updates from another tab).
//   - initAnalytics is itself idempotent: bails if already started.
// ============================================================================

import { useEffect } from 'react'
import { useProfile } from '../lib/ProfileContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { initAnalytics } from '../lib/analytics.js'

export default function AnalyticsBootstrap() {
  const { profile } = useProfile()
  const { user } = useAuth()

  useEffect(() => {
    if (!profile) return
    // Pass the auth email alongside the profile so PostHog identify() can
    // attach it as a person property (email lives on auth.users, not the
    // profile row). See ADR-0017 "beta user identification".
    initAnalytics(profile, user?.email)
  }, [profile?.id, profile?.is_test_user, user?.email])

  return null
}
