// ============================================================================
// blockTypeAdapters — the shared layer that turns the ONE canonical block-type
// list (blockTypes.js → BLOCK_TYPES) into the item shape each block-selection
// SURFACE needs (Chunk F5b).
// ----------------------------------------------------------------------------
// Architecture (agreed F5b): labels / types / props / icons are single-sourced in
// blockTypes.js; only the ACTION differs per surface and lives in a thin adapter
// here. The seam is deliberate — sharing the action would be the wrong abstraction
// because the surfaces do semantically different things:
//   • Slash menu ("/")        → INSERT-or-convert the current block   (this file, F5b)
//   • 6-dot "Turn into"        → CONVERT the current block             (blockControls.jsx)
//   • Toolbar Block Type Select→ CONVERT the current block            (sibling adapter, F5c)
//
// The toolbar adapter is deferred to F5c purely as RISK SEQUENCING (wiring a custom
// FormattingToolbarController is the suspected F5a-crash mechanism — see
// blockControls.jsx). It is NOT a separate architecture: when it lands it derives
// from BLOCK_TYPES through this same layer. BlockNote 0.51 supports it via
// `BlockTypeSelect`'s `blockTypeSelectItems` prop (verified), so F5c is a small
// plug-in, not a rebuild.
//
// HARD RULE: never hand-list block types here. Add/remove a type in blockTypes.js
// ONLY; this layer follows. A second list would reintroduce the split this file
// exists to prevent.
// ============================================================================

import { insertOrUpdateBlockForSlashMenu, filterSuggestionItems } from '@blocknote/core'
import { BLOCK_TYPES } from './blockTypes.js'

// Slash menu ("/"): each canonical type → a BlockNote suggestion item. Clicking it
// converts the current (slash-trigger) block into that type, or inserts it — this
// is exactly what BlockNote's own default slash items use
// (`insertOrUpdateBlockForSlashMenu`), so the behavior matches the editor's native
// slash UX; we only change WHICH types are offered + their labels.
// `filterSuggestionItems` applies BlockNote's own title + alias matching against
// the typed query, so "/h1" still finds "Heading 1" and "/quote" still finds "Callout".
export function getSlashMenuItems(editor, query) {
  const items = BLOCK_TYPES.map((bt) => {
    const Icon = bt.icon
    return {
      title: bt.label,
      aliases: bt.aliases,
      icon: <Icon size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: bt.type, props: bt.props }),
    }
  })
  return filterSuggestionItems(items, query)
}
