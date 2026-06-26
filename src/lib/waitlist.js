// ============================================================================
// Waitlist — overflow signups when the beta is closed (public.waitlist).
// ----------------------------------------------------------------------------
// Runs as the anon role (the visitor has no session). The table's RLS allows
// anon INSERT only — no read-back — so this returns nothing on success and
// surfaces a friendly error on failure.
//
// Guards live in the DB (migration 014): unique email (dedupe), an email
// format CHECK, and NOT NULL how_heard. We translate the two user-facing
// failure modes (duplicate, bad format) into plain-English messages; anything
// else falls back to a generic message.
// ============================================================================

import { supabase } from './supabase.js'

// Joins the waitlist. Returns { error: string | null }.
//   email      — required
//   howHeard   — required (the dropdown value)
//   howHeardOther — only meaningful when howHeard === 'Other'
export async function joinWaitlist({ email, howHeard, howHeardOther }) {
  const trimmedEmail = (email ?? '').trim().toLowerCase()
  const other = (howHeardOther ?? '').trim() || null

  if (!trimmedEmail) return { error: 'Please enter your email.' }
  if (!howHeard) return { error: 'Please tell us how you heard about MasterMind.' }

  const { error } = await supabase.from('waitlist').insert({
    email: trimmedEmail,
    how_heard: howHeard,
    how_heard_other: other,
  })

  if (error) {
    // 23505 = unique_violation (email already on the list).
    if (error.code === '23505') {
      return { error: "You're already on the waitlist — we'll be in touch." }
    }
    // 23514 = check_violation (email failed the format CHECK).
    if (error.code === '23514') {
      return { error: 'That email address doesn’t look right. Please check it.' }
    }
    console.warn('[waitlist] join failed', error)
    return { error: 'Something went wrong. Please try again in a moment.' }
  }

  return { error: null }
}
