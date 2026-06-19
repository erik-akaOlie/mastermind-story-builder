// ============================================================================
// workspaceSnapshot — capture the ENTIRE knowledge graph to an image.
// ----------------------------------------------------------------------------
// Used to auto-generate a workspace's fallback cover (the picture shown on the
// CampaignPicker tile when the user hasn't set a custom cover). Captures ALL
// nodes — not just the visible viewport — using the documented React Flow
// "export whole graph to image" recipe:
//
//   bounding box of every node → transform that fits that box into the target
//   frame → render the .react-flow__viewport at that transform via html-to-image.
//
// Works because onlyRenderVisibleElements is off (App.jsx), so every node is in
// the DOM regardless of scroll/zoom. Readability isn't the goal; a faithful
// crammed overview is. Returns a PNG data URL, or null when there's nothing to
// capture (no nodes / no canvas mounted).
// ============================================================================

import { getRectOfNodes, getTransformForBounds } from 'reactflow'
import { toPng } from 'html-to-image'
import { DEFAULT_CANVAS_COLOR } from './canvasColor.js'

// 16:9 at the same resolution as a custom cover (1536×864), so the `full`
// variant the picker tiles render is crisp. transcodeImage also derives a
// 256px thumb for small contexts (the switcher circles).
const SNAPSHOT_W = 1536
const SNAPSHOT_H = 864

// `backgroundColor` defaults to the global canvas color but is overridable so a
// future per-workspace canvas color flows straight through (the viewport is
// transparent and excludes the dotted Background layer, so we paint it in).
export async function captureGraphSnapshot(
  nodes,
  { width = SNAPSHOT_W, height = SNAPSHOT_H, backgroundColor = DEFAULT_CANVAS_COLOR } = {},
) {
  const viewport = document.querySelector('.react-flow__viewport')
  if (!viewport || !nodes || nodes.length === 0) return null

  // Fit the whole graph. minZoom tiny so a large map crams in rather than
  // clamping; 10% padding so nothing kisses the edge.
  const bounds = getRectOfNodes(nodes)
  const [tx, ty, scale] = getTransformForBounds(bounds, width, height, 0.02, 2, 0.1)

  return toPng(viewport, {
    backgroundColor,
    width,
    height,
    cacheBust: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    },
  })
}
