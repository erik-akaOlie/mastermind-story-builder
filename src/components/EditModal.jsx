import { useState, useRef, useEffect, useCallback } from 'react'
import { useNodeTypes } from '../store/useTypeStore'
import { useCampaign } from '../lib/CampaignContext.jsx'
import { useUndoStore } from '../store/useUndoStore'
import { ACTION_TYPES, deepEqual } from '../lib/undoActions'
import CreateTypeModal from './CreateTypeModal'
import BulletSection, { newItem } from './BulletSection'
import SectionLabel from './SectionLabel'
import MediaSection from './MediaSection'
import ConnectionsSection from './ConnectionsSection'
import EditModalHeader from './EditModalHeader'
import { useAutoSave } from '../hooks/useAutoSave'
import { useMorphAnimation } from '../hooks/useMorphAnimation'

const MODAL_WIDTH = '41.25rem'

// editCardField undo entries are emitted on modal close, one per field that
// drifted from its session-start snapshot. The order here is the order the
// entries are pushed onto the undo stack, so consecutive Ctrl+Z's revert in
// this order. Field labels are user-facing (toast in phase 9).
const EDITABLE_FIELDS = [
  'label', 'type', 'summary',
  'storyNotes', 'hiddenLore', 'dmNotes',
  'media', 'avatar',
]
const FIELD_LABELS = {
  label:      'title',
  type:       'type',
  summary:    'summary',
  storyNotes: 'story notes',
  hiddenLore: 'hidden lore',
  dmNotes:    'DM notes',
  media:      'inspiration',
  avatar:     'avatar',
}

// Return a readable foreground color for a given hex background.
// Used for the header text on the type-colored band.
function textForHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1f2937' : '#ffffff'
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
  const NODE_TYPES = useNodeTypes()
  const typeConfig = NODE_TYPES[type] || { color: '#6B7280', label: type }
  const TypeIcon   = typeConfig.icon
  const hdrText    = textForHex(typeConfig.color)
  const { activeCampaignId } = useCampaign()

  // ── Connection state ──────────────────────────────────────────────────────
  const [localConns, setLocalConns] = useState(
    () => connectedNodes.map((c) => ({ ...c, isNew: false }))
  )
  // Tracks nodeIds whose edges currently exist in the graph (updated after each sync)
  const syncedNodeIds = useRef(new Set(connectedNodes.map((c) => c.nodeId)))
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false)

  // ── Morph animation (refs + entry/exit transitions) ─────────────────────
  const modalRef    = useRef(null)
  const backdropRef = useRef(null)
  // animateClose is returned by the hook; handleClose wraps it with flushSave.
  // Declared after flushSave below.

  // ── Persisted-shape values (used by both auto-save and the close-time diff) ─
  // Recomputed each render and stashed in a ref so handleClose reads fresh
  // values without re-attaching its useCallback (and the Esc keydown listener)
  // every keystroke.
  //
  // Empty labels persist as '' (not 'Untitled'). Display-time fallback to
  // 'Untitled' lives in CampaignNode + ConnectionsSection. A persist-time
  // fold here used to corrupt the undo chain on freshly-created empty cards:
  // createCard recorded dbRow.label='', the mount auto-save folded that to
  // 'Untitled' in DB, and any subsequent editCardField captured `before:
  // 'Untitled'`. Redo-create then landed at '', and redo-edit's `before='Untitled'`
  // mismatched and got silently rejected.
  const livePersistedRef = useRef(null)
  livePersistedRef.current = {
    label:      title.trim(),
    type,
    summary,
    storyNotes: storyNotes.filter((b) => b.value.trim()).map((b) => b.value),
    hiddenLore: hiddenLore.filter((b) => b.value.trim()).map((b) => b.value),
    dmNotes:    dmNotes.filter((b) => b.value.trim()).map((b) => b.value),
    media:      media.map((m) => m.src),
    avatar:     thumbnail || null,
  }

  // Per-field session start snapshot (ADR-0006 §7). Captured ONCE on mount
  // from the same persisted-shape projection the close-time diff uses, so
  // a no-op open/close doesn't generate spurious undo entries. handleClose
  // diffs this against livePersistedRef.current and emits one editCardField
  // per changed field.
  const sessionStartRef = useRef(null)
  useEffect(() => {
    sessionStartRef.current = livePersistedRef.current
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const flushSave = useAutoSave({
    doSave: () => {
      const currentNodeIds = new Set(localConns.map((c) => c.nodeId))
      const addNodeIds    = localConns.filter((c) => !syncedNodeIds.current.has(c.nodeId)).map((c) => c.nodeId)
      const removeNodeIds = [...syncedNodeIds.current].filter((id) => !currentNodeIds.has(id))
      onUpdate(node.id, livePersistedRef.current, { addNodeIds, removeNodeIds })
      addNodeIds.forEach((id) => syncedNodeIds.current.add(id))
      removeNodeIds.forEach((id) => syncedNodeIds.current.delete(id))
    },
    deps: [title, type, summary, storyNotes, hiddenLore, dmNotes, media, thumbnail, localConns],
  })

  const animateClose = useMorphAnimation({ modalRef, backdropRef, originRect, onClose })
  const handleClose = useCallback(() => {
    flushSave()
    // Per-field diff vs session start. Each changed field becomes one
    // editCardField undo entry; outside the modal, Ctrl+Z reverts them in
    // this push order (most recently pushed first).
    const start = sessionStartRef.current
    if (start) {
      const current = livePersistedRef.current
      for (const field of EDITABLE_FIELDS) {
        if (!deepEqual(start[field], current[field])) {
          useUndoStore.getState().recordAction({
            type: ACTION_TYPES.EDIT_CARD_FIELD,
            campaignId: activeCampaignId,
            label: `Edit ${FIELD_LABELS[field]}`,
            timestamp: new Date().toISOString(),
            cardId: node.id,
            field,
            before: start[field],
            after: current[field],
          })
        }
      }
    }
    animateClose()
  }, [flushSave, animateClose, activeCampaignId, node.id])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  // ── Title focus on mount ─────────────────────────────────────────────────
  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showCreateTypeModal && (
        <CreateTypeModal
          onClose={() => setShowCreateTypeModal(false)}
          onCreated={(key) => setType(key)}
        />
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

          {/* ── Header: avatar + title + type dropdown + close ── */}
          <EditModalHeader
            node={node}
            title={title}
            setTitle={setTitle}
            type={type}
            setType={setType}
            typeConfig={typeConfig}
            hdrText={hdrText}
            TypeIcon={TypeIcon}
            thumbnail={thumbnail}
            setThumbnail={setThumbnail}
            campaignId={activeCampaignId}
            onClose={handleClose}
            onCreateNewType={() => setShowCreateTypeModal(true)}
          />

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
            <BulletSection
              items={storyNotes}
              onChange={setStoryNotes}
              label="Story Notes"
              placeholder="Narrative beat…"
              dotColor={typeConfig.color}
              addLabel="Add note"
            />

            {/* ── GM Only divider ── */}
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-semibold text-[#4b5563] whitespace-nowrap">GM ONLY</span>
              <div className="flex-1 h-px bg-[#6b7280]" />
            </div>

            {/* Inspiration images */}
            <MediaSection
              items={media}
              onChange={setMedia}
              cardId={node.id}
              campaignId={activeCampaignId}
              slug={title || node.data.label}
            />

            {/* Hidden Lore */}
            <BulletSection
              items={hiddenLore}
              onChange={setHiddenLore}
              label="Hidden Lore"
              placeholder="Secret not yet revealed…"
              dotColor={typeConfig.color}
              addLabel="Add secret"
            />

            {/* DM Notes */}
            <BulletSection
              items={dmNotes}
              onChange={setDmNotes}
              label="DM Notes"
              placeholder="Voice, motivation, tactics…"
              dotColor={typeConfig.color}
              addLabel="Add note"
            />

            {/* ── Connections ── */}
            <ConnectionsSection
              localConns={localConns}
              setLocalConns={setLocalConns}
              allOtherNodes={allOtherNodes}
            />

          </div>


        </div>
      </div>
    </>
  )
}
