// ============================================================================
// HoverReveal
// ----------------------------------------------------------------------------
// Animates a child's inline width between 0 and its natural content width,
// so an expand-on-hover chip morphs smoothly from a circle into a pill.
//
// Uses the grid `0fr ↔ 1fr` technique: a single-column grid whose track
// animates between zero and content size, with the child clipped by
// `overflow-hidden`. Two properties of this approach matter here:
//
//   1. The child stays mounted in both states, so the transition has real
//      start/end values to interpolate (mount/unmount would just pop).
//   2. A CSS transition is interruptible and reverses FROM THE CURRENT FRAME.
//      If the open animation reaches 80% and the user mouses away, the close
//      animation runs 80% → 0% — no flash, no jump to the end first.
//
// Shared by the top-left breadcrumb (UserMenu) and the top-right search
// placeholder (SearchBar) so both expand-on-hover chips feel identical.
//
// The child should be `whitespace-nowrap` so it doesn't reflow while clipped.
// ============================================================================

export default function HoverReveal({ open, durationMs = 200, children }) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: open ? '1fr' : '0fr',
        transition: `grid-template-columns ${durationMs}ms ease-out`,
      }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}
