// ============================================================================
// FeedbackChipBar
// ----------------------------------------------------------------------------
// The bottom-left "what's happening" strip. Reads as a single feedback
// surface composed of two parts:
//
//   [SyncIndicator] [ToastSlot — masked, overflow-hidden]
//        ^                ^
//        |                |
//        ambient save     transient action feedback
//        status chip      (undo/redo success, conflicts, save fail)
//
// Layout: a fixed flex row with an 8px gap. The whole bar is wrapped in
// `overflow: hidden` so its left edge IS the masking boundary — any part
// of a toast that would render left of the SyncIndicator chip's left edge
// is clipped. This is what makes the slide-in look like the toast emerges
// from behind the chip even when the toast is wider than the chip.
//
// The bar is given an explicit width via `w-[640px]` so its right edge
// extends well past where any toast settles; without that, the natural
// width (chip + gap + 0-width toast slot) would clip the toast on the
// right immediately. The bar's outer pointer-events-none ensures the
// 640px invisible region doesn't intercept canvas clicks; only the chip
// and toasts (which set pointer-events-auto) react to hover/click.
//
// Z-order inside the bar:
//   - SyncIndicator wrapper z-50 — always on top of any toast
//   - ChipToast            z-30 and below — occluded by the chip during
//                                            slide-in
//
// Mounted once in main.jsx, replacing what used to be a bare
// <SyncIndicator /> + Sonner Toaster combo.
// ============================================================================

import SyncIndicator from './SyncIndicator.jsx'
import ChipToast from './ChipToast.jsx'
import { useFeedbackToastStore } from '../store/useFeedbackToastStore.js'

export default function FeedbackChipBar() {
  const toasts = useFeedbackToastStore((s) => s.toasts)

  return (
    <div
      className="fixed bottom-4 left-4 z-30 pointer-events-none overflow-hidden"
      style={{ width: '640px', height: '30px' }}
    >
      <div className="flex items-end gap-2 h-full">
        {/*
          SyncIndicator wrapper — z-50 so the chip sits on top of any toast
          beneath it. Without this, a toast at translateX(-200) would
          render OVER the chip during slide-in instead of emerging from
          behind it.
        */}
        <div className="relative z-50 pointer-events-auto">
          <SyncIndicator />
        </div>
        {/*
          Toast slot. width:0 + position:relative makes it a positioning
          anchor at "8px right of the chip" (the gap), without claiming
          any layout width itself. ChipToasts inside use position:absolute
          + translateX so they animate into a single slot — older toasts
          that aren't yet faded out share the same spot, briefly cross-
          fading with the new arrival.
        */}
        <div className="relative h-full" style={{ width: 0 }}>
          {toasts.map((toast, index) => (
            <ChipToast key={toast.id} toast={toast} stackIndex={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
