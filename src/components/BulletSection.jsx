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

function SortableBulletInput({ id, value, onChange, onKeyDown, onRemove, onFocus, onBlur, inputRef, placeholder, dotColor }) {
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
        onFocus={onFocus}
        onBlur={onBlur}
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

// Optional semantic callbacks for per-item undo logging (phase 7c). Each
// fires once per user-visible action; the parent (EditModal) logs the
// event into its chronological action log and emits one recordAction per
// log entry on modal close. Parents that don't need them can leave them
// undefined — onChange still flows for state management.
//
//   onAddItem    ({ item, position })
//   onRemoveItem ({ item, position })
//   onItemBlur   ({ itemId, position, before, after })   // bullets only;
//                                                          fires on textarea
//                                                          blur if value changed
//   onReorderItem({ itemId, from, to })                  // only when from !== to
//
// onItemBlur is the source of editListItem entries. We track value-at-focus
// per bullet id so the on-blur diff fires once per net edit (matches the
// "Word-style typing exemption" — Ctrl+Z while focused is browser-native
// per-keystroke; once you blur, the whole field-level change becomes one
// undo step).
export default function BulletSection({
  items, onChange, label, placeholder, dotColor, addLabel,
  onAddItem, onRemoveItem, onItemBlur, onReorderItem,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const refs = useRef([])
  const prevCount = useRef(items.length)
  // Per-bullet `value-at-focus` map keyed by bullet id. Set on focus,
  // diffed on blur to fire onItemBlur exactly once per net edit.
  const focusValueRef = useRef(new Map())

  // When a bullet is added (length grows), focus the new last bullet so the
  // user can type into it immediately.
  useEffect(() => {
    if (items.length > prevCount.current) {
      refs.current[items.length - 1]?.focus()
    }
    prevCount.current = items.length
  }, [items.length])

  const updateItem = (id, v) => onChange(items.map((x) => x.id === id ? { ...x, value: v } : x))
  const removeItem = (id) => {
    const idx = items.findIndex((x) => x.id === id)
    if (idx === -1) return
    const removed = items[idx]
    onChange(items.filter((x) => x.id !== id))
    onRemoveItem?.({ item: { ...removed }, position: idx })
  }
  const addItem = () => {
    const fresh = newItem()
    onChange([...items, fresh])
    onAddItem?.({ item: { ...fresh }, position: items.length })
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>{label}</SectionLabel>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          // dnd-kit only reports a meaningful over.id when the drag landed
          // on a different bullet — same-position drops have over.id === active.id
          // and we filter them out so no reorder log entry fires for a
          // drag-and-drop-back-to-original move (per Erik's spec).
          if (over && active.id !== over.id) {
            const from = items.findIndex((x) => x.id === active.id)
            const to   = items.findIndex((x) => x.id === over.id)
            if (from === -1 || to === -1 || from === to) return
            onChange(arrayMove(items, from, to))
            onReorderItem?.({ itemId: active.id, from, to })
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
                onFocus={() => { focusValueRef.current.set(item.id, item.value) }}
                onBlur={() => {
                  const before = focusValueRef.current.get(item.id)
                  focusValueRef.current.delete(item.id)
                  if (before === undefined || before === item.value) return
                  // Position re-derived at blur time in case items shifted
                  // (normally bullets don't reorder while a textarea has
                  // focus, but the cost of getting it wrong is firing the
                  // wrong index — this defensive lookup keeps it consistent).
                  const position = items.findIndex((x) => x.id === item.id)
                  if (position === -1) return
                  onItemBlur?.({ itemId: item.id, position, before, after: item.value })
                }}
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
