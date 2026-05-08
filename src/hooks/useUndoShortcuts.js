// ============================================================================
// useUndoShortcuts
// ----------------------------------------------------------------------------
// Registers a single window-level keydown listener that wires Cmd/Ctrl+Z to
// useUndoStore.undo() and Cmd/Ctrl+Shift+Z (or Ctrl+Y) to redo().
//
// Word-style exemption (per ADR-0006 §"Word-style typing exemption"):
// when the user is focused inside an input / textarea / contenteditable, we
// leave Ctrl+Z to the browser for native per-keystroke undo. Field-level
// edits get rolled into a single editCardField / editTextNode action when the
// session ends (modal close / blur), so Ctrl+Z from outside the field still
// reverts the whole field-level change in one step.
//
// nodes / edges / setNodes / setEdges flow into the store's undo() / redo()
// via a ref so the listener (registered once) always reads fresh values
// without re-attaching every render.
// ============================================================================

import { useEffect, useRef } from 'react'
import { useUndoStore } from '../store/useUndoStore.js'

export function useUndoShortcuts({ nodes, edges, setNodes, setEdges }) {
  const stateRef = useRef({ nodes, edges, setNodes, setEdges })
  stateRef.current = { nodes, edges, setNodes, setEdges }

  useEffect(() => {
    function onKeyDown(e) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      if (!isCmdOrCtrl) return

      const el = document.activeElement
      const tag = el?.tagName?.toLowerCase()
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        el?.isContentEditable === true
      if (isEditable) return

      const key = e.key?.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useUndoStore.getState().undo(stateRef.current)
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useUndoStore.getState().redo(stateRef.current)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
