// ============================================================================
// crossZoneDragGuard — block block-drags BETWEEN the two zone editors (F5g)
// ----------------------------------------------------------------------------
// DATA-LOSS PREVENTION (not a UX feature). Card View and GM's Eyes Only are two
// independent BlockNote editors. BlockNote's cross-editor "move" (insert in the
// destination + a deferred, selection-based deleteSelection in the source) is
// selection/timing-fragile across two stacked editors and silently drops blocks
// (see the F5g diagnosis). We disable cross-zone drops while leaving WITHIN-zone
// reordering fully intact.
//
// HOW: window-level CAPTURE listeners. BlockNote registers its document-level drop
// handler with capture:true (SideMenu.ts), so to intercept first we go one level
// up — a capture listener on `window` fires before any document-level capture
// listener, regardless of registration order.
//   • dragstart → record which zone editor (.mm-zone-editor) the drag began in.
//   • dragover  → if it's a BlockNote block-drag now over a DIFFERENT zone editor
//                 (or outside any), stopImmediatePropagation so BlockNote never
//                 calls preventDefault → the area is not a valid drop target → the
//                 browser won't fire a drop there at all (no insert, no source
//                 delete). We do NOT preventDefault here (that would ALLOW a drop).
//   • drop      → belt-and-suspenders: if one slips through, preventDefault +
//                 stopImmediatePropagation to block BlockNote's onDrop entirely.
//   • dragend   → clear the recorded origin.
//
// Within-zone reorder: origin and destination resolve to the SAME .mm-zone-editor,
// so we never intervene and BlockNote handles it normally.
//
// Gated on the `blocknote/html` dataTransfer type, so non-block drags (file drops,
// dnd-kit pointer reorders in the bullet/media sections, text selection drags) are
// never affected.
// ============================================================================

const ZONE_SELECTOR = '.mm-zone-editor'

// Pure decision core (unit-tested): block when a BlockNote block-drag that started
// in a zone editor is over a DIFFERENT zone editor, or over nothing (dropped
// outside any zone — which would otherwise delete the source into the void).
export function shouldBlockCrossZone({ originEl, destEl, isBlockDrag }) {
  if (!originEl) return false // drag didn't start in a zone editor
  if (!isBlockDrag) return false // not a BlockNote block-drag
  return destEl !== originEl // different editor (or null) → cross-zone → block
}

let originEl = null

function zoneEditorOf(target) {
  const el = target instanceof Element ? target : null
  return el ? el.closest(ZONE_SELECTOR) : null
}

function isBlockDragEvent(event) {
  const types = event.dataTransfer?.types
  if (!types) return false
  // DataTransfer.types is a DOMStringList in some browsers, array-like in others.
  return Array.prototype.indexOf.call(types, 'blocknote/html') >= 0
}

function onDragStart(event) {
  originEl = zoneEditorOf(event.target)
}

function onDragOver(event) {
  if (
    shouldBlockCrossZone({
      originEl,
      destEl: zoneEditorOf(event.target),
      isBlockDrag: isBlockDragEvent(event),
    })
  ) {
    // Do NOT preventDefault — leaving the default keeps the area a non-drop-target,
    // so no drop event fires here. Stop BlockNote's handlers from allowing it.
    event.stopImmediatePropagation()
  }
}

function onDrop(event) {
  if (
    shouldBlockCrossZone({
      originEl,
      destEl: zoneEditorOf(event.target),
      isBlockDrag: isBlockDragEvent(event),
    })
  ) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}

function onDragEnd() {
  originEl = null
}

let refCount = 0

export function installCrossZoneDragGuard() {
  refCount += 1
  if (refCount > 1) return
  window.addEventListener('dragstart', onDragStart, true)
  window.addEventListener('dragover', onDragOver, true)
  window.addEventListener('drop', onDrop, true)
  window.addEventListener('dragend', onDragEnd, true)
}

export function uninstallCrossZoneDragGuard() {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) return
  window.removeEventListener('dragstart', onDragStart, true)
  window.removeEventListener('dragover', onDragOver, true)
  window.removeEventListener('drop', onDrop, true)
  window.removeEventListener('dragend', onDragEnd, true)
  originEl = null
}
