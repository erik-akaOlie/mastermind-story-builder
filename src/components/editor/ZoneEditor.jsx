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
  DragHandleButton,
  useComponentsContext,
  useExtensionState,
} from '@blocknote/react'
import { SideMenuExtension } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { Plus } from '@phosphor-icons/react'
import { schema } from './blockSchema.jsx'
import { useEditorContext } from './EditorContext.jsx'
import { insertNodeLink, searchNodes } from './editorLinks.js'
import { BlockControlMenu, ControlTooltip } from './blockControls.jsx'
import { getSlashMenuItems } from './blockTypeAdapters.jsx'

const SAVE_DEBOUNCE_MS = 600

// Side-menu control tooltip content (F5a), rendered via ControlTooltip.
// The "+" simply adds a paragraph below (no Alt-click, no menu — Erik's call), so
// its tooltip is one line. The 6-dot describes drag + click-to-open-menu.
const ADD_TOOLTIP = (
  <span>
    <b>Click</b> to add a block below
  </span>
)
const DRAG_TOOLTIP = (
  <span>
    <b>Drag</b> to move
    <br />
    <b>Click</b> to open menu
  </span>
)

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
function CenteredSideMenu({ editor, ...props }) {
  // The hovered block, straight from BlockNote's side-menu extension state.
  const block = useExtensionState(SideMenuExtension, { selector: (s) => s?.block })
  const Components = useComponentsContext()
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
        {/* "+" — a CUSTOM button (not BlockNote's AddBlockButton). BlockNote's
            default opens the full block-type library on click; we instead just
            insert a paragraph below and focus it (Erik's call: new rows default to
            text; change type via the 6-dot "Turn into"). Owning the single click
            handler also avoids the dual-handler conflict that corrupted the side
            menu when we tried to intercept the default button's native listener. */}
        <ControlTooltip label={ADD_TOOLTIP}>
          {/* Use BlockNote's OWN side-menu button (the same component the 6-dot
              uses) so the "+" matches it exactly — gray color + hover rollover.
              We only swap the behavior: instead of opening the block library, it
              inserts a paragraph below and focuses it (Erik's call). */}
          {Components ? (
            <Components.SideMenu.Button
              className="bn-button"
              label="Add block below"
              icon={<Plus size={18} weight="bold" />}
              onClick={() => {
                if (!block) return
                try {
                  const [created] = editor.insertBlocks([{ type: 'paragraph' }], block, 'after')
                  if (created) editor.setTextCursorPosition(created, 'end')
                  editor.focus?.()
                } catch {
                  /* never let an add failure crash the editor */
                }
              }}
            />
          ) : null}
        </ControlTooltip>
        {/* Custom 6-dot menu (F5a): Turn into ▶ / Duplicate / Delete, no Color. */}
        <ControlTooltip label={DRAG_TOOLTIP}>
          <DragHandleButton {...props} dragHandleMenu={() => <BlockControlMenu editor={editor} />} />
        </ControlTooltip>
        {/* 8px gap between the drag handle and the text column (F5a: widened from
            4px). It's the rightmost flex item and BlockNote anchors the menu's
            right edge to the content column, so widening it slides the controls
            LEFT while the content stays put. Kept inside the menu element so the
            gap stays part of the hover surface. 8px = one 8pt step. */}
        <div aria-hidden style={{ width: 8, flexShrink: 0 }} />
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
    // `slashMenu={false}` disables BlockNote's DEFAULT "/" menu so our tailored
    // one below is the only one (F5b) — the approved 7 types with "Callout".
    <BlockNoteView
      editor={editor}
      onChange={handleChange}
      theme="light"
      sideMenu={false}
      slashMenu={false}
    >
      {/* Tailored "/" slash menu (F5b): the approved 7 block types with "Callout",
          derived from blockTypes.js via the shared adapter — no second list. The
          default slash menu is off (slashMenu={false} above) so this is the only one. */}
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => getSlashMenuItems(editor, query)}
      />

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

      {/* Custom side menu (F4 + F5a) — first-line vertical centering + 4px gap
          (F4), plus the reorganized 6-dot menu via dragHandleMenu (F5a). `editor`
          is threaded through so the menu can convert/duplicate/delete the block. */}
      <SideMenuController sideMenu={(props) => <CenteredSideMenu {...props} editor={editor} />} />
    </BlockNoteView>
  )
}
