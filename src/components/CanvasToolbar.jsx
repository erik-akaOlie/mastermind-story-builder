import { forwardRef } from 'react'

// Fixed on-screen gap (px) a floating canvas toolbar leaves between itself and
// the element/selection it's attached to. Shared so every canvas toolbar sits
// the same distance off its anchor.
export const TOOLBAR_GAP_PX = 8

// Margin (px) a floating toolbar keeps from the window edges when clamped.
export const TOOLBAR_MARGIN_PX = 8

// Shared edge-aware placement for floating canvas toolbars. Given the anchor's
// screen rect and the toolbar's measured screen size, returns the toolbar's
// screen-space top-left so it floats centered above the anchor by `gap`, flips
// below if it would clip the top of the window, and clamps left/right/bottom to
// stay in-window. Both the multi-select alignment toolbar (screen-layer) and
// the text-block formatting toolbar (in-canvas, mapped back through zoom) use
// this so their behavior can't drift apart.
//   anchorRect: { left, top, bottom, width } in screen px (a DOMRect works)
//   size:       { w, h } toolbar size in screen px
export function placeFloatingToolbar(anchorRect, size, {
  gap = TOOLBAR_GAP_PX,
  margin = TOOLBAR_MARGIN_PX,
} = {}) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const centerX = anchorRect.left + anchorRect.width / 2
  let left = centerX - size.w / 2
  let top = anchorRect.top - gap - size.h
  if (top < margin) top = anchorRect.bottom + gap   // flip below the anchor
  left = Math.min(Math.max(left, margin), vw - size.w - margin)
  top = Math.min(Math.max(top, margin), vh - size.h - margin)
  return { left, top }
}

// Shared visual shell for floating canvas toolbars — the text-block formatting
// toolbar and the multi-select alignment toolbar both render their controls
// inside one of these, so they're visually identical and future canvas
// toolbars inherit the look for free. Callers own positioning (one lives
// inside a zoomable node and counter-scales; the other is a screen-layer
// overlay); this component owns only the container styling.
export const CanvasToolbar = forwardRef(function CanvasToolbar(
  { children, className = '', style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1.5 ${className}`}
      style={{ whiteSpace: 'nowrap', ...style }}
      {...rest}
    >
      {children}
    </div>
  )
})

// Thin vertical rule used to group controls within a CanvasToolbar.
export function ToolbarDivider() {
  return <div className="w-px h-4 bg-gray-200 mx-1" />
}
