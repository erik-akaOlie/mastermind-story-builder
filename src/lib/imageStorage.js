// ============================================================================
// Image Storage helper
// ----------------------------------------------------------------------------
// Owns the Supabase Storage interactions for two image domains:
//
//   1. Card images (avatars + inspiration) — bucket `card-media`, two
//      variants (thumb 256px / full 1920px), per ADR-0005.
//      Path: {campaign_id}/{card_id}/{section}-{timestamp_ms}-{slug}.{variant}.webp
//
//   2. Profile avatars — bucket `profile-media`, single 256×256 variant
//      per migration 003. Profile photos never render larger than ~64px
//      in real UI; one variant is sufficient.
//      Path: {user_id}/avatar-{timestamp_ms}.webp
//
// Domain-specific entry points:
//   - Card:    uploadCardImage(), deleteCardImage(), cardImagePipeline()
//   - Profile: uploadProfileAvatar(), deleteProfileAvatar(), profileAvatarPipeline()
//
// Shared by both: getImageUrl() (takes a bucket parameter), the transcoding
// helpers, and useImageUrl() (the hook in useImageUrl.js).
//
// The pipeline factories return a { upload, delete, getUrl } trio so
// UploadImageModal can be pipeline-agnostic — it doesn't know whether it's
// editing a card image or a profile avatar; it just calls the trio its
// caller handed it.
// ============================================================================

import { supabase } from './supabase.js'

const BUCKET_CARD     = 'card-media'
const BUCKET_PROFILE  = 'profile-media'

const VARIANTS = {
  thumb: { maxEdge: 256,  quality: 0.4 },
  full:  { maxEdge: 1920, quality: 0.8 },
}

const PROFILE_AVATAR_QUALITY = 0.85   // single 256×256 variant

const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour; cached on the CDN edge

// ----------------------------------------------------------------------------
// Pure helpers
// ----------------------------------------------------------------------------

// Convert a label into a safe kebab-case slug. Falls back to 'untitled-card'
// when the label is empty or contains no alphanumerics.
export function slugify(label) {
  if (typeof label !== 'string') return 'untitled-card'
  const cleaned = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return cleaned || 'untitled-card'
}

// Compose the storage path for a single variant.
export function buildImagePath({ campaignId, cardId, section, slug, timestamp, variant }) {
  return `${campaignId}/${cardId}/${section}-${timestamp}-${slug}.${variant}.webp`
}

// Recognise a value as a base64 data URI (legacy storage shape).
export function isBase64DataUri(value) {
  return typeof value === 'string' && value.startsWith('data:')
}

// Recognise a value as a Supabase Storage path (new shape).
export function isStoragePath(value) {
  return typeof value === 'string'
    && !value.startsWith('data:')
    && !value.startsWith('http://')
    && !value.startsWith('https://')
    && value.length > 0
}

// Swap the variant suffix on a storage path. Accepts either .full.webp or
// .thumb.webp suffix and rewrites to the requested variant.
export function pathForVariant(path, variant) {
  if (!path) return null
  return path.replace(/\.(full|thumb)\.webp$/, `.${variant}.webp`)
}

// ----------------------------------------------------------------------------
// Browser-only: image transcoding via Canvas
// ----------------------------------------------------------------------------

// Decode a File / Blob into thumb + full WebP blobs. Returns { thumb, full }.
export async function transcodeImage(input) {
  const objectUrl = URL.createObjectURL(input)
  try {
    const img = await loadHtmlImage(objectUrl)
    const out = {}
    for (const [name, config] of Object.entries(VARIANTS)) {
      out[name] = await renderVariant(img, config)
    }
    return out
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = url
  })
}

function renderVariant(img, { maxEdge, quality }) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const longEdge = Math.max(w, h)
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
  const targetW = Math.round(w * scale)
  const targetH = Math.round(h * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, targetW, targetH)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
      'image/webp',
      quality
    )
  })
}

// Decode a base64 data URI into a Blob, for migrating legacy images.
export function base64ToBlob(dataUri) {
  const [header, base64] = dataUri.split(',', 2)
  const mimeMatch = /data:([^;]+)/.exec(header)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ----------------------------------------------------------------------------
// Storage I/O
// ----------------------------------------------------------------------------

// Upload a file/blob as both variants. Returns the .full.webp path; callers
// store this string and use pathForVariant() to derive the thumb path.
export async function uploadCardImage({ campaignId, cardId, section, slug, file, timestamp = Date.now() }) {
  const variants = await transcodeImage(file)
  const cleanSlug = slugify(slug)

  const paths = {}
  for (const [variant, blob] of Object.entries(variants)) {
    const path = buildImagePath({ campaignId, cardId, section, slug: cleanSlug, timestamp, variant })
    const { error } = await supabase.storage.from(BUCKET_CARD).upload(path, blob, {
      contentType: 'image/webp',
      upsert: false,
    })
    if (error) throw error
    paths[variant] = path
  }

  return paths.full
}

// Variant of uploadCardImage that takes already-transcoded blobs (used by the
// migration script which has already decoded base64 to a Blob).
export async function uploadCardImageBlob({ campaignId, cardId, section, slug, blob, timestamp = Date.now() }) {
  return uploadCardImage({ campaignId, cardId, section, slug, file: blob, timestamp })
}

// Remove both variants of an image. Accepts either the full or thumb path.
export async function deleteCardImage(path) {
  if (!isStoragePath(path)) return
  const fullPath = pathForVariant(path, 'full')
  const thumbPath = pathForVariant(path, 'thumb')
  const { error } = await supabase.storage.from(BUCKET_CARD).remove([fullPath, thumbPath])
  if (error) throw error
}

// Resolve a path into a signed URL. The variant suffix swap only applies to
// card-media paths (which carry .full.webp / .thumb.webp suffixes). Profile
// avatars are single-variant; passing a profile path with any variant value
// is harmless because pathForVariant no-ops on paths without the suffix.
//
// Returns null for falsy input or signing failure (caller decides how to
// render absence).
export async function getImageUrl(path, variant = 'full', bucket = BUCKET_CARD) {
  if (!isStoragePath(path)) return null
  const targetPath = pathForVariant(path, variant)
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(targetPath, SIGNED_URL_TTL_SECONDS)
  if (error) {
    console.error(`Failed to sign URL for ${targetPath} in ${bucket}`, error)
    return null
  }
  return data.signedUrl
}

// ----------------------------------------------------------------------------
// Profile avatars — single 256×256 variant, profile-media bucket
// ----------------------------------------------------------------------------

// Build the storage path for a profile avatar.
export function buildProfileAvatarPath({ userId, timestamp = Date.now() }) {
  return `${userId}/avatar-${timestamp}.webp`
}

// Convert an already-cropped 256×256 Blob into a single WebP variant. The
// cropper for profile-avatar mode outputs exactly 256×256, so this is a
// format conversion only — no resize step.
export async function transcodeProfileAvatar(input, quality = PROFILE_AVATAR_QUALITY) {
  const objectUrl = URL.createObjectURL(input)
  try {
    const img = await loadHtmlImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width  = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
        'image/webp',
        quality
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// Upload a cropped profile avatar Blob. Returns the storage path.
export async function uploadProfileAvatar({ userId, blob, timestamp = Date.now() }) {
  const webp = await transcodeProfileAvatar(blob)
  const path = buildProfileAvatarPath({ userId, timestamp })
  const { error } = await supabase.storage.from(BUCKET_PROFILE).upload(path, webp, {
    contentType: 'image/webp',
    upsert: false,
  })
  if (error) throw error
  return path
}

// Delete a profile avatar object. Single variant, single object.
export async function deleteProfileAvatar(path) {
  if (!isStoragePath(path)) return
  const { error } = await supabase.storage.from(BUCKET_PROFILE).remove([path])
  if (error) throw error
}

// ----------------------------------------------------------------------------
// Pipeline factories — used by UploadImageModal so the modal stays
// pipeline-agnostic. Each factory returns { upload, delete, getUrl } async
// functions bound to the right bucket and path conventions for that domain.
// ----------------------------------------------------------------------------

export function cardImagePipeline({ campaignId, cardId, section, slug }) {
  return {
    upload: (blob) => uploadCardImage({ campaignId, cardId, section, slug, file: blob }),
    delete: (path) => deleteCardImage(path),
    getUrl: (path) => getImageUrl(path, 'full', BUCKET_CARD),
  }
}

export function profileAvatarPipeline({ userId }) {
  return {
    upload: (blob) => uploadProfileAvatar({ userId, blob }),
    delete: (path) => deleteProfileAvatar(path),
    getUrl: (path) => getImageUrl(path, 'full', BUCKET_PROFILE),
  }
}
