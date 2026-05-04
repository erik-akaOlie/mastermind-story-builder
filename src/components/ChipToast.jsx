// ============================================================================
// ChipToast
// ----------------------------------------------------------------------------
// Single chip-toast inside the feedback-bar's slot. Owns its slide-in,
// fadeout, and hover-pause behavior. The store (useFeedbackToastStore) owns
// the lifecycle timers; this component owns the DOM-side animation state.
//
// Slide-in: pure CSS @keyframes (defined in index.css as
// `chip-toast-slide-in`) so the animation starts the same frame the element
// mounts — no React state ping-pong or RAF delay. The element settles at
// translateX(0), which is its natural flex position 8px past the
// SyncIndicator chip's right edge.
//
// Masking & "behind the chip" effect:
//   - FeedbackChipBar wraps the toast slot in `overflow: hidden` whose left
//     edge is the SyncIndicator chip's left edge → any part of the toast
//     that would render LEFT of the chip gets clipped.
//   - The SyncIndicator wrapper carries a higher z-index than this toast →
//     during the slide, where toast and chip overlap, the chip fully
//     occludes the toast. The toast emerges visually from the chip's right
//     edge.
//
// Fadeout: `opacity` transitions 1 → 0 over FADEOUT_MS (300ms) when the
// store flips `toast.exiting`. Hover-pause works in two stages:
//   1. mouseenter → store.pause() freezes the dismiss timer; if mid-fadeout,
//      we additionally snapshot the live opacity inline with `transition:
//      none` so the visual fade also freezes.
//   2. mouseleave → store.resume() restarts the timer; if mid-fadeout, we
//      re-enable the transition and clear the inline opacity so React's
//      managed `opacity: 0` takes over and the fade continues from the
//      snapshotted point.
// ============================================================================

import { useRef } from 'react'
import FeedbackChip from './FeedbackChip.jsx'
import { useFeedbackToastStore, FADEOUT_MS } from '../store/useFeedbackToastStore.js'

const SLIDE_DURATION_MS = 250

export default function ChipToast({ toast, stackIndex }) {
  const ref = useRef(null)
  const pause = useFeedbackToastStore((s) => s.pause)
  const resume = useFeedbackToastStore((s) => s.resume)

  function handleMouseEnter() {
    pause(toast.id)
    if (toast.exiting && ref.current) {
      // Mid-fadeout: read live opacity from the in-progress transition,
      // freeze it inline with no transition. mouseleave undoes this.
      const el = ref.current
      const live = window.getComputedStyle(el).opacity
      el.style.transition = 'none'
      el.style.opacity = live
    }
  }

  function handleMouseLeave() {
    if (toast.exiting && ref.current) {
      const el = ref.current
      // Force a reflow so the browser commits the frozen state, then re-
      // enable the transition. Clearing inline opacity lets the
      // React-managed value (0, since exiting) take over again under
      // the fadeout transition.
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetWidth
      el.style.transition = `opacity ${FADEOUT_MS}ms linear`
      el.style.opacity = ''
    }
    resume(toast.id)
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        // Each toast sits BELOW the SyncIndicator wrapper's z-50 so the
        // chip occludes it during slide-in. Newer toasts sit above older
        // ones during the brief cross-fade when a new push triggers an
        // older one to exit.
        zIndex: 30 - stackIndex,
        opacity: toast.exiting ? 0 : 1,
        transition: `opacity ${FADEOUT_MS}ms linear`,
        // Slide-in plays once on mount (CSS keyframes — see index.css).
        // After it completes, the element rests at translateX(0) which
        // is the natural flex-positioned spot. Re-renders that don't
        // change this string don't restart the animation.
        animation: `chip-toast-slide-in ${SLIDE_DURATION_MS}ms ease-out`,
        pointerEvents: 'auto',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <FeedbackChip variant={toast.variant} icon={toast.icon}>{toast.content}</FeedbackChip>
    </div>
  )
}
