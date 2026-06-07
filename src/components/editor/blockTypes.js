// ============================================================================
// blockTypes — the single list of block types MasterMind lets users convert
// between, with their product-facing labels (Chunk F5a).
// ----------------------------------------------------------------------------
// ONE source of truth, consumed by every surface where a user changes a block's
// type, so the list + labels stay identical everywhere (decision F5a-1):
//   • the 6-dot menu's "Turn into ▶" submenu        (blockControls.jsx, F5a)
//   • the floating formatting toolbar's type select  (blockControls.jsx, F5a)
//   • the "/" slash menu                             (relabeled to match in F5b)
//
// `type` / `props` are BlockNote's native primitives; `label` is MasterMind's
// product language. Note "Callout" maps to the native `quote` block via
// CALLOUT_BLOCK_TYPE — see blockSchema.jsx for why we alias rather than fork.
//
// Heading levels are intentionally limited to H1/H2 (the levels F2 styles);
// H3–H6 are slated to be hidden in F6, so offering them here would contradict
// that. Image Album / Connections are excluded — they aren't text blocks a user
// converts into. Array order = display order.
// ============================================================================

import {
  TextT,
  TextHOne,
  TextHTwo,
  ListBullets,
  ListNumbers,
  ListChecks,
  AlignLeftSimple,
} from '@phosphor-icons/react'
import { CALLOUT_BLOCK_TYPE } from './blockSchema.jsx'

export const BLOCK_TYPES = [
  { key: 'paragraph', label: 'Text', type: 'paragraph', props: {}, icon: TextT },
  { key: 'heading1', label: 'Heading 1', type: 'heading', props: { level: 1 }, icon: TextHOne },
  { key: 'heading2', label: 'Heading 2', type: 'heading', props: { level: 2 }, icon: TextHTwo },
  { key: 'bullet', label: 'Bullet List', type: 'bulletListItem', props: {}, icon: ListBullets },
  { key: 'numbered', label: 'Numbered List', type: 'numberedListItem', props: {}, icon: ListNumbers },
  { key: 'check', label: 'Check List', type: 'checkListItem', props: {}, icon: ListChecks },
  { key: 'callout', label: 'Callout', type: CALLOUT_BLOCK_TYPE, props: {}, icon: AlignLeftSimple },
]
