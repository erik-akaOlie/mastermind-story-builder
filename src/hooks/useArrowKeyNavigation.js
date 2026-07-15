// ============================================================================
// useArrowKeyNavigation
// ----------------------------------------------------------------------------
// FigJam-style arrow-key canvas navigation:
//   - Nothing selected  -> arrow keys pan the camera (48 / 200 px with Shift).
//   - Something selected -> arrow keys nudge the selected node(s)
//     (2 / 16 px with Shift). Persistence + undo are owned by the caller
//     via the onNudgeSelected callback so this hook stays pure keyboard
//     plumbing.
//
// Exempts the usual editable surfaces so typing in inputs / textareas /
// contenteditables still moves the text cursor.
//
// Key repeats (held arrow keys) are ignored in this version. Continuous
// hold-to-pan is deferred — first press only, matching the spacebar hook's
// convention (useSpacebarToolSwitch).
// ============================================================================

import { useEffect, useRef } from 'react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'

const ARROW_DELTAS = {
  ArrowUp:    { dx:  0, dy: -1 },
  ArrowDown:  { dx:  0, dy:  1 },
  ArrowLeft:  { dx: -1, dy:  0 },
  ArrowRight: { dx:  1, dy:  0 },
}

const PAN_STEP        = 48
const PAN_STEP_SHIFT  = 200
const NUDGE_STEP      = 2
const NUDGE_STEP_SHIFT = 16

export function useArrowKeyNavigation({ rfInstanceRef, onNudgeSelected }) {
  // Hold onNudgeSelected in a ref so the keydown listener reads the latest
  // callback without forcing the effect to re-register on every render.
  const onNudgeRef = useRef(onNudgeSelected)
  useEffect(() => { onNudgeRef.current = onNudgeSelected }, [onNudgeSelected])

  useEffect(() => {
    const onKeyDown = (e) => {
      const delta = ARROW_DELTAS[e.key]
      if (!delta) return
      if (e.repeat) return

      const el = document.activeElement
      const tag = el?.tagName
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        el?.isContentEditable
      if (editable) return

      e.preventDefault()

      const selectedIds = useCanvasUiStore.getState().selectedNodeIds
      const shift = e.shiftKey

      if (selectedIds.size === 0) {
        const rf = rfInstanceRef.current
        if (!rf) return
        const step = shift ? PAN_STEP_SHIFT : PAN_STEP
        const vp = rf.getViewport()
        // ReactFlow's viewport.x/y are screen-space offsets that move
        // inversely to the perceived camera direction — pressing ArrowRight
        // (the user expects the camera to look further right) means content
        // appears to shift left, which is viewport.x -= step.
        rf.setViewport({
          x: vp.x - delta.dx * step,
          y: vp.y - delta.dy * step,
          zoom: vp.zoom,
        })
      } else {
        const step = shift ? NUDGE_STEP_SHIFT : NUDGE_STEP
        onNudgeRef.current?.(delta.dx * step, delta.dy * step)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rfInstanceRef])
}
