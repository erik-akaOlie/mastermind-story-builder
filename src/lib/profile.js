// ============================================================================
// Profile API
// ----------------------------------------------------------------------------
// Thin wrapper around Supabase for the public.profiles table — the canonical
// home for app-level user metadata (avatar_path, display_name, future
// preferences, etc.). One row per auth user, linked 1:1 by id.
//
// Profile rows are auto-created by the on_auth_user_created trigger
// (see supabase/migrations/003_profiles_and_profile_media.sql), so callers
// can assume a row exists for any signed-in user.
//
// Avatar storage lives in the `profile-media` Supabase Storage bucket, with
// path convention `{user_id}/avatar-{timestamp_ms}.webp`. Single 256×256
// variant. Profile avatars never render larger than ~64px in real UI.
// ============================================================================

import { supabase } from './supabase.js'
import { persistWrite } from './errorReporting.js'

// ----------------------------------------------------------------------------
// Read the current user's profile row.
// Returns { id, avatar_path, display_name, created_at, updated_at } or null
// if not signed in. Throws on read errors.
// ----------------------------------------------------------------------------
export async function getProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

// ----------------------------------------------------------------------------
// Update the avatar_path on the current user's profile.
// Caller is responsible for the storage upload itself; this only updates
// the database column to point at the new path.
// ----------------------------------------------------------------------------
export async function setAvatarPath(path) {
  return persistWrite(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    return data
  }, 'your profile photo')
}

// ----------------------------------------------------------------------------
// Remove the current user's avatar:
//   1. Read the current avatar_path so we know what to delete in storage.
//   2. Null the column in profiles.
//   3. Delete the storage object.
//
// Order is intentional: the user-visible state (avatar reverts to initial)
// is correct as soon as step 2 succeeds. If step 3 fails, we leave a storage
// orphan but the UI is consistent. Periodic orphan cleanup (per ADR-0005)
// handles those.
// ----------------------------------------------------------------------------
export async function clearAvatar() {
  return persistWrite(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    // 1. Read current path
    const { data: existing, error: readErr } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .maybeSingle()
    if (readErr) throw readErr

    const oldPath = existing?.avatar_path

    // 2. Null the column
    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', user.id)
      .select()
      .single()
    if (updateErr) throw updateErr

    // 3. Best-effort storage delete (don't fail the operation if this fails)
    if (oldPath) {
      try {
        await supabase.storage.from('profile-media').remove([oldPath])
      } catch (err) {
        console.warn('[clearAvatar] storage delete failed; orphan left at', oldPath, err)
      }
    }

    return updated
  }, 'your profile photo')
}

// ----------------------------------------------------------------------------
// Update the display_name on the current user's profile.
// Pass null or empty string to clear it (UI then falls back to email-derived).
// ----------------------------------------------------------------------------
export async function setDisplayName(name) {
  return persistWrite(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    const trimmed = (name ?? '').trim() || null

    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    return data
  }, 'your display name')
}
