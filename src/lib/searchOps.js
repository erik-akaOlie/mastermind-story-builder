// ============================================================================
// searchOps
// ----------------------------------------------------------------------------
// Singleton bridge that lets the search UI (SearchBar + SearchResultsDrawer,
// which live OUTSIDE App in the React tree — siblings of the canvas, like the
// toast layer) reach App's node state, camera, and Inspector. Same shape as
// cameraOps.js: App registers an implementation object once the canvas is
// mounted; the search components call the exported functions. Module-scope
// mutable state is right here for the same reason — exactly one canvas at a
// time, and the reference doesn't participate in React rendering.
//
// The implementation object App registers:
//   getEntries()            → [{ id, title, typeKey, avatar, hideAvatar }]
//                             for every card node in the active workspace
//                             (text blocks are not searchable in beta).
//   resultsOpened()         → async. Called when the results drawer opens.
//                             App commits + flushes any open Inspector's
//                             pending edits (incl. block-editor zones), closes
//                             it, and remembers its topic node for restore.
//   resultsClosed({selected}) → called when the drawer closes. selected=false
//                             (dismissed via X/Esc) restores the remembered
//                             Inspector; selected=true skips the restore.
//   openNode(nodeId)        → selects the node, moves the camera so it's
//                             centered in the work area (standing rule:
//                             left of the reserved Inspector band), and opens
//                             the Inspector on it. Returns false if the node
//                             no longer exists.
// ============================================================================

let _impl = null

export function setSearchOpsImpl(impl) {
  _impl = impl
}

export function getSearchEntries() {
  return _impl?.getEntries?.() ?? []
}

export async function notifySearchResultsOpened() {
  return _impl?.resultsOpened?.()
}

export function notifySearchResultsClosed({ selected = false } = {}) {
  _impl?.resultsClosed?.({ selected })
}

export function openNodeFromSearch(nodeId) {
  return _impl?.openNode?.(nodeId) ?? false
}
