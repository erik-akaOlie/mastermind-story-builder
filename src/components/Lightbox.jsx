// ============================================================================
// Lightbox
// ----------------------------------------------------------------------------
// Single shared image lightbox. Hoisted to the canvas root so any part of the
// app — card avatar, edit-modal avatar, inspiration grid — can open it
// without each owning its own overlay state.
//
// Consumers call useLightbox() to get { open, close } and pass the raw image
// reference (base64 string, Storage path string, or { path, ... } object) to
// open(). The provider resolves it to a signed full-variant URL via useImageUrl.
//
// For content/handout images (entries carrying a `printable_path`), a compound
// Download control offers the display version (what's on screen) or the larger
// printable artifact, each labeled with its pixel dimensions (and file size for
// the printable, from the stored metadata). UI-identity images (avatars, plain
// path strings) show no download control.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { DownloadSimple, CaretDown } from '@phosphor-icons/react'
import { useImageUrl } from '../lib/useImageUrl'
import { getImageUrl, isStoragePath } from '../lib/imageStorage'
import { useTouchPrimary } from '../hooks/useTouchPrimary'

const LightboxContext = createContext(null)

export function useLightbox() {
  const ctx = useContext(LightboxContext)
  if (!ctx) throw new Error('useLightbox must be used inside <LightboxProvider>')
  return ctx
}

// Human-readable byte size for the download menu.
function prettyBytes(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// Derive a friendly download filename from a storage path + variant label.
// e.g. ".../inspiration-1714247612482-castle-ravenloft.printable.jpg"
//   → "castle-ravenloft-printable.jpg"
function downloadName(path, label, ext) {
  const base = (path.split('/').pop() || 'image')
    .replace(/\.(full|thumb|printable)\.[a-z0-9]+$/i, '')
  const slug = base.replace(/^[a-z]+-\d+-/i, '') || base
  return `${slug}-${label}.${ext}`
}

// Fetch a signed URL and force a browser download (cross-origin signed URLs
// ignore the <a download> attribute, so we fetch the blob first).
async function triggerDownload(path, filename) {
  const signed = await getImageUrl(path)
  if (!signed) throw new Error('Could not resolve image URL')
  const res = await fetch(signed)
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objUrl)
}

export function LightboxProvider({ children }) {
  const [value, setValue] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [displayDims, setDisplayDims] = useState(null) // { w, h } from the loaded <img>
  const [downloading, setDownloading] = useState(false)
  const url = useImageUrl(value, 'full')

  const open = useCallback((v) => {
    if (v) setValue(v)
  }, [])
  const close = useCallback(() => {
    setValue(null)
    setMenuOpen(false)
    setDisplayDims(null)
  }, [])

  // Esc closes
  useEffect(() => {
    if (!value) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value, close])

  // Touch: release focus when the lightbox opens (iPhone QA Finding D,
  // 2026-07-07). Opening from inside the Inspector leaves the text editor
  // focused, so the on-screen keyboard stays up — it shrinks and shifts the
  // visual viewport, pushing the top-anchored Download/Close controls out of
  // view until the user scrolls. Blurring dismisses the keyboard and lets
  // the viewport realign. Touch-only so a desktop user's caret survives a
  // quick image peek.
  const touchPrimary = useTouchPrimary()
  useEffect(() => {
    if (!value || !touchPrimary) return
    const el = document.activeElement
    if (el && el !== document.body && typeof el.blur === 'function') el.blur()
  }, [value, touchPrimary])

  // Content entries are objects; the printable artifact is download-only.
  const entry = value && typeof value === 'object' ? value : null
  const hasPrintable = isStoragePath(entry?.printable_path)
  // Display variant format follows the stored full path's extension (webp for
  // opaque, png for transparent).
  const displayExt = (entry?.path?.match(/\.(webp|png)$/i)?.[1] || 'webp').toLowerCase()
  const displayFormatLabel = displayExt === 'png' ? 'PNG' : 'WebP'

  const doDownload = async (path, label, ext) => {
    if (!path) return
    setDownloading(true)
    setMenuOpen(false)
    try {
      await triggerDownload(path, downloadName(path, label, ext))
    } catch (err) {
      console.error('Image download failed', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <LightboxContext.Provider value={{ open, close }}>
      {children}
      {value && (
        <div
          className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/80 cursor-zoom-out"
          onClick={close}
        >
          <img
            src={url ?? ''}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onLoad={(e) => setDisplayDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
            draggable={false}
          />

          {/* Top-right controls */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {hasPrintable && (
              <div className="relative">
                <button
                  className="h-10 px-3 rounded-full bg-black/50 text-white flex items-center gap-1.5 text-sm font-medium hover:bg-black/70 transition-colors disabled:opacity-60"
                  onClick={() => setMenuOpen((v) => !v)}
                  disabled={downloading}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <DownloadSimple size={18} weight="bold" />
                  {downloading ? 'Downloading…' : 'Download'}
                  <CaretDown size={14} weight="bold" />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-lg bg-gray-900 text-white shadow-2xl overflow-hidden"
                    role="menu"
                  >
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex flex-col"
                      role="menuitem"
                      onClick={() => doDownload(entry.path, 'display', displayExt)}
                    >
                      <span className="text-sm font-medium">Display version</span>
                      <span className="text-xs text-gray-400">
                        {displayDims ? `${displayDims.w} × ${displayDims.h}` : 'optimized'} · {displayFormatLabel}
                      </span>
                    </button>
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex flex-col border-t border-white/10"
                      role="menuitem"
                      onClick={() => doDownload(
                        entry.printable_path,
                        'printable',
                        entry.printable_format === 'png' ? 'png' : 'jpg',
                      )}
                    >
                      <span className="text-sm font-medium">Printable version</span>
                      <span className="text-xs text-gray-400">
                        {entry.printable_width && entry.printable_height
                          ? `${entry.printable_width} × ${entry.printable_height}`
                          : 'high resolution'}
                        {' · '}{entry.printable_format === 'png' ? 'PNG' : 'JPEG'}
                        {entry.printable_bytes ? ` · ${prettyBytes(entry.printable_bytes)}` : ''}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-xl font-bold hover:bg-black/70 transition-colors"
              onClick={close}
              aria-label="Close lightbox"
            >×</button>
          </div>
        </div>
      )}
    </LightboxContext.Provider>
  )
}
