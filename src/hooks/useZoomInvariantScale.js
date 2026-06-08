import { useViewport } from 'reactflow'

// Counter-scale factor that cancels the canvas zoom so an element rendered
// INSIDE the zoomable canvas layer (e.g. a toolbar living inside a custom
// node) holds a constant on-screen size at every zoom level.
//
// The canvas scales everything in its viewport by `zoom`; multiplying an
// element's transform by 1/zoom undoes that, leaving it screen-fixed. This is
// the same idea CampaignNode uses to keep card titles legible when zoomed out.
//
// Only valid for components rendered as descendants of <ReactFlow> — that's
// where `useViewport` has context. Screen-layer overlays (rendered as direct
// children of <ReactFlow>, outside the transformed viewport) are already
// constant-size and don't need this.
export function useZoomInvariantScale() {
  const { zoom } = useViewport()
  return zoom > 0 ? 1 / zoom : 1
}
