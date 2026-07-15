// ============================================================================
// useSpacebarToolSwitch
// ----------------------------------------------------------------------------
// Replaces useSpacebarPan (pre-toolbar). While the spacebar is held, the
// canvas temporarily switches movement modes — Hand for every tool except
// Hand, Pointer when Hand is active (approved toolbar spec, 2026-07-10).
//
// This hook only tracks the physical key: it writes `spacebarHeld` into
// useToolStore. The tool flip itself is the pure effectiveTool() derivation,
// so releasing the key restores the prior tool by construction — there is
// no saved-and-restored state that could go stale.
//
// Preserved from useSpacebarPan: a spacebar press while typing in an
// input/textarea/contenteditable is left to the text field.
// New: a window blur while the key is held clears the flag — otherwise
// Alt-Tab with spacebar down would leave the canvas stuck in the switched
// mode until the next keyup.
// ============================================================================

import { useEffect } from 'react'
import { useToolStore } from '../store/useToolStore'

export function useSpacebarToolSwitch() {
  useEffect(() => {
    const setHeld = (held) => useToolStore.getState().setSpacebarHeld(held)

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
      setHeld(true)
    }
    const onUp = (e) => {
      if (e.code === 'Space') setHeld(false)
    }
    const onBlur = () => setHeld(false)

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      setHeld(false)
    }
  }, [])
}
