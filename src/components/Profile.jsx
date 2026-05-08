// ============================================================================
// Profile
// ----------------------------------------------------------------------------
// User profile page. Reached via the #profile hash route (set by the
// "View profile" item in UserAvatar's dropdown). Visual frame matches
// CampaignPicker so it reads as a top-level MasterMind surface, not a
// canvas surface.
//
// V1 contents: read-only email + change-password form. Username and avatar
// upload are intentionally deferred (separate backlog items).
// ============================================================================

import { useState } from 'react'
import { ArrowLeft, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import UserAvatar from './UserAvatar.jsx'
import PasswordInput from './PasswordInput.jsx'

const MIN_PASSWORD_LENGTH = 6  // Supabase Auth's default minimum

function navigateBack() {
  window.location.hash = ''
}

export default function Profile() {
  const { user, updatePassword } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function clearForm() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Fill in all three fields.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation don’t match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current one.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await updatePassword(currentPassword, newPassword)
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message || 'Could not update password.')
      return
    }
    clearForm()
    setSuccess(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">MasterMind</h1>
            <p className="text-sm text-gray-500 mt-1">Your story builder.</p>
          </div>
          <UserAvatar />
        </div>

        <button
          onClick={navigateBack}
          className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={14} weight="bold" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Profile</h2>
          </div>

          <div className="px-6 py-5 border-b border-gray-100">
            <div className="text-[0.6875rem] uppercase tracking-wide text-gray-500 mb-1">
              Email
            </div>
            <div className="text-sm text-gray-900">{user?.email}</div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Change password</h3>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
                <WarningCircle size={16} weight="fill" className="flex-shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-4">
                <CheckCircle size={16} weight="fill" className="flex-shrink-0 mt-px" />
                <span>Password updated.</span>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Current password
              </label>
              <PasswordInput
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                New password
              </label>
              <PasswordInput
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-[0.6875rem] text-gray-500 mt-1">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Confirm new password
              </label>
              <PasswordInput
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
