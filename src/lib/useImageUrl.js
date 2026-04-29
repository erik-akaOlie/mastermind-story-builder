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
// During the image-storage migration window this hook is the single place
// the app asks "what URL should the <img> use?" — components don't need to
// know whether they're looking at legacy base64 or migrated Storage paths.
// ============================================================================

import { useEffect, useState } from 'react'
import { getImageUrl, isBase64DataUri, isStoragePath } from './imageStorage.js'

export function useImageUrl(input, variant = 'full') {
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
    getImageUrl(value, variant)
      .then((signed) => {
        if (cancelled) return
        if (signed == null) {
          console.warn(`useImageUrl: signed URL was null for ${value} (${variant})`)
        }
        setUrl(signed)
      })
      .catch((err) => {
        console.error(`useImageUrl: rejected for ${value} (${variant})`, err)
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, variant])

  return url
}
