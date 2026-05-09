// ============================================================================
// useImageUrl
// ----------------------------------------------------------------------------
// Resolves any image reference the rest of the app might hand a component:
//
//   - null / undefined / ''         → returns null (component renders fallback)
//   - 'data:image/...' (legacy)     → returns the base64 string directly
//   - external https URL            → returns it as-is (e.g. /avatars/strahd.jpg)
//   - Supabase Storage path string  → asynchronously fetches a signed URL
//   - { path: '...' } object        → same as the path string above
//
// Signature:
//   useImageUrl(input, options?)
//     options.variant — 'full' (default) or 'thumb'; only meaningful for
//                       card-media paths.
//     options.bucket  — 'card-media' (default) or 'profile-media'.
//
// Backward compat: passing a plain string as the second argument is treated
// as { variant: <string> }. Existing call sites continue to work unchanged.
// ============================================================================

import { useEffect, useState } from 'react'
import { getImageUrl, isBase64DataUri, isStoragePath } from './imageStorage.js'

export function useImageUrl(input, options = {}) {
  // Accept the legacy string-variant form: useImageUrl(value, 'thumb').
  const opts = typeof options === 'string' ? { variant: options } : options
  const variant = opts.variant ?? 'full'
  const bucket  = opts.bucket  ?? 'card-media'

  // Normalize: callers may pass a string or a { path, ... } object.
  const value = typeof input === 'string' ? input : input?.path ?? null

  // Synchronous initial state for the legacy / external cases so we don't
  // flash empty before the effect runs.
  const initial =
    value == null
      ? null
      : isBase64DataUri(value)
        ? value
        : !isStoragePath(value) // external https/http URL
          ? value
          : null

  const [url, setUrl] = useState(initial)

  useEffect(() => {
    if (value == null) {
      setUrl(null)
      return
    }
    if (isBase64DataUri(value) || !isStoragePath(value)) {
      setUrl(value)
      return
    }

    // Storage path — fetch a signed URL.
    let cancelled = false
    getImageUrl(value, variant, bucket)
      .then((signed) => {
        if (cancelled) return
        if (signed == null) {
          console.warn(`useImageUrl: signed URL was null for ${value} (${variant}, ${bucket})`)
        }
        setUrl(signed)
      })
      .catch((err) => {
        console.error(`useImageUrl: rejected for ${value} (${variant}, ${bucket})`, err)
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, variant, bucket])

  return url
}
