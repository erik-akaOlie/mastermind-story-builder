// UploadImageProvider — context that lets any consumer inside an EditModal
// open the Upload Image modal. Mirrors Lightbox.jsx's provider/hook shape.
//
// Consumers call useUploadImage().open({ mode, cardId, campaignId, slug,
// section, existingImage?, onSave }) and the provider renders the modal.
// Closing the modal clears the config; reopening replaces it.

import { createContext, useCallback, useContext, useState } from 'react'
import UploadImageModal from './UploadImageModal'

const UploadImageContext = createContext(null)

export function useUploadImage() {
  const ctx = useContext(UploadImageContext)
  if (!ctx) throw new Error('useUploadImage must be used inside <UploadImageProvider>')
  return ctx
}

export function UploadImageProvider({ children }) {
  const [config, setConfig] = useState(null)

  const open  = useCallback((cfg) => setConfig(cfg), [])
  const close = useCallback(() => setConfig(null), [])

  return (
    <UploadImageContext.Provider value={{ open, close }}>
      {children}
      {config && <UploadImageModal {...config} onClose={close} />}
    </UploadImageContext.Provider>
  )
}
