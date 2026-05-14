import { BaseEdge, getStraightPath } from 'reactflow'
import {
  useCanvasUiStore,
  selectIsEdgeActive,
  selectAnythingActive,
} from '../store/useCanvasUiStore'
import { MORPH_DURATION_MS } from '../utils/altitude'
import { useReducedMotion } from '../hooks/useReducedMotion'

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
  const morphPhase     = useCanvasUiStore((s) => s.morphPhase)
  // Reduced-motion accessibility (Chunk F): when set, the morph-fade
  // collapses to a zero-duration swap so the user doesn't see any line
  // animation during card↔bead transitions. Built as a per-render value
  // (rather than a module-level constant) because the OS-level setting
  // can change live and the hook re-renders on change.
  const reducedMotion  = useReducedMotion()
  const TRANSITION_MORPHING = `opacity ${(reducedMotion ? 0 : MORPH_DURATION_MS) / 2}ms ease`
  // Per-node hover-expand morph signal (Chunk D step 6). Narrow selector:
  // only re-renders THIS edge when one of ITS endpoints' phases changes —
  // unrelated nodes' phases never trigger an update here.
  const localMorphPhase = useCanvasUiStore((s) => {
    const m = s.nodeMorphPhases
    return m.get(source) ?? m.get(target) ?? null
  })
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

  // Compute the resting opacity (what the edge wants to be when no morph is
  // in flight): 1 if active or simply resting, 0.15 if dimmed because
  // something else has focus.
  let restingOpacity
  let restingTransition
  if (isEdgeActive) {
    restingOpacity = OPACITY_REST
    restingTransition = TRANSITION_ACTIVE
  } else if (anythingActive) {
    restingOpacity = OPACITY_DIMMED
    restingTransition = TRANSITION_DIMMING
  } else {
    restingOpacity = OPACITY_REST
    restingTransition = TRANSITION_RESTING
  }

  // Morph phase overrides the resting state. Two independent signals:
  //   - morphPhase (global)     — fires on canvas altitude crossings;
  //                                every edge fades.
  //   - localMorphPhase (per-node) — fires when one of THIS edge's two
  //                                  endpoints is mid-hover-expand;
  //                                only THIS edge fades.
  // Either signal in 'out' → opacity 0; either in 'in' → opacity returns
  // to resting; both null → resting timings untouched (carefully tuned for
  // seizure safety and snap-in feedback, preserved outside the morph).
  // 'out' takes priority over 'in' so a fresh morph-out wins if both
  // happen to be present at the exact moment of an effect fire.
  const activePhase = (morphPhase === 'out' || localMorphPhase === 'out')
    ? 'out'
    : (morphPhase === 'in' || localMorphPhase === 'in')
      ? 'in'
      : null

  let computedOpacity
  let transition
  if (activePhase === 'out') {
    computedOpacity = 0
    transition = TRANSITION_MORPHING
  } else if (activePhase === 'in') {
    computedOpacity = restingOpacity
    transition = TRANSITION_MORPHING
  } else {
    computedOpacity = restingOpacity
    transition = restingTransition
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
