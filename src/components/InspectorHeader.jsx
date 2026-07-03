// InspectorHeader — the type-colored band at the top of the Inspector.
// Composes:
//   - Avatar (with click-to-replace via Upload Image modal + lightbox on click)
//   - Title input (focused on mount)
//   - TypePicker (the type dropdown)
//   - Close button
//
// Avatar has two states. Both surface a pencil-fill edit affordance in
// the top-right corner — visibility differs by whether a thumbnail exists,
// so that users with no thumbnail see the affordance unprompted (the
// 2026-05-19 usability finding it addresses):
//   - Empty (no thumbnail): the whole tile is one click target. The pencil
//     icon stays visible at 70% opacity; tile hover brightens it to 100%.
//     Clicking anywhere on the tile opens the Upload Image modal fresh.
//   - Filled: clicking the image opens the lightbox. The pencil icon is
//     hidden until the tile is hovered, when it fades in at 70%; hovering
//     the pencil itself brightens it to 100% (signals it's the discrete
//     click target). Clicking the pencil opens the Upload Image modal
//     pre-loaded with the existing thumbnail.
//
// State for `title`, `type`, and `thumbnail` lives in the parent
// (Inspector) because auto-save reads them. The Upload Image modal
// handles its own upload progress and Storage writes.

import { useEffect, useRef, useState } from 'react'
import { Pencil, CaretDown, Eye, EyeSlash } from '@phosphor-icons/react'
import { useTouchPrimary } from '../hooks/useTouchPrimary'
import { useImageUrl } from '../lib/useImageUrl'
import { cardImagePipeline } from '../lib/imageStorage'
import { useLightbox } from './Lightbox'
import { useUploadImage } from './UploadImageProvider'
import { labelInitial } from '../utils/labelUtils'
import TypePicker from './TypePicker'

export default function InspectorHeader({
  node,
  onPointerDown,
  docked = false,
  title,
  setTitle,
  type,
  setType,
  typeConfig,
  hdrText,
  TypeIcon,
  thumbnail,
  setThumbnail,
  hideAvatar,
  setHideAvatar,
  workspaceId,
  onClose,
  onCreateNewType,
}) {
  const titleRef     = useRef(null)
  const lightbox     = useLightbox()
  const upload       = useUploadImage()
  // Touch-primary devices get persistently-visible, corner-separated avatar
  // controls. The desktop hover-reveal model left both buttons INVISIBLE but
  // still tappable — on a phone the centered eye toggle swallowed taps meant
  // for "add an image" (2026-07-02 audit follow-up: fat-finger hide/show
  // loop). Touch layout: pencil pinned top-right, eye pinned bottom-right,
  // the rest of the tile is the image/upload target.
  const touchPrimary = useTouchPrimary()
  // Hover state for the show/hide eye, so the HIDDEN tile can swap its
  // EyeSlash → open Eye on pointer-over (signifying "click to show").
  const [eyeHover, setEyeHover] = useState(false)
  const thumbnailUrl = useImageUrl(thumbnail, 'thumb')

  // Auto-focus the title field on mount so the user can start typing
  // immediately.
  useEffect(() => { titleRef.current?.focus() }, [])

  // Both empty-state and Swap-button paths route through the Upload Image
  // modal in thumbnail mode. The replace path passes `existingImage` so
  // the modal pre-loads the cropper with the current thumbnail and
  // deletes the old variants from Storage on Save.
  const buildPipeline = () => cardImagePipeline({
    workspaceId,
    cardId: node.id,
    section: 'avatar',
    slug: title || node.data.label,
  })

  const openUploadFresh = () => {
    upload.open({
      mode: 'thumbnail',
      pipeline: buildPipeline(),
      onSave: (newPath) => setThumbnail(newPath),
    })
  }
  const openUploadReplace = () => {
    upload.open({
      mode: 'thumbnail',
      pipeline: buildPipeline(),
      existingImage: thumbnail,
      onSave: (newPath) => setThumbnail(newPath),
      onRemove: () => setThumbnail(null),
    })
  }

  return (
    <div
      onPointerDown={onPointerDown}
      className="flex items-center gap-2 p-2 flex-shrink-0 select-none cursor-move touch-none"
      style={{ backgroundColor: typeConfig.color }}
    >
      {/* Avatar — click to lightbox; hover the Swap button to replace */}
      <div className="flex-shrink-0">
        <div
          className="relative group w-16 h-16 rounded-[0.5rem] overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: typeConfig.color, filter: 'brightness(0.75)' }}
          // Empty tile = one big "add an image" target (matches the header
          // comment's documented intent). Buttons above it stopPropagation.
          onClick={!hideAvatar && !thumbnailUrl ? openUploadFresh : undefined}
          role={!hideAvatar && !thumbnailUrl ? 'button' : undefined}
          aria-label={!hideAvatar && !thumbnailUrl ? 'Add avatar image' : undefined}
        >
          {/* Center: the identity image, or its first-letter placeholder. Both
              only render when the thumbnail is SHOWN — when hidden the whole
              component reads as off (just the muted tile + the eye control), so
              there's no stray placeholder. The stored image is never deleted. */}
          {!hideAvatar && thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt="Avatar"
              className="w-full h-full object-cover absolute inset-0 cursor-zoom-in"
              onClick={() => lightbox.open(thumbnail)}
              draggable={false}
            />
          )}
          {!hideAvatar && !thumbnailUrl && (
            <span className="font-bold text-2xl select-none" style={{ color: hdrText }}>
              {labelInitial(title || node.data.label)}
            </span>
          )}

          {/* Add / replace the image — only while shown. Desktop: reveal on
              hover. Touch: persistently visible, 32px, pinned to the top-right
              corner (invisible-but-tappable controls are tap traps). */}
          {!hideAvatar && (
            <button
              className={touchPrimary
                ? 'absolute top-0 right-0 z-20 w-8 h-8 rounded-full bg-black/50 text-white opacity-80 flex items-center justify-center'
                : 'absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-80 transition-opacity flex items-center justify-center'}
              onClick={(e) => { e.stopPropagation(); if (thumbnailUrl) openUploadReplace(); else openUploadFresh() }}
              aria-label={thumbnailUrl ? 'Edit avatar' : 'Add avatar'}
            >
              <Pencil size={touchPrimary ? 16 : 12} weight="fill" />
            </button>
          )}

          {/* Show/hide toggle (display-only). Desktop SHOWN: hidden until
              tile-hover, then an EyeSlash → click to hide. HIDDEN (both
              inputs): a persistent centered EyeSlash that swaps to an open
              Eye on pointer-over → click to show. Touch SHOWN: persistently
              visible, pinned bottom-right so it can't swallow taps meant for
              the image/upload target. */}
          <button
            className={`absolute z-10 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center transition-opacity ${
              hideAvatar
                ? 'inset-0 m-auto opacity-90'
                : touchPrimary
                  ? 'bottom-0 right-0 opacity-70'
                  : 'inset-0 m-auto opacity-0 group-hover:opacity-90'
            }`}
            onMouseEnter={() => setEyeHover(true)}
            onMouseLeave={() => setEyeHover(false)}
            onClick={(e) => { e.stopPropagation(); setHideAvatar(!hideAvatar) }}
            aria-label={hideAvatar ? 'Show thumbnail on the canvas' : 'Hide thumbnail on the canvas'}
            title={hideAvatar ? 'Show on canvas' : 'Hide on canvas'}
          >
            {hideAvatar && eyeHover
              ? <Eye size={16} weight="fill" />
              : <EyeSlash size={16} weight="fill" />}
          </button>
        </div>
      </div>

      {/* Title + type selector */}
      <div className="flex-1 min-w-0 flex flex-col">
        <input
          ref={titleRef}
          className="modal-header-input self-start bg-transparent font-semibold text-2xl leading-none outline-none rounded-[0.25rem] pr-2 py-1"
          style={{
            color: hdrText,
            // Size the field to its content (px-2 supplies the 8px L/R
            // padding), growing until it fills the available header width,
            // then locking at max-width so the text scrolls inside like
            // before. This leaves the space to the right of the title as
            // grabbable header. `field-sizing: content` is Chromium/recent
            // Safari; see the min-width fallback for non-supporting browsers.
            fieldSizing: 'content',
            maxWidth: '100%',
            minWidth: '4rem',
          }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
        />
        <div className="flex items-center gap-1 pt-1">
          {TypeIcon && <TypeIcon size={24} color={hdrText} weight="fill" className="opacity-85" />}
          <TypePicker
            type={type}
            setType={setType}
            hdrText={hdrText}
            onCreateNewType={onCreateNewType}
          />
        </div>
      </div>

      <button
        // p-2/-m-2 grows the touch target to ~40px without moving the icon —
        // the close control is the "never trap the user" guarantee on mobile
        // (MB-2), and a 24px bare icon is below comfortable thumb size.
        className="flex-shrink-0 self-start transition-colors p-2 -m-2"
        style={{ color: hdrText, opacity: 0.7 }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
        onClick={onClose}
        aria-label={docked ? 'Collapse to edge' : 'Close'}
      >
        {docked ? (
          // Docked: a down chevron matches the close motion (the panel slides
          // down out of frame), vs. an X which reads as dismiss.
          <CaretDown size={24} weight="bold" color={hdrText} />
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill={hdrText}>
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        )}
      </button>
    </div>
  )
}
