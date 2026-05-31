// EditModalHeader — the type-colored band at the top of EditModal.
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
// (EditModal) because auto-save reads them. The Upload Image modal
// handles its own upload progress and Storage writes.

import { useEffect, useRef } from 'react'
import { Pencil } from '@phosphor-icons/react'
import { useImageUrl } from '../lib/useImageUrl'
import { cardImagePipeline } from '../lib/imageStorage'
import { useLightbox } from './Lightbox'
import { useUploadImage } from './UploadImageProvider'
import { labelInitial } from '../utils/labelUtils'
import TypePicker from './TypePicker'

export default function EditModalHeader({
  node,
  onPointerDown,
  title,
  setTitle,
  type,
  setType,
  typeConfig,
  hdrText,
  TypeIcon,
  thumbnail,
  setThumbnail,
  workspaceId,
  onClose,
  onCreateNewType,
}) {
  const titleRef     = useRef(null)
  const lightbox     = useLightbox()
  const upload       = useUploadImage()
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
      className="flex items-center gap-4 p-2 flex-shrink-0 select-none cursor-move touch-none"
      style={{ backgroundColor: typeConfig.color }}
    >
      {/* Avatar — click to lightbox; hover the Swap button to replace */}
      <div className="flex-shrink-0">
        <div
          className="relative group w-16 h-16 rounded-[0.5rem] overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: typeConfig.color, filter: 'brightness(0.75)' }}
        >
          {thumbnailUrl ? (
            <>
              <img
                src={thumbnailUrl}
                alt="Avatar"
                className="w-full h-full object-cover absolute inset-0 cursor-zoom-in"
                onClick={() => lightbox.open(thumbnail)}
                draggable={false}
              />
              <button
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-70 transition-opacity flex items-center justify-center"
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '' }}
                onClick={(e) => { e.stopPropagation(); openUploadReplace() }}
                aria-label="Edit avatar"
              >
                <Pencil size={12} weight="fill" />
              </button>
            </>
          ) : (
            <button
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={openUploadFresh}
              aria-label="Add avatar"
            >
              <span className="font-bold text-2xl select-none relative z-10" style={{ color: hdrText }}>
                {labelInitial(title || node.data.label)}
              </span>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <span
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
              >
                <Pencil size={12} weight="fill" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Title + type selector */}
      <div className="flex-1 min-w-0 flex flex-col">
        <input
          ref={titleRef}
          className="modal-header-input self-start bg-transparent font-semibold text-2xl leading-none outline-none rounded-[0.25rem] px-2 py-1"
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
        className="flex-shrink-0 self-start transition-colors"
        style={{ color: hdrText, opacity: 0.7 }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
        onClick={onClose}
        aria-label="Close"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill={hdrText}>
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  )
}
