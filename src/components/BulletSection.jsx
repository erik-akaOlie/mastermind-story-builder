// BulletSection — the reusable section type used by Story Notes, Hidden Lore,
// and DM Notes inside EditModal. Owns:
//   - dnd-kit setup for drag-to-reorder
//   - the SortableBulletInput render (textarea + grip handle + remove button)
//   - focus-on-new-bullet behavior
//   - add / remove / update handlers
//
// State is held by the parent (EditModal) as `[{id, value}, ...]` so the auto-
// save useEffect can keep reading from a single source of truth across all
// three sections. The parent passes `items` and `onChange(nextItems)` props.

import { useEffect, useRef } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import SectionLabel from './SectionLabel'

// Helper exported so EditModal can seed its initial state from the persisted
// string arrays in node.data without depending on this file's internals.
export const newItem = (value = '') => ({ id: crypto.randomUUID(), value })

function SortableBulletInput({ id, value, onChange, onKeyDown, onRemove, inputRef, placeholder, dotColor }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const textareaRef = useRef(null)

  const handleRef = (el) => {
    textareaRef.current = el
    if (typeof inputRef === 'function') inputRef(el)
  }

  // Auto-grow the textarea as the content gets taller.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <li
      ref={setNodeRef}
      className="flex gap-2"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: 'relative', zIndex: isDragging ? 10 : 'auto' }}
    >
      <button
        className="flex-shrink-0 self-start mt-[0.6rem] cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        style={{ lineHeight: 0 }}
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>
      <span className="w-3 h-3 rounded-full flex-shrink-0 self-start mt-[0.6rem]" style={{ backgroundColor: dotColor }} />
      <textarea
        ref={handleRef}
        className="flex-1 bg-[var(--modal-bg)] focus:bg-white border border-[#9ca3af] rounded-[0.25rem] p-2 text-base font-light text-[#1f2937] outline-none focus:border-gray-400 transition-colors leading-[1.32] resize-none overflow-hidden"
        rows={1}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
      />
      <button
        className="flex-shrink-0 self-center text-gray-400 hover:text-red-400 text-xl leading-none transition-colors"
        onClick={onRemove}
      >×</button>
    </li>
  )
}

export default function BulletSection({ items, onChange, label, placeholder, dotColor, addLabel }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const refs = useRef([])
  const prevCount = useRef(items.length)

  // When a bullet is added (length grows), focus the new last bullet so the
  // user can type into it immediately.
  useEffect(() => {
    if (items.length > prevCount.current) {
      refs.current[items.length - 1]?.focus()
    }
    prevCount.current = items.length
  }, [items.length])

  const updateItem = (id, v) => onChange(items.map((x) => x.id === id ? { ...x, value: v } : x))
  const removeItem = (id) => onChange(items.filter((x) => x.id !== id))
  const addItem    = ()    => onChange([...items, newItem()])

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>{label}</SectionLabel>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            onChange(arrayMove(
              items,
              items.findIndex((x) => x.id === active.id),
              items.findIndex((x) => x.id === over.id),
            ))
          }
        }}
      >
        <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-4">
            {items.map((item, i) => (
              <SortableBulletInput
                key={item.id}
                id={item.id}
                value={item.value}
                inputRef={(el) => (refs.current[i] = el)}
                placeholder={placeholder}
                dotColor={dotColor}
                onChange={(e) => updateItem(item.id, e.target.value)}
                onRemove={() => removeItem(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')                       { e.preventDefault(); addItem() }
                  if (e.key === 'Backspace' && item.value === '') removeItem(item.id)
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button
        className="flex items-center gap-1 text-base font-light text-[#6b7280] hover:text-gray-600 transition-colors"
        onClick={addItem}
      >
        <span className="text-xl leading-none">+</span>{addLabel}
      </button>
    </div>
  )
}
