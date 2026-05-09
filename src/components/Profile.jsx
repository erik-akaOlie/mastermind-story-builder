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

import { useEffect, useState } from 'react'
import { ArrowLeft, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useImageUrl } from '../lib/useImageUrl.js'
import { profileAvatarPipeline } from '../lib/imageStorage.js'
import { getProfile, setAvatarPath, clearAvatar } from '../lib/profile.js'
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
  const { user, updatePassword } = useAuth()
  const upload = useUploadImage()

  // Profile row state: { id, avatar_path, display_name, ... } or null while loading.
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)

  // Resolved signed URL for the avatar — null when no avatar set.
  const avatarUrl = useImageUrl(profile?.avatar_path, { bucket: 'profile-media' })

  // Initial fallback (first letter of email, uppercase). Mirrors UserAvatar.
  const initial = (user?.email?.[0] ?? '?').toUpperCase()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Load the profile on mount.
  useEffect(() => {
    let cancelled = false
    getProfile()
      .then((p) => { if (!cancelled) setProfile(p) })
      .catch((err) => {
        console.error('Failed to load profile', err)
        if (!cancelled) setProfileError(err)
      })
    return () => { cancelled = true }
  }, [])

  // Open the Upload Image modal in profile-avatar mode. Pre-loads the
  // existing avatar (if any) for the replace flow. onSave + onRemove keep
  // local profile state in sync; the modal handles storage I/O via the
  // injected pipeline.
  function openUploadModal() {
    if (!user) return
    upload.open({
      mode: 'profile-avatar',
      pipeline: profileAvatarPipeline({ userId: user.id }),
      existingImage: profile?.avatar_path ?? undefined,
      onSave: async (newPath) => {
        try {
          await setAvatarPath(newPath)
          setProfile((p) => ({ ...(p || {}), avatar_path: newPath }))
        } catch (err) {
          console.error('Failed to save avatar path', err)
        }
      },
      onRemove: async () => {
        // Modal also calls pipeline.delete(existingImage) on its
        // pending-removal save path; here we just null the column.
        try {
          await setAvatarPath(null)
          setProfile((p) => ({ ...(p || {}), avatar_path: null }))
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
      setProfile((p) => ({ ...(p || {}), avatar_path: null }))
    } catch (err) {
      console.error('Failed to remove avatar', err)
    }
  }

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
      </div>
    </div>
  )
}
