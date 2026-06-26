// ============================================================================
// Beta config — reads the single launch-switch row (public.beta_config).
// ----------------------------------------------------------------------------
// The login screen calls isBetaOpen() before the visitor has a session, so
// this read runs as the anon role. The table's RLS allows anon SELECT.
//
// FAIL-SAFE (ADR-0017 / decided 2026-06-26): if the read fails for any reason
// (network blip, RLS surprise, missing row), default to OPEN — overshooting
// the soft cap by a few is acceptable; blocking a real signup is worse.
//
// The seat cap is enforced server-side by the handle_new_user trigger
// (migration 014), which auto-flips beta_open off once the profile count
// reaches seat_limit. The client only READS the flag to choose which form to
// show; it never writes it.
// ============================================================================

import { supabase } from './supabase.js'

// Returns true if signups are open, false if the beta is closed (show the
// waitlist). Defaults to true on any error — see FAIL-SAFE above.
export async function isBetaOpen() {
  try {
    const { data, error } = await supabase
      .from('beta_config')
      .select('beta_open')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    // Missing row → treat as open (the migration seeds it, but be defensive).
    if (!data) return true
    return data.beta_open === true
  } catch (err) {
    console.warn('[betaConfig] isBetaOpen read failed; defaulting to OPEN', err)
    return true
  }
}
