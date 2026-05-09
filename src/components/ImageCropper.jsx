// ImageCropper — the working surface inside UploadImageModal once an image
// has been picked or pasted.
//
// Two modes, each with its own UX:
//
//   image-section mode
//     - Frame is sized to fit the cropper canvas with padding. Aspect
//       ratio defaults to the source image's natural ratio (clamped to
//       1:3–3:1). Four corner handles ON THE FRAME let the user reshape
//       it (default = anchor opposite corner; Ctrl/Alt = symmetric
//       around frame center).
//     - Image cover-fits the frame on initial load, centered.
//     - Wheel zoom scales the image around the frame center.
//     - Saved output is the cropped region in source pixels, capped at
//       the 1920×1080 strict box.
//
//   thumbnail mode
//     - Frame is fixed at 280×224 (the thumbnail's saved pixel size),
//       centered in the cropper canvas. No frame corner handles — the
//       frame doesn't reshape.
//     - Image enters at 1:1 with its native pixels if it's larger than
//       the frame in both dimensions; bleeds out to the right and
//       bottom of the frame. If the source is smaller than the frame,
//       it scales up to cover (no white gaps inside the frame).
//     - Image's top-left aligns with the frame's top-left on entry.
//     - Four corner handles ON THE IMAGE let the user scale it
//       uniformly (default = anchor opposite image corner;
//       Ctrl/Alt = symmetric around image center). Wheel zoom also
//       works.
//     - Saved output is always exactly 280×224 — the frame's contents
//       resampled to those dimensions.
//
// The component exposes computeCroppedBlob() via ref so the parent
// modal can fetch the final cropped image on Save. Per ADR-0007, no
// Storage or DB writes happen here — this component only produces a
// Blob.
//
// Coordinate system:
//   - The cropper sits in a container; (0, 0) is its top-left corner.
//   - `framePos` is the frame's center in container coords.
//   - `imgPos` is the image's center in container coords.
//   - `scale` is the image's display scale relative to its natural
//     pixels (1.0 = 1 source pixel per display pixel).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const MIN_FRAME_PX     = 80      // minimum frame side length (image-section)
const FRAME_PAD_PX     = 24      // padding inside the cropper container
const ASPECT_MIN       = 1 / 3   // tallest allowed frame ratio (image-section)
const ASPECT_MAX       = 3       // widest allowed frame ratio (image-section)
const SCALE_MAX_FACTOR = 5       // user can zoom up to 5x cover-min
const STRICT_BOX_W     = 1920    // image-section saved-size width cap
const STRICT_BOX_H     = 1080    // image-section saved-size height cap
const THUMBNAIL_FRAME_W = 280    // thumbnail saved width (and on-screen frame width)
const THUMBNAIL_FRAME_H = 224    // thumbnail saved height (and on-screen frame height)
const THUMBNAIL_RATIO  = 5 / 4   // = 280 / 224
const BOTTOM_RESERVED_PX = 128   // vertical space reserved below frame for the Remove UI (gap + button + dashes + paste hint)

// OS-aware paste hint label (mirrors UploadImageModal's logic).
const isMac = typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent || '')
const PASTE_KEY_LABEL = isMac ? 'Cmd+V' : 'Ctrl+V'

const OPPOSITE_CORNER = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' }

// Return a corner's container-coord position given a center + size +
// which corner (tl / tr / bl / br).
function cornerOf(center, size, corner) {
  const left   = center.x - size.w / 2
  const top    = center.y - size.h / 2
  const right  = left + size.w
  const bottom = top + size.h
  switch (corner) {
    case 'tl': return { x: left,  y: top    }
    case 'tr': return { x: right, y: top    }
    case 'bl': return { x: left,  y: bottom }
    case 'br': return { x: right, y: bottom }
    default:   return { x: left,  y: top    }
  }
}

const ImageCropper = forwardRef(function ImageCropper({ imageBlob, mode, onRemove }, ref) {
  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState(null)   // { w, h }
  const [imageData,     setImageData]     = useState(null)   // { src, width, height }
  const [frameSize,     setFrameSize]     = useState(null)   // { w, h }
  const [framePos,      setFramePos]      = useState(null)   // frame center in container coords
  const [imgPos,        setImgPos]        = useState(null)   // image center in container coords
  const [scale,         setScale]         = useState(1)

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

  // ── Decode the source image so we can read its natural dimensions and
  // render it at any scale.
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

  // ── Initial frame, frame position, image position, scale.
  // Branches by mode — see file-header comment for behavior.
  useEffect(() => {
    if (!imageData || !containerSize) return
    const containerCenter = { x: containerSize.w / 2, y: containerSize.h / 2 }

    if (mode === 'thumbnail') {
      // Frame: fixed 280×224. Centered horizontally; vertically centered
      // in the area above the bottom-reserved Remove UI when onRemove is
      // provided, otherwise centered in the full canvas.
      const fSize = { w: THUMBNAIL_FRAME_W, h: THUMBNAIL_FRAME_H }
      const bottomReserved = onRemove ? BOTTOM_RESERVED_PX : 0
      const usableH = Math.max(fSize.h, containerSize.h - bottomReserved)
      const fPos = { x: containerSize.w / 2, y: usableH / 2 }
      // Image: native size if larger than frame in both dims; else
      // scaled up to cover.
      const initialScale = (imageData.width >= fSize.w && imageData.height >= fSize.h)
        ? 1
        : Math.max(fSize.w / imageData.width, fSize.h / imageData.height)
      // Position: image top-left aligned with frame top-left.
      const imgW = imageData.width  * initialScale
      const imgH = imageData.height * initialScale
      const initImgPos = {
        x: fPos.x - fSize.w / 2 + imgW / 2,
        y: fPos.y - fSize.h / 2 + imgH / 2,
      }
      setFrameSize(fSize)
      setFramePos(fPos)
      setScale(initialScale)
      setImgPos(initImgPos)
    } else {
      // image-section: existing chunk-2 behavior — frame fits container
      // with padding, aspect ratio from source clamped to [1/3, 3],
      // image cover-fits the frame and is centered.
      const sourceRatio = imageData.width / imageData.height
      const frameRatio = Math.max(ASPECT_MIN, Math.min(ASPECT_MAX, sourceRatio))
      const maxW = Math.max(MIN_FRAME_PX, containerSize.w - 2 * FRAME_PAD_PX)
      const maxH = Math.max(MIN_FRAME_PX, containerSize.h - 2 * FRAME_PAD_PX)
      let fw, fh
      if (maxW / frameRatio <= maxH) {
        fw = maxW
        fh = maxW / frameRatio
      } else {
        fh = maxH
        fw = maxH * frameRatio
      }
      const coverScale = Math.max(fw / imageData.width, fh / imageData.height)
      setFrameSize({ w: fw, h: fh })
      setFramePos(containerCenter)
      setScale(coverScale)
      setImgPos(containerCenter)
    }
  }, [imageData, containerSize, mode, onRemove])

  // ── Cover-fit clamping: pull the image's center to the closest position
  // where it still covers the frame. Assumes image dims at scale ≥ frame
  // dims in both axes; caller scales up first if not.
  const clampImgPos = (pos, fPos, fSize, s) => {
    if (!imageData) return pos
    const W = imageData.width  * s
    const H = imageData.height * s
    const fLeft   = fPos.x - fSize.w / 2
    const fTop    = fPos.y - fSize.h / 2
    const fRight  = fLeft + fSize.w
    const fBottom = fTop  + fSize.h
    const minX = fRight  - W / 2
    const maxX = fLeft   + W / 2
    const minY = fBottom - H / 2
    const maxY = fTop    + H / 2
    return {
      x: Math.max(minX, Math.min(maxX, pos.x)),
      y: Math.max(minY, Math.min(maxY, pos.y)),
    }
  }

  // ── Drag tracking. dragRef holds one of three drag kinds:
  //   'image'        — panning the image inside the frame.
  //   'frameHandle'  — resizing the frame (image-section mode).
  //   'imageHandle'  — scaling the image (thumbnail mode).
  const dragRef = useRef(null)

  // ── Image pan ─────────────────────────────────────────────────────────
  const onImagePointerDown = (e) => {
    if (!frameSize || !imgPos) return
    e.target.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'image',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startImgPos: imgPos,
      pointerId: e.pointerId,
    }
  }
  const onImagePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.kind !== 'image' || !frameSize || !framePos) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    const proposed = { x: drag.startImgPos.x + dx, y: drag.startImgPos.y + dy }
    setImgPos(clampImgPos(proposed, framePos, frameSize, scale))
  }
  const onImagePointerUp = (e) => {
    const drag = dragRef.current
    if (!drag) return
    try { e.target.releasePointerCapture(drag.pointerId) } catch { /* ignore */ }
    dragRef.current = null
  }

  // ── Frame-corner resize (image-section mode) ─────────────────────────
  // Default: opposite corner stays fixed in container coords; the
  // dragged corner follows the cursor; frame center shifts.
  // Ctrl/Alt: frame center stays at its drag-start position; the
  // dragged corner and its opposite move mirror-image around that
  // center; cursor distance from center sets size.
  const onFrameHandlePointerDown = (corner) => (e) => {
    if (mode !== 'image-section' || !frameSize || !framePos || !containerSize) return
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    const anchorPos = cornerOf(framePos, frameSize, OPPOSITE_CORNER[corner])
    dragRef.current = {
      kind: 'frameHandle',
      corner,
      anchorPos,
      startFramePos: framePos,
      pointerId: e.pointerId,
    }
  }
  const onFrameHandlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.kind !== 'frameHandle' || !imageData || !containerSize) return
    const rect = containerRef.current.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    const symmetric = e.ctrlKey || e.altKey
    const corner = drag.corner

    let newLeft, newTop, newRight, newBottom

    if (symmetric) {
      const cx = drag.startFramePos.x
      const cy = drag.startFramePos.y
      const halfW = Math.abs(cursorX - cx)
      const halfH = Math.abs(cursorY - cy)
      newLeft   = cx - halfW
      newRight  = cx + halfW
      newTop    = cy - halfH
      newBottom = cy + halfH
    } else {
      const ax = drag.anchorPos.x
      const ay = drag.anchorPos.y
      newLeft   = Math.min(ax, cursorX)
      newRight  = Math.max(ax, cursorX)
      newTop    = Math.min(ay, cursorY)
      newBottom = Math.max(ay, cursorY)
    }

    // Container padding
    const padL = FRAME_PAD_PX
    const padT = FRAME_PAD_PX
    const padR = containerSize.w - FRAME_PAD_PX
    const padB = containerSize.h - FRAME_PAD_PX
    if (symmetric) {
      const cx = drag.startFramePos.x
      const cy = drag.startFramePos.y
      const halfWmax = Math.max(0, Math.min(cx - padL, padR - cx))
      const halfHmax = Math.max(0, Math.min(cy - padT, padB - cy))
      const halfW = Math.min((newRight - newLeft) / 2, halfWmax)
      const halfH = Math.min((newBottom - newTop) / 2, halfHmax)
      newLeft   = cx - halfW
      newRight  = cx + halfW
      newTop    = cy - halfH
      newBottom = cy + halfH
    } else {
      if (corner === 'tl' || corner === 'bl') newLeft   = Math.max(padL, newLeft)
      if (corner === 'tr' || corner === 'br') newRight  = Math.min(padR, newRight)
      if (corner === 'tl' || corner === 'tr') newTop    = Math.max(padT, newTop)
      if (corner === 'bl' || corner === 'br') newBottom = Math.min(padB, newBottom)
    }

    // Minimum frame size
    if (symmetric) {
      const cx = drag.startFramePos.x
      const cy = drag.startFramePos.y
      if (newRight - newLeft < MIN_FRAME_PX) {
        newLeft  = cx - MIN_FRAME_PX / 2
        newRight = cx + MIN_FRAME_PX / 2
      }
      if (newBottom - newTop < MIN_FRAME_PX) {
        newTop    = cy - MIN_FRAME_PX / 2
        newBottom = cy + MIN_FRAME_PX / 2
      }
    } else {
      if (newRight - newLeft < MIN_FRAME_PX) {
        if (corner === 'tl' || corner === 'bl') newLeft = newRight - MIN_FRAME_PX
        else newRight = newLeft + MIN_FRAME_PX
      }
      if (newBottom - newTop < MIN_FRAME_PX) {
        if (corner === 'tl' || corner === 'tr') newTop = newBottom - MIN_FRAME_PX
        else newBottom = newTop + MIN_FRAME_PX
      }
    }

    // Aspect ratio bounds
    let newW = newRight - newLeft
    let newH = newBottom - newTop
    const ratio = newW / newH
    if (ratio > ASPECT_MAX) {
      const targetW = newH * ASPECT_MAX
      const dW = newW - targetW
      if (symmetric) {
        newLeft  += dW / 2
        newRight -= dW / 2
      } else if (corner === 'tl' || corner === 'bl') {
        newLeft = newRight - targetW
      } else {
        newRight = newLeft + targetW
      }
      newW = targetW
    } else if (ratio < ASPECT_MIN) {
      const targetH = newW / ASPECT_MIN
      const dH = newH - targetH
      if (symmetric) {
        newTop    += dH / 2
        newBottom -= dH / 2
      } else if (corner === 'tl' || corner === 'tr') {
        newTop = newBottom - targetH
      } else {
        newBottom = newTop + targetH
      }
      newH = targetH
    }

    const newFrameSize = { w: newW, h: newH }
    const newFramePos = {
      x: (newLeft + newRight) / 2,
      y: (newTop + newBottom) / 2,
    }
    const coverMin = Math.max(newW / imageData.width, newH / imageData.height)
    const newScale = Math.max(scale, coverMin)
    const newImgPos = clampImgPos(imgPos, newFramePos, newFrameSize, newScale)

    setFrameSize(newFrameSize)
    setFramePos(newFramePos)
    setScale(newScale)
    setImgPos(newImgPos)
  }
  const onFrameHandlePointerUp = (e) => {
    const drag = dragRef.current
    if (!drag) return
    try { e.target.releasePointerCapture(drag.pointerId) } catch { /* ignore */ }
    dragRef.current = null
  }

  // ── Image-corner scale (thumbnail mode) ──────────────────────────────
  // Default: opposite IMAGE corner stays fixed in container coords; the
  // dragged corner follows the cursor; image grows uniformly (preserves
  // aspect ratio).
  // Ctrl/Alt: image center stays put; the dragged corner and its
  // opposite move mirror-image around that center.
  const onImageHandlePointerDown = (corner) => (e) => {
    if (mode !== 'thumbnail' || !imageData || !imgPos) return
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    const imgSize = { w: imageData.width * scale, h: imageData.height * scale }
    const anchorPos = cornerOf(imgPos, imgSize, OPPOSITE_CORNER[corner])
    dragRef.current = {
      kind: 'imageHandle',
      corner,
      anchorPos,        // opposite image corner at drag start
      startImgPos: imgPos,
      pointerId: e.pointerId,
    }
  }
  const onImageHandlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.kind !== 'imageHandle' || !imageData || !frameSize || !framePos) return
    const rect = containerRef.current.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    const symmetric = e.ctrlKey || e.altKey

    // Cover-fit minimum scale (image must always cover the frame).
    const coverMin = Math.max(frameSize.w / imageData.width, frameSize.h / imageData.height)
    const maxScale = Math.max(coverMin, 1) * SCALE_MAX_FACTOR

    let proposedScale
    let newImgPos

    if (symmetric) {
      // Anchor: image center (= startImgPos). Cursor's distance from
      // center sets the half-dimensions; we take whichever dimension
      // demands the larger scale.
      const dx = Math.abs(cursorX - drag.startImgPos.x)
      const dy = Math.abs(cursorY - drag.startImgPos.y)
      const sX = (2 * dx) / imageData.width
      const sY = (2 * dy) / imageData.height
      proposedScale = Math.max(sX, sY)
      newImgPos = drag.startImgPos
    } else {
      // Anchor: opposite image corner (drag.anchorPos). Cursor distance
      // from anchor sets the dimensions; we take whichever demands the
      // larger scale (so the dragged corner is at or beyond the cursor).
      const dx = Math.abs(cursorX - drag.anchorPos.x)
      const dy = Math.abs(cursorY - drag.anchorPos.y)
      const sX = dx / imageData.width
      const sY = dy / imageData.height
      proposedScale = Math.max(sX, sY)
      // Anchor stays at anchorPos. The image center moves so that the
      // anchor's relative position to the center scales with the new
      // dimensions. Same math as the wheel-zoom anchor.
      const newW = imageData.width  * proposedScale
      const newH = imageData.height * proposedScale
      // Determine which side of the anchor the image is on.
      const signX = (drag.startImgPos.x >= drag.anchorPos.x) ? 1 : -1
      const signY = (drag.startImgPos.y >= drag.anchorPos.y) ? 1 : -1
      newImgPos = {
        x: drag.anchorPos.x + signX * (newW / 2),
        y: drag.anchorPos.y + signY * (newH / 2),
      }
    }

    // Clamp scale to [coverMin, maxScale]. If it's clamped, the image
    // ends up at a scale the cursor didn't quite ask for — accept it.
    const newScale = Math.max(coverMin, Math.min(maxScale, proposedScale))
    if (newScale !== proposedScale) {
      // Recompute imgPos for the clamped scale (same anchor logic).
      if (symmetric) {
        newImgPos = drag.startImgPos
      } else {
        const newW = imageData.width  * newScale
        const newH = imageData.height * newScale
        const signX = (drag.startImgPos.x >= drag.anchorPos.x) ? 1 : -1
        const signY = (drag.startImgPos.y >= drag.anchorPos.y) ? 1 : -1
        newImgPos = {
          x: drag.anchorPos.x + signX * (newW / 2),
          y: drag.anchorPos.y + signY * (newH / 2),
        }
      }
    }

    // Cover-fit clamp on imgPos.
    const clampedPos = clampImgPos(newImgPos, framePos, frameSize, newScale)
    setScale(newScale)
    setImgPos(clampedPos)
  }
  const onImageHandlePointerUp = (e) => {
    const drag = dragRef.current
    if (!drag) return
    try { e.target.releasePointerCapture(drag.pointerId) } catch { /* ignore */ }
    dragRef.current = null
  }

  // ── Wheel scaling. React 18 attaches wheel listeners passively at root,
  // so preventDefault inside an onWheel prop logs a warning. Attach
  // natively with { passive: false } and read latest state via a ref.
  const wheelStateRef = useRef({ scale, imgPos, framePos, frameSize, imageData })
  wheelStateRef.current = { scale, imgPos, framePos, frameSize, imageData }
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      const s = wheelStateRef.current
      if (!s.imageData || !s.frameSize || !s.framePos || !s.imgPos) return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.001)
      const coverMin = Math.max(
        s.frameSize.w / s.imageData.width,
        s.frameSize.h / s.imageData.height,
      )
      const maxScale = Math.max(coverMin, 1) * SCALE_MAX_FACTOR
      let newScale = s.scale * factor
      newScale = Math.max(coverMin, Math.min(maxScale, newScale))
      if (newScale === s.scale) return
      // Anchor the zoom at the frame center: the source pixel currently
      // at frame center stays at frame center after the scale change.
      const ratio = newScale / s.scale
      const newImgPos = clampImgPos(
        {
          x: s.framePos.x + (s.imgPos.x - s.framePos.x) * ratio,
          y: s.framePos.y + (s.imgPos.y - s.framePos.y) * ratio,
        },
        s.framePos,
        s.frameSize,
        newScale,
      )
      setScale(newScale)
      setImgPos(newImgPos)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Imperative handle: parent calls this on Save to fetch the cropped
  // Blob. Renders the visible frame's contents to an off-screen canvas,
  // sizes the output per mode, and returns a JPEG blob (lossy but high
  // quality — uploadCardImage transcodes to WebP after this).
  useImperativeHandle(ref, () => ({
    computeCroppedBlob: async () => {
      if (!imageData || !frameSize || !framePos || !imgPos) {
        throw new Error('Cropper not ready')
      }
      const fLeft = framePos.x - frameSize.w / 2
      const fTop  = framePos.y - frameSize.h / 2
      const imgLeft = imgPos.x - imageData.width  * scale / 2
      const imgTop  = imgPos.y - imageData.height * scale / 2
      const srcLeftRaw = (fLeft - imgLeft) / scale
      const srcTopRaw  = (fTop  - imgTop ) / scale
      const srcCropW   = frameSize.w / scale
      const srcCropH   = frameSize.h / scale
      const srcLeft = Math.max(0, Math.min(imageData.width  - srcCropW, srcLeftRaw))
      const srcTop  = Math.max(0, Math.min(imageData.height - srcCropH, srcTopRaw))

      // Output size: thumbnail = exactly 280×224; image-section =
      // source-pixel size capped at 1920×1080 strict-box.
      let outW, outH
      if (mode === 'thumbnail') {
        outW = THUMBNAIL_FRAME_W
        outH = THUMBNAIL_FRAME_H
      } else {
        outW = srcCropW
        outH = srcCropH
        if (outW > STRICT_BOX_W || outH > STRICT_BOX_H) {
          const k = Math.min(STRICT_BOX_W / outW, STRICT_BOX_H / outH)
          outW *= k
          outH *= k
        }
        outW = Math.max(1, Math.round(outW))
        outH = Math.max(1, Math.round(outH))
      }

      const canvas = document.createElement('canvas')
      canvas.width  = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      const sourceImg = await loadImage(imageData.src)
      ctx.drawImage(sourceImg, srcLeft, srcTop, srcCropW, srcCropH, 0, 0, outW, outH)
      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
          'image/jpeg',
          0.95,
        )
      })
    },
  }), [imageData, frameSize, framePos, imgPos, scale, mode])

  // ── Render ───────────────────────────────────────────────────────────
  const ready = containerSize && imageData && frameSize && framePos && imgPos
  const frameLeft = ready ? framePos.x - frameSize.w / 2 : 0
  const frameTop  = ready ? framePos.y - frameSize.h / 2 : 0

  // Image-corner positions for thumbnail-mode handles.
  const imgLeft   = ready ? imgPos.x - imageData.width  * scale / 2 : 0
  const imgTop    = ready ? imgPos.y - imageData.height * scale / 2 : 0
  const imgRight  = ready ? imgLeft + imageData.width   * scale     : 0
  const imgBottom = ready ? imgTop  + imageData.height  * scale     : 0

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
          {/* Image */}
          <img
            src={imageData.src}
            alt=""
            className="absolute pointer-events-none"
            style={{
              left:   imgLeft,
              top:    imgTop,
              width:  imageData.width  * scale,
              height: imageData.height * scale,
            }}
            draggable={false}
          />

          {/* Frame outline + dark surround. */}
          <div
            className="absolute pointer-events-none"
            style={{
              left:   frameLeft,
              top:    frameTop,
              width:  frameSize.w,
              height: frameSize.h,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              border:  '1px solid white',
            }}
          />

          {/* Image pan overlay — sits on top of the image, inside the frame. */}
          <div
            className="absolute cursor-move"
            style={{
              left:   frameLeft,
              top:    frameTop,
              width:  frameSize.w,
              height: frameSize.h,
            }}
            onPointerDown={onImagePointerDown}
            onPointerMove={onImagePointerMove}
            onPointerUp={onImagePointerUp}
            onPointerCancel={onImagePointerUp}
          />

          {/* Frame corner handles — image-section mode only. */}
          {mode === 'image-section' && (
            <>
              <Handle x={frameLeft}                 y={frameTop}                  cursor="nwse-resize"
                onPointerDown={onFrameHandlePointerDown('tl')}
                onPointerMove={onFrameHandlePointerMove}
                onPointerUp={onFrameHandlePointerUp} />
              <Handle x={frameLeft + frameSize.w}   y={frameTop}                  cursor="nesw-resize"
                onPointerDown={onFrameHandlePointerDown('tr')}
                onPointerMove={onFrameHandlePointerMove}
                onPointerUp={onFrameHandlePointerUp} />
              <Handle x={frameLeft}                 y={frameTop + frameSize.h}    cursor="nesw-resize"
                onPointerDown={onFrameHandlePointerDown('bl')}
                onPointerMove={onFrameHandlePointerMove}
                onPointerUp={onFrameHandlePointerUp} />
              <Handle x={frameLeft + frameSize.w}   y={frameTop + frameSize.h}    cursor="nwse-resize"
                onPointerDown={onFrameHandlePointerDown('br')}
                onPointerMove={onFrameHandlePointerMove}
                onPointerUp={onFrameHandlePointerUp} />
            </>
          )}

          {/* Image corner handles — thumbnail mode only. */}
          {mode === 'thumbnail' && (
            <>
              <Handle x={imgLeft}  y={imgTop}    cursor="nwse-resize"
                onPointerDown={onImageHandlePointerDown('tl')}
                onPointerMove={onImageHandlePointerMove}
                onPointerUp={onImageHandlePointerUp} />
              <Handle x={imgRight} y={imgTop}    cursor="nesw-resize"
                onPointerDown={onImageHandlePointerDown('tr')}
                onPointerMove={onImageHandlePointerMove}
                onPointerUp={onImageHandlePointerUp} />
              <Handle x={imgLeft}  y={imgBottom} cursor="nesw-resize"
                onPointerDown={onImageHandlePointerDown('bl')}
                onPointerMove={onImageHandlePointerMove}
                onPointerUp={onImageHandlePointerUp} />
              <Handle x={imgRight} y={imgBottom} cursor="nwse-resize"
                onPointerDown={onImageHandlePointerDown('br')}
                onPointerMove={onImageHandlePointerMove}
                onPointerUp={onImageHandlePointerUp} />
            </>
          )}
        </>
      )}

      {/* Remove UI — thumbnail mode only, when onRemove is provided
          (i.e. a replace flow with an existing thumbnail still in
          place). Anchored 32px below the frame's bottom edge.
          Reserves BOTTOM_RESERVED_PX of vertical space below the frame
          so this block has room. */}
      {mode === 'thumbnail' && onRemove && ready && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ top: frameTop + frameSize.h + 32 }}
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
