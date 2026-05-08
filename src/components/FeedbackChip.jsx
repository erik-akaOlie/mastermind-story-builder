// ============================================================================
// FeedbackChip
// ----------------------------------------------------------------------------
// Pill-shaped toast body. Pairs with the SyncIndicator chip in the bottom-
// left feedback bar but is visually distinct: where the SyncIndicator is
// light/frosted (ambient "edited Nm ago" status), the toast is dark with
// white text — a transient action event (undid / redid / couldn't save).
// The contrast separates "what just happened" from "where things stand."
//
// Optional `icon` (a Phosphor component reference, e.g. ArrowUUpLeft)
// renders before the text. Used to replace the verbose "Undid:" / "Redid:"
// prefix in success toasts with a glyph; warn / error toasts pass no icon
// and lead with their text directly.
//
// `variant` is retained as a prop for future variant-specific accents
// (e.g. tinting the icon amber for conflict toasts) but currently all
// variants share the dark+white treatment.
//
// Used by:
//   - src/lib/feedbackToasts.jsx — undo / redo / conflict / save-fail
//   - rendered inside src/components/ChipToast.jsx (which owns animation)
// ============================================================================

export default function FeedbackChip({ variant = 'info', icon: Icon, children }) {
  // Reserved for future per-variant accents. Kept here (not stripped) so
  // adding a tint later is a one-line change that doesn't break callers.
  void variant
  return (
    <div
      className="px-3 py-1.5 bg-gray-900/95 backdrop-blur rounded-full shadow-md text-xs text-white select-none whitespace-nowrap inline-flex items-center gap-1.5"
      role="status"
    >
      {Icon && <Icon size={14} weight="bold" className="shrink-0" />}
      <span>{children}</span>
    </div>
  )
}
