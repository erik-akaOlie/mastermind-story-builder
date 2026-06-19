// ImageCropper — the working surface inside UploadImageModal once an image
// has been picked or pasted.
//
// INTERACTION MODEL (Option B rewrite, 2026-06-18): the image is drawn
// STATIC, fit to the canvas, and the user moves / resizes a CROP BOX over it
// to select the region to keep. This is the inverse of the prior model (fixed
// frame, drag the image behind it). Same model for every mode — only the crop
// box's aspect lock and the saved output size differ:
//
//   image-section  — free aspect; box defaults to the whole image. Output is
//                    the source-pixel crop, capped at 4096px long edge. Feeds
//                    the high-res `printable` variant (ADR-0005 amendment).
//   thumbnail      — locked to 5:4; saved at exactly 560×448.
//   profile-avatar — locked to 1:1; saved at exactly 512×512.
//   workspace-cover— locked to 16:9 (reserved; not wired into the UI yet).
//
// HANDLES: every mode has four corner handles. Free-aspect content mode also
// gets four mid-edge handles (single-axis resize) since its ratio is flexible.
// MODIFIERS (Figma/Photoshop, all modes): Ctrl/Alt scales from the box center;
// Shift locks the ratio while scaling (a no-op in fixed-ratio modes). They're
// read live from each pointer-move event.
//
// All the geometry lives in cropGeometry.js (pure, unit-tested). This
// component owns only pointer plumbing + rendering.
//
// OUTPUT FORMAT: computeCroppedBlob() returns a PNG. PNG is lossless and
// preserves transparency, so the upload pipeline (imageStorage.js) can do all
// final format/quality decisions downstream — including detecting real
// transparency to pick JPEG vs PNG for the printable variant. Emitting JPEG
// here would flatten transparency before that detection ever runs.
//
// The component exposes computeCroppedBlob() via ref so the parent modal can
// fetch the final cropped image on Save. Per ADR-0007, no Storage or DB writes
// happen here — this component only produces a Blob.
//
// Coordinate system: the cropper sits in a container; (0, 0) is its top-left.
// `displayRect` is the static image's placement { left, top, w, h, scale }
// (scale = display-px per source-px). `cropBox` is { x, y, w, h } with (x, y)
// its top-left corner.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  aspectForMode,
  fitContain,
  initialCropBox,
  clampBoxToRect,
  boxCorner,
  resizeCropBox,
  cropBoxToSourceRect,
  outputSizeForMode,
} from './cropGeometry.js'

const FRAME_PAD_PX       = 24   // padding inside the cropper container
const BOTTOM_RESERVED_PX = 128  // space reserved below the image for the Remove UI

// OS-aware paste hint label (mirrors UploadImageModal's logic).
const isMac = typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent || '')
const PASTE_KEY_LABEL = isMac ? 'Cmd+V' : 'Ctrl+V'

const ImageCropper = forwardRef(function ImageCropper({ imageBlob, mode, onRemove }, ref) {
  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState(null)   // { w, h }
  const [imageData,     setImageData]     = useState(null)   // { src, width, height }
  const [displayRect,   setDisplayRect]   = useState(null)   // { left, top, w, h, scale }
  const [cropBox,       setCropBox]       = useState(null)   // { x, y, w, h }

  // ── Container size: track via ResizeObserver so the cropper reflows. ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Decode the source image so we can read its natural dimensions. ──
  useEffect(() => {
    if (!imageBlob) return
    const url = URL.createObjectURL(imageBlob)
    const img = new Image()
    img.onload = () => {
      setImageData({ src: url, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      console.error('Cropper: failed to decode image')
      setImageData(null)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [imageBlob])

  // ── Lay out the static image (fit-contain) + the initial crop box. ──
  useEffect(() => {
    if (!imageData || !containerSize) return
    const bottomReserved = onRemove ? BOTTOM_RESERVED_PX : 0
    const area = {
      x: FRAME_PAD_PX,
      y: FRAME_PAD_PX,
      w: Math.max(1, containerSize.w - 2 * FRAME_PAD_PX),
      h: Math.max(1, containerSize.h - 2 * FRAME_PAD_PX - bottomReserved),
    }
    const rect = fitContain(imageData.width, imageData.height, area)
    setDisplayRect(rect)
    setCropBox(initialCropBox(rect, aspectForMode(mode)))
  }, [imageData, containerSize, mode, onRemove])

  // ── Drag tracking. dragRef holds one of two kinds:
  //   'move'   — translating the crop box over the static image.
  //   'resize' — resizing via a corner handle (opposite corner pinned).
  const dragRef = useRef(null)

  const endDrag = (e) => {
    const drag = dragRef.current
    if (!drag) return
    try { e.target.releasePointerCapture(drag.pointerId) } catch { /* ignore */ }
    dragRef.current = null
  }

  // ── Move the crop box ──────────────────────────────────────────────────
  const onBoxPointerDown = (e) => {
    if (!cropBox) return
    e.target.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: cropBox,
      pointerId: e.pointerId,
    }
  }
  const onBoxPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.kind !== 'move' || !displayRect) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    setCropBox(clampBoxToRect(
      { ...drag.startBox, x: drag.startBox.x + dx, y: drag.startBox.y + dy },
      displayRect,
    ))
  }

  // ── Resize the crop box via a corner or edge handle ────────────────────
  // Modifiers are read live from each pointer-move event: Ctrl/Alt → scale
  // from center; Shift → lock ratio (free-aspect content only — fixed modes
  // are already locked via aspectForMode).
  const onHandlePointerDown = (handle) => (e) => {
    if (!cropBox) return
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'resize',
      handle,
      startBox: cropBox,
      pointerId: e.pointerId,
    }
  }
  const onHandlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.kind !== 'resize' || !displayRect) return
    const rect = containerRef.current.getBoundingClientRect()
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setCropBox(resizeCropBox({
      handle: drag.handle,
      cursor,
      startBox: drag.startBox,
      aspect: aspectForMode(mode),
      lockAspect: e.shiftKey,
      symmetric: e.ctrlKey || e.altKey,
      rect: displayRect,
    }))
  }

  // ── Imperative handle: parent calls this on Save. Renders the crop box's
  // source region to an off-screen canvas at the per-mode output size and
  // returns a PNG blob (lossless; the upload pipeline re-encodes per variant).
  useImperativeHandle(ref, () => ({
    computeCroppedBlob: async () => {
      if (!imageData || !displayRect || !cropBox) {
        throw new Error('Cropper not ready')
      }
      const { srcX, srcY, srcW, srcH } =
        cropBoxToSourceRect(cropBox, displayRect, imageData.width, imageData.height)
      const { outW, outH } = outputSizeForMode(mode, srcW, srcH)

      const canvas = document.createElement('canvas')
      canvas.width  = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      const sourceImg = await loadImage(imageData.src)
      ctx.drawImage(sourceImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
          'image/png',
        )
      })
    },
  }), [imageData, displayRect, cropBox, mode])

  // ── Render ───────────────────────────────────────────────────────────
  const ready = containerSize && imageData && displayRect && cropBox

  // Free-aspect (content) mode gets mid-edge handles too; fixed-ratio modes
  // stay corners-only so the locked ratio reads as intentional.
  const freeAspect = aspectForMode(mode) === null

  const handlePos = ready
    ? {
        tl: boxCorner(cropBox, 'tl'),
        tr: boxCorner(cropBox, 'tr'),
        bl: boxCorner(cropBox, 'bl'),
        br: boxCorner(cropBox, 'br'),
        t: { x: cropBox.x + cropBox.w / 2, y: cropBox.y },
        b: { x: cropBox.x + cropBox.w / 2, y: cropBox.y + cropBox.h },
        l: { x: cropBox.x, y: cropBox.y + cropBox.h / 2 },
        r: { x: cropBox.x + cropBox.w, y: cropBox.y + cropBox.h / 2 },
      }
    : null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none overflow-hidden bg-gray-100"
      style={{ touchAction: 'none' }}
    >
      {!ready ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Static image — never moves; fit-contain in the work area. */}
          <img
            src={imageData.src}
            alt=""
            className="absolute pointer-events-none"
            style={{
              left:   displayRect.left,
              top:    displayRect.top,
              width:  displayRect.w,
              height: displayRect.h,
            }}
            draggable={false}
          />

          {/* Crop box outline + dark surround (everything outside the box). */}
          <div
            className="absolute pointer-events-none"
            style={{
              left:   cropBox.x,
              top:    cropBox.y,
              width:  cropBox.w,
              height: cropBox.h,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              border:  '1px solid white',
            }}
          />

          {/* Crop box interior — drag to move. */}
          <div
            className="absolute cursor-move"
            style={{
              left:   cropBox.x,
              top:    cropBox.y,
              width:  cropBox.w,
              height: cropBox.h,
            }}
            onPointerDown={onBoxPointerDown}
            onPointerMove={onBoxPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />

          {/* Corner handles — resize the crop box (aspect-locked per mode). */}
          <Handle x={handlePos.tl.x} y={handlePos.tl.y} cursor="nwse-resize"
            onPointerDown={onHandlePointerDown('tl')} onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag} />
          <Handle x={handlePos.tr.x} y={handlePos.tr.y} cursor="nesw-resize"
            onPointerDown={onHandlePointerDown('tr')} onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag} />
          <Handle x={handlePos.bl.x} y={handlePos.bl.y} cursor="nesw-resize"
            onPointerDown={onHandlePointerDown('bl')} onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag} />
          <Handle x={handlePos.br.x} y={handlePos.br.y} cursor="nwse-resize"
            onPointerDown={onHandlePointerDown('br')} onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag} />

          {/* Mid-edge handles — free-aspect (content) only: adjust one axis. */}
          {freeAspect && (
            <>
              <Handle x={handlePos.t.x} y={handlePos.t.y} cursor="ns-resize"
                onPointerDown={onHandlePointerDown('t')} onPointerMove={onHandlePointerMove}
                onPointerUp={endDrag} />
              <Handle x={handlePos.b.x} y={handlePos.b.y} cursor="ns-resize"
                onPointerDown={onHandlePointerDown('b')} onPointerMove={onHandlePointerMove}
                onPointerUp={endDrag} />
              <Handle x={handlePos.l.x} y={handlePos.l.y} cursor="ew-resize"
                onPointerDown={onHandlePointerDown('l')} onPointerMove={onHandlePointerMove}
                onPointerUp={endDrag} />
              <Handle x={handlePos.r.x} y={handlePos.r.y} cursor="ew-resize"
                onPointerDown={onHandlePointerDown('r')} onPointerMove={onHandlePointerMove}
                onPointerUp={endDrag} />
            </>
          )}
        </>
      )}

      {/* Remove UI — replace flows (an existing image is loaded). Anchored
          below the static image; BOTTOM_RESERVED_PX reserves room for it. */}
      {onRemove && ready && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ top: displayRect.top + displayRect.h + 32 }}
        >
          <button
            onClick={onRemove}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors"
          >
            Remove image
          </button>
          <p className="text-gray-700 text-sm select-none">— or —</p>
          <p className="text-gray-700 text-sm">
            <span className="font-bold">{PASTE_KEY_LABEL}</span> to paste a new image
          </p>
        </div>
      )}
    </div>
  )
})

function Handle({ x, y, cursor, onPointerDown, onPointerMove, onPointerUp }) {
  return (
    <div
      className="absolute"
      style={{
        left: x - 12,
        top:  y - 12,
        width:  24,
        height: 24,
        cursor,
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-gray-500 rounded-full shadow" />
    </div>
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

export default ImageCropper
