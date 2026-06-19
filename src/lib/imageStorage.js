// ============================================================================
// Image Storage helper
// ----------------------------------------------------------------------------
// Owns the Supabase Storage interactions for two image domains:
//
//   1. Card images — bucket `workspace-media`, per ADR-0005 + its
//      2026-06-18 amendment (tiered variants). Two CATEGORIES, split by
//      purpose:
//        a. UI-identity images (node thumbnail) — display variants only
//           (thumb 256px / full 1600px WebP). Optimized for display.
//        b. Content/handout images (Image Section + Image Album) — the
//           same display variants PLUS a high-resolution `printable`
//           artifact (≤4096px long edge). Transparency drives the whole
//           format family: a transparent source yields PNG display variants
//           AND a PNG printable; an opaque source yields WebP display
//           variants AND a JPEG printable. Future paywall gates the
//           printable variant only.
//      Path: {workspace_id}/{card_id}/{section}-{timestamp_ms}-{slug}.{variant}.{ext}
//
//   2. Profile avatars — bucket `profile-media`, single 256×256 variant
//      per migration 003. Profile photos never render larger than ~64px
//      in real UI; one variant is sufficient.
//      Path: {user_id}/avatar-{timestamp_ms}.webp
//
// Domain-specific entry points:
//   - UI card image: uploadCardImage(), deleteCardImage(), cardImagePipeline()
//   - Content image: uploadContentImage(), deleteCardImage(), contentImagePipeline()
//   - Profile:       uploadProfileAvatar(), deleteProfileAvatar(), profileAvatarPipeline()
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

// Exported as the single source of truth for the bucket names. Consumers
// (useImageUrl, Profile, UserAvatar) MUST import these constants rather than
// hardcoding the string — a rename of either bucket should only require
// editing this file. The 2026-05 campaign -> workspace rename broke
// because useImageUrl had hardcoded 'card-media' as a default; that
// regression is what these exported constants exist to prevent.
export const BUCKET_WORKSPACE = 'workspace-media'
export const BUCKET_PROFILE   = 'profile-media'

// Display variants — small WebP renditions for on-screen rendering (grids,
// canvas, lightbox). Generated for EVERY image regardless of category.
const DISPLAY_VARIANTS = {
  thumb: { maxEdge: 256,  quality: 0.4 },
  full:  { maxEdge: 1600, quality: 0.82 },
}

// Printable variant — high-resolution download/share artifact, content
// images only. "Printable quality," not an archival original: it is cropped
// and may be re-encoded. The long-edge cap keeps print-grade detail
// (exceeds A4/Letter at 300 DPI) without unbounded storage. Quality applies
// to JPEG; PNG is lossless and ignores it. Future paywall gates THIS variant.
const PRINTABLE_MAX_EDGE     = 4096
const PRINTABLE_JPEG_QUALITY = 0.92

// Source MIME types that can carry an alpha channel. A type outside this set
// cannot be transparent, so we skip the (more expensive) per-pixel scan.
const ALPHA_CAPABLE_TYPES = new Set(['image/png', 'image/webp', 'image/gif'])

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

// Compose the storage path for a single variant. Display variants are WebP
// (the default ext); the printable variant overrides ext with 'jpg' or
// 'png' since it isn't WebP and so can't be derived by suffix swap.
export function buildImagePath({ workspaceId, cardId, section, slug, timestamp, variant, ext = 'webp' }) {
  return `${workspaceId}/${cardId}/${section}-${timestamp}-${slug}.${variant}.${ext}`
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

// Swap the DISPLAY variant token (full ↔ thumb) on a storage path, preserving
// the actual extension — `.webp` for opaque images, `.png` for transparent
// ones (both display variants share the source's format family). The printable
// path has its own variable `.jpg`/`.png` extension and is stored explicitly,
// so it is intentionally NOT matched here and never derived by swap.
export function pathForVariant(path, variant) {
  if (!path) return null
  return path.replace(/\.(full|thumb)\.(webp|png)$/i, `.${variant}.$2`)
}

// ----------------------------------------------------------------------------
// Printable-variant pure helpers (transparency → format → ext/mime, and the
// delete-path collector). Kept pure so they're unit-testable without a
// browser/Canvas. The canvas scan that FEEDS hasAlphaInImageData lives in
// imageHasAlpha() below.
// ----------------------------------------------------------------------------

// Scan decoded RGBA bytes for any non-opaque pixel. `data` is the
// Uint8ClampedArray from getImageData (RGBA quads — alpha is every 4th byte).
export function hasAlphaInImageData(data) {
  if (!data) return false
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

// A source MIME type that cannot carry alpha never needs the pixel scan.
// Unknown/empty type → scan to be safe (return true).
export function canTypeHaveAlpha(mimeType) {
  if (!mimeType) return true
  return ALPHA_CAPABLE_TYPES.has(mimeType)
}

// Format decision for the printable variant: PNG preserves transparency (and
// crisp edges) losslessly; JPEG keeps opaque photos small.
export function selectPrintableFormat(hasAlpha) {
  return hasAlpha ? 'png' : 'jpeg'
}

export function printableExtension(format) {
  return format === 'png' ? 'png' : 'jpg'
}

export function printableMimeType(format) {
  return format === 'png' ? 'image/png' : 'image/jpeg'
}

// Collect every storage path to remove for an image entry. Accepts a bare
// path string (legacy / UI-identity → full + thumb) or a content entry
// object (→ full + thumb + explicit printable_path when present). Pure and
// tolerant: never throws on missing/garbage input, so deletes stay safe for
// legacy entries that predate the printable variant.
export function collectImagePathsToDelete(input) {
  const displayPath = typeof input === 'string' ? input : input?.path
  const out = []
  if (isStoragePath(displayPath)) {
    out.push(pathForVariant(displayPath, 'full'), pathForVariant(displayPath, 'thumb'))
  }
  const printablePath = input && typeof input === 'object' ? input.printable_path : null
  if (isStoragePath(printablePath)) out.push(printablePath)
  return out
}

// Normalize a string path or an entry object to its display (.full.webp)
// path for signed-URL resolution.
function toDisplayPath(input) {
  return typeof input === 'string' ? input : input?.path ?? null
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
    for (const [name, config] of Object.entries(DISPLAY_VARIANTS)) {
      out[name] = (await renderVariant(img, config)).blob
    }
    return out
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// Decode-and-scan a source image for REAL transparency, on a real canvas.
// Fast-path: skip the scan entirely for source types that can't carry alpha.
export async function imageHasAlpha(input) {
  if (!canTypeHaveAlpha(input?.type)) return false
  const objectUrl = URL.createObjectURL(input)
  try {
    const img = await loadHtmlImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width  = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return hasAlphaInImageData(data)
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

// Render a decoded image to a Blob at a capped long edge. Returns the blob
// plus rendered dimensions (used for printable metadata). `mime` selects
// WebP (display) or JPEG/PNG (printable); only JPEG/WebP honor `quality`.
function renderVariant(img, { maxEdge, quality, mime = 'image/webp' }) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const longEdge = Math.max(w, h)
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
  const targetW = Math.max(1, Math.round(w * scale))
  const targetH = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, targetW, targetH)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob
        ? resolve({ blob, width: targetW, height: targetH })
        : reject(new Error('Canvas toBlob returned null'))),
      mime,
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
export async function uploadCardImage({ workspaceId, cardId, section, slug, file, timestamp = Date.now() }) {
  const variants = await transcodeImage(file)
  const cleanSlug = slugify(slug)

  const paths = {}
  for (const [variant, blob] of Object.entries(variants)) {
    const path = buildImagePath({ workspaceId, cardId, section, slug: cleanSlug, timestamp, variant })
    const { error } = await supabase.storage.from(BUCKET_WORKSPACE).upload(path, blob, {
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
export async function uploadCardImageBlob({ workspaceId, cardId, section, slug, blob, timestamp = Date.now() }) {
  return uploadCardImage({ workspaceId, cardId, section, slug, file: blob, timestamp })
}

// Internal: PUT one blob to workspace-media. Throws on error.
async function putWorkspaceObject(path, blob, contentType) {
  const { error } = await supabase.storage.from(BUCKET_WORKSPACE).upload(path, blob, {
    contentType,
    upsert: false,
  })
  if (error) throw error
}

// Upload a content/handout image: thumb + full (WebP display variants) PLUS a
// high-resolution `printable` artifact (JPEG when opaque, PNG when the source
// has real transparency). Returns the structured entry fields the caller
// merges into its JSONB image object:
//
//   { path, printable_path, printable_format,
//     printable_width, printable_height, printable_bytes }
//
// `path` is the .full.webp display path — keeps existing rendering and the
// stored identity unchanged. The printable path is EXPLICIT because it may be
// .jpg or .png and cannot be derived from the .webp suffix.
export async function uploadContentImage({ workspaceId, cardId, section, slug, file, timestamp = Date.now() }) {
  const cleanSlug = slugify(slug)
  const hasAlpha  = await imageHasAlpha(file)

  // Transparency drives the WHOLE format family. Transparent source → PNG for
  // both display variants AND the printable (universally understood, lossless,
  // unambiguous in the download menu). Opaque source → WebP display variants
  // (smaller, hot-path) + a JPEG printable. WebP also supports alpha, but PNG
  // matches user expectation and keeps formats predictable end to end.
  const printableFormat = selectPrintableFormat(hasAlpha)        // 'png' | 'jpeg'
  const printableExt    = printableExtension(printableFormat)
  const printableMime   = printableMimeType(printableFormat)
  const displayMime     = hasAlpha ? 'image/png' : 'image/webp'
  const displayExt      = hasAlpha ? 'png' : 'webp'

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadHtmlImage(objectUrl)

    // Display variants — WebP (opaque) or PNG (transparent). PNG is lossless,
    // so the quality arg is dropped for it.
    const paths = {}
    for (const [variant, config] of Object.entries(DISPLAY_VARIANTS)) {
      const { blob } = await renderVariant(img, {
        ...config,
        mime: displayMime,
        quality: hasAlpha ? undefined : config.quality,
      })
      const path = buildImagePath({
        workspaceId, cardId, section, slug: cleanSlug, timestamp, variant, ext: displayExt,
      })
      await putWorkspaceObject(path, blob, displayMime)
      paths[variant] = path
    }

    // Printable variant (JPEG/PNG). PNG ignores the quality arg.
    const printable = await renderVariant(img, {
      maxEdge: PRINTABLE_MAX_EDGE,
      quality: printableFormat === 'jpeg' ? PRINTABLE_JPEG_QUALITY : undefined,
      mime: printableMime,
    })
    const printablePath = buildImagePath({
      workspaceId, cardId, section, slug: cleanSlug, timestamp, variant: 'printable', ext: printableExt,
    })
    await putWorkspaceObject(printablePath, printable.blob, printableMime)

    return {
      path:             paths.full,
      printable_path:   printablePath,
      printable_format: printableFormat,
      printable_width:  printable.width,
      printable_height: printable.height,
      printable_bytes:  printable.blob.size,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// Remove an image's storage objects. Accepts either a bare path string
// (legacy / UI-identity → removes .full + .thumb) or a content entry object
// (also removes its explicit printable_path when present). Safe — and a
// no-op — for legacy entries that have no printable.
export async function deleteCardImage(input) {
  const paths = collectImagePathsToDelete(input)
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET_WORKSPACE).remove(paths)
  if (error) throw error
}

// Resolve a path into a signed URL. The variant suffix swap only applies to
// workspace-media paths (which carry .full.webp / .thumb.webp suffixes).
// Profile avatars are single-variant; passing a profile path with any variant
// value is harmless because pathForVariant no-ops on paths without the suffix.
//
// Returns null for falsy input or signing failure (caller decides how to
// render absence).
export async function getImageUrl(path, variant = 'full', bucket = BUCKET_WORKSPACE) {
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

// Convert an already-cropped square Blob into a single WebP variant. The
// cropper for profile-avatar mode outputs a fixed square (512×512), so this
// is a format conversion only — it renders at the blob's native size, no
// resize step.
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

// UI-identity card images (node thumbnail): display variants only.
// upload() resolves to the .full.webp path string.
export function cardImagePipeline({ workspaceId, cardId, section, slug }) {
  return {
    upload: (blob)  => uploadCardImage({ workspaceId, cardId, section, slug, file: blob }),
    delete: (input) => deleteCardImage(input),
    getUrl: (input) => getImageUrl(toDisplayPath(input), 'full', BUCKET_WORKSPACE),
  }
}

// Content/handout card images (Image Section + Image Album): display variants
// PLUS a high-res printable artifact. upload() resolves to the structured
// entry OBJECT (not a bare path) — the caller spreads it into its stored JSONB
// image entry. delete() accepts that same object so the printable is cleaned
// up too.
export function contentImagePipeline({ workspaceId, cardId, section, slug }) {
  return {
    upload: (blob)  => uploadContentImage({ workspaceId, cardId, section, slug, file: blob }),
    delete: (input) => deleteCardImage(input),
    getUrl: (input) => getImageUrl(toDisplayPath(input), 'full', BUCKET_WORKSPACE),
  }
}

export function profileAvatarPipeline({ userId }) {
  return {
    upload: (blob) => uploadProfileAvatar({ userId, blob }),
    delete: (path) => deleteProfileAvatar(path),
    getUrl: (path) => getImageUrl(path, 'full', BUCKET_PROFILE),
  }
}
