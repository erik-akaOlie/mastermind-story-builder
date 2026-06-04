// ============================================================================
// EditorContext — app state the custom BlockNote blocks need (Phase 2, Chunk B)
// ----------------------------------------------------------------------------
// BlockNote custom blocks render as ordinary React components, so they can read
// app context. This provider (set up by the Inspector around the zone editors)
// hands the data-driven blocks what they can't get from existing hooks:
//   - cardId / workspaceId / slug  → the Image Album's upload pipeline
//   - connections                  → the live connection list for this card
//   - onDeleteConnection           → removes a connection (reuses the
//                                     Inspector's existing localConns flow, so
//                                     auto-save + undo come for free)
//
// Per ADR-0016 §8, blocks must read live external state every render rather than
// caching it — so the Connections block reads `connections` from here on each
// render instead of holding its own copy. React re-renders context consumers
// when the provider value changes, which is what keeps the block from ghosting
// a connection the user just deleted.
// ============================================================================

import { createContext, useContext } from 'react'

const EditorContext = createContext(null)

export function useEditorContext() {
  const ctx = useContext(EditorContext)
  if (!ctx) {
    throw new Error('useEditorContext must be used inside <EditorContext.Provider> (the Inspector wraps the zone editors in it)')
  }
  return ctx
}

export function EditorProvider({ value, children }) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
