import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNodeTypes } from '../store/useTypeStore'
import { useWorkspace } from '../lib/WorkspaceContext.jsx'
import { useUndoStore } from '../store/useUndoStore'
import { ACTION_TYPES, deepEqual } from '../lib/undo/index.js'
import CreateTypeModal from './CreateTypeModal'
import InspectorHeader from './InspectorHeader'
import { useAutoSave } from '../hooks/useAutoSave'
import { safeRandomUUID } from '../lib/uuid.js'
import { useIsNarrowViewport } from '../hooks/useIsNarrowViewport'
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight'
import { useMorphAnimation, TRANSITION_MS } from '../hooks/useMorphAnimation'
import { UploadImageProvider } from './UploadImageProvider'
import { SEARCH_BAND_REM } from './SearchBar'
import { EditorProvider } from './editor/EditorContext.jsx'
import { EditorErrorBoundary } from './editor/EditorErrorBoundary.jsx'
import { revertLinksForNode, revertLinksInBlocks } from './editor/editorLinks.js'
import { loadBlockZones, saveBlockZones, ZONE_KINDS } from '../lib/blockZones.js'

// Lazy so the ~1 MB BlockNote bundle loads only when a card is opened, never in
// the main app bundle. Block-editor Phase 2, Chunk A (ADR-0016).
const CardZones = lazy(() => import('./editor/CardZones.jsx'))

const MODAL_WIDTH = '41.25rem'
// Docked geometry (per the mockup). 8-grid: 480/8=60, 16/8=2, 80/8=10.
const DOCKED_WIDTH    = '30rem'   // 480px
const DOCKED_RIGHT    = '1rem'    // 16px off the right edge
const DOCK_SNAP_PX    = 96        // drag the right edge within this of the
                                  // viewport edge to arm docking
const DETACH_PX       = 24        // drag the docked header this far to detach
const VIEWPORT_MARGIN = 8         // keep the floating modal this far inside the
                                  // viewport so the header stays grabbable

// Clamp a centered-modal drag offset so the modal stays within the viewport.
// The undocked inspector is flex-centered, so the offset (dragPos) is measured
// from that centered base position — hence baseLeft/baseTop. Shared by the
// drag, detach, and resize re-clamp paths so they can't drift apart.
function clampOffset(x, y, w, h, m = VIEWPORT_MARGIN) {
  const baseLeft = (window.innerWidth  - w) / 2
  const baseTop  = (window.innerHeight - h) / 2
  return {
    x: Math.min(Math.max(x, m - baseLeft), window.innerWidth  - w - m - baseLeft),
    y: Math.min(Math.max(y, m - baseTop),  window.innerHeight - h - m - baseTop),
  }
}

// Scalar card fields that emit `editCardField` undo entries on modal close.
// Card content (summary / story notes / hidden lore / DM notes / media) moved
// into the block editor at the E4 cutover (ADR-0016); the only fields the
// Inspector still owns + persists via onUpdate are these three header fields,
// plus connections (tracked separately below).
//
// Emission order is chronological by per-field last-dirty timestamp,
// interleaved with connection events, all sorted by timestamp in
// commitSession's emission pass.
const EDITABLE_FIELDS = ['label', 'type', 'avatar']
const FIELD_LABELS = {
  label:  'title',
  type:   'type',
  avatar: 'avatar',
}

// Return a readable foreground color for a given hex background.
// Used for the header text on the type-colored band.
function textForHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1f2937' : '#ffffff'
}

export default function Inspector({
  node,
  connectedNodes,
  allOtherNodes,
  originRect,
  skipOpenMorph = false,
  mode = 'undocked',
  position = { x: 0, y: 0 },
  onPositionChange,
  onDock,
  onUndock,
  getCloseRect,
  commitApiRef,
  editorFlushApiRef,
  connectionsApiRef,
  onUpdate,
  onClose,
}) {
  const isDocked = mode === 'docked'
  // MB-2 (mobile beta hardening): on phone-narrow viewports BOTH desktop
  // presentations are wider than the screen (floating 660px, docked 480px),
  // so the Inspector renders as a full-screen takeover instead — Erik's
  // product call 2026-07-02 (mobile users don't expect to see the graph
  // alongside the editor). Presentation-level override only: `mode` (and its
  // localStorage memory) stays desktop-only state, untouched by this branch,
  // so rotating to landscape or moving to desktop restores the chosen mode.
  const isFullscreen = useIsNarrowViewport()
  // When the on-screen keyboard opens, mobile browsers overlay it without
  // shrinking the layout viewport — a fixed inset-0 panel keeps its full
  // height and its bottom (the GM's Eyes Only zone) hides behind the
  // keyboard. Constrain the full-screen container to the VISIBLE height so
  // the inner scroll area can actually reach what the user is typing.
  // null when the keyboard is closed (or on desktop) → normal inset-0.
  const keyboardAwareHeight = useVisualViewportHeight(isFullscreen)
  // ── Form state ────────────────────────────────────────────────────────────
  // Card content (summary / bullets / media) lives in the block editor now;
  // the Inspector owns only the three header fields below, plus connections.
  const [title,      setTitle]      = useState(node.data.label  || '')
  const [type,       setType]       = useState(node.data.type)
  const [thumbnail,  setThumbnail]  = useState(node.data.avatar || null)
  // Per-node display preference (migration 013): hide the identity image on the
  // canvas without deleting it. Persisted via onUpdate alongside the other
  // header fields; intentionally NOT in EDITABLE_FIELDS (a display toggle has
  // no undo entry — toggling back is the inverse).
  const [hideAvatar, setHideAvatar] = useState(node.data.hideAvatar || false)
  const NODE_TYPES = useNodeTypes()
  const typeConfig = NODE_TYPES[type] || { color: '#6B7280', label: type }
  const TypeIcon   = typeConfig.icon
  const hdrText    = textForHex(typeConfig.color)
  const { activeWorkspaceId } = useWorkspace()

  // ── Connection state ──────────────────────────────────────────────────────
  // localConns shape: { id, nodeId, label, type, isNew }. `id` is the
  // connection's UUID — the existing edge id for pre-existing connections,
  // or a client-side-generated UUID for newly-added ones (assigned in
  // ConnectionsSection at picker click). Carrying a stable id from click
  // through to dbCreateConnection means Inspector can log addConnection
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
    label:  title.trim(),
    type,
    avatar: thumbnail || null,
    hideAvatar,
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
  //
  // Skip-on-no-change (phase 7b): the auto-save fires on mount because its
  // useEffect deps go from undefined → defined. Without a guard, opening
  // any card triggers one DB write even when the user touches nothing.
  // We compare livePersistedRef.current against sessionStartRef.current
  // (snapshotted on mount in the same shape) and skip if they're equal AND
  // there are no pending connection changes. The first real edit produces
  // a diff and the save fires normally.
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
      const hasConnectionChanges = addConnections.length > 0 || removeConnections.length > 0
      const fieldsUnchanged =
        sessionStartRef.current &&
        deepEqual(sessionStartRef.current, livePersistedRef.current)
      if (fieldsUnchanged && !hasConnectionChanges) return

      onUpdate(node.id, livePersistedRef.current, { addConnections, removeConnections })
      addConnections.forEach(({ id, nodeId }) => syncedConnsRef.current.set(id, nodeId))
      removeConnections.forEach(({ id }) => syncedConnsRef.current.delete(id))
    },
    deps: [title, type, thumbnail, hideAvatar, localConns],
  })

  const animateClose = useMorphAnimation({ modalRef, backdropRef, originRect, skipOpenMorph, getCloseRect, onClose })

  // Docked panel ref + its slide-down close (the undocked path uses the morph
  // animation instead — see handleClose).
  const dockedRef = useRef(null)
  const animateDockedClose = useCallback(() => {
    const el = dockedRef.current
    if (!el) { onClose(); return }
    el.style.transition = `transform ${TRANSITION_MS}ms ease, opacity ${TRANSITION_MS}ms ease`
    el.style.transform  = 'translateY(100%)'
    el.style.opacity    = '0'
    setTimeout(onClose, TRANSITION_MS)
  }, [onClose])

  // Commit the editing session: flush the pending auto-save and emit this
  // session's undo entries. Called on explicit close AND — via commitApiRef —
  // by App right before a repoint swaps the inspector's topic node, so the
  // outgoing node's edits are never lost. Guarded so it can't double-emit
  // (e.g. App commits on repoint, or close commits, but never both for one
  // mounted instance).
  const committedRef = useRef(false)
  const commitSession = useCallback(() => {
    if (committedRef.current) return
    committedRef.current = true
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
            workspaceId: activeWorkspaceId,
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
            workspaceId: activeWorkspaceId,
            label: 'Add connection',
            timestamp: isoTs,
            connectionId: e.connectionId,
            sourceNodeId: node.id,
            targetNodeId: e.nodeId,
          })
        } else if (e.kind === 'removeConnection') {
          useUndoStore.getState().recordAction({
            type: ACTION_TYPES.REMOVE_CONNECTION,
            workspaceId: activeWorkspaceId,
            label: 'Remove connection',
            timestamp: isoTs,
            connectionId: e.connectionId,
            sourceNodeId: node.id,
            targetNodeId: e.nodeId,
          })
        }
      }
    }
  }, [flushSave, activeWorkspaceId, node.id])

  // Expose commitSession to App so a repoint can commit this session before
  // remounting the inspector on the new topic node.
  useEffect(() => {
    if (!commitApiRef) return
    commitApiRef.current = commitSession
    return () => { if (commitApiRef.current === commitSession) commitApiRef.current = null }
  }, [commitApiRef, commitSession])

  // Expose addExternalConnection to App so a canvas quick-connect involving
  // this card shows up as a chip immediately. The connection is ALREADY
  // created and undo-recorded by App, so it must enter this session as
  // settled state, not as a user edit: pre-marking syncedConnsRef keeps
  // auto-save from re-creating it, and writing prevLocalConnsRef inside the
  // updater keeps the session's connection log (and therefore the close-time
  // undo emission) from double-recording it.
  useEffect(() => {
    if (!connectionsApiRef) return
    const api = {
      addExternalConnection: ({ id, nodeId, label, type }) => {
        syncedConnsRef.current.set(id, nodeId)
        setLocalConns((prev) => {
          if (prev.some((c) => c.id === id || c.nodeId === nodeId)) return prev
          const next = [...prev, { id, nodeId, label, type, isNew: false }]
          prevLocalConnsRef.current = next
          return next
        })
      },
    }
    connectionsApiRef.current = api
    return () => { if (connectionsApiRef.current === api) connectionsApiRef.current = null }
  }, [connectionsApiRef])

  const handleClose = useCallback(() => {
    commitSession()
    // Full-screen and docked share the slide-down exit (dockedRef); the
    // undocked modal morphs back toward its node instead.
    if (isFullscreen || isDocked) animateDockedClose()
    else animateClose()
  }, [commitSession, isFullscreen, isDocked, animateDockedClose, animateClose])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  // ── Undocked drag (Chunk 1) ──────────────────────────────────────────────
  // The inspector is flex-centered; dragging applies a translate offset to a
  // wrapper element. That wrapper is deliberately separate from modalRef —
  // the morph animation owns modalRef's transform, so keeping the two on
  // different elements lets them compose without fighting. A drag begins only
  // from the header band, never from an interactive control inside it, and
  // the offset is clamped so the inspector stays within the viewport (8px
  // margin) and the header is always grabbable.
  // Drag offset is kept in local state during the drag (cheap — no App
  // re-render per pointermove) and synced up to App on release via
  // onPositionChange, so the position survives a repoint remount. It's
  // seeded from the `position` prop, which App preserves across repoints.
  const [dragPos, setDragPos] = useState(position)
  const dragPosRef = useRef(position)
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange
  const onDockRef = useRef(onDock)
  onDockRef.current = onDock
  // True while the drag has carried the inspector's right edge near the
  // viewport's right edge — arms docking and shows the snap-zone affordance.
  const [dockArmed, setDockArmed] = useState(false)
  const dockArmedRef = useRef(false)
  const onHeaderPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    if (e.target.closest('input, textarea, button, select, [contenteditable="true"]')) return
    e.preventDefault()
    const startMX = e.clientX, startMY = e.clientY
    const startPX = dragPosRef.current.x, startPY = dragPosRef.current.y
    const onMove = (ev) => {
      let nx = startPX + (ev.clientX - startMX)
      let ny = startPY + (ev.clientY - startMY)
      const el = modalRef.current
      if (el) {
        const w = el.offsetWidth, h = el.offsetHeight
        const clamped = clampOffset(nx, ny, w, h)
        nx = clamped.x; ny = clamped.y
        // Arm docking when the panel's right edge nears the viewport edge.
        const baseLeft = (window.innerWidth - w) / 2
        const rightEdge = baseLeft + nx + w
        const armed = (window.innerWidth - rightEdge) < DOCK_SNAP_PX
        if (armed !== dockArmedRef.current) {
          dockArmedRef.current = armed
          setDockArmed(armed)
        }
      }
      dragPosRef.current = { x: nx, y: ny }
      setDragPos(dragPosRef.current)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (dockArmedRef.current) {
        dockArmedRef.current = false
        setDockArmed(false)
        onDockRef.current?.()
      } else {
        onPositionChangeRef.current?.(dragPosRef.current)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  // ── Detach from docked (Chunk 3) ─────────────────────────────────────────
  // Dragging the docked panel's header past a small threshold undocks it into
  // a floating modal that follows the cursor (header tracked under the
  // pointer), then behaves like a normal drag. One continuous gesture: the
  // window listeners stay attached across the mode flip.
  const onUndockRef = useRef(onUndock)
  onUndockRef.current = onUndock
  const onDockedHeaderPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    if (e.target.closest('input, textarea, button, select, [contenteditable="true"]')) return
    e.preventDefault()
    const startMX = e.clientX, startMY = e.clientY
    let detached = false
    const place = (cx, cy) => {
      const el = modalRef.current
      const w = el?.offsetWidth  || 660
      const h = el?.offsetHeight || 520
      const baseTop  = (window.innerHeight - h) / 2
      const rawX = cx - window.innerWidth / 2   // modal center-x under cursor
      const rawY = (cy - 24) - baseTop          // header just under the cursor
      dragPosRef.current = clampOffset(rawX, rawY, w, h)
      setDragPos(dragPosRef.current)
    }
    const onMove = (ev) => {
      if (!detached) {
        if (Math.hypot(ev.clientX - startMX, ev.clientY - startMY) < DETACH_PX) return
        detached = true
        onUndockRef.current?.()
      }
      place(ev.clientX, ev.clientY)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (detached) onPositionChangeRef.current?.(dragPosRef.current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  // ── Keep the floating header on-screen when content height changes ────────
  // The modal is flex-centered, so growing content (e.g. typing in the block
  // editor) expands it symmetrically about its center — a modal dragged near
  // the top would otherwise carry its header (the only drag handle) above the
  // viewport. Re-run the same clamp the drag path uses whenever the modal
  // resizes or the window resizes. Undocked only; docked is pinned.
  useEffect(() => {
    if (isDocked || isFullscreen) return
    const el = modalRef.current
    if (!el) return
    const reclamp = () => {
      const { x, y } = dragPosRef.current
      const clamped = clampOffset(x, y, el.offsetWidth, el.offsetHeight)
      if (clamped.x !== x || clamped.y !== y) {
        dragPosRef.current = clamped
        setDragPos(clamped)
        onPositionChangeRef.current?.(clamped)
      }
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reclamp) : null
    ro?.observe(el)
    window.addEventListener('resize', reclamp)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', reclamp)
    }
  }, [isDocked, isFullscreen])

  // ── Title focus on mount ─────────────────────────────────────────────────
  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  // ── Editor context for the custom blocks (Phase 2, Chunks B + C) ─────────
  // The Connections + Image Album blocks and the [[ link autocomplete read this.
  // Adding/deleting a connection routes through the SAME localConns flow the
  // legacy ConnectionsSection uses, so canvas-edge create/remove, persistence,
  // and undo all come for free. Connections are read live (not cached in the
  // block) so a delete can't ghost back — see ADR-0016 §8.
  //
  // editorsRef holds every mounted zone editor so a connection delete can
  // revert that node's [[links]] back to plain text across both zones (§7).
  const editorsRef = useRef(null)
  if (editorsRef.current === null) editorsRef.current = new Set()
  const registerEditor   = useCallback((ed) => { editorsRef.current.add(ed) }, [])
  const unregisterEditor = useCallback((ed) => { editorsRef.current.delete(ed) }, [])

  // Pending-save flush functions, one per mounted zone editor. App awaits the
  // aggregate (via editorFlushApiRef) before deleting the card this Inspector
  // is open on, so the card's latest block content is in the DB before the
  // delete snapshot reads it (ADR-0016 Chunk E1).
  const flushesRef = useRef(null)
  if (flushesRef.current === null) flushesRef.current = new Set()
  const registerFlush   = useCallback((fn) => { flushesRef.current.add(fn) }, [])
  const unregisterFlush = useCallback((fn) => { flushesRef.current.delete(fn) }, [])
  useEffect(() => {
    if (!editorFlushApiRef) return
    const flushAll = () =>
      Promise.all(
        [...flushesRef.current].map((fn) => {
          try { return Promise.resolve(fn()) } catch { return Promise.resolve() }
        }),
      )
    editorFlushApiRef.current = flushAll
    return () => { if (editorFlushApiRef.current === flushAll) editorFlushApiRef.current = null }
  }, [editorFlushApiRef])

  const editorContextValue = useMemo(() => ({
    cardId: node.id,
    workspaceId: activeWorkspaceId,
    slug: title || node.data.label,
    connections: localConns,
    allOtherNodes,
    registerEditor,
    unregisterEditor,
    registerFlush,
    unregisterFlush,
    // [[ link selection — set semantics: one connection per node-pair.
    onAddConnection: (targetNode) =>
      setLocalConns((prev) =>
        prev.some((c) => c.nodeId === targetNode.id)
          ? prev
          : [...prev, {
              id: safeRandomUUID(),
              nodeId: targetNode.id,
              label: targetNode.data?.label,
              type: targetNode.data?.type,
              isNew: true,
            }],
      ),
    // The authoritative connection delete (§6): drop the connection AND revert
    // any inline [[links]] to that node to plain text across both zones (§7).
    onDeleteConnection: (connectionId) => {
      const conn = localConns.find((c) => c.id === connectionId)
      if (conn) {
        for (const ed of editorsRef.current) revertLinksForNode(ed, conn.nodeId)
        // The OTHER endpoint may hold [[links]] to THIS card. Its editors
        // aren't mounted here, so rewrite its stored zones directly —
        // otherwise its link text keeps the live styling after the line is
        // gone (§7 is a both-endpoints contract). Fire-and-forget per the
        // persistence pattern; Realtime mirrors the change to open canvases.
        loadBlockZones(conn.nodeId)
          .then((zones) => {
            const changed = {}
            for (const kind of ZONE_KINDS) {
              const res = revertLinksInBlocks(zones[kind], node.id)
              if (res.reverted > 0) changed[kind] = res.blocks
            }
            if (Object.keys(changed).length > 0) {
              return saveBlockZones(conn.nodeId, changed)
            }
          })
          .catch(console.error)
      }
      setLocalConns((prev) => prev.filter((c) => c.id !== connectionId))
    },
  }), [node.id, node.data.label, activeWorkspaceId, title, localConns, allOtherNodes, registerEditor, unregisterEditor, registerFlush, unregisterFlush])

  // ── Render ────────────────────────────────────────────────────────────────
  // Header + body, shared verbatim by both the docked and undocked containers.
  const inner = (
    <>
          {/* ── Header: avatar + title + type dropdown + close ── */}
          <InspectorHeader
            node={node}
            // Full-screen has no drag gestures — there's nowhere to drag a
            // panel that already fills the screen.
            onPointerDown={isFullscreen ? undefined : (isDocked ? onDockedHeaderPointerDown : onHeaderPointerDown)}
            docked={isDocked && !isFullscreen}
            title={title}
            setTitle={setTitle}
            type={type}
            setType={setType}
            typeConfig={typeConfig}
            hdrText={hdrText}
            TypeIcon={TypeIcon}
            thumbnail={thumbnail}
            setThumbnail={setThumbnail}
            hideAvatar={hideAvatar}
            setHideAvatar={setHideAvatar}
            workspaceId={activeWorkspaceId}
            onClose={handleClose}
            onCreateNewType={() => setShowCreateTypeModal(true)}
          />

          {/* ── Body (scrollable) ── */}
          <div className="overflow-y-auto flex-1 min-h-0 px-4 pt-4 pb-10 flex flex-col gap-10">

            {/* ── Block editor (ADR-0016) ──
                The two zone editors read/save the migrated card_view / gm_only
                JSON, and the fixed Connections panel (inside CardZones) reads/
                deletes through the EditorContext localConns flow. The legacy
                Summary / bullets / media / connections sections were removed at
                the Chunk E4 cutover; their state + wiring is cleaned up in E4b. */}
            <EditorErrorBoundary>
              <Suspense fallback={<div className="text-sm text-gray-400">Loading editor…</div>}>
                <EditorProvider value={editorContextValue}>
                  <CardZones nodeId={node.id} />
                </EditorProvider>
              </Suspense>
            </EditorErrorBoundary>

          </div>
    </>
  )

  return (
    <UploadImageProvider>
      {showCreateTypeModal && (
        <CreateTypeModal
          onClose={() => setShowCreateTypeModal(false)}
          onCreated={(key) => setType(key)}
        />
      )}

      {/* Snap-zone affordance — shows where the inspector will dock while it's
          dragged near the right edge. */}
      {dockArmed && (
        <div
          className="fixed z-[9998] rounded-[0.5rem] border-2 border-dashed border-white/50 bg-white/10 pointer-events-none"
          style={{ top: `${SEARCH_BAND_REM}rem`, right: DOCKED_RIGHT, bottom: 0, width: DOCKED_WIDTH }}
        />
      )}

      {/* No scrim — the canvas stays live behind the inspector. Docked is a
          bottom-right overlay (flush bottom, off the right edge, top at the
          search band); undocked is a centered, draggable modal. On narrow
          viewports (MB-2) both collapse into a full-screen takeover: no
          rounded corners, no drag, slide-up entry, slide-down close. */}
      <div className={(isDocked || isFullscreen)
        ? 'fixed inset-0 z-[9999] pointer-events-none'
        : 'fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none'}>
        {isFullscreen ? (
          <div
            ref={dockedRef}
            data-testid="inspector-fullscreen"
            className={`pointer-events-auto absolute inset-0 flex flex-col overflow-hidden ${skipOpenMorph ? 'inspector-fade-in' : 'inspector-rise-in'}`}
            style={{
              // Explicit height beats inset-0's bottom when the keyboard is
              // open (over-constrained box: bottom loses), shrinking the
              // panel to the visible area above the keyboard.
              ...(keyboardAwareHeight != null ? { height: `${keyboardAwareHeight}px` } : null),
              backgroundColor: `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
              '--modal-bg': `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
            }}
          >
            {inner}
          </div>
        ) : isDocked ? (
          <div
            ref={dockedRef}
            className={`pointer-events-auto absolute rounded-[0.5rem] shadow-2xl flex flex-col overflow-hidden ${skipOpenMorph ? 'inspector-fade-in' : 'inspector-rise-in'}`}
            style={{
              top: `${SEARCH_BAND_REM}rem`,
              right: DOCKED_RIGHT,
              bottom: 0,
              width: DOCKED_WIDTH,
              backgroundColor: `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
              '--modal-bg': `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
            }}
          >
            {inner}
          </div>
        ) : (
          <div
            className="pointer-events-auto"
            style={{ transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }}
          >
            <div
              ref={modalRef}
              className="rounded-[0.5rem] shadow-2xl flex flex-col overflow-hidden"
              style={{
                width: MODAL_WIDTH,
                maxHeight: '90vh',
                backgroundColor: `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
                '--modal-bg': `color-mix(in srgb, ${typeConfig.color} 5%, white)`,
              }}
            >
              {inner}
            </div>
          </div>
        )}
      </div>
    </UploadImageProvider>
  )
}
