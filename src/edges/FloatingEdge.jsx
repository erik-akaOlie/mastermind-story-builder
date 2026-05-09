import { BaseEdge, getStraightPath } from 'reactflow'
import {
  useCanvasUiStore,
  selectIsEdgeActive,
  selectAnythingActive,
} from '../store/useCanvasUiStore'

// Opacity tiers — match the card-side values in CampaignNode.jsx so cards
// and their connection lines fade together.
const OPACITY_DIMMED = 0.15
const OPACITY_REST   = 1

// Transition strings mirror CampaignNode's three-state opacity timing so
// edges and their endpoint cards animate as a single visual unit.
const TRANSITION_ACTIVE   = 'opacity 180ms ease-out'                  // snap-in (no delay)
const TRANSITION_DIMMING  = 'opacity 260ms ease-in-out 90ms'          // gentle pull-back
const TRANSITION_RESTING  = 'opacity 500ms ease-in-out 90ms'          // slow return to rest

export default function FloatingEdge({ source, target, data, style, selected }) {
  // Subscribe with narrow selectors so this edge only re-renders when its own
  // active status (or the global "anything active" flag) flips — not on
  // unrelated hovers elsewhere on the canvas.
  const isEdgeActive   = useCanvasUiStore(selectIsEdgeActive(source, target))
  const anythingActive = useCanvasUiStore(selectAnythingActive)
  // True when the user is hovering THIS edge specifically (both endpoints are
  // in the hovered-edge set). Used to bump strokeWidth a hair, replacing the
  // legacy setEdges-based hover bump that lived in useNodeHoverSelection.
  const isThisEdgeHovered = useCanvasUiStore((s) =>
    !!s.hoveredEdgeNodeIds?.has(source) && !!s.hoveredEdgeNodeIds?.has(target)
  )

  if (!data?.sourcePoint || !data?.targetPoint) return null

  const [path] = getStraightPath({
    sourceX: data.sourcePoint.x,
    sourceY: data.sourcePoint.y,
    targetX: data.targetPoint.x,
    targetY: data.targetPoint.y,
  })

  // Three opacity tiers + matching transition timing, mirroring the card model:
  //   - active   (one or both endpoints are hovered / edge-hovered / selected) → 1, snap-in
  //   - dimming  (something else is active — this edge is out of focus)        → 0.15, gentle
  //   - resting  (nothing on the canvas is active right now)                   → 1, slow return
  let computedOpacity
  let transition
  if (isEdgeActive) {
    computedOpacity = OPACITY_REST
    transition = TRANSITION_ACTIVE
  } else if (anythingActive) {
    computedOpacity = OPACITY_DIMMED
    transition = TRANSITION_DIMMING
  } else {
    computedOpacity = OPACITY_REST
    transition = TRANSITION_RESTING
  }

  const stroke = style?.stroke || '#94a3b8'
  // Bump the directly-hovered edge a hair thicker. Selected edges stay thicker
  // too (existing behavior).
  const strokeWidth = isThisEdgeHovered ? 2 : (selected ? 2 : 1.5)

  // Spread `style` (any caller-supplied overrides) BEFORE our computed values
  // so opacity / strokeWidth / transition can never be silently overridden by
  // a caller passing `undefined` for those keys. That was the source of the
  // "edges stop dimming after the first edge hover" bug — the old hover-leave
  // handler was setting style.opacity=undefined on every edge, which would
  // override our computed value via the spread. Putting our values last
  // guarantees our intent wins.
  return (
    <BaseEdge
      path={path}
      style={{
        ...style,
        stroke,
        strokeWidth,
        opacity: computedOpacity,
        transition,
      }}
    />
  )
}
