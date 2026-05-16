// UploadImageModal — overlay that captures a single image (file pick or
// clipboard paste), runs it through the cropper, and uploads it via a
// caller-supplied pipeline when the user presses Save.
//
// Per ADR-0007, no Storage or DB writes occur until Save. Cancel discards
// everything cleanly.
//
// The modal is pipeline-agnostic. Callers pass a `pipeline` prop with three
// async functions: { upload(blob) → path, delete(path) → void, getUrl(path)
// → signedUrl }. The two domains today are card images (cardImagePipeline)
// and profile avatars (profileAvatarPipeline) — both factory-built in
// imageStorage.js. New image domains drop in by adding a new factory; this
// modal does not need to know about them.

import { useEffect, useRef, useState } from 'react'
import ImageCropper from './ImageCropper'

// OS-aware paste hint label
const isMac = typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent || '')
const PASTE_KEY_LABEL = isMac ? 'Cmd+V' : 'Ctrl+V'

export default function UploadImageModal({
  // mode: 'image-section' | 'thumbnail' | 'profile-avatar' — drives the
  // cropper's frame-shape and output-size behavior.
  mode,
  // pipeline: { upload(blob) → path, delete(path) → void, getUrl(path) →
  // signedUrl }. Bind via cardImagePipeline() or profileAvatarPipeline()
  // from imageStorage.js so the modal stays domain-agnostic.
  pipeline,
  // existingImage: present in replace flows — the modal opens pre-loaded
  // with the existing image (fetched via pipeline.getUrl) and surfaces a
  // Remove button inside the cropper.
  existingImage,
  onSave,          // (path) => void — called with the new Storage path
  onRemove,        // () => void  — called when the user clears the existing
                   //               image (replace flow only). Optional.
  onClose,         // () => void
}) {
  const [imageBlob,       setImageBlob]       = useState(null)
  const [uploading,       setUploading]       = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)
  // hasNewSource: flips true once the user pastes or picks a new image.
  // Used to hide the Remove UI — once they've supplied a replacement,
  // they're committed to replacing rather than removing.
  const [hasNewSource,    setHasNewSource]    = useState(false)
  // pendingRemoval: set true when the user clicks "Remove image" in the
  // cropper. Clears the image from the cropper but doesn't commit the
  // removal — the user has to press Save (which sees pendingRemoval and
  // calls onRemove + deletes old variants) or Cancel (which discards).
  const [pendingRemoval,  setPendingRemoval]  = useState(false)
  // errorMessage: inline modal feedback for failures the user needs to see —
  // existing image fetch failed, cropper not ready on Save, upload failed.
  // Rendered as a banner above the footer (near the Save button so it sits
  // where the user is already looking). Cleared on any user action that
  // supersedes the previous attempt (pick / paste / remove / save retry).
  const [errorMessage,    setErrorMessage]    = useState(null)
  const fileInputRef = useRef(null)
  const cropperRef   = useRef(null)
  // Note: the ImageCropper handles its own object URL lifecycle for the
  // image preview, so we don't keep a separate previewUrl here anymore.

  // ── If opened with `existingImage`, fetch its full variant and seed
  // the cropper with it. Cancellation handles unmount mid-fetch and the
  // case where the user picks or pastes a new image while the existing
  // one is still downloading (we only seed if imageBlob is still null).
  // pendingRemoval is in deps so that clicking Remove cancels any
  // in-flight fetch and the new run exits early without re-fetching.
  useEffect(() => {
    if (!existingImage || pendingRemoval) {
      setLoadingExisting(false)
      return
    }
    let cancelled = false
    setLoadingExisting(true)
    ;(async () => {
      try {
        const url = await pipeline.getUrl(existingImage)
        if (cancelled || !url) return
        const res = await fetch(url)
        if (cancelled) return
        const blob = await res.blob()
        if (cancelled) return
        setImageBlob((current) => current ?? blob)
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load existing image', err)
          setErrorMessage("Couldn't load the existing image — pick or paste to start fresh.")
        }
      } finally {
        if (!cancelled) setLoadingExisting(false)
      }
    })()
    return () => { cancelled = true }
  }, [existingImage, pendingRemoval, pipeline])

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
            setHasNewSource(true)
            // If the user had clicked Remove, supplying a new image
            // overrides that intent — they're now replacing.
            setPendingRemoval(false)
            setErrorMessage(null)
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
      setHasNewSource(true)
      setPendingRemoval(false)
      setErrorMessage(null)
    }
  }

  // Remove flow: clears the cropper to the empty state and marks the
  // modal as "pending removal." Doesn't commit anything — Save commits
  // the removal (delete old variants + onRemove callback), Cancel
  // discards. This lets the user see the empty state before confirming
  // and gives them a chance to paste/pick a replacement instead.
  const handleRemove = () => {
    if (!existingImage || uploading) return
    setImageBlob(null)
    setHasNewSource(false)
    setPendingRemoval(true)
    setErrorMessage(null)
  }

  const handleSave = async () => {
    if (uploading) return
    setErrorMessage(null)  // clear any prior error so retry shows a fresh state

    // Pending-removal path: commit the removal, no new upload.
    if (pendingRemoval) {
      if (!existingImage) return
      setUploading(true)
      try {
        if (onRemove) onRemove()
        // Best-effort delete of the old object(s). If this fails, the
        // orphan-cleanup script (ADR-0005 §7) reaps the leftovers;
        // user-visible state (no thumbnail) is already correct.
        try {
          await pipeline.delete(existingImage)
        } catch (err) {
          console.error('Failed to delete old image', err)
        }
        onClose()
      } finally {
        setUploading(false)
      }
      return
    }

    // Upload path: requires a loaded image and a ready cropper.
    if (!imageBlob || !pipeline) return
    if (!cropperRef.current) {
      setErrorMessage("Cropper isn't ready yet — try again in a moment.")
      return
    }
    setUploading(true)
    try {
      // Per ADR-0007: cropper produces the final cropped Blob (size
      // depends on mode — capped at 1920×1080 for image-section,
      // exactly 280×224 for thumbnail, exactly 256×256 for
      // profile-avatar). pipeline.upload handles transcoding and
      // bucket-specific path construction for that domain.
      const croppedBlob = await cropperRef.current.computeCroppedBlob()
      const newPath = await pipeline.upload(croppedBlob)
      onSave(newPath)
      // Replace flow: delete the old object(s) AFTER the new path has
      // been handed back. Same best-effort note as above.
      if (existingImage && existingImage !== newPath) {
        try {
          await pipeline.delete(existingImage)
        } catch (err) {
          console.error('Failed to delete old image', err)
        }
      }
      onClose()
    } catch (err) {
      console.error('Upload failed', err)
      setErrorMessage(`Couldn't upload image: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  // Save is enabled when there's an image to upload, OR when the user
  // has clicked Remove and is committing that removal.
  const saveDisabled = uploading || (!imageBlob && !pendingRemoval)
  const cancelDisabled = uploading
  // Show the Remove UI only while we still have the original existing
  // image loaded (no replacement supplied yet, no removal already
  // pending). Once the user pastes/picks a new image, hide it; once
  // they click Remove, the cropper isn't rendered so this is moot.
  const showRemove = !!existingImage && !hasNewSource && !pendingRemoval

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
            {imageBlob ? (
              <ImageCropper
                ref={cropperRef}
                imageBlob={imageBlob}
                mode={mode}
                onRemove={showRemove ? handleRemove : undefined}
              />
            ) : loadingExisting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
              </div>
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

          {/* Inline error banner — sits above the footer so it appears
              right where the user's attention is when Save fails. */}
          {errorMessage && (
            <div
              role="alert"
              className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          {/* Footer — Cancel + Save bottom-right */}
          <div className="flex justify-end gap-3 px-4 pb-4">
            <button
              onClick={onClose}
              disabled={cancelDisabled}
              className="px-4 py-2 border border-sky-600 text-sky-600 rounded font-semibold hover:bg-sky-50 transition-colors disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed"
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
