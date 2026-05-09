// EditModalHeader — the type-colored band at the top of EditModal.
// Composes:
//   - Avatar (with click-to-replace via Upload Image modal + lightbox on click)
//   - Title input (focused on mount)
//   - TypePicker (the type dropdown)
//   - Close button
//
// Avatar has two states:
//   - Empty (no thumbnail): clicking the letter-initial circle opens the
//     Upload Image modal in thumbnail mode (no existing image).
//   - Filled: clicking the image opens the lightbox; clicking the Swap
//     button (hover affordance) opens the Upload Image modal pre-loaded
//     with the existing thumbnail. Save in the modal replaces; Cancel
//     preserves the old image.
//
// State for `title`, `type`, and `thumbnail` lives in the parent
// (EditModal) because auto-save reads them. The Upload Image modal
// handles its own upload progress and Storage writes.

import { useEffect, useRef } from 'react'
import { Swap } from '@phosphor-icons/react'
import { useImageUrl } from '../lib/useImageUrl'
import { cardImagePipeline } from '../lib/imageStorage'
import { useLightbox } from './Lightbox'
import { useUploadImage } from './UploadImageProvider'
import { labelInitial } from '../utils/labelUtils'
import TypePicker from './TypePicker'

export default function EditModalHeader({
  node,
  title,
  setTitle,
  type,
  setType,
  typeConfig,
  hdrText,
  TypeIcon,
  thumbnail,
  setThumbnail,
  campaignId,
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
    campaignId,
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
      className="flex items-center gap-4 p-2 flex-shrink-0 select-none"
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
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); openUploadReplace() }}
                aria-label="Swap avatar"
              >
                <Swap size={11} weight="bold" />
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
            </button>
          )}
        </div>
      </div>

      {/* Title + type selector */}
      <div className="flex-1 min-w-0 flex flex-col">
        <input
          ref={titleRef}
          className="modal-header-input bg-transparent font-semibold text-2xl leading-none outline-none w-full"
          style={{ color: hdrText }}
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
