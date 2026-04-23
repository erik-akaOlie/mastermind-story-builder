import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import { useNodeTypes } from '../store/useTypeStore'
import { sortKey, labelInitial } from '../utils/labelUtils'
import CreateTypeModal from './CreateTypeModal'

const MODAL_WIDTH   = '41.25rem'
const TRANSITION_MS = 260

// ─────────────────────────────────────────────────────────────────────────────
// Animation approach: useLayoutEffect sets card-position transform before first
// paint (invisible); useEffect schedules a RAF to animate to final position.
// handleClose reverses the animation then unmounts via setTimeout.
// ─────────────────────────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <span className="block text-xs font-medium text-[#6b7280] uppercase tracking-wide">
    {children}
  </span>
)

// Blend a hex color with white at the given opacity (0–1)
const tintHex = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * opacity + 255 * (1 - opacity))},${Math.round(g * opacity + 255 * (1 - opacity))},${Math.round(b * opacity + 255 * (1 - opacity))})`
}

// Return a readable foreground color for a given hex background
const textForHex = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}

// Same but for the pre-blended tint (avoids a second parse)
const textForTint = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const tr = Math.round(r * opacity + 255 * (1 - opacity))
  const tg = Math.round(g * opacity + 255 * (1 - opacity))
  const tb = Math.round(b * opacity + 255 * (1 - opacity))
  return (0.299 * tr + 0.587 * tg + 0.114 * tb) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}

const newItem = (value = '') => ({ id: crypto.randomUUID(), value })

function SortableBulletInput({ id, value, onChange, onKeyDown, onRemove, inputRef, placeholder, dotColor }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const textareaRef = useRef(null)

  const handleRef = (el) => {
    textareaRef.current = el
    if (typeof inputRef === 'function') inputRef(el)
  }

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

function SortableImage({ id, src, onRemove, onLightbox }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className="relative group w-[10rem] h-[10rem] rounded-[0.25rem] overflow-hidden border border-gray-200 flex-shrink-0"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : 'auto' }}
    >
      <img
        src={src}
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

export default function EditModal({
  node,
  connectedNodes,
  allOtherNodes,
  originRect,
  onUpdate,
  onClose,
}) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [title,      setTitle]      = useState(node.data.label   || '')
  const [type,       setType]       = useState(node.data.type    || 'character')
  const [summary,    setSummary]    = useState(node.data.summary || '')
  const [thumbnail,  setThumbnail]  = useState(node.data.avatar  || null)
  const [storyNotes, setStoryNotes] = useState(() =>
    (node.data.storyNotes || node.data.narrative || []).map(newItem)
  )
  const [hiddenLore, setHiddenLore] = useState(() =>
    (node.data.hiddenLore || []).map(newItem)
  )
  const [dmNotes, setDmNotes] = useState(() => {
    const d = node.data.dmNotes
    const arr = Array.isArray(d) ? d : (typeof d === 'string' && d.trim() ? [d] : [])
    return arr.map(newItem)
  })
  const [media,      setMedia]      = useState(() =>
    (node.data.media || []).map((src) => ({ id: crypto.randomUUID(), src }))
  )
  const [lightboxSrc, setLightboxSrc] = useState(null)

  const fileInputRef  = useRef(null)
  const mediaInputRef = useRef(null)

  const NODE_TYPES = useNodeTypes()
  const typeConfig = NODE_TYPES[type] || { color: '#6B7280', label: type }
  const TypeIcon   = typeConfig.icon
  const hdrText    = textForHex(typeConfig.color)

  const handleThumbnailUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setThumbnail(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleMediaUpload = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => setMedia((prev) => [...prev, { id: crypto.randomUUID(), src: ev.target.result }])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removeMedia = (id) => setMedia((prev) => prev.filter((m) => m.id !== id))

  // ── Connection state ──────────────────────────────────────────────────────
  const [localConns, setLocalConns] = useState(
    () => connectedNodes.map((c) => ({ ...c, isNew: false }))
  )
  // Tracks nodeIds whose edges currently exist in the graph (updated after each sync)
  const syncedNodeIds = useRef(new Set(connectedNodes.map((c) => c.nodeId)))
  const [showPicker,          setShowPicker]          = useState(false)
  const [showTypePicker,      setShowTypePicker]      = useState(false)
  const [hoveredType,         setHoveredType]         = useState(null)
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false)

  const availableNodes = allOtherNodes
    .filter((n) => !localConns.find((c) => c.nodeId === n.id))
    .sort((a, b) => sortKey(a.data.label).localeCompare(sortKey(b.data.label)))

  const addConnection = (n) => {
    setLocalConns((prev) => [
      ...prev,
      { edgeId: null, nodeId: n.id, label: n.data.label, type: n.data.type, isNew: true },
    ])
    setShowPicker(false)
  }
  const removeConnection = (nodeId) =>
    setLocalConns((prev) => prev.filter((c) => c.nodeId !== nodeId))

  // ── Animation refs ────────────────────────────────────────────────────────
  const modalRef    = useRef(null)
  const backdropRef = useRef(null)

  useLayoutEffect(() => {
    const el = modalRef.current
    const bd = backdropRef.current
    if (el) {
      el.style.opacity    = '0'
      el.style.transition = 'none'
      if (originRect) {
        const rect    = el.getBoundingClientRect()
        const modalCX = rect.left + rect.width  / 2
        const modalCY = rect.top  + rect.height / 2
        const cardCX  = originRect.left + originRect.width  / 2
        const cardCY  = originRect.top  + originRect.height / 2
        el.style.transform = `translate(${cardCX - modalCX}px, ${cardCY - modalCY}px) scale(${originRect.width / rect.width})`
      } else {
        el.style.transform = 'scale(0.92)'
      }
    }
    if (bd) { bd.style.opacity = '0'; bd.style.transition = 'none' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = modalRef.current
    const bd = backdropRef.current
    const id = requestAnimationFrame(() => {
      if (el) {
        el.style.transition = `transform ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1), opacity ${TRANSITION_MS}ms ease`
        el.style.transform  = 'none'
        el.style.opacity    = '1'
      }
      if (bd) {
        bd.style.transition = `opacity ${TRANSITION_MS}ms ease`
        bd.style.opacity    = '0.6'
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = useCallback(() => {
    doSaveRef.current?.()
    const el = modalRef.current
    const bd = backdropRef.current
    if (!el) { onClose(); return }
    if (originRect) {
      const rect    = el.getBoundingClientRect()
      const modalCX = rect.left + rect.width  / 2
      const modalCY = rect.top  + rect.height / 2
      const cardCX  = originRect.left + originRect.width  / 2
      const cardCY  = originRect.top  + originRect.height / 2
      el.style.transition = `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${TRANSITION_MS}ms ease`
      el.style.transform  = `translate(${cardCX - modalCX}px, ${cardCY - modalCY}px) scale(${originRect.width / rect.width})`
    } else {
      el.style.transition = `transform ${TRANSITION_MS}ms ease, opacity ${TRANSITION_MS}ms ease`
      el.style.transform  = 'scale(0.92)'
    }
    el.style.opacity = '0'
    if (bd) { bd.style.transition = `opacity ${TRANSITION_MS}ms ease`; bd.style.opacity = '0' }
    setTimeout(onClose, TRANSITION_MS)
  }, [originRect, onClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  // ── Focus management ──────────────────────────────────────────────────────
  const titleRef           = useRef(null)
  const storyNoteRefs      = useRef([])
  const hiddenLoreRefs     = useRef([])
  const dmNotesRefs        = useRef([])
  const prevStoryCount     = useRef(storyNotes.length)
  const prevHiddenLoreCount = useRef(hiddenLore.length)
  const prevDmNotesCount   = useRef(dmNotes.length)

  useEffect(() => { titleRef.current?.focus() }, [])

  useEffect(() => {
    if (storyNotes.length > prevStoryCount.current)
      storyNoteRefs.current[storyNotes.length - 1]?.focus()
    prevStoryCount.current = storyNotes.length
  }, [storyNotes.length])

  useEffect(() => {
    if (hiddenLore.length > prevHiddenLoreCount.current)
      hiddenLoreRefs.current[hiddenLore.length - 1]?.focus()
    prevHiddenLoreCount.current = hiddenLore.length
  }, [hiddenLore.length])

  useEffect(() => {
    if (dmNotes.length > prevDmNotesCount.current)
      dmNotesRefs.current[dmNotes.length - 1]?.focus()
    prevDmNotesCount.current = dmNotes.length
  }, [dmNotes.length])

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Bullet helpers ────────────────────────────────────────────────────────
  const updateStoryNote = (id, v) => setStoryNotes((b) => b.map((x) => x.id === id ? { ...x, value: v } : x))
  const removeStoryNote = (id)    => setStoryNotes((b) => b.filter((x) => x.id !== id))
  const addStoryNote    = ()      => setStoryNotes((b) => [...b, newItem()])

  const updateHiddenLore    = (id, v) => setHiddenLore((b) => b.map((x) => x.id === id ? { ...x, value: v } : x))
  const removeHiddenLore    = (id)    => setHiddenLore((b) => b.filter((x) => x.id !== id))
  const addHiddenLoreBullet = ()      => setHiddenLore((b) => [...b, newItem()])

  const updateDmNote = (id, v) => setDmNotes((b) => b.map((x) => x.id === id ? { ...x, value: v } : x))
  const removeDmNote = (id)    => setDmNotes((b) => b.filter((x) => x.id !== id))
  const addDmNote    = ()      => setDmNotes((b) => [...b, newItem()])

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // doSaveRef always holds the latest save closure so the debounce timer and
  // the flush-on-close path both call the same up-to-date computation.
  const doSaveRef = useRef(null)
  doSaveRef.current = () => {
    const currentNodeIds = new Set(localConns.map((c) => c.nodeId))
    const addNodeIds    = localConns.filter((c) => !syncedNodeIds.current.has(c.nodeId)).map((c) => c.nodeId)
    const removeNodeIds = [...syncedNodeIds.current].filter((id) => !currentNodeIds.has(id))
    onUpdate(
      node.id,
      {
        label:      title.trim() || 'Untitled',
        type,
        summary,
        storyNotes: storyNotes.filter((b) => b.value.trim()).map((b) => b.value),
        hiddenLore: hiddenLore.filter((b) => b.value.trim()).map((b) => b.value),
        dmNotes:    dmNotes.filter((b) => b.value.trim()).map((b) => b.value),
        media:      media.map((m) => m.src),
        avatar:     thumbnail || null,
      },
      { addNodeIds, removeNodeIds }
    )
    addNodeIds.forEach((id) => syncedNodeIds.current.add(id))
    removeNodeIds.forEach((id) => syncedNodeIds.current.delete(id))
  }

  useEffect(() => {
    const timer = setTimeout(() => doSaveRef.current?.(), 400)
    return () => clearTimeout(timer)
  }, [title, type, summary, storyNotes, hiddenLore, dmNotes, media, thumbnail, localConns])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showCreateTypeModal && (
        <CreateTypeModal
          onClose={() => setShowCreateTypeModal(false)}
          onCreated={(key) => setType(key)}
        />
      )}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/80 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-xl font-bold hover:bg-black/70 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >×</button>
        </div>
      )}
      <div ref={backdropRef} className="fixed inset-0 z-[9998] bg-black" onClick={handleClose} />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          ref={modalRef}
          className="pointer-events-auto rounded-[0.5rem] shadow-2xl flex flex-col overflow-hidden"
          style={{
            width: MODAL_WIDTH,
            maxHeight: '90vh',
            backgroundColor: `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
            '--modal-bg': `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Header: avatar + title + type dropdown ── */}
          <div
            className="flex items-center gap-4 p-2 flex-shrink-0 select-none"
            style={{ backgroundColor: typeConfig.color }}
          >
            {/* Avatar — click to change thumbnail */}
            <div className="flex-shrink-0">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
              <div
                className="relative group w-16 h-16 rounded-[0.5rem] overflow-hidden cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: typeConfig.color, filter: 'brightness(0.75)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                {thumbnail ? (
                  <>
                    <img src={thumbnail} alt="Avatar" className="w-full h-full object-cover absolute inset-0" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium">Change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-2xl select-none relative z-10" style={{ color: hdrText }}>
                      {labelInitial(title || node.data.label)}
                    </span>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </>
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
                <div className="relative w-[10.5rem]">
                  {/* Trigger */}
                  <button
                    type="button"
                    className="flex items-center justify-between w-full border-b border-[#a5a6f6] cursor-pointer"
                    onClick={() => setShowTypePicker(v => !v)}
                  >
                    <span className="text-base font-light leading-[1.32]" style={{ color: hdrText }}>{typeConfig.label}</span>
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: hdrText, opacity: 0.8 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </button>

                  {showTypePicker && (
                    <>
                      <div className="fixed inset-0 z-[10000]" onClick={() => setShowTypePicker(false)} />
                      <div className="absolute top-full left-0 z-[10001] w-full mt-1 rounded-[0.25rem] overflow-hidden shadow-lg">
                        {Object.entries(NODE_TYPES).map(([key, cfg]) => {
                          const Icon = cfg.icon
                          const isActive = key === type || hoveredType === key
                          const bg = isActive ? cfg.color : tintHex(cfg.color, 0.05)
                          const fg = isActive ? textForHex(cfg.color) : textForTint(cfg.color, 0.05)
                          return (
                            <button
                              key={key}
                              type="button"
                              className="flex items-center gap-2 w-full px-2"
                              style={{ height: '2.5rem', backgroundColor: bg, color: fg }}
                              onMouseEnter={() => setHoveredType(key)}
                              onMouseLeave={() => setHoveredType(null)}
                              onClick={() => { setType(key); setShowTypePicker(false) }}
                            >
                              <Icon size={16} weight="fill" color={isActive ? fg : cfg.color} />
                              <span className="text-sm font-medium">{cfg.label}</span>
                            </button>
                          )
                        })}
                        {/* Create new type */}
                        <button
                          type="button"
                          className="flex items-center gap-2 w-full px-2 border-t border-black/10"
                          style={{ height: '2.5rem', backgroundColor: '#f9fafb', color: '#6b7280' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb' }}
                          onClick={() => { setShowTypePicker(false); setShowCreateTypeModal(true) }}
                        >
                          <span className="text-base leading-none font-light">+</span>
                          <span className="text-sm font-medium">Create new type…</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              className="flex-shrink-0 self-start transition-colors"
            style={{ color: hdrText, opacity: 0.7 }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
              onClick={handleClose}
              aria-label="Close"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill={hdrText}>
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* ── Body (scrollable) ── */}
          <div className="overflow-y-auto flex-1 min-h-0 px-4 pt-4 pb-10 flex flex-col gap-10">

            {/* Summary */}
            <div className="flex flex-col gap-4">
              <SectionLabel>Summary</SectionLabel>
              <textarea
                className="w-full bg-[var(--modal-bg)] focus:bg-white border border-[#9ca3af] rounded-[0.25rem] p-2 text-base font-light text-[#1f2937] resize-y outline-none focus:border-gray-400 transition-colors leading-[1.32]"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One sentence — the quick-recall hook…"
              />
            </div>

            {/* Story Notes */}
            <div className="flex flex-col gap-4">
              <SectionLabel>Story Notes</SectionLabel>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                if (over && active.id !== over.id)
                  setStoryNotes((b) => arrayMove(b, b.findIndex((x) => x.id === active.id), b.findIndex((x) => x.id === over.id)))
              }}>
                <SortableContext items={storyNotes.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-4">
                    {storyNotes.map((note, i) => (
                      <SortableBulletInput
                        key={note.id}
                        id={note.id}
                        value={note.value}
                        inputRef={(el) => (storyNoteRefs.current[i] = el)}
                        placeholder="Narrative beat…"
                        dotColor={typeConfig.color}
                        onChange={(e) => updateStoryNote(note.id, e.target.value)}
                        onRemove={() => removeStoryNote(note.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')                        { e.preventDefault(); addStoryNote() }
                          if (e.key === 'Backspace' && note.value === '') removeStoryNote(note.id)
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <button className="flex items-center gap-1 text-base font-light text-[#6b7280] hover:text-gray-600 transition-colors" onClick={addStoryNote}>
                <span className="text-xl leading-none">+</span>Add note
              </button>
            </div>

            {/* ── GM Only divider ── */}
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-semibold text-[#4b5563] whitespace-nowrap">GM ONLY</span>
              <div className="flex-1 h-px bg-[#6b7280]" />
            </div>

            {/* Inspiration images */}
            <div className="flex flex-col gap-4">
              <SectionLabel>Inspiration</SectionLabel>
              <input ref={mediaInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMediaUpload} />
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                if (over && active.id !== over.id)
                  setMedia((m) => arrayMove(m, m.findIndex((x) => x.id === active.id), m.findIndex((x) => x.id === over.id)))
              }}>
                <SortableContext items={media.map((m) => m.id)} strategy={rectSortingStrategy}>
                  <div className="flex flex-wrap gap-[0.625rem]">
                    {/* Add button always first, outside sortable */}
                    <button
                      className="w-[10rem] h-[10rem] border border-dashed border-[#9ca3af] rounded-[0.25rem] flex flex-col items-center justify-center gap-1 text-[#6b7280] hover:border-gray-400 hover:text-gray-500 transition-colors flex-shrink-0"
                      onClick={() => mediaInputRef.current?.click()}
                    >
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-base font-light">Add image</span>
                    </button>
                    {media.map((m) => (
                      <SortableImage
                        key={m.id}
                        id={m.id}
                        src={m.src}
                        onRemove={() => removeMedia(m.id)}
                        onLightbox={() => setLightboxSrc(m.src)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Hidden Lore */}
            <div className="flex flex-col gap-4">
              <SectionLabel>Hidden Lore</SectionLabel>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                if (over && active.id !== over.id)
                  setHiddenLore((b) => arrayMove(b, b.findIndex((x) => x.id === active.id), b.findIndex((x) => x.id === over.id)))
              }}>
                <SortableContext items={hiddenLore.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-4">
                    {hiddenLore.map((lore, i) => (
                      <SortableBulletInput
                        key={lore.id}
                        id={lore.id}
                        value={lore.value}
                        inputRef={(el) => (hiddenLoreRefs.current[i] = el)}
                        placeholder="Secret not yet revealed…"
                        dotColor={typeConfig.color}
                        onChange={(e) => updateHiddenLore(lore.id, e.target.value)}
                        onRemove={() => removeHiddenLore(lore.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')                         { e.preventDefault(); addHiddenLoreBullet() }
                          if (e.key === 'Backspace' && lore.value === '') removeHiddenLore(lore.id)
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <button className="flex items-center gap-1 text-base font-light text-[#6b7280] hover:text-gray-600 transition-colors" onClick={addHiddenLoreBullet}>
                <span className="text-xl leading-none">+</span>Add secret
              </button>
            </div>

            {/* DM Notes */}
            <div className="flex flex-col gap-4">
              <SectionLabel>DM Notes</SectionLabel>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
                if (over && active.id !== over.id)
                  setDmNotes((b) => arrayMove(b, b.findIndex((x) => x.id === active.id), b.findIndex((x) => x.id === over.id)))
              }}>
                <SortableContext items={dmNotes.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-4">
                    {dmNotes.map((note, i) => (
                      <SortableBulletInput
                        key={note.id}
                        id={note.id}
                        value={note.value}
                        inputRef={(el) => (dmNotesRefs.current[i] = el)}
                        placeholder="Voice, motivation, tactics…"
                        dotColor={typeConfig.color}
                        onChange={(e) => updateDmNote(note.id, e.target.value)}
                        onRemove={() => removeDmNote(note.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')                         { e.preventDefault(); addDmNote() }
                          if (e.key === 'Backspace' && note.value === '') removeDmNote(note.id)
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <button className="flex items-center gap-1 text-base font-light text-[#6b7280] hover:text-gray-600 transition-colors" onClick={addDmNote}>
                <span className="text-xl leading-none">+</span>Add note
              </button>
            </div>

            {/* ── Connections ── */}
            <div className="flex flex-col gap-4">
              <SectionLabel>Connections</SectionLabel>

              {localConns.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {[...localConns]
                    .sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label)))
                    .map((conn) => {
                      const cfg = NODE_TYPES[conn.type] || { color: '#6B7280', label: conn.type }
                      const chipText = textForHex(cfg.color)
                      return (
                        <div
                          key={conn.nodeId}
                          className="flex items-center gap-2 pl-4 pr-2 py-1 rounded-full text-xs font-medium select-none"
                          style={{ backgroundColor: cfg.color, color: chipText }}
                        >
                          <span className="max-w-[9rem] truncate leading-none">{conn.label || 'Untitled'}</span>
                          <button
                            className="text-base leading-none transition-opacity flex-shrink-0 opacity-50 hover:opacity-100"
                            style={{ color: chipText }}
                            onClick={() => removeConnection(conn.nodeId)}
                          >×</button>
                        </div>
                      )
                    })}
                </div>
              )}

              {localConns.length === 0 && (
                <p className="text-base font-light text-[#6b7280] italic">No connections yet</p>
              )}

              {availableNodes.length > 0 && (
                <div className="relative">
                  <button
                    className="flex items-center gap-1 text-base font-light text-[#6b7280] hover:text-gray-600 transition-colors"
                    onClick={() => setShowPicker((v) => !v)}
                  >
                    <span className="text-xl leading-none">+</span>Add connection
                  </button>
                  {showPicker && (
                    <>
                      <div className="fixed inset-0 z-[10000]" onClick={() => setShowPicker(false)} />
                      <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[10001] w-72 max-h-52 overflow-y-auto">
                        {availableNodes.map((n) => {
                          const cfg = NODE_TYPES[n.data?.type] || { color: '#6B7280', label: n.data?.type }
                          return (
                            <button
                              key={n.id}
                              className="w-full text-left px-3 py-3 text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
                              onClick={() => addConnection(n)}
                            >
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                              <span className="flex-1 truncate text-gray-700">{n.data?.label || 'Untitled'}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>


        </div>
      </div>
    </>
  )
}
