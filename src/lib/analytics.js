// ============================================================================
// Analytics — PostHog session replay + named events, scoped to invited testers.
// ----------------------------------------------------------------------------
// See ADR-0009 for the full decision. This module enforces three safety
// guards so non-tester users never feel analytics in any way:
//
//   1. Conditional load — posthog-js is only imported when the signed-in
//      user has is_test_user=true on public.profiles. Non-testers download
//      zero PostHog code (Vite splits the dynamic import into its own
//      chunk that is never requested).
//   2. Try/catch on every public function — a bug or hiccup in PostHog
//      cannot crash the host app. Errors are logged to the dev console;
//      user-visible flows are unaffected.
//   3. Early bail — track() and resetAnalytics() return immediately if
//      init never happened. No queued events, no memory accumulation.
//
// Password protection (per ADR-0009):
//   - The sign-in screen is rendered before initAnalytics can run (no
//     profile yet), so the login form is never captured.
//   - PostHog's default config auto-masks any <input type="password">.
//   - PasswordInput.jsx flips between type=password and type=text when
//     the user toggles visibility, so we ALSO mask anything carrying the
//     .ph-mask class. Belt-and-suspenders.
//
// This module holds posthog at module scope. Two long-running invariants:
//   - posthog === null means analytics is dormant (no session, no events).
//   - posthog !== null means a session is active for the current user;
//     resetAnalytics() must be called on sign-out to close it.
// ============================================================================

let posthog = null
let initStarted = false

// ----------------------------------------------------------------------------
// Initialize analytics for the signed-in user, IF they're flagged as a tester.
// Safe to call repeatedly — bails immediately if already initialized or if
// the user isn't a tester. Designed to be called from a React effect on
// profile load.
// ----------------------------------------------------------------------------
export async function initAnalytics(profile, email) {
  if (initStarted) return
  if (profile?.is_test_user !== true) return

  const key = import.meta.env.VITE_POSTHOG_KEY
  const host = import.meta.env.VITE_POSTHOG_HOST
  if (!key) {
    console.warn('[analytics] VITE_POSTHOG_KEY not set; analytics disabled')
    return
  }

  // Set the flag BEFORE awaiting the dynamic import so a second concurrent
  // call (e.g. React StrictMode double-invoking the effect in dev) doesn't
  // double-init.
  initStarted = true

  try {
    const mod = await import('posthog-js')
    const ph = mod.default

    ph.init(key, {
      api_host: host || 'https://us.i.posthog.com',
      // Autocapture gives us rage-click detection without per-event wiring.
      autocapture: true,
      // No routes in this SPA — pageviews/leaves are meaningless.
      capture_pageview: false,
      capture_pageleave: false,
      session_recording: {
        // Everything visible in the canvas IS the research data — see ADR-0009.
        maskAllInputs: false,
        // ...except passwords, which PostHog auto-masks by input type.
        maskInputOptions: { password: true },
        // Belt-and-suspenders for the PasswordInput show/hide toggle: any
        // element carrying .ph-mask has its input value AND text masked,
        // regardless of input type.
        maskInputFn: (text, element) =>
          element?.classList?.contains('ph-mask') ? '*'.repeat(text?.length ?? 0) : text,
        maskTextFn: (text, element) =>
          element?.classList?.contains('ph-mask') ? '*'.repeat(text?.length ?? 0) : text,
      },
      // Identify the tester so their replays correlate to live observation
      // sessions. Done in `loaded` so the SDK is fully ready first. We attach
      // email + display_name + how_heard as person properties so the replay
      // list shows real people (known testers like Chris/Todd) instead of raw
      // UUIDs — see ADR-0017 "beta user identification". Undefined props are
      // omitted by PostHog, so pre-trigger users (no display_name) are fine.
      // PRIVACY: sending email/name while recording makes sessions personally
      // identifiable; the in-flow recording notice discloses this (it does not
      // imply anonymity).
      loaded: (instance) => {
        if (profile?.id) {
          try {
            instance.identify(profile.id, {
              email: email || undefined,
              display_name: profile.display_name || undefined,
              how_heard: profile.how_heard || undefined,
            })
          } catch (err) {
            console.warn('[analytics] identify failed:', err)
          }
        }
      },
    })

    posthog = ph
  } catch (err) {
    console.warn('[analytics] init failed:', err)
    // Allow a future retry (e.g. on the next profile reload).
    initStarted = false
  }
}

// ----------------------------------------------------------------------------
// Record a named event. Safe to call from anywhere — silently no-ops if
// analytics is dormant (non-tester user, init still pending, or init failed).
// Wrap the actual capture in try/catch so a malformed event payload can't
// crash whatever feature called us.
// ----------------------------------------------------------------------------
export function track(eventName, props) {
  if (!posthog) return
  try {
    posthog.capture(eventName, props)
  } catch (err) {
    console.warn('[analytics] track failed:', eventName, err)
  }
}

// ----------------------------------------------------------------------------
// Close the current PostHog session and forget the identified user.
// Called on sign-out so a different user signing in on the same browser
// doesn't inherit the previous tester's identity.
// ----------------------------------------------------------------------------
export function resetAnalytics() {
  if (!posthog) return
  try {
    posthog.reset()
  } catch (err) {
    console.warn('[analytics] reset failed:', err)
  }
  posthog = null
  initStarted = false
}
