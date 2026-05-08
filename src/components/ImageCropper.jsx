// ImageCropper — the working surface inside UploadImageModal once an image
// has been picked or pasted. Lets the user position and scale the source
// image, and (in image-section mode) reshape the crop frame between the
// 1:3 (tall) and 3:1 (wide) bounds via four corner handles. Thumbnail mode
// pins the frame to a fixed 5:4 aspect ratio.
//
// The component exposes computeCroppedBlob() via ref so the parent modal
// can fetch the final cropped image on Save. Per ADR-0007, no Storage or
// DB writes happen here — this component only produces a Blob.
//
// Coordinate system:
//   - The cropper sits in a container; (0, 0) is its top-left corner.
//   - `framePos` is the frame's center in container coords. It starts at
//     the container center, but corner-handle drags in default mode move
//     it (the opposite corner stays anchored).
//   - `imgPos` is the image's center in container coords. Image pan moves
//     it; frame manipulations may also adjust it to keep the cover-fit
//     invariant (image must always cover the frame).
//   - `scale` is the image's display scale relative to its natural pixels.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const MIN_FRAME_PX     = 80      // minimum frame side length in canvas px
const FRAME_PAD_PX     = 24      // padding inside the cropper container
const ASPECT_MIN       = 1 / 3   // tallest allowed frame ratio (width/height)
const ASPECT_MAX       = 3       // widest allowed frame ratio (width/height)
const SCALE_MAX_FACTOR = 5       // user can zoom up to 5x cover
const STRICT_BOX_W     = 1920    // saved image strict-box width cap
const STRICT_BOX_H     = 1080    // saved image strict-box height cap
const THUMBNAIL_RATIO  = 5 / 4   // fixed thumbnail aspect ratio (5:4)

const OPPOSITE_CORNER = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' }

// Return a corner's container-coord position given the frame's center +
// size + which corner (tl / tr / bl / br).
function cornerOf(framePos, frameSize, corner) {
  const left   = framePos.x - frameSize.w / 2
  const top    = framePos.y - frameSize.h / 2
  const right  = left + frameSize.w
  const bottom = top + frameSize.h
  switch (corner) {
    case 'tl': return { x: left,  y: top    }
    case 'tr': return { x: right, y: top    }
    case 'bl': return { x: left,  y: bottom }
    case 'br': return { x: right, y: bottom }
    default:   return { x: left,  y: top    }
  }
}

const ImageCropper = forwardRef(function ImageCropper({ imageBlob, mode }, ref) {
  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState(null)   // { w, h }
  const [imageData,     setImageData]     = useState(null)   // { src, width, height }
  const [frameSize,     setFrameSize]     = useState(null)   // { w, h }
  const [framePos,      setFramePos]      = useState(null)   // frame center in container coords
  const [imgPos,        setImgPos]        = useState(null)   // image center in container coords
  const [scale,         setScale]         = useState(1)

  // ── Container size: track via ResizeObserver so the cropper reflows ─────
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

  // ── Initial frame, frame position, image position, scale — all set once
  // image and container are both measured. Frame defaults to source image's
  // natural aspect ratio (clamped to 1:3–3:1) in image-section mode; pinned
  // to 5:4 in thumbnail mode. Frame and image both start centered.
  useEffect(() => {
    if (!imageData || !containerSize) return
    const sourceRatio = imageData.width / imageData.height
    const frameRatio = mode === 'thumbnail'
      ? THUMBNAIL_RATIO
      : Math.max(ASPECT_MIN, Math.min(ASPECT_MAX, sourceRatio))
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
    const center = { x: containerSize.w / 2, y: containerSize.h / 2 }
    const coverScale = Math.max(fw / imageData.width, fh / imageData.height)
    setFrameSize({ w: fw, h: fh })
    setFramePos(center)
    setImgPos(center)
    setScale(coverScale)
  }, [imageData, containerSize, mode])

  // ── Cover-fit clamping: pull the image's center to the closest position
  // where it still covers the frame. Assumes image dims at scale ≥ frame
  // dims; caller is expected to scale up first if not.
  const clampImgPos = (pos, fPos, fSize, s) => {
    if (!imageData) return pos
    const W = imageData.width  * s
    const H = imageData.height * s
    const fLeft   = fPos.x - fSize.w / 2
    const fTop    = fPos.y - fSize.h / 2
    const fRight  = fLeft + fSize.w
    const fBottom = fTop  + fSize.h
    // Image must extend at least to fLeft on left and fRight on right:
    //   imgPos.x - W/2 ≤ fLeft  AND  imgPos.x + W/2 ≥ fRight
    //   ⇒ fRight - W/2 ≤ imgPos.x ≤ fLeft + W/2
    const minX = fRight  - W / 2
    const maxX = fLeft   + W / 2
    const minY = fBottom - H / 2
    const maxY = fTop    + H / 2
    return {
      x: Math.max(minX, Math.min(maxX, pos.x)),
      y: Math.max(minY, Math.min(maxY, pos.y)),
    }
  }

  // ── Drag tracking. dragRef holds either an image-pan drag or a
  // corner-handle resize drag. Pointer capture keeps the events flowing
  // when the cursor leaves the element.
  const dragRef = useRef(null)

  // ── Image pan ─────────────────────────────────────────────────────────────
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
    const proposed = {
      x: drag.startImgPos.x + dx,
      y: drag.startImgPos.y + dy,
    }
    setImgPos(clampImgPos(proposed, framePos, frameSize, scale))
  }
  const onImagePointerUp = (e) => {
    const drag = dragRef.current
    if (!drag) return
    try { e.target.releasePointerCapture(drag.pointerId) } catch { /* ignore */ }
    dragRef.current = null
  }

  // ── Corner-handle resize (image-section mode only) ───────────────────────
  // Default (no modifier): the OPPOSITE corner stays fixed in container
  // coords; the dragged corner follows the cursor; frame center shifts.
  // Symmetric (Ctrl or Alt held during the drag): frame center stays fixed
  // at its drag-start position; the dragged corner and its opposite move
  // mirror-image around that center; cursor distance from center sets size.
  const onHandlePointerDown = (corner) => (e) => {
    if (mode !== 'image-section' || !frameSize || !framePos || !containerSize) return
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    const anchorPos = cornerOf(framePos, frameSize, OPPOSITE_CORNER[corner])
    dragRef.current = {
      kind: 'handle',
      corner,
      anchorPos,         // opposite corner's position at drag start
      startFramePos: framePos,  // frame center at drag start (used in symmetric mode)
      pointerId: e.pointerId,
    }
  }
  const onHandlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.kind !== 'handle' || !imageData || !containerSize) return
    const rect = containerRef.current.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    const symmetric = e.ctrlKey || e.altKey
    const corner = drag.corner

    // ── Step 1: derive new frame edges (left, top, right, bottom) ─────────
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
      // Default: opposite corner stays anchored. Cursor is the dragged
      // corner. Compute frame from the two points.
      const ax = drag.anchorPos.x
      const ay = drag.anchorPos.y
      newLeft   = Math.min(ax, cursorX)
      newRight  = Math.max(ax, cursorX)
      newTop    = Math.min(ay, cursorY)
      newBottom = Math.max(ay, cursorY)
    }

    // ── Step 2: container padding ─────────────────────────────────────────
    const padL = FRAME_PAD_PX
    const padT = FRAME_PAD_PX
    const padR = containerSize.w - FRAME_PAD_PX
    const padB = containerSize.h - FRAME_PAD_PX
    if (symmetric) {
      // Shrink symmetrically from the boundary that overshoots first
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
      // Clamp dragged sides only (anchor side stays put)
      if (corner === 'tl' || corner === 'bl') newLeft = Math.max(padL, newLeft)
      if (corner === 'tr' || corner === 'br') newRight = Math.min(padR, newRight)
      if (corner === 'tl' || corner === 'tr') newTop = Math.max(padT, newTop)
      if (corner === 'bl' || corner === 'br') newBottom = Math.min(padB, newBottom)
    }

    // ── Step 3: minimum frame size — pull the dragged side toward anchor
    // (or shrink symmetrically) so the frame is always ≥ MIN_FRAME_PX.
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

    // ── Step 4: aspect ratio bounds [1:3, 3:1]. If the proposed frame
    // exceeds the bounds, shrink whichever dimension overshoots, pulling
    // the dragged side(s) toward the anchor.
    let newW = newRight - newLeft
    let newH = newBottom - newTop
    const ratio = newW / newH
    if (ratio > ASPECT_MAX) {
      // Too wide: reduce width.
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
      // Too tall: reduce height.
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

    // ── Step 5: ensure cover-fit. If the new frame requires a larger image
    // scale to be fully covered, raise the scale.
    const coverMin = Math.max(newW / imageData.width, newH / imageData.height)
    const newScale = Math.max(scale, coverMin)

    // ── Step 6: pull image position toward the closest cover-valid point
    // (the image stays put unless the frame change pushed it out of cover).
    const newImgPos = clampImgPos(imgPos, newFramePos, newFrameSize, newScale)

    setFrameSize(newFrameSize)
    setFramePos(newFramePos)
    setScale(newScale)
    setImgPos(newImgPos)
  }
  const onHandlePointerUp = (e) => {
    const drag = dragRef.current
    if (!drag) return
    try { e.target.releasePointerCapture(drag.pointerId) } catch { /* ignore */ }
    dragRef.current = null
  }

  // ── Wheel scaling. React 18 attaches wheel listeners passively at root,
  // so preventDefault inside an onWheel prop logs a warning. Attach
  // natively with { passive: false } and read the latest state via a ref.
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
      const maxScale = coverMin * SCALE_MAX_FACTOR
      let newScale = s.scale * factor
      newScale = Math.max(coverMin, Math.min(maxScale, newScale))
      if (newScale === s.scale) return
      // Anchor the zoom at the frame center: the source pixel currently at
      // frame center stays at frame center after the scale change.
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
  // Blob. We render the visible frame's contents to an off-screen canvas,
  // applying the 1920×1080 strict-box cap, and return a JPEG blob (lossy
  // but high quality — uploadCardImage transcodes to WebP after this).
  useImperativeHandle(ref, () => ({
    computeCroppedBlob: async () => {
      if (!imageData || !frameSize || !framePos || !imgPos) {
        throw new Error('Cropper not ready')
      }
      // Map the visible frame back into source-pixel coordinates.
      const fLeft = framePos.x - frameSize.w / 2
      const fTop  = framePos.y - frameSize.h / 2
      const imgLeft = imgPos.x - imageData.width  * scale / 2
      const imgTop  = imgPos.y - imageData.height * scale / 2
      // Source-pixel offset of the frame's top-left within the image.
      const srcLeftRaw = (fLeft - imgLeft) / scale
      const srcTopRaw  = (fTop  - imgTop ) / scale
      const srcCropW   = frameSize.w / scale
      const srcCropH   = frameSize.h / scale
      // Numerical safety: ensure the source rectangle stays inside the
      // image bounds even with float drift in the cover-fit clamps.
      const srcLeft = Math.max(0, Math.min(imageData.width  - srcCropW, srcLeftRaw))
      const srcTop  = Math.max(0, Math.min(imageData.height - srcCropH, srcTopRaw))
      // Apply the 1920×1080 strict-box cap.
      let outW = srcCropW
      let outH = srcCropH
      if (outW > STRICT_BOX_W || outH > STRICT_BOX_H) {
        const k = Math.min(STRICT_BOX_W / outW, STRICT_BOX_H / outH)
        outW *= k
        outH *= k
      }
      outW = Math.max(1, Math.round(outW))
      outH = Math.max(1, Math.round(outH))
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
  }), [imageData, frameSize, framePos, imgPos, scale])

  // ── Render ───────────────────────────────────────────────────────────────
  const ready = containerSize && imageData && frameSize && framePos && imgPos
  const frameLeft = ready ? framePos.x - frameSize.w / 2 : 0
  const frameTop  = ready ? framePos.y - frameSize.h / 2 : 0

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
          {/* Image — direct width/height (no transform) so positioning is
              decoupled from CSS transform-origin gotchas. */}
          <img
            src={imageData.src}
            alt=""
            className="absolute pointer-events-none"
            style={{
              left:   imgPos.x - imageData.width  * scale / 2,
              top:    imgPos.y - imageData.height * scale / 2,
              width:  imageData.width  * scale,
              height: imageData.height * scale,
            }}
            draggable={false}
          />

          {/* Frame outline + dark surround. The huge box-shadow darkens
              everything outside the frame in one element. */}
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

          {/* Corner handles — image-section mode only. */}
          {mode === 'image-section' && (
            <>
              <Handle x={frameLeft}                 y={frameTop}                  cursor="nwse-resize"
                onPointerDown={onHandlePointerDown('tl')}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp} />
              <Handle x={frameLeft + frameSize.w}   y={frameTop}                  cursor="nesw-resize"
                onPointerDown={onHandlePointerDown('tr')}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp} />
              <Handle x={frameLeft}                 y={frameTop + frameSize.h}    cursor="nesw-resize"
                onPointerDown={onHandlePointerDown('bl')}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp} />
              <Handle x={frameLeft + frameSize.w}   y={frameTop + frameSize.h}    cursor="nwse-resize"
                onPointerDown={onHandlePointerDown('br')}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp} />
            </>
          )}
        </>
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
