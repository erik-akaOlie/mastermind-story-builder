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

export default function Login() {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState('signin')   // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const action = mode === 'signin' ? signIn : signUp
    const { data, error } = await action(email, password)

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
            <input
              type="password"
              autoComplete={isSignin ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
            />
          </div>

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
            disabled={submitting}
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
