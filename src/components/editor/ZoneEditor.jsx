// ============================================================================
// ZoneEditor — one BlockNote editor for one card zone (card_view OR gm_only)
// ----------------------------------------------------------------------------
// Mounts a BlockNote editor seeded with the zone's migrated block JSON and
// saves the document back on a debounce, plus a flush when the editor unmounts
// (so closing the Inspector never drops a pending edit). Mirrors the 600ms
// debounce + flush-on-close pattern the legacy useAutoSave uses.
//
// initialContent is read ONCE at editor creation (BlockNote owns the document
// after that), so this component must not mount until its content has loaded —
// CardZones guarantees that.
// ============================================================================

import { useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import {
  useCreateBlockNote,
  SuggestionMenuController,
  SideMenuController,
  SideMenu,
  AddBlockButton,
  DragHandleButton,
  useExtensionState,
} from '@blocknote/react'
import { SideMenuExtension } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { schema } from './blockSchema.jsx'
import { useEditorContext } from './EditorContext.jsx'
import { insertNodeLink, searchNodes } from './editorLinks.js'

const SAVE_DEBOUNCE_MS = 600

// ── Custom side menu (F4) ────────────────────────────────────────────────────
// Keeps BlockNote's DEFAULT +/drag-handle buttons (native gray, native hover, no
// chrome, familiar order) and makes only two changes, both positioning-only:
//   1. A 4px gap from the text column (the spacer div), kept inside the menu so
//      it stays part of the hover surface (no control flicker).
//   2. Vertical centering on the hovered block's FIRST LINE.
//
// Why #2 needs JS: BlockNote centers the controls inside a box anchored to the
// block top and over-sizes that box on several heading levels (H1/H2/H4/H5/H6),
// so the controls sit visibly low. A pure-CSS per-level fix is impossible — the
// side menu is a single element BlockNote repositions, carrying no block-level
// attribute to target. So we read the hovered block from BlockNote's OWN side-menu
// state (useExtensionState + SideMenuExtension — not DOM guessing), collapse the
// box (height:auto, inspectorEditor.css rule 6), and shift the controls by an
// offset MEASURED from that block's actual first-line geometry. Measuring live
// (rather than a hardcoded H1–H6 map) means it survives future type-scale changes.
// No typography is changed. Scoped to the Inspector editor.
function CenteredSideMenu(props) {
  // The hovered block, straight from BlockNote's side-menu extension state.
  const block = useExtensionState(SideMenuExtension, { selector: (s) => s?.block })
  const innerRef = useRef(null)
  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.style.transform = ''
    if (!block?.id) return
    try {
      const outer = document.querySelector(`.bn-block-outer[data-id="${CSS.escape(block.id)}"]`)
      const inner = outer?.querySelector('.bn-inline-content')
      if (!inner) return // e.g. image-album block has no text line — leave default
      const lh = parseFloat(getComputedStyle(inner).lineHeight)
      if (!lh) return
      // First-line center measured from the block's OWN top — NOT the menu's live
      // screen position, so there's no timing race with BlockNote's repositioning.
      const firstLineOffset =
        inner.getBoundingClientRect().top - outer.getBoundingClientRect().top + lh / 2
      // Box is collapsed (height:auto), so the controls sit at block-top + half
      // their own height; shift them down onto the first-line center.
      const elHalf = el.getBoundingClientRect().height / 2
      el.style.transform = `translateY(${firstLineOffset - elHalf}px)`
    } catch {
      /* any measurement failure: leave controls at BlockNote's default position */
    }
  }, [block])
  return (
    <SideMenu {...props}>
      <div ref={innerRef} style={{ display: 'flex', alignItems: 'center' }}>
        <AddBlockButton {...props} />
        <DragHandleButton {...props} />
        {/* 4px gap between the drag handle and the text column, kept inside the
            menu element so it stays part of the hover surface. */}
        <div aria-hidden style={{ width: 4, flexShrink: 0 }} />
      </div>
    </SideMenu>
  )
}

export default function ZoneEditor({ initialContent, onSave }) {
  const editor = useCreateBlockNote({
    schema,
    // An empty array is not valid initial content; let BlockNote seed a default
    // empty paragraph instead.
    initialContent: initialContent && initialContent.length ? initialContent : undefined,
  })

  const {
    allOtherNodes, onAddConnection,
    registerEditor, unregisterEditor,
    registerFlush, unregisterFlush,
  } = useEditorContext()

  const timerRef = useRef(null)
  const dirtyRef = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  // Last document captured WHILE THE EDITOR IS ALIVE. The flush-on-close must
  // save this, never re-read editor.document during teardown — a torn-down
  // BlockNote editor returns an empty document, which would overwrite the zone
  // with nothing if you close quickly after an edit (the content-wipe bug).
  const latestDocRef = useRef(null)

  function handleChange() {
    latestDocRef.current = editor.document
    dirtyRef.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      dirtyRef.current = false
      if (latestDocRef.current) onSaveRef.current(latestDocRef.current)
    }, SAVE_DEBOUNCE_MS)
  }

  // Force any pending (debounced) save to land NOW, returning a promise that
  // resolves once the save call has been issued. The Inspector aggregates these
  // so a card delete can await "all zones flushed" before snapshotting the card
  // from the DB (ADR-0016 Chunk E1). Uses the last alive snapshot, never
  // editor.document — a torn-down editor returns an empty document.
  const flush = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (dirtyRef.current && latestDocRef.current) {
      dirtyRef.current = false
      return Promise.resolve(onSaveRef.current(latestDocRef.current))
    }
    return Promise.resolve()
  }, [])

  // Register the flush so the Inspector (and through it, a card delete) can
  // await pending saves. Registered separately from registerEditor so the
  // two concerns stay independent.
  useEffect(() => {
    registerFlush(flush)
    return () => unregisterFlush(flush)
  }, [flush, registerFlush, unregisterFlush])

  // Flush any pending save when the editor unmounts (Inspector close / repoint),
  // using the last alive snapshot — NOT editor.document (see above). A prior
  // explicit flush() clears dirtyRef, so this unmount path is then a no-op.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (dirtyRef.current && latestDocRef.current) onSaveRef.current(latestDocRef.current)
    }
  }, [])

  // Register with the Inspector so deleting a connection can revert this
  // editor's [[links]] to plain text (ADR-0016 §7).
  useEffect(() => {
    registerEditor(editor)
    return () => unregisterEditor(editor)
  }, [editor, registerEditor, unregisterEditor])

  return (
    // `sideMenu={false}` disables BlockNote's built-in side menu so our custom
    // CenteredSideMenu (above) is the only one (F4): default buttons, 4px gap,
    // and first-line vertical centering via a live-measured per-block offset.
    <BlockNoteView editor={editor} onChange={handleChange} theme="light" sideMenu={false}>
      {/* [[Node]] autocomplete. Triggers on "[" (the measured workaround);
          choosing a node inserts the inline link and declares the connection. */}
      <SuggestionMenuController
        triggerCharacter="["
        getItems={async (query) =>
          searchNodes(allOtherNodes, query).map((n) => ({
            title: n.data?.label || 'Untitled',
            onItemClick: () => insertNodeLink(editor, n, onAddConnection),
          }))
        }
      />

      {/* Custom side menu (F4) — see CenteredSideMenu above for the full rationale
          (first-line vertical centering + 4px gap, no typography changes). */}
      <SideMenuController sideMenu={(props) => <CenteredSideMenu {...props} />} />
    </BlockNoteView>
  )
}
