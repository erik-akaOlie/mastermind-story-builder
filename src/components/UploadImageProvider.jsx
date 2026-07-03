// UploadImageProvider — context that lets any consumer open the shared
// Upload Image modal. Mirrors Lightbox.jsx's provider/hook shape.
//
// Consumers call useUploadImage().open({ mode, pipeline, existingImage?,
// onSave, onRemove? }) and the provider renders the modal. The `pipeline`
// is built via cardImagePipeline() or profileAvatarPipeline() in
// imageStorage.js so the modal stays domain-agnostic.
//
// PICK-FIRST ON TOUCH (2026-07-02, upload-flow research + Erik's call):
// on touch-primary devices a FRESH image add goes straight from the user's
// tap to the OS-native source picker (Camera / Gallery / Files — the
// platform provides the source sheet; we don't rebuild it). The crop modal
// opens only after a file is chosen; cancelling the picker returns the user
// cleanly to where they were, no empty modal. The hidden file input lives
// HERE — permanently mounted — and is .click()ed SYNCHRONOUSLY inside the
// consumer's original tap call stack via open(), because mobile browsers
// (Safari especially) only honor programmatic file-picker opens while the
// tap's user-activation window is alive. An effect or modal-mount trigger
// would lose it.
//
// Replace flows (existingImage present) keep the modal-first path on every
// device: the modal is where Remove and the current image live.
//
// Closing the modal clears the config; reopening replaces it.

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import UploadImageModal from './UploadImageModal'
import { useTouchPrimary } from '../hooks/useTouchPrimary'

const UploadImageContext = createContext(null)

export function useUploadImage() {
  const ctx = useContext(UploadImageContext)
  if (!ctx) throw new Error('useUploadImage must be used inside <UploadImageProvider>')
  return ctx
}

export function UploadImageProvider({ children }) {
  const [config, setConfig] = useState(null)
  const touchPrimary = useTouchPrimary()
  const touchPrimaryRef = useRef(touchPrimary)
  touchPrimaryRef.current = touchPrimary

  // Config waiting on the OS picker (pick-first path). Held in a ref — no
  // render needed until a file actually arrives.
  const pendingRef   = useRef(null)
  const fileInputRef = useRef(null)

  const open = useCallback((cfg) => {
    // Pick-first: fresh add on a touch device → OS picker NOW, modal later.
    if (touchPrimaryRef.current && !cfg.existingImage && fileInputRef.current) {
      pendingRef.current = cfg
      fileInputRef.current.click()
      return
    }
    setConfig(cfg)
  }, [])

  const close = useCallback(() => setConfig(null), [])

  const onPickFirstChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // same-file re-pick must re-fire change next time
    const cfg = pendingRef.current
    pendingRef.current = null
    if (!cfg || !file || !file.type.startsWith('image/')) return
    // Seed the modal straight into the cropper with the chosen file.
    setConfig({ ...cfg, initialBlob: file })
  }

  return (
    <UploadImageContext.Provider value={{ open, close }}>
      {children}
      {/* Permanently mounted so open() can click it synchronously. A
          cancelled picker simply never fires change — no cleanup needed. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickFirstChange}
      />
      {config && <UploadImageModal {...config} onClose={close} />}
    </UploadImageContext.Provider>
  )
}
