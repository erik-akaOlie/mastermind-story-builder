// ============================================================================
// cropGeometry — pure geometry for the crop-box ImageCropper.
// ----------------------------------------------------------------------------
// No DOM, no React. Extracted from ImageCropper so the load-bearing math
// (crop-box → source-pixel mapping, output sizing, aspect-locked resize) is
// unit-testable without a browser/Canvas. The cropper component owns only the
// pointer plumbing and rendering; all the arithmetic lives here.
//
// Interaction model (ADR-0005 amendment + the Option B cropper rewrite):
// the image is drawn STATIC (fit-contain), and the user moves / resizes a
// crop box over it — the inverse of the old "fixed frame, move the image"
// model.
//
// Coordinates are container pixels. A `rect`/`displayRect` is
// { left, top, w, h, scale } where `scale` is display-px per source-px. A
// `box` is { x, y, w, h } with (x, y) its top-left corner.
// ============================================================================

// Per-mode output policy.
export const THUMBNAIL_OUT = { w: 560, h: 448 }   // UI-identity, 5:4 (2× legacy 280×224)
export const PROFILE_OUT   = { w: 512, h: 512 }   // UI-identity, 1:1 (2× legacy 256²)
export const COVER_OUT     = { w: 1536, h: 864 }  // workspace-cover, 16:9

// Content/handout long-edge cap. Matches PRINTABLE_MAX_EDGE in imageStorage.js
// (kept independent so this module stays DOM/network-free). The cropper caps
// here so it never hands a multi-thousand-px blob to the upload pipeline; the
// pipeline re-applies its own 4096 cap, so the two only need to agree loosely.
export const CONTENT_MAX_EDGE = 4096

export const MIN_BOX_PX = 48   // smallest crop-box side, in container px

// Aspect ratio (w / h) the crop box is locked to, or null for free aspect.
export function aspectForMode(mode) {
  if (mode === 'thumbnail')      return THUMBNAIL_OUT.w / THUMBNAIL_OUT.h
  if (mode === 'profile-avatar') return PROFILE_OUT.w / PROFILE_OUT.h
  if (mode === 'workspace-cover') return COVER_OUT.w / COVER_OUT.h
  return null // image-section: free aspect (content/handout)
}

// Fixed output dimensions for a UI-identity mode, or null for content
// (content output is computed from the crop region).
export function fixedOutputForMode(mode) {
  if (mode === 'thumbnail')       return THUMBNAIL_OUT
  if (mode === 'profile-avatar')  return PROFILE_OUT
  if (mode === 'workspace-cover') return COVER_OUT
  return null
}

// Fit an image inside an area (contain), centered. Allows upscaling small
// images so the work surface stays usable; the actual crop always reads from
// source pixels, so display upscale costs no output quality.
export function fitContain(imgW, imgH, area) {
  const scale = Math.min(area.w / imgW, area.h / imgH)
  const w = imgW * scale
  const h = imgH * scale
  return {
    scale,
    left: area.x + (area.w - w) / 2,
    top:  area.y + (area.h - h) / 2,
    w,
    h,
  }
}

// Largest box of `aspect` (w/h) fitting inside rect, centered. aspect == null
// → the whole rect (free-aspect default = "select all, trim inward").
export function initialCropBox(rect, aspect) {
  if (!aspect) return { x: rect.left, y: rect.top, w: rect.w, h: rect.h }
  let w = rect.w
  let h = w / aspect
  if (h > rect.h) {
    h = rect.h
    w = h * aspect
  }
  return {
    x: rect.left + (rect.w - w) / 2,
    y: rect.top  + (rect.h - h) / 2,
    w,
    h,
  }
}

// Clamp a (moved) box so it stays fully within rect. Assumes the box is no
// larger than rect in either axis (resize enforces that).
export function clampBoxToRect(box, rect) {
  const x = Math.min(Math.max(box.x, rect.left), rect.left + rect.w - box.w)
  const y = Math.min(Math.max(box.y, rect.top),  rect.top  + rect.h - box.h)
  return { x, y, w: box.w, h: box.h }
}

// The container-coord position of one corner of a box.
export function boxCorner(box, corner) {
  const right = box.x + box.w
  const bottom = box.y + box.h
  switch (corner) {
    case 'tl': return { x: box.x,  y: box.y }
    case 'tr': return { x: right,  y: box.y }
    case 'bl': return { x: box.x,  y: bottom }
    case 'br': return { x: right,  y: bottom }
    default:   return { x: box.x,  y: box.y }
  }
}

// Which edge(s) each handle moves. Corners move one edge per axis; mid-edge
// handles ('t' / 'r' / 'b' / 'l') move a single edge and leave the other axis
// free (used only in free-aspect content mode).
const HANDLE_AXES = {
  tl: { x: 'left',  y: 'top'    },
  tr: { x: 'right', y: 'top'    },
  bl: { x: 'left',  y: 'bottom' },
  br: { x: 'right', y: 'bottom' },
  t:  { x: null,    y: 'top'    },
  b:  { x: null,    y: 'bottom' },
  l:  { x: 'left',  y: null     },
  r:  { x: 'right', y: null     },
}

// Resize a box by dragging `handle` toward `cursor`, starting from `startBox`.
// Modifiers (Figma/Photoshop conventions):
//   symmetric  (Ctrl/Alt) → scale about the start box's center, both sides.
//   lockAspect (Shift)    → lock to the start box's ratio while scaling
//                           (fixed-ratio modes pass `aspect` directly, so for
//                           them the ratio is always locked regardless).
// Honors a minimum size and the `rect` bounds (the box can't leave the image).
export function resizeCropBox({
  handle, cursor, startBox, aspect = null, lockAspect = false,
  symmetric = false, rect, minPx = MIN_BOX_PX,
}) {
  const axes = HANDLE_AXES[handle] || HANDLE_AXES.br
  const sLeft = startBox.x
  const sTop = startBox.y
  const sRight = startBox.x + startBox.w
  const sBottom = startBox.y + startBox.h
  const cx = (sLeft + sRight) / 2
  const cy = (sTop + sBottom) / 2

  const rLeft = rect.left
  const rTop = rect.top
  const rRight = rect.left + rect.w
  const rBottom = rect.top + rect.h

  const controlsX = axes.x != null
  const controlsY = axes.y != null

  // Effective aspect: fixed modes pass their own aspect; free-aspect content
  // opts in via Shift, locking to the start box's ratio.
  const effAspect = aspect ?? (lockAspect ? startBox.w / startBox.h : null)

  // Candidate size + in-rect maximum, per controlled axis.
  let candW = startBox.w
  let candH = startBox.h
  let maxW = Infinity
  let maxH = Infinity

  if (controlsX) {
    if (symmetric) {
      candW = 2 * Math.abs(cursor.x - cx)
      maxW = 2 * Math.min(cx - rLeft, rRight - cx)
    } else if (axes.x === 'right') {
      candW = cursor.x - sLeft
      maxW = rRight - sLeft
    } else {
      candW = sRight - cursor.x
      maxW = sRight - rLeft
    }
  }
  if (controlsY) {
    if (symmetric) {
      candH = 2 * Math.abs(cursor.y - cy)
      maxH = 2 * Math.min(cy - rTop, rBottom - cy)
    } else if (axes.y === 'bottom') {
      candH = cursor.y - sTop
      maxH = rBottom - sTop
    } else {
      candH = sBottom - cursor.y
      maxH = sBottom - rTop
    }
  }

  // When aspect grows an UNcontrolled axis (edge-handle case), it grows
  // centered on the start center, so its room is bounded symmetrically.
  const maxPerpW = 2 * Math.min(cx - rLeft, rRight - cx)
  const maxPerpH = 2 * Math.min(cy - rTop, rBottom - cy)

  let w, h
  if (effAspect) {
    if (controlsX && controlsY) {
      // Corner: cover the cursor in both axes, then lock ratio.
      w = Math.max(candW, candH * effAspect)
      const wMax = Math.min(maxW, maxH * effAspect)
      const wMin = Math.max(minPx, minPx * effAspect)
      w = Math.min(Math.max(w, wMin), wMax)
      h = w / effAspect
    } else if (controlsX) {
      w = candW
      const wMax = Math.min(maxW, maxPerpH * effAspect)
      const wMin = Math.max(minPx, minPx * effAspect)
      w = Math.min(Math.max(w, wMin), wMax)
      h = w / effAspect
    } else {
      h = candH
      const hMax = Math.min(maxH, maxPerpW / effAspect)
      const hMin = Math.max(minPx, minPx / effAspect)
      h = Math.min(Math.max(h, hMin), hMax)
      w = h * effAspect
    }
  } else {
    w = controlsX ? Math.min(Math.max(candW, minPx), maxW) : startBox.w
    h = controlsY ? Math.min(Math.max(candH, minPx), maxH) : startBox.h
  }

  // Placement: anchored side stays put; symmetric / aspect-grown axes center.
  let x
  if ((effAspect && !controlsX) || (symmetric && controlsX)) x = cx - w / 2
  else if (controlsX && axes.x === 'right') x = sLeft
  else if (controlsX && axes.x === 'left')  x = sRight - w
  else x = sLeft

  let y
  if ((effAspect && !controlsY) || (symmetric && controlsY)) y = cy - h / 2
  else if (controlsY && axes.y === 'bottom') y = sTop
  else if (controlsY && axes.y === 'top')    y = sBottom - h
  else y = sTop

  return { x, y, w, h }
}

// Map a crop box (container coords) to a source-pixel rectangle, clamped to
// the image bounds. This is the load-bearing mapping the saved crop depends on.
export function cropBoxToSourceRect(box, displayRect, imgW, imgH) {
  const s = displayRect.scale
  let srcX = (box.x - displayRect.left) / s
  let srcY = (box.y - displayRect.top)  / s
  let srcW = box.w / s
  let srcH = box.h / s

  srcX = Math.max(0, Math.min(srcX, imgW))
  srcY = Math.max(0, Math.min(srcY, imgH))
  srcW = Math.max(1, Math.min(srcW, imgW - srcX))
  srcH = Math.max(1, Math.min(srcH, imgH - srcY))
  return { srcX, srcY, srcW, srcH }
}

// Output dimensions for the rendered crop. UI-identity modes use their fixed
// size; content uses the source crop size capped at CONTENT_MAX_EDGE long edge
// (the printable variant feeds off this; display variants downscale from it).
export function outputSizeForMode(mode, srcW, srcH) {
  const fixed = fixedOutputForMode(mode)
  if (fixed) return { outW: fixed.w, outH: fixed.h }
  const longEdge = Math.max(srcW, srcH)
  const scale = longEdge > CONTENT_MAX_EDGE ? CONTENT_MAX_EDGE / longEdge : 1
  return {
    outW: Math.max(1, Math.round(srcW * scale)),
    outH: Math.max(1, Math.round(srcH * scale)),
  }
}
