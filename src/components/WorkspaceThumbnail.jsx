// ============================================================================
// WorkspaceThumbnail — the canonical workspace cover image.
// ----------------------------------------------------------------------------
// One place owns the render precedence so every surface stays in sync:
//
//     custom cover (cover_image_url)
//   → auto canvas snapshot (snapshot_path)
//   → bare canvas color  (empty workspace reads as "nothing on the canvas yet")
//
// `className` controls shape/size at the call site: a 16:9 rectangle on the
// CampaignPicker tiles, a small circle in the UserMenu switcher. Both render
// the same source through this component. `variant` picks the image size:
// `full` for the large picker tiles (default; avoids upscaling a 256px thumb),
// `thumb` for the small switcher circles.
// ============================================================================

import { useImageUrl } from '../lib/useImageUrl.js'
import { getWorkspaceCanvasColor } from '../lib/canvasColor.js'

export default function WorkspaceThumbnail({ workspace, className = '', variant = 'full' }) {
  const src = useImageUrl(workspace?.cover_image_url ?? workspace?.snapshot_path, { variant })

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ backgroundColor: getWorkspaceCanvasColor(workspace) }}
    >
      {src && (
        <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      )}
    </div>
  )
}
