// EditModalHeader — the type-colored band at the top of EditModal.
// Composes:
//   - Avatar (with upload via pencil button + lightbox on click)
//   - Title input (focused on mount)
//   - TypePicker (the type dropdown)
//   - Close button
//
// State for `title`, `type`, and `thumbnail` lives in the parent (EditModal)
// because auto-save reads them. The header owns its own avatar upload state
// (`uploadingAvatar`) since EditModal doesn't need to know about it.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PencilSimple } from '@phosphor-icons/react'
import { useImageUrl } from '../lib/useImageUrl'
import { uploadCardImage } from '../lib/imageStorage'
import { useLightbox } from './Lightbox'
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
  const titleRef = useRef(null)
  const fileInputRef = useRef(null)
  const lightbox = useLightbox()
  const thumbnailUrl = useImageUrl(thumbnail, 'thumb')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Auto-focus the title field on mount so the user can start typing immediately.
  useEffect(() => { titleRef.current?.focus() }, [])

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !campaignId) return
    setUploadingAvatar(true)
    try {
      const path = await uploadCardImage({
        campaignId,
        cardId: node.id,
        section: 'avatar',
        slug: title || node.data.label,
        file,
      })
      setThumbnail(path)
    } catch (err) {
      console.error('Avatar upload failed', err)
      toast.error(`Couldn't upload avatar: ${err.message}`)
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div
      className="flex items-center gap-4 p-2 flex-shrink-0 select-none"
      style={{ backgroundColor: typeConfig.color }}
    >
      {/* Avatar — click to lightbox; hover the pencil to change */}
      <div className="flex-shrink-0">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
        <div
          className="relative group w-16 h-16 rounded-[0.5rem] overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: typeConfig.color, filter: 'brightness(0.75)' }}
        >
          {uploadingAvatar && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          )}
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
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                aria-label="Change avatar"
              >
                <PencilSimple size={11} weight="bold" />
              </button>
            </>
          ) : (
            <button
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
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
