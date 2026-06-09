import { useLayoutEffect, useRef, useState } from 'react'
import { useViewport, useReactFlow } from 'reactflow'
import {
  AlignLeft, AlignCenterVertical, AlignRight,
  AlignTop, AlignCenterHorizontal, AlignBottom,
  Columns, Rows,
} from '@phosphor-icons/react'
import { useCanvasUiStore } from '../store/useCanvasUiStore'
import { CanvasToolbar, ToolbarDivider, placeFloatingToolbar } from './CanvasToolbar.jsx'

// Canonical fallback dimensions when React Flow hasn't measured a node yet.
const CARD_W = 256, CARD_H = 180, TEXT_W = 256, TEXT_H = 96

// Icon ↔ action mapping uses the intuitive "line orientation = movement axis"
// reading (deliberately inverted from Phosphor's literal naming, which follows
// the Figma convention of naming the icon after the line objects align ONTO):
//   vertical line   → 'middle'   (objects move vertically onto a shared centerline)
//   horizontal line → 'center-h' (objects move horizontally onto a shared centerline)
const ALIGN_OPS = [
  { mode: 'left',     Icon: AlignLeft,             title: 'Align left edges' },
  { mode: 'center-h', Icon: AlignCenterHorizontal, title: 'Align horizontal centers' },
  { mode: 'right',    Icon: AlignRight,            title: 'Align right edges' },
  { mode: 'top',      Icon: AlignTop,              title: 'Align top edges' },
  { mode: 'middle',   Icon: AlignCenterVertical,   title: 'Align vertical centers' },
  { mode: 'bottom',   Icon: AlignBottom,           title: 'Align bottom edges' },
]
const DISTRIBUTE_OPS = [
  { mode: 'distribute-h', Icon: Columns, title: 'Distribute horizontally' },
  { mode: 'distribute-v', Icon: Rows,    title: 'Distribute vertically' },
]

// Floating toolbar for aligning / distributing a multi-node selection. Rendered
// as a screen-layer child of <ReactFlow> (outside the zoomable viewport), so
// it's constant-size for free and edge-clamping is plain screen-pixel math.
// Appears when 2+ card/text nodes are selected; distribute needs 3+.
export default function AlignmentToolbar({ onAlign }) {
  // Subscribing to the viewport makes the toolbar re-project (follow) on pan/zoom.
  const { zoom, x: panX, y: panY } = useViewport()
  const rf = useReactFlow()
  const selectedNodeIds = useCanvasUiStore((s) => s.selectedNodeIds)
  const draggingNodeId  = useCanvasUiStore((s) => s.draggingNodeId)
  const toolbarRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Measure the rendered toolbar so edge-aware placement can keep it in-window.
  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width !== size.w || r.height !== size.h) setSize({ w: r.width, h: r.height })
  })

  // Hide during an active drag — the toolbar would otherwise jitter as the
  // selection moves; it reappears at rest. Also hide for <2 selected.
  if (draggingNodeId || selectedNodeIds.size < 2) return null

  const selected = rf.getNodes().filter(
    (n) => selectedNodeIds.has(n.id) && (n.type === 'campaignNode' || n.type === 'textNode'),
  )
  if (selected.length < 2) return null

  // Selection bounding box in flow coords → project two corners to screen.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of selected) {
    const w = n.width  ?? (n.type === 'campaignNode' ? CARD_W : (n.data?.width  ?? TEXT_W))
    const h = n.height ?? (n.type === 'campaignNode' ? CARD_H : (n.data?.height ?? TEXT_H))
    minX = Math.min(minX, n.position.x);     minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + w); maxY = Math.max(maxY, n.position.y + h)
  }
  const tl = rf.flowToScreenPosition({ x: minX, y: minY })
  const br = rf.flowToScreenPosition({ x: maxX, y: maxY })

  // Edge-aware placement (centered above, flips below / clamps in-window).
  const anchorRect = { left: tl.x, top: tl.y, bottom: br.y, width: br.x - tl.x }
  const { left, top } = placeFloatingToolbar(anchorRect, size)

  const canDistribute = selected.length >= 3
  // suppress unused-var lint for the viewport values we depend on for re-render
  void zoom; void panX; void panY

  return (
    <div
      style={{
        position: 'fixed',
        left, top,
        zIndex: 50,
        pointerEvents: 'auto',
        visibility: size.w ? 'visible' : 'hidden',
      }}
      // Don't let toolbar clicks deselect the cards underneath.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <CanvasToolbar ref={toolbarRef}>
        {ALIGN_OPS.map(({ mode, Icon, title }) => (
          <button
            key={mode}
            title={title}
            className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            onClick={() => onAlign(mode)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Icon size={16} weight="bold" />
          </button>
        ))}

        <ToolbarDivider />

        {DISTRIBUTE_OPS.map(({ mode, Icon, title }) => (
          <button
            key={mode}
            title={canDistribute ? title : `${title} — needs 3+ selected`}
            disabled={!canDistribute}
            className={`p-1 rounded transition-colors ${
              canDistribute
                ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            onClick={() => canDistribute && onAlign(mode)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Icon size={16} weight="bold" />
          </button>
        ))}
      </CanvasToolbar>
    </div>
  )
}
