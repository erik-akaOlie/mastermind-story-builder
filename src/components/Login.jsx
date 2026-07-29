// ============================================================================
// Login / Sign-up / Waitlist screen
// ----------------------------------------------------------------------------
// Three modes:
//   - signin   : email + password (always available, even when the beta is full)
//   - signup   : create an account — shown when the beta is OPEN
//   - waitlist : leave email + how-heard — shown instead of signup when the
//                beta is CLOSED (seat cap reached)
//
// Which of signup/waitlist a new visitor lands on is driven by beta_config
// (read via isBetaOpen). FAIL-SAFE: if that read fails, we default to OPEN
// (show signup) — overshooting the soft cap is acceptable; blocking a real
// signup is worse. See ADR-0017 and lib/betaConfig.js.
//
// Signup collects, beyond email+password:
//   - display name (required) — stored in profiles via the handle_new_user
//     trigger (migration 014), so PostHog/Supabase show real people not UUIDs
//   - how-heard (optional) — attribution
//   - a plain-English session-recording notice (in-flow disclosure per
//     ADR-0017 §2) + the beta promise, above the single Terms/Privacy checkbox
//
// Uses the system CTA color (#0284C7 / sky-600) per CLAUDE.md conventions.
// ============================================================================

import { useEffect, useState } from 'react'
import { SignIn, UserPlus, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import { isBetaOpen } from '../lib/betaConfig.js'
import { joinWaitlist } from '../lib/waitlist.js'
import { HOW_HEARD_OPTIONS, HOW_HEARD_OTHER } from '../lib/howHeardOptions.js'
import PasswordInput from './PasswordInput.jsx'

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent'
const LABEL_CLASS = 'block text-xs font-medium text-gray-700 mb-1'

export default function Login() {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState('signin')   // 'signin' | 'signup' | 'waitlist'
  const [betaOpen, setBetaOpen] = useState(true) // fail-safe default: open
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [howHeard, setHowHeard] = useState('')
  const [howHeardOther, setHowHeardOther] = useState('')
  const [agreed, setAgreed] = useState(false)  // signup-only; ToS + PP acknowledgement
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [waitlisted, setWaitlisted] = useState(false)
  const [signedUp, setSignedUp] = useState(false)  // signup succeeded; email confirmation pending
  const [submitting, setSubmitting] = useState(false)

  // Read the launch switch once on mount. Stays true (the fail-safe default)
  // if the read fails. Drives which form the "Create one" toggle opens.
  useEffect(() => {
    let cancelled = false
    isBetaOpen().then((open) => {
      if (!cancelled) setBetaOpen(open)
    })
    return () => { cancelled = true }
  }, [])

  function clearMessages() {
    setError(null)
    setInfo(null)
  }

  // Resolve the how-heard value for storage. For the signup path we collapse
  // "Other" + free text into a single string so PostHog/profiles carry the
  // real answer (the waitlist keeps them in separate columns for analysis).
  function resolveHowHeard() {
    if (!howHeard) return null
    if (howHeard === HOW_HEARD_OTHER) return howHeardOther.trim() || HOW_HEARD_OTHER
    return howHeard
  }

  async function handleSignin(e) {
    e.preventDefault()
    clearMessages()
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError(error.message)
    // On success, AuthContext's onAuthStateChange swaps the UI.
  }

  async function handleSignup(e) {
    e.preventDefault()
    clearMessages()

    // Defensive: the submit button is disabled when these fail, but a
    // determined keyboard user can submit anyway.
    if (!displayName.trim()) {
      setError('Please enter a display name.')
      return
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    setSubmitting(true)
    // The metadata bag rides supabase.auth.signUp → handle_new_user trigger
    // (migration 014) so display_name + how_heard + terms land in the same
    // transaction as the auth.users row.
    const { data, error } = await signUp(email, password, {
      data: {
        terms_accepted_at: new Date().toISOString(),
        display_name: displayName.trim(),
        how_heard: resolveHowHeard() ?? '',
      },
    })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    // Supabase requires email confirmation by default: a null session after
    // signUp means the user must confirm via email first. Replace the form
    // with a success panel (same pattern as the waitlist) — the old inline
    // gray banner mid-form was easy to miss (iPhone QA Finding E).
    if (!data.session) {
      setSignedUp(true)
    }
  }

  async function handleWaitlist(e) {
    e.preventDefault()
    clearMessages()

    if (!howHeard) {
      setError('Please tell us how you heard about MasterMind.')
      return
    }

    setSubmitting(true)
    const { error } = await joinWaitlist({ email, howHeard, howHeardOther })
    setSubmitting(false)

    if (error) {
      setError(error)
      return
    }
    setWaitlisted(true)
  }

  function goTo(nextMode) {
    setMode(nextMode)
    clearMessages()
    // Leaving the signup success panel (e.g. to sign in) resets it, so
    // returning to signup later shows the form, not a stale confirmation.
    setSignedUp(false)
  }

  const subtitle =
    mode === 'signin' ? 'Sign in to your story builder.'
    : mode === 'signup' ? 'Create your account.'
    : 'Join the waitlist.'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 border border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">MasterMind</h1>
        <p className="text-sm text-gray-500 mb-6">{subtitle}</p>

        {/* ---------------------------------------------------------------- */}
        {/* SIGN IN                                                          */}
        {/* ---------------------------------------------------------------- */}
        {mode === 'signin' && (
          <form onSubmit={handleSignin} className="space-y-4">
            <div>
              <label className={LABEL_CLASS}>Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Password</label>
              <PasswordInput
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Messages error={error} info={info} />

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SignIn size={16} weight="bold" />
              Sign in
            </button>
          </form>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* SIGN UP                                                          */}
        {/* ---------------------------------------------------------------- */}
        {/* The primary action after signup happens OUTSIDE the app (open the
            confirmation email; its link returns the user to MasterMind), so
            the panel has no primary button — the mode toggle below becomes
            "Back to sign in" as the escape hatch for users who confirmed in
            another tab/app and come back here. */}
        {/* Layout per Figma node 223-102 (2026-07-09): three scannable
            sections at 16px inside the green panel, 14px supporting text
            below, link in the interactive blue. */}
        {mode === 'signup' && signedUp && (
          <div className="space-y-6">
            <div className="flex items-start gap-1 bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle size={16} weight="fill" className="flex-shrink-0 mt-0.5 text-green-600" />
              <div className="space-y-4 text-base text-gray-600">
                <p className="font-bold">Check your email.</p>
                <p>
                  We sent a confirmation link to:
                  <br />
                  <span className="font-bold">{email}</span>
                </p>
                <p>
                  Open the email and click the link to finish setting up your
                  account and sign in.
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              After confirming, the link will bring you back to MasterMind. If you
              return here later, you can sign in normally.
            </p>
          </div>
        )}

        {mode === 'signup' && !signedUp && (
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Beta promise (ADR-0017 §6) */}
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 leading-relaxed">
              MasterMind is free during early-access beta because users are helping
              shape the product through real usage, feedback, and session
              recordings. Pricing may change later, but you own the story material
              you create. If paid plans are introduced, beta users will get advance
              notice and a clear way to keep access to or export their work.
            </p>

            <div>
              <label className={LABEL_CLASS}>Display name</label>
              <input
                type="text"
                autoComplete="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Password</label>
              <PasswordInput
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <HowHeardField
              optional
              value={howHeard}
              onChange={setHowHeard}
              otherValue={howHeardOther}
              onOtherChange={setHowHeardOther}
            />

            {/* In-flow session-recording notice (ADR-0017 §2) */}
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 leading-relaxed">
              To keep improving MasterMind, we record in-app sessions to understand
              how people use the tool, where they get stuck, and what should improve
              next. Recordings may include campaign text you type and may be tied to
              your account/email. They are never sold or used for advertising, and
              are only used by the MasterMind team and trusted services that help run
              and improve the product. Recordings are deleted after 30 days.
              Session data is collected through MasterMind&rsquo;s own servers,
              so recording works even if you use an ad-blocker.
            </p>

            {/* Single Terms + Privacy checkbox (ADR-0017 §2) */}
            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-600 cursor-pointer"
              />
              <span className="leading-relaxed">
                I agree to the{' '}
                <a href="/#terms" target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:text-sky-900 underline">
                  Terms of Service
                </a>
                {' '}and{' '}
                <a href="/#privacy" target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:text-sky-900 underline">
                  Privacy Policy
                </a>
                .
              </span>
            </label>

            <Messages error={error} info={info} />

            <button
              type="submit"
              disabled={submitting || !agreed || !displayName.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <UserPlus size={16} weight="bold" />
              Create account
            </button>
          </form>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* WAITLIST                                                         */}
        {/* ---------------------------------------------------------------- */}
        {mode === 'waitlist' && (
          waitlisted ? (
            <div className="flex items-start gap-2 text-sm text-gray-700 bg-green-50 border border-green-200 rounded-md px-3 py-3">
              <CheckCircle size={18} weight="fill" className="flex-shrink-0 mt-px text-green-600" />
              <span>You're on the list. We'll email you when a seat opens up.</span>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="space-y-4">
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 leading-relaxed">
                The beta is currently full. Leave your email and we'll let you know
                when a seat opens up.
              </p>

              <div>
                <label className={LABEL_CLASS}>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <HowHeardField
                value={howHeard}
                onChange={setHowHeard}
                otherValue={howHeardOther}
                onOtherChange={setHowHeardOther}
              />

              <Messages error={error} info={info} />

              <button
                type="submit"
                disabled={submitting || !howHeard}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Join waitlist
              </button>
            </form>
          )
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MODE TOGGLE                                                      */}
        {/* ---------------------------------------------------------------- */}
        <button
          type="button"
          onClick={() =>
            mode === 'signin'
              ? goTo(betaOpen ? 'signup' : 'waitlist')
              : goTo('signin')
          }
          className={
            mode === 'signup' && signedUp
              ? // Post-signup it's a real text link (Figma 223-102): the
                // interactive blue + underline, sized with the 14px footer.
                'mt-2 w-full text-sm text-sky-600 hover:text-sky-800 underline'
              : 'mt-4 w-full text-xs text-gray-500 hover:text-gray-700'
          }
        >
          {mode === 'signin'
            ? "Don't have an account? Create one"
            : signedUp
              ? 'Back to sign in'
              : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// How-heard dropdown + conditional "Other" free-text. Shared by signup
// (optional) and waitlist (required).
// ----------------------------------------------------------------------------
function HowHeardField({ value, onChange, otherValue, onOtherChange, optional = false }) {
  return (
    <div>
      <label className={LABEL_CLASS}>
        How did you hear about MasterMind?{optional && <span className="text-gray-400"> (optional)</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={!optional}
        className={INPUT_CLASS + ' bg-white'}
      >
        <option value="" disabled>Select one…</option>
        {HOW_HEARD_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {value === HOW_HEARD_OTHER && (
        <input
          type="text"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Tell us where"
          className={INPUT_CLASS + ' mt-2'}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Inline error / info banners (shared across all three modes).
// ----------------------------------------------------------------------------
function Messages({ error, info }) {
  return (
    <>
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <WarningCircle size={16} weight="fill" className="flex-shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          {info}
        </div>
      )}
    </>
  )
}
