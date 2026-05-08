// ============================================================================
// FeedbackChip
// ----------------------------------------------------------------------------
// Pill-shaped notification body that visually mirrors the SyncIndicator chip,
// so the bottom-left corner reads as one cohesive feedback system: the
// SyncIndicator reports ambient save status, and toast-rendered chips report
// transient events (undid/redid/save-failed). Same shape, same materials,
// just different text colors per variant.
//
// Used by:
//   - src/lib/undoToasts.jsx — undo / redo / conflict notifications
//   - src/lib/errorReporting.js — persist-write final-failure notification
//
// Pair with SyncIndicator's class string (currently lives in
// src/components/SyncIndicator.jsx). If the chip aesthetic ever shifts, both
// places should change together.
// ============================================================================

const VARIANT_TEXT_COLORS = {
  // Subtle gray — same family as SyncIndicator's text-gray-500 but slightly
  // darker to signal "an event just happened" vs "ongoing status."
  info:  'text-gray-700',
  // Amber — drift / conflict warning (something didn't apply because the
  // world changed). Visible without screaming.
  warn:  'text-amber-700',
  // Red — outright failure (e.g. persist write that didn't recover after
  // retries). Strongest urgency in the family.
  error: 'text-red-600',
}

export default function FeedbackChip({ variant = 'info', children }) {
  const textColor = VARIANT_TEXT_COLORS[variant] ?? VARIANT_TEXT_COLORS.info
  return (
    <div
      className={`px-3 py-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm border border-gray-200 text-xs ${textColor} select-none whitespace-nowrap`}
      role="status"
    >
      {children}
    </div>
  )
}
