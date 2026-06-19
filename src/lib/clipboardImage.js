// ============================================================================
// clipboardImage — higher-fidelity paste resolver.
// ----------------------------------------------------------------------------
// The synchronous `paste` event often exposes a single, lower-fidelity image
// representation — on Windows especially, a clipboard bitmap with transparency
// matted to white. But the clipboard can hold MULTIPLE representations of the
// same image, and `navigator.clipboard.read()` sometimes surfaces a better one
// (e.g., a real PNG with alpha) than the paste event does.
//
// So on paste we gather EVERY image candidate we can reach, inspect each
// (dimensions + real transparency), and choose the best — preferring a
// candidate that actually has alpha, then the highest resolution. If no
// candidate carries transparency, the alpha genuinely wasn't on the clipboard
// (the source app flattened it), and the caller can warn the user to use
// drag/Add instead. We never fabricate alpha; we just stop discarding a better
// representation when one exists.
//
// IMPORTANT: the paste event's `clipboardData` is only valid synchronously, so
// gatherClipboardImageCandidates() reads all of its data BEFORE its first
// await. The async `navigator.clipboard.read()` is a separate source.
// ============================================================================

import { base64ToBlob, hasAlphaInImageData, canTypeHaveAlpha } from './imageStorage.js'

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode failed'))
    img.src = url
  })
}

// Pull any inline data:image/* sources out of clipboard HTML. (Remote http(s)
// <img> sources are intentionally NOT fetched here — that needs a CORS-safe
// server proxy and is the deferred "URL paste" feature, ADR-0005 §6.)
export function extractDataUriImages(html) {
  if (!html) return []
  const out = []
  const re = /<img[^>]+src=["'](data:image\/[^"']+)["']/gi
  let m
  while ((m = re.exec(html)) !== null) {
    try { out.push(base64ToBlob(m[1])) } catch { /* skip malformed */ }
  }
  return out
}

// Collect every image blob the clipboard exposes. Synchronous clipboardData
// reads happen first (it's neutered after an await); the async clipboard read
// is attempted last and tolerates permission/support failures.
export async function gatherClipboardImageCandidates(e) {
  const blobs = []
  const dt = e?.clipboardData

  // --- Synchronous sources (must run before any await) ---
  if (dt) {
    if (dt.files) {
      for (const f of dt.files) if (f?.type?.startsWith('image/')) blobs.push(f)
    }
    if (dt.items) {
      for (const it of dt.items) {
        if (it.kind === 'file' && it.type?.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) blobs.push(f)
        }
      }
    }
    const html = dt.getData ? dt.getData('text/html') : ''
    blobs.push(...extractDataUriImages(html))
  }

  // --- Asynchronous source: the modern Clipboard API can surface a
  // higher-fidelity representation than the paste event. ---
  if (typeof navigator !== 'undefined' && navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            try { blobs.push(await item.getType(type)) } catch { /* skip */ }
          }
        }
      }
    } catch { /* permission denied / unsupported / not focused */ }
  }

  return blobs
}

// Decode a blob and report its dimensions + whether it carries real
// transparency. Returns null if it can't be decoded.
export async function inspectImageBlob(blob) {
  if (!blob) return null
  const fastNoAlpha = !canTypeHaveAlpha(blob.type)
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImg(url)
    let hasAlpha = false
    if (!fastNoAlpha) {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      hasAlpha = hasAlphaInImageData(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
    }
    return {
      blob,
      width: img.naturalWidth,
      height: img.naturalHeight,
      hasAlpha,
      bytes: blob.size,
      type: blob.type,
    }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Pure: pick the best candidate. Prefer real transparency; among the pool,
// prefer the highest resolution. Returns null when there are no valid images.
export function chooseBestImageCandidate(candidates) {
  const valid = (candidates || []).filter((c) => c && c.width > 0 && c.height > 0)
  if (valid.length === 0) return null
  const withAlpha = valid.filter((c) => c.hasAlpha)
  const pool = withAlpha.length ? withAlpha : valid
  return pool.reduce((best, c) => (c.width * c.height > best.width * best.height ? c : best))
}

// Resolve the best image from a paste event. Returns null if no image was on
// the clipboard, otherwise { blob, hadAlpha, anyAlpha, candidateCount }.
//   hadAlpha  — the chosen image carries transparency
//   anyAlpha  — ANY candidate did (chosen == best, so equal to hadAlpha today,
//               kept distinct for clarity/future tie-breaks)
export async function resolveBestPastedImage(e) {
  const blobs = await gatherClipboardImageCandidates(e)
  if (blobs.length === 0) return null

  // De-dupe identical blobs (same source often appears via multiple channels).
  const seen = new Set()
  const unique = blobs.filter((b) => {
    const key = `${b.type}:${b.size}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const inspected = []
  for (const b of unique) {
    const info = await inspectImageBlob(b)
    if (info) inspected.push(info)
  }

  const best = chooseBestImageCandidate(inspected)
  if (!best) return null
  return {
    blob: best.blob,
    hadAlpha: best.hasAlpha,
    anyAlpha: inspected.some((c) => c.hasAlpha),
    candidateCount: inspected.length,
  }
}

// Cheap synchronous check: does this paste event carry any image at all?
// (Lets the caller leave text-only pastes alone without doing async work.)
export function pasteHasImage(e) {
  const dt = e?.clipboardData
  if (!dt) return false
  if (dt.files && [...dt.files].some((f) => f?.type?.startsWith('image/'))) return true
  if (dt.items && [...dt.items].some((it) => it.kind === 'file' && it.type?.startsWith('image/'))) return true
  const html = dt.getData ? dt.getData('text/html') : ''
  return /<img[^>]+src=["']data:image\//i.test(html || '')
}
