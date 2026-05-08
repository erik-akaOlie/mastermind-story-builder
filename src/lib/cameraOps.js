// ============================================================================
// cameraOps
// ----------------------------------------------------------------------------
// Singleton bridge that lets the toast layer (which lives outside App's
// CanvasOpsProvider in the React tree) trigger camera moves on App's React
// Flow instance. App registers an implementation in a useEffect once
// `onInit` has supplied the rfInstance; the toast click handler calls
// `panToTarget(target)` which forwards to that implementation.
//
// Module-scope mutable state is the right shape here: there is exactly one
// canvas in the app at a time, and the function reference doesn't need to
// participate in React rendering — it just needs to exist when the user
// clicks a toast.
//
// Target shape — all fields optional, derived in feedbackToasts.jsx from
// the undo/redo entry:
//   {
//     ids: string[]              // node ids to fitView together
//     fallbackPosition?: {x, y}  // canvas coords to setCenter on if every
//                                // id in `ids` has been removed (deleted-
//                                // card / deleted-text-node redo case)
//   }
// ============================================================================

let _impl = null

export function setPanToTargetImpl(fn) {
  _impl = fn
}

export function panToTarget(target) {
  if (typeof _impl === 'function') _impl(target)
}
