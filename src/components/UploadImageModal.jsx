// UploadImageModal — overlay that captures a single image (file pick or
// clipboard paste) and uploads it via the existing imageStorage pipeline
// when the user presses Save.
//
// Per ADR-0007, no Storage or DB writes occur until Save. Cancel discards
// everything cleanly.
//
// Chunk 1 scope: empty state + image preview at natural size + Save/Cancel
// plumbing. The cropper UI is added in chunk 2.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadCardImage } from '../lib/imageStorage'

// OS-aware paste hint label
const isMac = typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent || '')
const PASTE_KEY_LABEL = isMac ? 'Cmd+V' : 'Ctrl+V'

export default function UploadImageModal({
  // mode: 'image-section' | 'thumbnail' — informational in chunk 1 (no
  // cropper differentiation yet); used in chunk 2+ to set the cropper's
  // aspect-ratio behavior.
  mode,
  cardId,
  campaignId,
  slug,
  section,         // storage path component, e.g. 'inspiration', 'avatar'
  // existingImage: present in thumbnail replace flow (chunk 3) — opens
  // the cropper pre-loaded with the existing image. Unused in chunk 1.
  existingImage,
  onSave,          // (path) => void — called with the new Storage path
  onClose,         // () => void
}) {
  const [imageBlob, setImageBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading]   = useState(false)
  const fileInputRef = useRef(null)

  // Build a temporary preview URL whenever the image changes. Revokes the
  // old URL on cleanup so the browser can free the bitmap.
  useEffect(() => {
    if (!imageBlob) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageBlob])

  // Document-level paste listener using the capture phase so we run before
  // any focused input's own paste handler. We only preventDefault when we
  // actually take an image, so text-only pastes flow through normally.
  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            setImageBlob(file)
            return // first image only — multi-image clipboards take the first silently
          }
        }
      }
    }
    document.addEventListener('paste', onPaste, { capture: true })
    return () => document.removeEventListener('paste', onPaste, { capture: true })
  }, [])

  // Esc closes — capture phase + stopImmediatePropagation so the
  // EditModal's own window-level Esc handler doesn't also fire and close
  // the parent modal underneath us.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  const handleFilePick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file && file.type.startsWith('image/')) {
      setImageBlob(file)
    }
  }

  const handleSave = async () => {
    if (!imageBlob || !campaignId || uploading) return
    setUploading(true)
    try {
      const path = await uploadCardImage({
        campaignId,
        cardId,
        section,
        slug,
        file: imageBlob,
      })
      onSave(path)
      onClose()
    } catch (err) {
      console.error('Upload failed', err)
      toast.error(`Couldn't upload image: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const saveDisabled = !imageBlob || uploading

  return (
    <>
      {/* Backdrop — clicking dismisses, mirroring Lightbox / EditModal patterns */}
      <div
        className="fixed inset-0 z-[10000] bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto rounded-[0.5rem] shadow-2xl bg-white flex flex-col overflow-hidden"
          style={{ width: '46rem', maxHeight: '90vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title bar — neutral gray, system surface (not card-type colored) */}
          <div
            className="flex items-center justify-between px-4 py-3 select-none"
            style={{ backgroundColor: '#6b7280' }}
          >
            <h2 className="text-xl font-semibold text-white">Upload Image</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-white opacity-70 hover:opacity-100 transition-opacity"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* Canvas area — empty state OR image preview (chunk 1: natural size) */}
          <div
            className="m-4 border border-gray-300 rounded relative flex items-center justify-center overflow-hidden bg-white"
            style={{ minHeight: '32rem' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFilePick}
            />
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-gray-700">
                <p className="text-base">
                  <span className="font-bold">{PASTE_KEY_LABEL}</span> to paste an image
                </p>
                <p className="text-gray-500 text-sm select-none">— or —</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold transition-colors"
                >
                  Select a file from computer
                </button>
              </div>
            )}
          </div>

          {/* Footer — Cancel + Save bottom-right */}
          <div className="flex justify-end gap-3 px-4 pb-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-sky-600 text-sky-600 rounded font-semibold hover:bg-sky-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveDisabled}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
