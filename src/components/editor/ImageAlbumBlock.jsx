// ============================================================================
// ImageAlbumBlock — the real data-driven Image Album custom block (Chunk B)
// ----------------------------------------------------------------------------
// Renders the album's images (migrated from the legacy Image Section) as
// thumbnails with signed URLs, plus add (via the shared Upload Image modal) and
// remove. The image list lives in the block's own props (a JSON string, since
// BlockNote props are primitives only) — that IS the block's persisted content,
// so editing it through editor.updateBlock flows into the zone's debounced save.
//
// Uploads go to workspace-media via contentImagePipeline (display variants +
// a high-res printable artifact) and are stored as
// { path, alt, uploaded_at, printable_path, printable_format, printable_width,
//   printable_height, printable_bytes }. Display rendering and the lightbox
// read `path` and so work unchanged; legacy entries lacking printable_* fields
// still render fine.
// ============================================================================

import { useImageUrl } from '../../lib/useImageUrl'
import { contentImagePipeline } from '../../lib/imageStorage'
import { useUploadImage } from '../UploadImageProvider'
import { useLightbox } from '../Lightbox'
import { useEditorContext } from './EditorContext.jsx'

function parseImages(raw) {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function AlbumThumb({ value, onRemove, onOpen }) {
  const url = useImageUrl(value, 'thumb')
  return (
    <div className="relative group w-[6rem] h-[6rem] rounded-[0.25rem] overflow-hidden border border-gray-200 flex-shrink-0">
      <img
        src={url ?? ''}
        alt=""
        className="w-full h-full object-cover cursor-zoom-in"
        onClick={onOpen}
        draggable={false}
      />
      <button
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold leading-none hover:bg-black/70"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  )
}

export default function ImageAlbumView({ block, editor }) {
  const { cardId, workspaceId, slug } = useEditorContext()
  const upload = useUploadImage()
  const lightbox = useLightbox()

  const images = parseImages(block.props.images)

  const setImages = (next) =>
    editor.updateBlock(block, { type: 'imageAlbum', props: { images: JSON.stringify(next) } })

  const addImage = () => {
    if (!workspaceId) return
    upload.open({
      mode: 'image-section',
      pipeline: contentImagePipeline({ workspaceId, cardId, section: 'inspiration', slug }),
      // Content uploads resolve to a structured object (display path +
      // printable_* fields) — spread it into the stored entry.
      onSave: (result) => setImages([...images, { ...result, alt: '', uploaded_at: new Date().toISOString() }]),
    })
  }

  const removeImage = (i) => setImages(images.filter((_, idx) => idx !== i))

  return (
    <div
      contentEditable={false}
      className="w-full rounded-[0.5rem] border border-[#e5e7eb] bg-[#fafafa] p-3 my-1"
    >
      {/* No in-block header (F5e — Erik's call): the gallery is just the add tile
          + thumbnails. The block's identity is carried by its menu label / icon. */}
      <div className="flex flex-wrap gap-2">
        <button
          className="w-[6rem] h-[6rem] border border-dashed border-[#9ca3af] rounded-[0.25rem] flex flex-col items-center justify-center gap-0.5 text-[#6b7280] hover:border-gray-400 hover:text-gray-500 transition-colors flex-shrink-0"
          onClick={addImage}
        >
          <span className="text-xl leading-none">+</span>
          <span className="text-xs font-light">Add</span>
        </button>
        {images.map((img, i) => (
          <AlbumThumb
            key={(img && img.path) || (typeof img === 'string' ? img : i)}
            value={img}
            onRemove={() => removeImage(i)}
            onOpen={() => lightbox.open(img)}
          />
        ))}
      </div>
    </div>
  )
}
