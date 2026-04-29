import { useState, useRef, useEffect, useCallback } from 'react'
import { useNodeTypes } from '../store/useTypeStore'
import { useCampaign } from '../lib/CampaignContext.jsx'
import CreateTypeModal from './CreateTypeModal'
import BulletSection, { newItem } from './BulletSection'
import SectionLabel from './SectionLabel'
import MediaSection from './MediaSection'
import ConnectionsSection from './ConnectionsSection'
import EditModalHeader from './EditModalHeader'
import { useAutoSave } from '../hooks/useAutoSave'
import { useMorphAnimation } from '../hooks/useMorphAnimation'

const MODAL_WIDTH = '41.25rem'

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

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const flushSave = useAutoSave({
    doSave: () => {
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
    },
    deps: [title, type, summary, storyNotes, hiddenLore, dmNotes, media, thumbnail, localConns],
  })

  const animateClose = useMorphAnimation({ modalRef, backdropRef, originRect, onClose })
  const handleClose = useCallback(() => {
    flushSave()
    animateClose()
  }, [flushSave, animateClose])

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
