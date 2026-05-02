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

// Card fields that emit `editCardField` undo entries on modal close. Phase 7a
// emits them in CHRONOLOGICAL order (sorted by per-field last-dirty timestamp,
// interleaved with connection events from the same session) instead of the
// fixed array order used in phases 4–6 — see the dirty-tracking refs below.
//
// Phase 7b will split storyNotes/hiddenLore/dmNotes/media into per-item
// `addListItem`/`removeListItem`/`editListItem`/`reorderListItem` entries.
// For now they stay collapsed at the field level; the chronological ordering
// across fields and connections is what 7a fixes.
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
  // localConns shape: { id, nodeId, label, type, isNew }. `id` is the
  // connection's UUID — the existing edge id for pre-existing connections,
  // or a client-side-generated UUID for newly-added ones (assigned in
  // ConnectionsSection at picker click). Carrying a stable id from click
  // through to dbCreateConnection means EditModal can log addConnection
  // events into the chronological action log immediately, without waiting
  // for the persist round-trip.
  const [localConns, setLocalConns] = useState(
    () => connectedNodes.map((c) => ({
      id: c.edgeId, nodeId: c.nodeId, label: c.label, type: c.type, isNew: false,
    }))
  )
  // Map of connectionId → nodeId for connections currently persisted in DB.
  // doSave updates this after each successful add/remove; used to compute
  // the addConnections / removeConnections payloads sent to onUpdate.
  const syncedConnsRef = useRef(
    new Map(connectedNodes.map((c) => [c.edgeId, c.nodeId])),
  )
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
  // a no-op open/close doesn't generate spurious undo entries.
  const sessionStartRef = useRef(null)
  useEffect(() => {
    sessionStartRef.current = livePersistedRef.current
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chronological action log (phase 7a) ──────────────────────────────────
  // Two trackers feed `handleClose`'s ordered emission of recordActions:
  //
  // 1. fieldDirtyAtRef — per-field { firstAt, lastAt } timestamps. We use
  //    `lastAt` for emission ordering, so re-editing a field after touching
  //    others moves it up the stack ("most recent edit on top"). Reverting
  //    a field back to its session-start value drops the tracker so the
  //    field is treated as clean.
  //
  // 2. connectionLogRef — every connection add/remove the user clicks during
  //    the session, in click order, with timestamps. We log every click
  //    rather than diffing at close so add-X then remove-X within a session
  //    becomes two undo steps (the user did two things) instead of one
  //    collapsed entry.
  //
  // At close we merge both into a chronological list and emit recordActions
  // sorted by timestamp. Connection events that have a matching same-id
  // opposite-kind event later in the log still both get emitted — each
  // click is its own undo step (this is the trust-preserving choice;
  // de-duping would lose intent).
  const fieldDirtyAtRef = useRef({})       // field → { firstAt, lastAt }
  const prevLiveRef     = useRef(null)
  const connectionLogRef = useRef([])      // [{ kind, connectionId, nodeId, timestamp }]
  const prevLocalConnsRef = useRef(localConns)

  useEffect(() => {
    const start = sessionStartRef.current
    if (!start) {
      prevLiveRef.current = livePersistedRef.current
      return
    }
    const prev = prevLiveRef.current
    const curr = livePersistedRef.current
    const now = Date.now()

    for (const field of EDITABLE_FIELDS) {
      if (deepEqual(prev?.[field], curr[field])) continue
      const dirtyNow = !deepEqual(start[field], curr[field])
      if (dirtyNow) {
        const existing = fieldDirtyAtRef.current[field]
        fieldDirtyAtRef.current[field] = {
          firstAt: existing?.firstAt ?? now,
          lastAt: now,
        }
      } else {
        // Reverted to session start — clear so the field doesn't emit.
        delete fieldDirtyAtRef.current[field]
      }
    }
    prevLiveRef.current = curr
  })  // every render; cheap, just ref reads + deepEqual

  useEffect(() => {
    const prev = prevLocalConnsRef.current
    const curr = localConns
    const prevIds = new Set(prev.map((c) => c.id))
    const currIds = new Set(curr.map((c) => c.id))
    const ts = Date.now()

    for (const c of curr) {
      if (!prevIds.has(c.id)) {
        connectionLogRef.current.push({
          kind: 'addConnection', connectionId: c.id, nodeId: c.nodeId, timestamp: ts,
        })
      }
    }
    for (const c of prev) {
      if (!currIds.has(c.id)) {
        connectionLogRef.current.push({
          kind: 'removeConnection', connectionId: c.id, nodeId: c.nodeId, timestamp: ts,
        })
      }
    }
    prevLocalConnsRef.current = curr
  }, [localConns])

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // Payload shape for connections is { addConnections, removeConnections },
  // each entry { id, nodeId }. The id is generated client-side at picker
  // click and threads through to dbCreateConnection({ id, ... }) so the
  // DB row, the React Flow edge, and the undo entry all agree.
  const flushSave = useAutoSave({
    doSave: () => {
      const currentIds = new Set(localConns.map((c) => c.id))
      const addConnections    = localConns
        .filter((c) => !syncedConnsRef.current.has(c.id))
        .map((c) => ({ id: c.id, nodeId: c.nodeId }))
      const removeConnections = []
      for (const [syncedId, syncedNodeId] of syncedConnsRef.current) {
        if (!currentIds.has(syncedId)) {
          removeConnections.push({ id: syncedId, nodeId: syncedNodeId })
        }
      }
      onUpdate(node.id, livePersistedRef.current, { addConnections, removeConnections })
      addConnections.forEach(({ id, nodeId }) => syncedConnsRef.current.set(id, nodeId))
      removeConnections.forEach(({ id }) => syncedConnsRef.current.delete(id))
    },
    deps: [title, type, summary, storyNotes, hiddenLore, dmNotes, media, thumbnail, localConns],
  })

  const animateClose = useMorphAnimation({ modalRef, backdropRef, originRect, onClose })
  const handleClose = useCallback(() => {
    flushSave()

    const start = sessionStartRef.current
    if (start) {
      const current = livePersistedRef.current

      // Build a unified chronological emission list: scalar field changes
      // (sorted by last-dirty time) plus connection events from the click
      // log. Sort by timestamp so the recordAction calls happen in user-
      // action order — most recent ends up on top of the undo stack.
      const emissions = []

      for (const field of EDITABLE_FIELDS) {
        if (!deepEqual(start[field], current[field])) {
          const dirty = fieldDirtyAtRef.current[field]
          emissions.push({
            kind: 'editCardField',
            field,
            before: start[field],
            after:  current[field],
            timestamp: dirty?.lastAt ?? Date.now(),
          })
        }
      }
      for (const ev of connectionLogRef.current) {
        emissions.push(ev)
      }
      emissions.sort((a, b) => a.timestamp - b.timestamp)

      for (const e of emissions) {
        const isoTs = new Date(e.timestamp).toISOString()
        if (e.kind === 'editCardField') {
          useUndoStore.getState().recordAction({
            type: ACTION_TYPES.EDIT_CARD_FIELD,
            campaignId: activeCampaignId,
            label: `Edit ${FIELD_LABELS[e.field]}`,
            timestamp: isoTs,
            cardId: node.id,
            field:  e.field,
            before: e.before,
            after:  e.after,
          })
        } else if (e.kind === 'addConnection') {
          useUndoStore.getState().recordAction({
            type: ACTION_TYPES.ADD_CONNECTION,
            campaignId: activeCampaignId,
            label: 'Add connection',
            timestamp: isoTs,
            connectionId: e.connectionId,
            sourceNodeId: node.id,
            targetNodeId: e.nodeId,
          })
        } else if (e.kind === 'removeConnection') {
          useUndoStore.getState().recordAction({
            type: ACTION_TYPES.REMOVE_CONNECTION,
            campaignId: activeCampaignId,
            label: 'Remove connection',
            timestamp: isoTs,
            connectionId: e.connectionId,
            sourceNodeId: node.id,
            targetNodeId: e.nodeId,
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
