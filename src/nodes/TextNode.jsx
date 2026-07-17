import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useReactFlow } from 'reactflow'
import {
  TextAlignLeft, TextAlignCenter, TextAlignRight,
  TextB, TextItalic, Trash, DotsSixVertical, CaretDown,
} from '@phosphor-icons/react'
import { updateTextNode as dbUpdateTextNode } from '../lib/textNodes.js'
import { useCanvasOps } from '../lib/CanvasOpsContext.jsx'
import { useWorkspace } from '../lib/WorkspaceContext.jsx'
import { useUndoStore } from '../store/useUndoStore'
import { ACTION_TYPES } from '../lib/undo/index.js'
import { useZoomInvariantScale } from '../hooks/useZoomInvariantScale.js'
import { useTouchPrimary } from '../hooks/useTouchPrimary.js'
import { lockTextBlockGeometry, unlockTextBlockGeometry } from '../lib/interactionLocks.js'
import { CanvasToolbar, ToolbarDivider, placeFloatingToolbar, placeDropdown } from '../components/CanvasToolbar.jsx'

const DEFAULT_WIDTH = 240
const MIN_WIDTH     = 80
const MIN_HEIGHT    = 32

// Standard 8pt-scale presets offered in the font-size dropdown. The field also
// accepts any custom value the user types (clamped to FONT_MIN..FONT_MAX).
// Canvas-space px (text scales with zoom), hence larger than UI type —
// list + 48 default set by Erik 2026-07-06.
const FONT_SIZE_PRESETS = [32, 48, 64, 96, 128, 176, 224, 288]
const DEFAULT_FONT_SIZE = 48
const FONT_MIN = 8
const FONT_MAX = 800

// Text blocks resize like TEXT FIELDS on every platform (MB-6, Erik's call
// 2026-07-06): ONLY the two side handles (e/w), width-only, height always
// derived from the text. Any vertical-axis handle would commit a fixed pixel
// height, breaking the auto-height model (height:null grows with the text).
// Pattern per tldraw's mobile text handles. ax: which edge the handle moves.
const SIDE_HANDLES = [
  { id: 'e', cx: 1, cy: 0.5, cursor: 'ew-resize', ax: 'right', ay: null },
  { id: 'w', cx: 0, cy: 0.5, cursor: 'ew-resize', ax: 'left',  ay: null },
]

// Band geometry (screen px, multiplied by invZoom at render time — handles
// are SCREEN-CONSTANT at every zoom, per the MB-6 research pass: every
// mature canvas tool draws selection chrome at fixed screen size; Excalidraw
// divides all handle dimensions by zoom).
//
// The visible pill is the affordance; the invisible band around it is the
// grab target (hit > visible, industry-universal). The band sits almost
// entirely OUTSIDE the box — the inward sliver stays within the box's own
// 8px padding, so the band covers ZERO text pixels: the browser's native
// selection grabbers at row starts must stay reachable — a 12px inward
// overlap made select-to-start nearly impossible (MB-6 verification,
// 2026-07-06). Touch: 44px target (Apple HIG minimum). Mouse: 24px.
const BAND_WIDTH  = { touch: 44, mouse: 24 }
const BAND_OUTSET = { touch: 40, mouse: 16 }
const PILL_WIDTH  = 8
const PILL_HEIGHT = 32

// ─────────────────────────────────────────────────────────────────────────────
// NativeButton — toolbar button that uses NATIVE pointerdown + click listeners
// instead of React's synthetic events.
//
// React Flow v11's NodeWrapper attaches event listeners that interfere with
// React's synthetic event delegation when a node is selected. The result:
// React's `onMouseDown`/`onClick` on toolbar buttons silently fail to fire
// once the text node has been selected (i.e., on the second edit session and
// every one after). Native listeners attached directly to the button element
// bypass that interference. Native pointerdown also calls `preventDefault()`
// to keep the contenteditable focused, so blur doesn't fire and the toolbar
// doesn't unmount mid-click.
// ─────────────────────────────────────────────────────────────────────────────
function NativeButton({ onAction, className, title, children }) {
  const ref = useRef(null)
  const actionRef = useRef(onAction)
  actionRef.current = onAction

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onPointerDown = (e) => { e.preventDefault() }
    const onClick       = () => actionRef.current?.()
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('click',       onClick)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('click',       onClick)
    }
  }, [])

  return (
    <button ref={ref} className={className} title={title}>
      {children}
    </button>
  )
}

export default function TextNode({ id, data, xPos, yPos }) {
  const { setNodes, getViewport } = useReactFlow()
  const { onDeleteNode } = useCanvasOps()
  const { activeWorkspaceId } = useWorkspace()
  // Counter-scale the in-canvas formatting toolbar so it stays a constant
  // on-screen size at any zoom (it lives inside the zoomable node layer).
  const invZoom = useZoomInvariantScale()
  const touchPrimary = useTouchPrimary()

  const width    = data.width    ?? DEFAULT_WIDTH
  const height   = data.height   ?? null
  const fontSize = data.fontSize ?? DEFAULT_FONT_SIZE
  const align    = data.align    ?? 'left'

  const [editing,   setEditing]   = useState(data.editing ?? false)
  const [isBold,    setIsBold]    = useState(false)
  const [isItalic,  setIsItalic]  = useState(false)
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false)
  // Screen-space placement for the PORTALED font-size menu ({ left, top },
  // null until first measured). See the placement effect below.
  const [sizeMenuPlace, setSizeMenuPlace] = useState(null)
  const sizeAnchorRef = useRef(null)  // the font-size input+caret group
  const sizeMenuRef   = useRef(null)  // the portaled menu, for measuring

  const editorRef   = useRef(null)
  const pendingCaretPointRef = useRef(null)  // screen point of the enter-edit tap (touch caret placement)
  const boxRef      = useRef(null)
  const toolbarRef  = useRef(null)
  const fontInputRef = useRef(null)
  const dragRef     = useRef(null)
  // Edge-aware placement for the in-canvas formatting toolbar, expressed as a
  // node-local translate (canvas px). Computed from the node's screen rect +
  // the toolbar's measured screen size via the shared placeFloatingToolbar
  // helper (same logic the alignment toolbar uses), then mapped back through
  // zoom so it lands at the target screen position. null until first measured.
  const [tbPlace, setTbPlace] = useState(null)
  // Phase 8: snapshot the editor's HTML on focus so the blur diff can fire
  // exactly one editTextNode entry per session (matching ADR-0006 §7's
  // text-edit session model). Toolbar clicks and resize gestures record
  // their own immediate entries — those don't go through this ref.
  const editFocusValueRef = useRef(null)

  // Helper: record an editTextNode entry with whatever fields actually
  // changed. Both `before` and `after` carry a partial field-set so the
  // dispatcher's drift check only looks at the relevant slots.
  const recordEdit = useCallback((before, after) => {
    if (!activeWorkspaceId) return
    useUndoStore.getState().recordAction({
      type: ACTION_TYPES.EDIT_TEXT_NODE,
      workspaceId: activeWorkspaceId,
      label: 'Edit text',
      timestamp: new Date().toISOString(),
      textNodeId: id,
      before,
      after,
    })
  }, [id, activeWorkspaceId])

  // ── Enter edit mode when data.editing flips true ──────────────────────────
  useEffect(() => {
    if (data.editing && !editing) setEditing(true)
  }, [data.editing]) // eslint-disable-line

  // ── Initialize editor content + focus on edit mode entry ─────────────────
  // Focusing the contenteditable is surprisingly unreliable: a single
  // `el.focus()` (even inside requestAnimationFrame) can silently no-op on
  // freshly-mounted React Flow nodes — observed in Edge/Chromium where
  // `document.activeElement` stays on `<body>` despite the call. The HTML
  // `autoFocus` attribute handles some cases on its own; for the rest, this
  // retry loop calls focus() up to 10 times at 50ms intervals until the
  // editor actually receives focus, then sets the caret position.
  useEffect(() => {
    const el = editorRef.current
    if (!editing || !el) return
    el.innerHTML = data.text ?? ''
    // Snapshot the text-content at session start so save()'s blur path
    // can diff and emit a single editTextNode entry per session.
    editFocusValueRef.current = el.innerHTML

    let attempts = 0
    let timer = null
    const setCaret = () => {
      const sel = window.getSelection()
      if (!sel) return
      if (touchPrimary) {
        // Touch (MB-6): NEVER pre-select everything — any keystroke would
        // replace the whole block, and Android Chrome fires the context-menu
        // gesture on taps over selected text (which surfaced the block action
        // menu mid-editing). Place the caret at the double-tap point; fall
        // back to the end of the text.
        const pt = pendingCaretPointRef.current
        pendingCaretPointRef.current = null
        let range = null
        if (pt) {
          if (typeof document.caretRangeFromPoint === 'function') {
            range = document.caretRangeFromPoint(pt.x, pt.y)
          } else if (typeof document.caretPositionFromPoint === 'function') {
            const pos = document.caretPositionFromPoint(pt.x, pt.y)
            if (pos) {
              range = document.createRange()
              range.setStart(pos.offsetNode, pos.offset)
            }
          }
          // The tap point can resolve outside this editor (padding, another
          // element) — only trust it if it landed in our content.
          if (range && !el.contains(range.startContainer)) range = null
        }
        if (range) {
          range.collapse(true)
        } else {
          range = document.createRange()
          range.selectNodeContents(el)
          range.collapse(false) // caret at end
        }
        sel.removeAllRanges()
        sel.addRange(range)
        return
      }
      // Desktop: unchanged — entering edit selects all.
      const range = document.createRange()
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    const tryFocus = () => {
      if (document.activeElement === el) { setCaret(); return }
      el.focus()
      if (document.activeElement === el) { setCaret(); return }
      if (attempts++ < 10) timer = setTimeout(tryFocus, 50)
    }

    const raf = requestAnimationFrame(tryFocus)
    return () => {
      cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
    }
  }, [editing]) // eslint-disable-line

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Translate the in-memory data keys to the DB column names used by
  // dbUpdateTextNode (which takes camelCase arguments).
  const persistPatch = useCallback((patch) => {
    const dbPatch = {}
    if (patch.text     !== undefined) dbPatch.contentHtml = patch.text
    if (patch.width    !== undefined) dbPatch.width       = patch.width
    if (patch.height   !== undefined) dbPatch.height      = patch.height
    if (patch.fontSize !== undefined) dbPatch.fontSize    = patch.fontSize
    if (patch.align    !== undefined) dbPatch.align       = patch.align
    if (Object.keys(dbPatch).length === 0) return
    dbUpdateTextNode(id, dbPatch).catch(console.error)
  }, [id])

  const update = useCallback((patch) => {
    // Capture before-values from current React state for the recordAction.
    // `before` is the prior value of every field this update touches; only
    // fields that actually changed end up in the entry.
    const before = {}
    const after  = {}
    setNodes((nds) => nds.map((n) => {
      if (n.id !== id) return n
      for (const k of Object.keys(patch)) {
        const prevVal = n.data[k]
        if (prevVal !== patch[k]) {
          before[k] = prevVal
          after[k]  = patch[k]
        }
      }
      return { ...n, data: { ...n.data, ...patch } }
    }))
    persistPatch(patch)
    if (Object.keys(after).length > 0) recordEdit(before, after)
  }, [id, setNodes, persistPatch, recordEdit])

  const save = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? ''
    setNodes((nds) => nds.map((n) =>
      n.id === id
        ? { ...n, draggable: true, dragHandle: undefined, data: { ...n.data, text: html, editing: false } }
        : n
    ))
    setEditing(false)
    // Persist the final text content. `editing` is UI-only and not stored in DB.
    persistPatch({ text: html })

    // Session-bound text-content edit: diff the html against the value
    // captured on focus and record one editTextNode if it changed.
    // Toolbar clicks (handled via update()) record their own entries
    // immediately — this branch only covers the typed-into-the-editor
    // session per ADR-0006 §7.
    const before = editFocusValueRef.current
    editFocusValueRef.current = null
    if (before !== null && before !== html) {
      recordEdit({ text: before }, { text: html })
    }
  }, [id, setNodes, persistPatch, recordEdit])

  // Route through App's onDeleteNode (which uses App's setNodes from
  // useNodesState + dbDeleteTextNode). Going through useReactFlow().setNodes
  // here would silently fail to remove the node from App's state — see
  // CanvasOpsContext.jsx for the full explanation.
  const deleteNode = useCallback(() => {
    onDeleteNode(id)
  }, [id, onDeleteNode])

  // ── Font-size field (px input + preset dropdown) ───────────────────────────
  // Parse + clamp a raw input value and apply it. Reflect the clamped value
  // back into the (uncontrolled) input so a rejected/clamped entry is visible.
  const commitFontSize = useCallback((raw) => {
    const el = fontInputRef.current
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n)) { if (el) el.value = String(fontSize); return }
    const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, n))
    if (el) el.value = String(clamped)
    if (clamped !== fontSize) update({ fontSize: clamped })
  }, [fontSize, update])

  const pickFontSize = useCallback((px) => {
    setSizeMenuOpen(false)
    if (fontInputRef.current) fontInputRef.current.value = String(px)
    if (px !== fontSize) update({ fontSize: px })
  }, [fontSize, update])

  // The editor's blur ends the edit session — but blurring INTO the toolbar
  // (e.g. clicking the font-size input) must NOT end it. Guard on relatedTarget.
  const onEditorBlur = useCallback((e) => {
    if (e.relatedTarget && toolbarRef.current?.contains(e.relatedTarget)) return
    save()
  }, [save])

  // Keep the uncontrolled font input in sync with external value changes while
  // it isn't being edited (preset pick, undo, realtime update).
  useEffect(() => {
    const el = fontInputRef.current
    if (el && document.activeElement !== el) el.value = String(fontSize)
  }, [fontSize, editing])

  // Native listeners on the font input — React synthetic events can drop on
  // controls inside a selected RF node (same reason NativeButton exists).
  useEffect(() => {
    const el = fontInputRef.current
    if (!el) return
    const onKeyDown = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commitFontSize(el.value); editorRef.current?.focus() }
      else if (e.key === 'Escape') { e.preventDefault(); el.value = String(fontSize); editorRef.current?.focus() }
    }
    // Select-all on focus (desktop AND mobile): tapping the field highlights
    // the current value so typing replaces it — no manual backspacing. The
    // field's inputMode="numeric" raises the numeric keypad on touch; the
    // Enter commit above refocuses the editor, which returns the regular
    // keyboard.
    const onFocus = () => { el.select() }
    const onBlur = (e) => {
      commitFontSize(el.value)
      setSizeMenuOpen(false)
      // Focus left the field entirely (not into the toolbar, not back to the
      // editor) → the user clicked away, so end the edit session.
      const next = e.relatedTarget
      const stayingInSession =
        next && (toolbarRef.current?.contains(next) || editorRef.current?.contains(next))
      if (!stayingInSession) save()
    }
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('blur', onBlur)
    el.addEventListener('focus', onFocus)
    return () => {
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('blur', onBlur)
      el.removeEventListener('focus', onFocus)
    }
  }, [commitFontSize, fontSize, save, editing])

  const syncSelectionState = () => {
    setIsBold(document.queryCommandState('bold'))
    setIsItalic(document.queryCommandState('italic'))
  }

  // execCommand-based bold/italic: applies to the current selection in the
  // contenteditable. NativeButton's preventDefault on pointerdown keeps focus
  // on the editor, so the selection persists through the click.
  const execBold = useCallback(() => {
    editorRef.current?.focus()
    document.execCommand('bold', false, null)
    syncSelectionState()
  }, [])

  const execItalic = useCallback(() => {
    editorRef.current?.focus()
    document.execCommand('italic', false, null)
    syncSelectionState()
  }, [])

  // ── Resize drag ───────────────────────────────────────────────────────────
  // Pointer events (MB-6): one code path for mouse, touch, and pen. Pointer
  // capture keeps the drag alive when a finger drifts off the handle and
  // keeps the canvas/React Flow from seeing the pointer mid-drag.
  const startResize = useCallback((handle, e) => {
    e.stopPropagation()
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* jsdom / older browsers */ }
    // Freeze this block's geometry against Realtime echoes for the duration
    // of the drag (released in onUp / pointercancel / unmount cleanup).
    lockTextBlockGeometry(id)
    dragRef.current = {
      handle,
      pointerId:   e.pointerId,
      startX:      e.clientX,
      startY:      e.clientY,
      startWidth:  width,
      startHeight: boxRef.current ? boxRef.current.offsetHeight : (height ?? MIN_HEIGHT),
      // The STORED height (null = auto), distinct from the measured
      // startHeight above — the undo diff must compare stored values, or
      // undoing a resize on an auto-height block would commit a fixed height.
      startHeightData: height,
      startNodeX:  xPos,
      startNodeY:  yPos,
      zoom:        getViewport().zoom,
    }
  }, [width, height, xPos, yPos, getViewport])

  useEffect(() => {
    // Track the latest computed values during drag so we can persist them
    // once the user releases the mouse (instead of writing on every pixel).
    const latest = { dirty: false, x: 0, y: 0, width: 0, height: null }

    const onMove = (e) => {
      const drag = dragRef.current
      if (!drag) return
      // A second finger on the screen fires its own pointermove stream —
      // only the pointer that grabbed the handle drives the resize.
      if (e.pointerId !== undefined && drag.pointerId !== undefined && e.pointerId !== drag.pointerId) return
      const { handle, zoom, startX, startY, startWidth, startHeight, startNodeX, startNodeY } = drag

      const rawDx = (e.clientX - startX) / zoom
      const rawDy = (e.clientY - startY) / zoom

      let newWidth  = startWidth
      let newHeight = startHeight
      let newX      = startNodeX
      let newY      = startNodeY

      // Horizontal: drag right on the right edge increases width; drag left on left edge increases width
      if (handle.ax === 'right') {
        newWidth = Math.max(MIN_WIDTH, startWidth + rawDx)
      } else if (handle.ax === 'left') {
        const clamped = Math.max(MIN_WIDTH, startWidth - rawDx)
        newX     = startNodeX + (startWidth - clamped)
        newWidth = clamped
      }

      // Vertical: drag down on the bottom edge increases height; drag up on top edge increases height
      if (handle.ay === 'bottom') {
        newHeight = Math.max(MIN_HEIGHT, startHeight + rawDy)
      } else if (handle.ay === 'top') {
        const clamped = Math.max(MIN_HEIGHT, startHeight - rawDy)
        newY      = startNodeY + (startHeight - clamped)
        newHeight = clamped
      }

      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n
        // Width-only model (MB-6): a width resize RELEASES any fixed height
        // back to automatic — the box re-fits its text. Erik's rule
        // (2026-07-06): no bulk migration, no change on load; only an ACTIVE
        // width-resize converts a legacy fixed-height block. (handle.ay is
        // never set for SIDE_HANDLES; the branch is kept for the drag-math
        // generality.)
        const committedHeight = handle.ay ? newHeight : null
        latest.dirty  = true
        latest.x      = newX
        latest.y      = newY
        latest.width  = newWidth
        latest.height = committedHeight
        return {
          ...n,
          position: { x: newX, y: newY },
          data: {
            ...n.data,
            width:  newWidth,
            height: committedHeight,
          },
        }
      }))
    }

    const onUp = (e) => {
      const drag = dragRef.current
      if (!drag) return
      if (e && e.pointerId !== undefined && drag.pointerId !== undefined && e.pointerId !== drag.pointerId) return
      dragRef.current = null
      unlockTextBlockGeometry(id)
      if (latest.dirty) {
        dbUpdateTextNode(id, {
          positionX: latest.x,
          positionY: latest.y,
          width:     latest.width,
          height:    latest.height,
        }).catch(console.error)
        // Record the resize as a single editTextNode entry. `before` /
        // `after` carry only the dimensions and any position shift (a
        // resize from a top or left handle moves the node's origin too).
        // The drag's start values were captured in startResize and live
        // on dragRef until this mouseup.
        if (drag) {
          const before = {}
          const after  = {}
          if (drag.startWidth !== latest.width) {
            before.width = drag.startWidth
            after.width  = latest.width
          }
          // Compare STORED heights (null = auto), not the measured pixel
          // height — a block that was already auto must not gain a height
          // entry (undoing it would pin the box to a fixed height).
          if ((drag.startHeightData ?? null) !== (latest.height ?? null)) {
            before.height = drag.startHeightData ?? null
            after.height  = latest.height ?? null
          }
          if (drag.startNodeX !== latest.x) {
            before.positionX = drag.startNodeX
            after.positionX  = latest.x
          }
          if (drag.startNodeY !== latest.y) {
            before.positionY = drag.startNodeY
            after.positionY  = latest.y
          }
          if (Object.keys(after).length > 0) {
            recordEdit(before, after)
          }
        }
        latest.dirty = false
      }
    }
    // pointercancel = the browser aborted the drag (e.g. an OS gesture took
    // over). Treat it as a release so the latest size still persists and the
    // drag state can't leak.
    document.addEventListener('pointermove',   onMove)
    document.addEventListener('pointerup',     onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove',   onMove)
      document.removeEventListener('pointerup',     onUp)
      document.removeEventListener('pointercancel', onUp)
      // Unmount mid-drag: never leave a stale lock behind.
      if (dragRef.current) dragRef.current = null
      unlockTextBlockGeometry(id)
    }
  }, [id, setNodes, recordEdit])

  // ── Styles ────────────────────────────────────────────────────────────────
  const textStyle = {
    fontSize,
    textAlign:  align,
    fontFamily: 'Inter, sans-serif',
    color:      '#f3f4f6',
    lineHeight: 1.35,
    wordBreak:  'break-word',
  }

  // Edge-aware placement: measure the node box + toolbar in screen space, run
  // the shared placement helper (centered above → flip below / clamp in-window),
  // then map the target screen position back into a node-local translate. Runs
  // after every render (the node re-renders on viewport / move / resize); the
  // setState guard keeps it from looping. Cheap — only one node edits at a time.
  useLayoutEffect(() => {
    if (!editing) { if (tbPlace) setTbPlace(null); return }
    const box = boxRef.current, tb = toolbarRef.current
    if (!box || !tb) return
    const boxRect = box.getBoundingClientRect()
    const tbRect  = tb.getBoundingClientRect()
    const target  = placeFloatingToolbar(boxRect, { w: tbRect.width, h: tbRect.height })
    // node-local canvas px = screen delta ÷ zoom (= × invZoom).
    const Tx = (target.left - boxRect.left) * invZoom
    const Ty = (target.top  - boxRect.top)  * invZoom
    setTbPlace((prev) =>
      prev && Math.abs(prev.Tx - Tx) < 0.5 && Math.abs(prev.Ty - Ty) < 0.5 ? prev : { Tx, Ty },
    )
  })

  // Font-size menu placement (Erik's phone QA, 2026-07-16: the in-toolbar
  // dropdown opened DOWNWARD behind the bottom toolbar and off-viewport).
  // The menu now renders in a document.body portal at the context-menu tier
  // (fixed, z-[9999]) so it sits above ALL chrome — an in-canvas z-index can
  // never beat fixed chrome across stacking contexts — and placeDropdown
  // (shared helper next to placeFloatingToolbar) flips it above the anchor
  // when the bottom would clip and clamps it in-window. Runs after every
  // render like the toolbar placement above, so it tracks pan/zoom while
  // open; the setState guard keeps it from looping.
  useLayoutEffect(() => {
    if (!sizeMenuOpen) { if (sizeMenuPlace) setSizeMenuPlace(null); return }
    const anchor = sizeAnchorRef.current, menu = sizeMenuRef.current
    if (!anchor || !menu) return
    const target = placeDropdown(anchor.getBoundingClientRect(), {
      w: menu.offsetWidth,
      h: menu.offsetHeight,
    })
    setSizeMenuPlace((prev) =>
      prev && Math.abs(prev.left - target.left) < 0.5 && Math.abs(prev.top - target.top) < 0.5
        ? prev
        : target,
    )
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width }}>

      {/* Floating toolbar — lives inside the zoomable node, so it counter-scales
          (1/zoom) to hold a constant on-screen size. The wrapper sits at the
          node's top-left; the toolbar is translated to the edge-aware target
          (tbPlace) and scales about its top-left. Hidden until first measured. */}
      {editing && (
        <div className="absolute" style={{ left: 0, top: 0, zIndex: 20 }}>
        <CanvasToolbar
          ref={toolbarRef}
          style={{
            transform: tbPlace
              ? `translate(${tbPlace.Tx}px, ${tbPlace.Ty}px) scale(${invZoom})`
              : `scale(${invZoom})`,
            transformOrigin: 'top left',
            visibility: tbPlace ? 'visible' : 'hidden',
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            // preventDefault keeps the editor focused on button clicks, but the
            // font-size input needs to take focus — let it.
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
          }}
        >
          {/* Grip handle — drag this to move the text block */}
          <div
            className="text-node-drag-handle flex items-center self-stretch pr-2 mr-1 border-r border-gray-200 text-gray-300 hover:text-gray-400 transition-colors"
            style={{ cursor: 'grab' }}
            title="Drag to move"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DotsSixVertical size={14} weight="bold" />
          </div>

          {/* Font size — editable px field + preset dropdown. The field is the
              one focusable control in the toolbar; its blur logic and the
              editor's relatedTarget guard keep the edit session alive while the
              user interacts with it (see onEditorBlur + the input listeners). */}
          <div ref={sizeAnchorRef} className="relative flex items-center">
            <input
              ref={fontInputRef}
              type="text"
              inputMode="numeric"
              defaultValue={String(fontSize)}
              title="Font size (px)"
              className="w-9 text-center text-xs font-semibold text-gray-700 bg-gray-100 rounded-l px-1 py-0.5 outline-none focus:ring-1 focus:ring-gray-400"
            />
            <NativeButton
              className="px-1 py-0.5 rounded-r text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors border-l border-gray-200"
              title="Font size presets"
              onAction={() => setSizeMenuOpen((o) => !o)}
            ><CaretDown size={12} weight="bold" /></NativeButton>

            {/* Portaled to body (fixed, context-menu z tier) so it renders
                above ALL chrome incl. the bottom toolbar, flipped/clamped
                in-viewport by the placement effect. Hidden until measured.
                The pointer/mouse-down guards mirror the toolbar wrapper's:
                keep the editor focused so the edit session survives the
                click (NativeButton's own preventDefault covers the buttons;
                this covers the menu's padding/scrollbar). */}
            {sizeMenuOpen && createPortal(
              <div
                ref={sizeMenuRef}
                className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto"
                style={{
                  minWidth: '3rem',
                  left: sizeMenuPlace?.left ?? 0,
                  top: sizeMenuPlace?.top ?? 0,
                  visibility: sizeMenuPlace ? 'visible' : 'hidden',
                }}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
              >
                {FONT_SIZE_PRESETS.map((px) => (
                  <NativeButton
                    key={px}
                    className={`block w-full text-left px-3 py-1 text-xs font-semibold transition-colors ${fontSize === px ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    onAction={() => pickFontSize(px)}
                  >{px}</NativeButton>
                ))}
              </div>,
              document.body,
            )}
          </div>

          <ToolbarDivider />

          <NativeButton
            className={`p-1 rounded transition-colors ${align === 'left'   ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onAction={() => update({ align: 'left' })}
          ><TextAlignLeft size={14} weight="bold" /></NativeButton>
          <NativeButton
            className={`p-1 rounded transition-colors ${align === 'center' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onAction={() => update({ align: 'center' })}
          ><TextAlignCenter size={14} weight="bold" /></NativeButton>
          <NativeButton
            className={`p-1 rounded transition-colors ${align === 'right'  ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onAction={() => update({ align: 'right' })}
          ><TextAlignRight size={14} weight="bold" /></NativeButton>

          <ToolbarDivider />

          <NativeButton
            className={`p-1 rounded transition-colors ${isBold   ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onAction={execBold}
          ><TextB size={14} weight="bold" /></NativeButton>
          <NativeButton
            className={`p-1 rounded transition-colors ${isItalic ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onAction={execItalic}
          ><TextItalic size={14} weight="bold" /></NativeButton>

          <ToolbarDivider />

          <NativeButton
            className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            onAction={deleteNode}
          ><Trash size={14} weight="bold" /></NativeButton>
        </CanvasToolbar>
        </div>
      )}

      {/* Content box with dashed border + resize handles when editing */}
      <div
        ref={boxRef}
        style={{
          position:     'relative',
          border:       editing ? '1.5px dashed #94a3b8' : '1.5px solid transparent',
          borderRadius: 4,
          padding:      8,
          minHeight:    MIN_HEIGHT,
          ...(height ? { height } : {}),
        }}
      >
        {/* Width-only side handles — SAME interface on desktop and touch
            (MB-6): text blocks resize like text fields. Screen-constant
            (× invZoom); the visible pill is the affordance, the invisible
            band around it is the grab target, sized per input type. `nodrag`
            = React Flow's opt-out class, so the canvas can never read a
            handle drag as a node drag. */}
        {editing && SIDE_HANDLES.map((h) => {
          const bandWidth  = BAND_WIDTH[touchPrimary ? 'touch' : 'mouse']
          const bandOutset = BAND_OUTSET[touchPrimary ? 'touch' : 'mouse']
          return (
            <div
              key={h.id}
              className="nodrag"
              style={{
                position:       'absolute',
                top:            '50%',
                transform:      'translateY(-50%)',
                height:         '100%',
                minHeight:      bandWidth * invZoom,
                width:          bandWidth * invZoom,
                [h.ax === 'left' ? 'left' : 'right']: -bandOutset * invZoom,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                cursor:         h.cursor,
                zIndex:         10,
                touchAction:    'none',
              }}
              onPointerDown={(e) => startResize(h, e)}
            >
              <div
                style={{
                  width:           PILL_WIDTH * invZoom,
                  height:          PILL_HEIGHT * invZoom,
                  borderRadius:    (PILL_WIDTH / 2) * invZoom,
                  backgroundColor: 'white',
                  border:          `${2 * invZoom}px solid #64748b`,
                }}
              />
            </div>
          )
        })}

        {/* Editor: contenteditable for per-selection bold/italic */}
        {editing ? (
          <div
            key="editor"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            tabIndex={0}
            autoFocus
            data-placeholder="Type something…"
            style={{ ...textStyle, outline: 'none', minHeight: MIN_HEIGHT - 16 }}
            onInput={syncSelectionState}
            onKeyUp={syncSelectionState}
            onMouseUp={syncSelectionState}
            onSelect={syncSelectionState}
            onMouseDown={(e) => e.stopPropagation()}
            onPaste={(e) => {
              // Paste as PLAIN TEXT only (MB-6, Erik 2026-07-06): external
              // formatting must never enter a text block — styled HTML from a
              // source page pastes with its own font-size/color/background,
              // which then overrides the block's styling (observed: dark-on-
              // white Lorem Ipsum; font-size control moving line-height only).
              // insertText replaces the selection and routes through the
              // browser's undo + input events like normal typing.
              e.preventDefault()
              const text = e.clipboardData?.getData('text/plain') ?? ''
              if (text) document.execCommand('insertText', false, text)
            }}
            onBlur={onEditorBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); save() }
            }}
          />
        ) : (
          <div
            key="display"
            style={textStyle}
            onDoubleClick={(e) => {
              // Remember where the user tapped/clicked so the touch caret
              // path can place the cursor there (see setCaret).
              pendingCaretPointRef.current = { x: e.clientX, y: e.clientY }
              setNodes((nds) => nds.map((n) =>
                n.id === id ? { ...n, draggable: true, dragHandle: '.text-node-drag-handle', data: { ...n.data, editing: true } } : n
              ))
              setEditing(true)
            }}
          >
            {data.text
              ? <span dangerouslySetInnerHTML={{ __html: data.text }} />
              : <span style={{ color: '#d1d5db', fontStyle: 'italic', fontWeight: 400, fontSize: 14 }}>Double-click to edit</span>
            }
          </div>
        )}
      </div>
    </div>
  )
}
