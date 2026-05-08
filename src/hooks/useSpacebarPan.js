// ============================================================================
// useSpacebarPan
// ----------------------------------------------------------------------------
// While the spacebar is held down, the canvas should pan instead of marquee-
// select. Returns the boolean state; callers wire it into ReactFlow's
// `panOnDrag` and `selectionOnDrag` props (see App.jsx).
//
// Held in this hook so App.jsx isn't carrying keyboard plumbing.
// ============================================================================

import { useEffect, useState } from 'react'

export function useSpacebarPan() {
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    const onDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return
      // Don't hijack the spacebar while the user is typing in a field.
      const tag = document.activeElement?.tagName
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        document.activeElement?.isContentEditable
      if (editable) return
      e.preventDefault()
      setIsPanning(true)
    }
    const onUp = (e) => {
      if (e.code === 'Space') setIsPanning(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return isPanning
}
