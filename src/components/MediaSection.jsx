// MediaSection — the image grid inside Inspector (e.g. the "Inspiration"
// section that ships with V1 sample data). Owns:
//   - dnd-kit setup for drag-to-reorder image tiles
//   - SortableImage tile (image + grip handle + remove button)
//   - +Add button that opens the Upload Image modal via useUploadImage
//
// State (the array of `{id, src}` entries) is held by the parent so the
// auto-save useEffect in Inspector can read it. The parent passes `items`
// and `onChange(nextItems)` props plus the upload context (workspaceId,
// cardId, slug) needed to compute Storage paths.
//
// The Upload Image modal handles its own file picking, paste capture, and
// upload progress — MediaSection just opens it and merges the resulting
// path into items when onSave fires.

import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import { useImageUrl } from '../lib/useImageUrl'
import { contentImagePipeline } from '../lib/imageStorage'
import { useLightbox } from './Lightbox'
import { useUploadImage } from './UploadImageProvider'
import SectionLabel from './SectionLabel'

function SortableImage({ id, value, onRemove, onLightbox }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const url = useImageUrl(value, 'thumb')
  return (
    <div
      ref={setNodeRef}
      className="relative group w-[10rem] h-[10rem] rounded-[0.25rem] overflow-hidden border border-gray-200 flex-shrink-0"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : 'auto' }}
    >
      <img
        src={url ?? ''}
        alt=""
        className="w-full h-full object-cover cursor-zoom-in"
        onClick={onLightbox}
        draggable={false}
      />
      {/* Grip — top-left on hover */}
      <button
        className="absolute top-1.5 left-1.5 w-6 h-6 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        style={{ lineHeight: 0 }}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <DotsSixVertical size={14} weight="bold" />
      </button>
      {/* Remove — top-right on hover */}
      <button
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-bold leading-none hover:bg-black/70"
        onClick={onRemove}
      >×</button>
    </div>
  )
}

// Optional semantic callbacks for per-item undo logging.
//
//   onAddItem    ({ item, position })   // item = the raw src value (path
//                                          object for storage uploads, or
//                                          a legacy string)
//   onRemoveItem ({ item, position })
//   onReorderItem({ itemId, from, to }) // itemId = item.path for storage,
//                                          string itself for legacy
export default function MediaSection({
  items, onChange, cardId, workspaceId, slug,
  onAddItem, onRemoveItem, onReorderItem,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const lightbox = useLightbox()
  const upload   = useUploadImage()

  const handleAddImage = () => {
    if (!workspaceId) return
    upload.open({
      mode: 'image-section',
      pipeline: contentImagePipeline({ workspaceId, cardId, section: 'inspiration', slug }),
      // Content uploads resolve to a structured object carrying the display
      // path plus the printable_* fields — spread it into the stored entry.
      onSave: (result) => {
        const entry = { ...result, alt: '', uploaded_at: new Date().toISOString() }
        const insertPosition = items.length
        onChange([...items, { id: crypto.randomUUID(), src: entry }])
        onAddItem?.({ item: entry, position: insertPosition })
      },
    })
  }

  const removeItem = (id) => {
    const idx = items.findIndex((m) => m.id === id)
    if (idx === -1) return
    const removed = items[idx]
    onChange(items.filter((m) => m.id !== id))
    onRemoveItem?.({ item: removed.src, position: idx })
  }

  // Convert the local React-key `m.id` (session-scoped UUID) into the
  // persistable identity the dispatcher uses (storage path for uploaded
  // entries, or the string itself for legacy entries).
  const persistableId = (src) =>
    src && typeof src === 'object' && typeof src.path === 'string' ? src.path : src

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Inspiration</SectionLabel>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            const from = items.findIndex((x) => x.id === active.id)
            const to   = items.findIndex((x) => x.id === over.id)
            if (from === -1 || to === -1 || from === to) return
            const moved = items[from]
            onChange(arrayMove(items, from, to))
            onReorderItem?.({ itemId: persistableId(moved.src), from, to })
          }
        }}
      >
        <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-[0.625rem]">
            {/* Add button always first, outside sortable */}
            <button
              className="w-[10rem] h-[10rem] border border-dashed border-[#9ca3af] rounded-[0.25rem] flex flex-col items-center justify-center gap-1 text-[#6b7280] hover:border-gray-400 hover:text-gray-500 transition-colors flex-shrink-0"
              onClick={handleAddImage}
            >
              <span className="text-2xl leading-none">+</span>
              <span className="text-base font-light">Add image</span>
            </button>
            {items.map((m) => (
              <SortableImage
                key={m.id}
                id={m.id}
                value={m.src}
                onRemove={() => removeItem(m.id)}
                onLightbox={() => lightbox.open(m.src)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
