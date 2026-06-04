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

import { useRef, useEffect, useCallback } from 'react'
import { useCreateBlockNote, SuggestionMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { schema } from './blockSchema.jsx'
import { useEditorContext } from './EditorContext.jsx'
import { insertNodeLink, searchNodes } from './editorLinks.js'

const SAVE_DEBOUNCE_MS = 600

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
    <BlockNoteView editor={editor} onChange={handleChange}>
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
    </BlockNoteView>
  )
}
