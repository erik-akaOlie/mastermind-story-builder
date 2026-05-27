// ============================================================================
// Login / Sign-up screen
// ----------------------------------------------------------------------------
// Minimal email + password auth form. Intentionally un-stylized — Erik will
// want to redesign this with proper branding once the plumbing works.
//
// Uses the system CTA color (#0284C7 / sky-600) per CLAUDE.md conventions.
// Phosphor icons for visual consistency with the rest of the app.
// ============================================================================

import { useState } from 'react'
import { SignIn, UserPlus, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import PasswordInput from './PasswordInput.jsx'

export default function Login() {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState('signin')   // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)  // signup-only; ToS + PP acknowledgement
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    // Defensive: the submit button is disabled when this is true, but a
    // determined keyboard user can submit anyway. Don't let them past.
    if (mode === 'signup' && !agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    setSubmitting(true)

    const { data, error } = mode === 'signin'
      ? await signIn(email, password)
      // Pass the agreement timestamp through to the handle_new_user trigger
      // (see migration 008) so it lands in the same transaction as the
      // auth.users row.
      : await signUp(email, password, { data: { terms_accepted_at: new Date().toISOString() } })

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    // Supabase by default requires email confirmation on sign-up.
    // If the session is null after signUp, the user needs to check their email.
    if (mode === 'signup' && !data.session) {
      setInfo('Account created. Check your email to confirm before signing in.')
    }
    // On successful signin, AuthContext's onAuthStateChange will swap the UI.
  }

  const isSignin = mode === 'signin'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 border border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          MasterMind
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {isSignin ? 'Sign in to your story builder.' : 'Create your account.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Password
            </label>
            <PasswordInput
              autoComplete={isSignin ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Terms + Privacy Policy agreement — signup mode only. Links open
              in a new tab so the user doesn't lose their typed credentials
              when they go read either document. */}
          {!isSignin && (
            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-600 cursor-pointer"
              />
              <span className="leading-relaxed">
                I agree to the{' '}
                <a
                  href="/#terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 underline"
                >
                  Terms of Service
                </a>
                {' '}and{' '}
                <a
                  href="/#privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 underline"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
          )}

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

          <button
            type="submit"
            disabled={submitting || (!isSignin && !agreed)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSignin ? (
              <>
                <SignIn size={16} weight="bold" />
                Sign in
              </>
            ) : (
              <>
                <UserPlus size={16} weight="bold" />
                Create account
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignin ? 'signup' : 'signin')
            setError(null)
            setInfo(null)
          }}
          className="mt-4 w-full text-xs text-gray-500 hover:text-gray-700"
        >
          {isSignin
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
