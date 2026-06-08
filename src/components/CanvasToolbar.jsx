import { forwardRef } from 'react'

// Fixed on-screen gap (px) a floating canvas toolbar leaves between itself and
// the element/selection it's attached to. Shared so every canvas toolbar sits
// the same distance off its anchor.
export const TOOLBAR_GAP_PX = 8

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
