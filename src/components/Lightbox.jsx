// ============================================================================
// Lightbox
// ----------------------------------------------------------------------------
// Single shared image lightbox. Hoisted to the canvas root so any part of the
// app — card avatar, edit-modal avatar, inspiration grid — can open it
// without each owning its own overlay state.
//
// Consumers call useLightbox() to get { open, close } and pass the raw image
// reference (base64 string, Storage path string, or { path } object) to open().
// The provider resolves it to a signed full-variant URL via useImageUrl.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useImageUrl } from '../lib/useImageUrl'

const LightboxContext = createContext(null)

export function useLightbox() {
  const ctx = useContext(LightboxContext)
  if (!ctx) throw new Error('useLightbox must be used inside <LightboxProvider>')
  return ctx
}

export function LightboxProvider({ children }) {
  const [value, setValue] = useState(null)
  const url = useImageUrl(value, 'full')

  const open = useCallback((v) => {
    if (v) setValue(v)
  }, [])
  const close = useCallback(() => setValue(null), [])

  // Esc closes
  useEffect(() => {
    if (!value) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value, close])

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
            draggable={false}
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-xl font-bold hover:bg-black/70 transition-colors"
            onClick={close}
            aria-label="Close lightbox"
          >×</button>
        </div>
      )}
    </LightboxContext.Provider>
  )
}
