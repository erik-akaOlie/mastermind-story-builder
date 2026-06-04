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

import { useRef, useEffect } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { schema } from './blockSchema.jsx'

const SAVE_DEBOUNCE_MS = 600

export default function ZoneEditor({ initialContent, onSave }) {
  const editor = useCreateBlockNote({
    schema,
    // An empty array is not valid initial content; let BlockNote seed a default
    // empty paragraph instead.
    initialContent: initialContent && initialContent.length ? initialContent : undefined,
  })

  const timerRef = useRef(null)
  const dirtyRef = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  function handleChange() {
    dirtyRef.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      dirtyRef.current = false
      onSaveRef.current(editor.document)
    }, SAVE_DEBOUNCE_MS)
  }

  // Flush any pending save when the editor unmounts (Inspector close / repoint).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (dirtyRef.current) onSaveRef.current(editor.document)
    }
  }, [editor])

  return <BlockNoteView editor={editor} onChange={handleChange} />
}
