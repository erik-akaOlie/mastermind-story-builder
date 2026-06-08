// ============================================================================
// blockTypeAdapters — the shared layer that turns the canonical block-type lists
// (blockTypes.js → BLOCK_TYPES + MEDIA_BLOCKS) into the item shape each
// block-selection SURFACE needs (Chunk F5b; MEDIA_BLOCKS added F5e).
// ----------------------------------------------------------------------------
// Architecture (agreed F5b): labels / types / props / icons are single-sourced in
// blockTypes.js; only the ACTION differs per surface and lives in a thin adapter
// here. The seam is deliberate — sharing the action would be the wrong abstraction
// because the surfaces do semantically different things:
//   • Slash menu ("/")        → INSERT-or-convert the current block   (this file, F5b)
//   • 6-dot "Turn into"        → CONVERT the current block             (blockControls.jsx)
//
// Both block-type surfaces derive from the blockTypes.js lists through this layer
// (text blocks from BLOCK_TYPES; media blocks from MEDIA_BLOCKS, F5e). The floating
// formatting toolbar is deliberately NOT a third: F5d removed
// its block-type control entirely (inspectorEditor.css rule 11), positioning the toolbar
// as a TEXT-FORMATTING-only surface. The F5d spike confirmed relabeling or removing that
// control via the supported API would have required a custom FormattingToolbarController
// (the suspected F5a-crash mechanism — see blockControls.jsx); a CSS hide killed the
// duplication AND the risk instead. So "every block-type surface derives from
// blockTypes.js" now holds by subtraction, not by adding a fourth adapter.
//
// HARD RULE: never hand-list block types here. Add/remove a type in blockTypes.js
// ONLY; this layer follows. A second list would reintroduce the split this file
// exists to prevent.
// ============================================================================

import { insertOrUpdateBlockForSlashMenu, filterSuggestionItems } from '@blocknote/core'
import { BLOCK_TYPES, MEDIA_BLOCKS } from './blockTypes.js'

// Slash menu ("/"): each canonical type → a BlockNote suggestion item. Clicking it
// converts the current (slash-trigger) block into that type, or inserts it — this
// is exactly what BlockNote's own default slash items use
// (`insertOrUpdateBlockForSlashMenu`), so the behavior matches the editor's native
// slash UX; we only change WHICH types are offered + their labels.
// `filterSuggestionItems` applies BlockNote's own title + alias matching against
// the typed query, so "/h1" still finds "Heading 1" and "/quote" still finds "Callout".
//
// MEDIA_BLOCKS (F5e) are appended after the text blocks and carry a `group: 'Media'`
// so BlockNote renders them in a separate, labeled section at the bottom. They use the
// SAME insertOrUpdateBlockForSlashMenu helper, which is intentionally non-destructive:
// on an empty (slash-trigger) block it converts in place; on a block that already has
// text it inserts the media block BELOW, leaving the text intact (verified against the
// helper source). So unlike "Turn into", the slash menu never disables a media block.
function toSlashItem(editor, bt, group) {
  const Icon = bt.icon
  return {
    title: bt.label,
    aliases: bt.aliases,
    ...(group ? { group } : {}),
    icon: <Icon size={18} />,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: bt.type, props: bt.props }),
  }
}

export function getSlashMenuItems(editor, query) {
  const items = [
    ...BLOCK_TYPES.map((bt) => toSlashItem(editor, bt)),
    ...MEDIA_BLOCKS.map((bt) => toSlashItem(editor, bt, 'Media')),
  ]
  return filterSuggestionItems(items, query)
}
