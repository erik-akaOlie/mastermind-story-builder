// ============================================================================
// Profile
// ----------------------------------------------------------------------------
// User profile page. Reached via the #profile hash route (set by the
// "View profile" item in UserAvatar's dropdown). Visual frame matches
// CampaignPicker so it reads as a top-level MasterMind surface, not a
// canvas surface.
//
// V1 contents:
//   - Profile photo (avatar) with upload + remove
//   - Read-only email
//   - Change-password form
//
// The avatar section uses the shared UploadImageModal in 'profile-avatar'
// mode (256×256 square crop) wired to profileAvatarPipeline. Profile rows
// in public.profiles store the storage path; UserAvatar (top-left chip)
// reads the same path so the change shows up everywhere immediately.
// Display name is in the schema but not yet wired up in the UI.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useProfile } from '../lib/ProfileContext.jsx'
import { useImageUrl } from '../lib/useImageUrl.js'
import { BUCKET_PROFILE, profileAvatarPipeline } from '../lib/imageStorage.js'
import { setAvatarPath, clearAvatar } from '../lib/profile.js'
import { supabase } from '../lib/supabase.js'
import UserAvatar from './UserAvatar.jsx'
import PasswordInput from './PasswordInput.jsx'
import { UploadImageProvider, useUploadImage } from './UploadImageProvider.jsx'

const MIN_PASSWORD_LENGTH = 6  // Supabase Auth's default minimum

function navigateBack() {
  window.location.hash = ''
}

// Public entry: wraps the contents in UploadImageProvider so the avatar
// section can call useUploadImage() to open the shared modal.
export default function Profile() {
  return (
    <UploadImageProvider>
      <ProfileContents />
    </UploadImageProvider>
  )
}

function ProfileContents() {
  const { user, updatePassword, signOut } = useAuth()
  const { profile, error: profileError, updateProfile } = useProfile()
  const upload = useUploadImage()

  // Resolved signed URL for the avatar — null when no avatar set.
  const avatarUrl = useImageUrl(profile?.avatar_path, { bucket: BUCKET_PROFILE })

  // Initial fallback (first letter of email, uppercase). Mirrors UserAvatar.
  const initial = (user?.email?.[0] ?? '?').toUpperCase()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Delete-account flow state — owned by the parent so the modal can be a
  // pure controlled child (email-confirmation state stays inside the modal).
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Open the Upload Image modal in profile-avatar mode. Pre-loads the
  // existing avatar (if any) for the replace flow. onSave + onRemove patch
  // shared profile state so UserAvatar (and any other consumer) sees the
  // change immediately; the modal handles storage I/O via the injected pipeline.
  function openUploadModal() {
    if (!user) return
    upload.open({
      mode: 'profile-avatar',
      pipeline: profileAvatarPipeline({ userId: user.id }),
      existingImage: profile?.avatar_path ?? undefined,
      onSave: async (newPath) => {
        try {
          await setAvatarPath(newPath)
          updateProfile({ avatar_path: newPath })
        } catch (err) {
          console.error('Failed to save avatar path', err)
        }
      },
      onRemove: async () => {
        // Modal also calls pipeline.delete(existingImage) on its
        // pending-removal save path; here we just null the column.
        try {
          await setAvatarPath(null)
          updateProfile({ avatar_path: null })
        } catch (err) {
          console.error('Failed to clear avatar path', err)
        }
      },
    })
  }

  // Inline Remove (outside the modal): clearAvatar nulls the column AND
  // deletes the storage object in one call.
  async function handleInlineRemove() {
    if (!profile?.avatar_path) return
    try {
      await clearAvatar()
      updateProfile({ avatar_path: null })
    } catch (err) {
      console.error('Failed to remove avatar', err)
    }
  }

  function clearForm() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  // Closes the delete-confirm modal, but only if we're not mid-call (so the
  // user can't dismiss the modal during the network round-trip).
  function closeDeleteModal() {
    if (deleting) return
    setShowDeleteModal(false)
    setDeleteError(null)
  }

  // Invoke the delete-account Edge Function. Two distinct failure surfaces
  // we have to check: supabase-js's transport error AND our function's
  // own { ok: false, error } shape returned in the response body.
  //
  // On success: clear the hash so Root doesn't try to render Profile after
  // the session is gone, then sign out. signOut() already wipes the undo
  // store and resets PostHog (see AuthContext); the auth state change then
  // re-renders Root to <Login />.
  async function handleConfirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('delete-account')
      if (invokeErr) throw new Error(invokeErr.message || 'Network error')
      if (data?.ok !== true) throw new Error(data?.error || 'Server did not confirm deletion')
      window.location.hash = ''
      await signOut()
    } catch (e) {
      setDeleteError(e.message || 'Could not delete account. Please try again.')
      setDeleting(false)
    }
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
            <div className="text-[0.6875rem] uppercase tracking-wide text-gray-500 mb-3">
              Photo
            </div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-sky-600 text-white flex items-center justify-center text-2xl font-semibold flex-shrink-0 shadow-sm ring-1 ring-black/5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile photo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true">{initial}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={openUploadModal}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700"
                >
                  {profile?.avatar_path ? 'Change photo' : 'Upload photo'}
                </button>
                {profile?.avatar_path && (
                  <button
                    type="button"
                    onClick={handleInlineRemove}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            {profileError && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">
                <WarningCircle size={16} weight="fill" className="flex-shrink-0 mt-px" />
                <span>Couldn’t load your profile. Refresh to try again.</span>
              </div>
            )}
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

        {/* Danger zone — separate card so the visual separation reads as
            "this is different and irreversible." Red accent on the header
            mirrors the modal's accent for continuity. */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50">
            <h2 className="text-sm font-medium text-red-900">Danger zone</h2>
          </div>
          <div className="px-6 py-5">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Delete account</h3>
            <p className="text-xs text-gray-600 mb-4">
              Permanently deletes your account, all your workspaces, all
              uploaded images, and any session recordings. This cannot be
              undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Delete account
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          email={user?.email ?? ''}
          submitting={deleting}
          error={deleteError}
          onCancel={closeDeleteModal}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

// ============================================================================
// DeleteAccountModal
// ----------------------------------------------------------------------------
// Email-confirmation gate for the destructive Delete Account action. The
// Delete button stays disabled until the user types their own email (trim +
// lowercase compare both sides). Escape and backdrop click both cancel —
// but only when we're not mid-call, so the modal can't be dismissed during
// the network round-trip.
// ============================================================================
function DeleteAccountModal({ email, submitting, error, onCancel, onConfirm }) {
  const [confirmEmail, setConfirmEmail] = useState('')
  const inputRef = useRef(null)
  const matches =
    confirmEmail.trim().toLowerCase() === (email ?? '').trim().toLowerCase()
    && email.length > 0

  // Focus the input as soon as the modal mounts.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape cancels (unless we're mid-submit).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submitting, onCancel])

  function handleSubmit(e) {
    e.preventDefault()
    if (!matches || submitting) return
    onConfirm()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={() => { if (!submitting) onCancel() }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
      >
        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2">
            <WarningCircle size={18} weight="fill" className="text-red-600 flex-shrink-0" />
            <h2 id="delete-account-title" className="text-sm font-semibold text-red-900">
              Delete account?
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <p className="text-sm text-gray-700 mb-3">This permanently deletes:</p>
          <ul className="text-sm text-gray-700 list-disc pl-5 mb-4 space-y-1">
            <li>Your account and login</li>
            <li>All workspaces, cards, and connections</li>
            <li>All uploaded images (profile and card images)</li>
            <li>Any session recordings tied to your account</li>
          </ul>
          <p className="text-sm text-gray-900 font-medium mb-5">
            This cannot be undone.
          </p>

          <label htmlFor="delete-account-email" className="block text-xs font-medium text-gray-700 mb-1">
            Type your email address to confirm
          </label>
          <input
            id="delete-account-email"
            ref={inputRef}
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            disabled={submitting}
            placeholder={email}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-50 disabled:cursor-not-allowed mb-4"
          />

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
              <WarningCircle size={16} weight="fill" className="flex-shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!matches || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
