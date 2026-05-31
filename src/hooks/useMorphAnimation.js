// ============================================================================
// useMorphAnimation
// ----------------------------------------------------------------------------
// Animates a modal in from a clicked-on card's bounding box (or from a small
// scaled-down version if no origin is provided) and back out on close.
//
// Three phases:
//   1. useLayoutEffect — runs synchronously before first paint to set the
//      initial transform (modal positioned at origin, opacity 0). This is
//      why it's a layout effect, not a regular effect: a regular effect
//      would let the modal flash at full size for one frame before snapping
//      to the origin.
//   2. useEffect — schedules the animate-in transition on the next animation
//      frame, transitioning from the origin transform to identity.
//   3. The returned `animateClose` function — runs the reverse animation
//      and then calls `onClose` after TRANSITION_MS so the React tree
//      unmounts only after the animation finishes.
// ============================================================================

import { useLayoutEffect, useEffect, useCallback, useRef } from 'react'

export const TRANSITION_MS = 260
// A repoint keeps the inspector in place and just swaps its content, so the
// entry is a quick opacity fade rather than the grow-from-card morph.
export const REPOINT_FADE_MS = 130

export function useMorphAnimation({ modalRef, backdropRef, originRect, skipOpenMorph, getCloseRect, onClose }) {
  // Read the node's CURRENT screen rect at close time (kept in a ref so the
  // exit callback's identity doesn't churn each render). Lets the close morph
  // aim at where the node actually is now, not where it was when opened.
  const getCloseRectRef = useRef(getCloseRect)
  getCloseRectRef.current = getCloseRect
  // Phase 1: pre-paint setup
  useLayoutEffect(() => {
    const el = modalRef.current
    const bd = backdropRef.current
    if (el) {
      el.style.opacity    = '0'
      el.style.transition = 'none'
      if (skipOpenMorph) {
        // Repoint: no geometric morph — the panel is already in place.
        el.style.transform = 'none'
      } else if (originRect) {
        const rect    = el.getBoundingClientRect()
        const modalCX = rect.left + rect.width  / 2
        const modalCY = rect.top  + rect.height / 2
        const cardCX  = originRect.left + originRect.width  / 2
        const cardCY  = originRect.top  + originRect.height / 2
        el.style.transform = `translate(${cardCX - modalCX}px, ${cardCY - modalCY}px) scale(${originRect.width / rect.width})`
      } else {
        el.style.transform = 'scale(0.92)'
      }
    }
    if (bd) { bd.style.opacity = '0'; bd.style.transition = 'none' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: animate in
  useEffect(() => {
    const el = modalRef.current
    const bd = backdropRef.current
    const id = requestAnimationFrame(() => {
      if (el) {
        if (skipOpenMorph) {
          el.style.transition = `opacity ${REPOINT_FADE_MS}ms ease`
          el.style.transform  = 'none'
          el.style.opacity    = '1'
        } else {
          el.style.transition = `transform ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1), opacity ${TRANSITION_MS}ms ease`
          el.style.transform  = 'none'
          el.style.opacity    = '1'
        }
      }
      if (bd) {
        bd.style.transition = `opacity ${TRANSITION_MS}ms ease`
        bd.style.opacity    = '0.6'
      }
    })
    return () => cancelAnimationFrame(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 3: animate out, then onClose
  return useCallback(() => {
    const el = modalRef.current
    const bd = backdropRef.current
    if (!el) { onClose(); return }
    // Aim at the node's current rect; fall back to the open-time rect.
    const targetRect = (getCloseRectRef.current && getCloseRectRef.current()) || originRect
    if (targetRect) {
      const rect    = el.getBoundingClientRect()
      const modalCX = rect.left + rect.width  / 2
      const modalCY = rect.top  + rect.height / 2
      const cardCX  = targetRect.left + targetRect.width  / 2
      const cardCY  = targetRect.top  + targetRect.height / 2
      el.style.transition = `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${TRANSITION_MS}ms ease`
      el.style.transform  = `translate(${cardCX - modalCX}px, ${cardCY - modalCY}px) scale(${targetRect.width / rect.width})`
    } else {
      el.style.transition = `transform ${TRANSITION_MS}ms ease, opacity ${TRANSITION_MS}ms ease`
      el.style.transform  = 'scale(0.92)'
    }
    el.style.opacity = '0'
    if (bd) { bd.style.transition = `opacity ${TRANSITION_MS}ms ease`; bd.style.opacity = '0' }
    setTimeout(onClose, TRANSITION_MS)
  }, [originRect, onClose, modalRef, backdropRef])
}
